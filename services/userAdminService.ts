import { supabase } from './supabaseClient';
import { User } from '../types';

export async function manageCloudUser(action: 'create' | 'update' | 'delete', user: Partial<User> & { id?: string }) {
  const { data, error } = await supabase.functions.invoke('user-admin', { body: { action, id: user.id, email: user.username, name: user.name, password: user.password, role: user.role, status: user.status } });
  if (error) throw new Error(error.message || 'تعذر تنفيذ العملية على حساب المستخدم');
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listCloudUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('app_users').select('id, email, full_name, role').order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((u: any) => ({ id: u.id, username: u.email || '', name: u.full_name || u.email || '', role: (u.role || 'staff') as User['role'], status: 'active' as const }));
}
