
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, Permission, ROLE_PERMISSIONS } from '../types';
import { cloudService } from '../services/cloudService';
import { loggerService } from '../services/loggerService';



interface AuthContextType {
  currentUser: User | null;
  users: User[];
  login: (username: string, pass: string) => Promise<boolean>;
  logout: () => void;
  addUser: (user: User) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => void;
  isAdmin: boolean;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ⚠️ SECURITY: Change this default password immediately after first login!
// In production, consider using Supabase Auth or storing a hashed password.
const ADMIN_DEFAULT_PASSWORD = '123456';

const DEFAULT_ADMIN: User = {
  id: 'admin-01',
  username: 'admin',
  password: ADMIN_DEFAULT_PASSWORD,
  name: 'المدير العام',
  role: 'admin',
  status: 'active'
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 1. Load Users Synchronously (Lazy Initialization)
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const savedUsers = localStorage.getItem('jilco_system_users');
      let loadedUsers: User[] = savedUsers ? JSON.parse(savedUsers) : [];

      if (!Array.isArray(loadedUsers)) loadedUsers = [];

      const adminIndex = loadedUsers.findIndex(u => u.username === 'admin');

      if (adminIndex === -1) {
        loadedUsers.push(DEFAULT_ADMIN);
        localStorage.setItem('jilco_system_users', JSON.stringify(loadedUsers));
      }

      return loadedUsers;
    } catch (e) {
      return [DEFAULT_ADMIN];
    }
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedSession = localStorage.getItem('jilco_current_session');
      return savedSession ? JSON.parse(savedSession) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    localStorage.setItem('jilco_system_users', JSON.stringify(users));
  }, [users]);

  // Updated Asynchronous Login
  const login = async (username: string, pass: string): Promise<boolean> => {
    const cleanUser = username?.trim().toLowerCase();
    const cleanPass = pass?.trim();

    if (!cleanUser || !cleanPass) return false;

    // 1. Helper function to check credentials against a list
    const checkCredentials = (userList: User[]) => {
      // Emergency Admin Check — uses ADMIN_DEFAULT_PASSWORD constant
      if (cleanUser === 'admin' && cleanPass === ADMIN_DEFAULT_PASSWORD) {
        const existingAdmin = userList.find(u => u.username === 'admin');
        if (existingAdmin) {
          // Return the admin user (resetting password locally if needed happens in logic below)
          return { ...existingAdmin, password: '123456' };
        }
      }
      return userList.find(u => u.username?.trim().toLowerCase() === cleanUser && u.password === cleanPass);
    };

    // 2. Try Local First
    let user = checkCredentials(users);

    // 3. If not found locally, Try Cloud Sync
    if (!user) {
      try {
        console.log("User not found locally, checking cloud...");
        // 🛠️ FIX: Try to download from 'admin' backup first, as admin is the one who creates users
        let cloudData = await cloudService.downloadData('admin');

        // If no admin backup, fallback to default or the user's own backup
        if (!cloudData) {
          cloudData = await cloudService.downloadData();
        }

        if (cloudData && cloudData['jilco_system_users']) {
          const cloudUsers: User[] = JSON.parse(cloudData['jilco_system_users']);

          if (Array.isArray(cloudUsers)) {
            setUsers(cloudUsers);
            localStorage.setItem('jilco_system_users', JSON.stringify(cloudUsers));

            user = checkCredentials(cloudUsers);
          }
        }
      } catch (e) {
        console.error("Failed to sync users from cloud during login:", e);
      }
    }

    // 4. Final Validation
    if (user && user.status === 'active') {
      const timestamp = new Date().toISOString();
      const sessionUser = { ...user, lastLogin: timestamp };

      setUsers(prev => prev.map(u => u.id === user!.id ? { ...u, lastLogin: timestamp } : u));

      setCurrentUser(sessionUser);
      localStorage.setItem('jilco_current_session', JSON.stringify(sessionUser));

      // LOG LOGIN ACTION
      loggerService.addLog(sessionUser, 'تسجيل دخول', 'تم تسجيل الدخول بنجاح للنظام', 'الأمان');

      return true;
    }

    return false;
  };

  const logout = () => {
    // LOG LOGOUT ACTION
    if (currentUser) {
      loggerService.addLog(currentUser, 'تسجيل خروج', 'تم تسجيل الخروج من النظام', 'الأمان');
    }
    setCurrentUser(null);
    localStorage.removeItem('jilco_current_session');
  };

  const addUser = (newUser: User) => {
    setUsers(prev => [...prev, newUser]);
    // Log creation
    if (currentUser) {
      loggerService.addLog(currentUser, 'إضافة مستخدم', `تم إنشاء مستخدم جديد: ${newUser.name}`, 'المستخدمين');
    }
  };

  const updateUser = (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    if (currentUser?.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      localStorage.setItem('jilco_current_session', JSON.stringify(updatedUser));
    }
    // Log update
    if (currentUser) {
      loggerService.addLog(currentUser, 'تعديل مستخدم', `تم تحديث بيانات المستخدم: ${updatedUser.name}`, 'المستخدمين');
    }
  };

  const deleteUser = (id: string) => {
    const userToDelete = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));
    // Log deletion
    if (currentUser) {
      loggerService.addLog(currentUser, 'حذف مستخدم', `تم حذف المستخدم: ${userToDelete?.name || id}`, 'المستخدمين');
    }
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.customPermissions && currentUser.customPermissions.length > 0) {
      return currentUser.customPermissions.includes(permission);
    }
    const rolePermissions = ROLE_PERMISSIONS[currentUser.role];
    return rolePermissions ? rolePermissions.includes(permission) : false;
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      users,
      login,
      logout,
      addUser,
      updateUser,
      deleteUser,
      isAdmin: currentUser?.role === 'admin',
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
