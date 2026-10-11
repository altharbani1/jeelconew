import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, UserRole, Permission, ROLE_PERMISSIONS } from '../types';
import { supabase } from '../services/supabaseClient';
import { loggerService } from '../services/loggerService';

interface CloudIdentity { id: string; email: string; company_id?: string; role?: string; }
interface AuthContextType { currentUser: User | null; users: User[]; login: (username: string, pass: string) => Promise<boolean>; logout: () => Promise<void>; addUser: (user: User, password?: string) => Promise<void>; updateUser: (user: User, password?: string) => Promise<void>; deleteUser: (id: string) => Promise<void>; isAdmin: boolean; hasPermission: (permission: Permission) => boolean; }
const AuthContext = createContext<AuthContextType | undefined>(undefined);
const USERS_KEY = 'jilco_system_users';
const withoutPassword = (user: User): User => { const { password: _password, ...safe } = user; return safe; };
const roleOf = (role?: string): UserRole => ['admin', 'manager', 'sales', 'accountant', 'technician'].includes(role || '')
  ? role as UserRole
  : 'technician';

// This is the only client entry point for privileged user administration. The Edge Function
// performs auth.admin operations server-side; passwords never enter localStorage or backups.
const invokeAdminUsers = async (action: string, payload: Record<string, unknown> = {}) => {
  // Keep the browser client on the deployed, JWT-verified function. The
  // function accepts the descriptive aliases used by the UI as well.
  const body = {
    action,
    ...payload,
    ...(payload.full_name && !payload.name ? { name: payload.full_name } : {}),
    ...(payload.user_id && !payload.id ? { id: payload.user_id } : {}),
  };
  const { data, error } = await supabase.functions.invoke('user-admin', { body });
  if (error) {
    let message = error.message || 'تعذر تنفيذ العملية الآمنة للمستخدم.';
    try {
      const response = (error as any).context;
      const details = response && typeof response.json === 'function' ? await response.json() : null;
      if (details?.error) message = details.error;
    } catch { /* keep the SDK message */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

export const AuthProvider: React.FC<{ children: ReactNode; cloudUser?: CloudIdentity | null }> = ({ children, cloudUser }) => {
  const [users, setUsers] = useState<User[]>(() => { try { const parsed = JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); return Array.isArray(parsed) ? parsed.map(withoutPassword) : []; } catch { return []; } });
  const [currentUser, setCurrentUser] = useState<User | null>(() => { try { const parsed = JSON.parse(localStorage.getItem('jilco_current_session') || 'null'); return parsed ? withoutPassword(parsed) : null; } catch { return null; } });

  useEffect(() => {
    if (!cloudUser) return;
    const sessionUser = withoutPassword({ id: cloudUser.id, username: cloudUser.email, name: cloudUser.email, role: roleOf(cloudUser.role), status: 'active', lastLogin: new Date().toISOString() });
    setCurrentUser(sessionUser);
    setUsers(prev => prev.some(u => u.id === sessionUser.id) ? prev.map(u => u.id === sessionUser.id ? { ...u, ...sessionUser } : u) : [...prev, sessionUser]);
    localStorage.setItem('jilco_current_session', JSON.stringify(sessionUser));
  }, [cloudUser]);
  useEffect(() => { localStorage.setItem(USERS_KEY, JSON.stringify(users.map(withoutPassword))); }, [users]);
  useEffect(() => {
    if (!cloudUser) return;
    void supabase.from('app_users').select('id, email, full_name, role, created_at').then(({ data }) => {
      if (!data) return;
      setUsers(data.map((row: any) => withoutPassword({ id: row.id, username: row.email || row.id, name: row.full_name || row.email || 'مستخدم', role: roleOf(row.role), status: 'active' })));
    });
  }, [cloudUser?.id]);

  const login = async (username: string, pass: string) => {
    const email = username.trim().toLowerCase(); if (!email || !pass) return false;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass }); if (error || !data.user) return false;
    const matched = users.find(u => u.id === data.user!.id) || { id: data.user.id, username: email, name: email, role: 'manager' as UserRole, status: 'active' as const };
    const sessionUser = withoutPassword({ ...matched, lastLogin: new Date().toISOString() }); setCurrentUser(sessionUser); localStorage.setItem('jilco_current_session', JSON.stringify(sessionUser));
    loggerService.addLog(sessionUser, 'تسجيل دخول', 'تم تسجيل الدخول بنجاح للنظام', 'الأمان'); return true;
  };
  const logout = async () => {
    if (currentUser) loggerService.addLog(currentUser, 'تسجيل خروج', 'تم تسجيل الخروج من النظام', 'الأمان');
    // Revoke all Supabase sessions before clearing the local mirror. This
    // prevents a stale browser tab from retaining a valid cloud session.
    try { await supabase.auth.signOut({ scope: 'global' }); } finally {
      setCurrentUser(null);
      localStorage.removeItem('jilco_current_session');
    }
  };
  const addUser = async (user: User, password?: string) => {
    if (!password) throw new Error('يرجى تحديد كلمة مرور مؤقتة للمستخدم.');
    const data = await invokeAdminUsers('create', { email: user.username.trim().toLowerCase(), password, full_name: user.name.trim(), role: user.role, status: user.status });
    const safe = withoutPassword({ ...user, id: data?.user?.id || data?.id || user.id, username: user.username.trim().toLowerCase() }); setUsers(prev => [...prev.filter(existing => existing.id !== safe.id), safe]);
    if (currentUser) loggerService.addLog(currentUser, 'إضافة مستخدم', `تم إنشاء مستخدم جديد: ${safe.name}`, 'المستخدمين');
  };
  const updateUser = async (user: User, password?: string) => {
    const safe = withoutPassword(user); await invokeAdminUsers('update', { user_id: safe.id, email: safe.username, password: password || undefined, full_name: safe.name, role: safe.role, status: safe.status });
    setUsers(prev => prev.map(existing => existing.id === safe.id ? safe : existing)); if (currentUser?.id === safe.id) { setCurrentUser(safe); localStorage.setItem('jilco_current_session', JSON.stringify(safe)); }
    if (currentUser) loggerService.addLog(currentUser, 'تعديل مستخدم', `تم تحديث بيانات المستخدم: ${safe.name}`, 'المستخدمين');
  };
  const deleteUser = async (id: string) => { const target = users.find(u => u.id === id); await invokeAdminUsers('delete', { user_id: id }); setUsers(prev => prev.filter(u => u.id !== id)); if (currentUser) loggerService.addLog(currentUser, 'حذف مستخدم', `تم حذف المستخدم: ${target?.name || id}`, 'المستخدمين'); };
  const hasPermission = (permission: Permission) => { if (!currentUser) return false; if (currentUser.role === 'admin') return true; if (currentUser.customPermissions?.length) return currentUser.customPermissions.includes(permission); return (ROLE_PERMISSIONS[currentUser.role] || []).includes(permission); };
  return <AuthContext.Provider value={{ currentUser, users, login, logout, addUser, updateUser, deleteUser, isAdmin: currentUser?.role === 'admin', hasPermission }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within an AuthProvider'); return context; };
