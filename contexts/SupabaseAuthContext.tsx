import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabaseClient';

interface SupabaseUser {
  id: string;
  email: string;
  company_id?: string;
  role?: string;
}

interface SupabaseAuthContextType {
  user: SupabaseUser | null;
  loading: boolean;
  loadingAuth: boolean;
  loadingProfile: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
}

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

export const SupabaseAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = supabase.auth.getSession();
    session.then(({ data }) => {
      if (data.session?.user) {
        fetchAppUser(data.session.user.id);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchAppUser(session.user.id);
      } else {
        setUser(null);
      }
    });
  }, []);

  const fetchAppUser = async (id: string) => {
    setLoadingProfile(true);
    setError(null);
    let timeoutId: any;
    try {
      // Timeout بعد 8 ثواني
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('تعذر تحميل بيانات المستخدم. تحقق من الاتصال أو السياسات (RLS).')), 8000);
      });
      const userPromise = supabase.from('app_users').select('id, email, company_id, role').eq('id', id).single();
      const { data, error } = await Promise.race([userPromise, timeoutPromise]) as any;
      clearTimeout(timeoutId);
      if (error && error.code === 'PGRST116') { // Not found
        // جلب أول شركة أو إنشاء واحدة افتراضية
        let companyId = null;
        const { data: companies } = await supabase.from('companies').select('id').limit(1);
        if (companies && companies.length > 0) companyId = companies[0].id;
        else {
          const { data: newCompany } = await supabase.from('companies').insert({ name: 'Jeelco' }).select().single();
          companyId = newCompany?.id;
        }
        // تحقق هل هو أول مستخدم
        const { count } = await supabase.from('app_users').select('id', { count: 'exact', head: true });
        const role = (count === 0) ? 'admin' : 'staff';
        // upsert صف المستخدم
        await supabase.from('app_users').upsert({
          id,
          email: '',
          company_id: companyId,
          role
        });
        // أعد جلبه
        return await fetchAppUser(id);
      }
      if (error) throw error;
      if (!data) throw new Error('تعذر تحميل بيانات المستخدم.');
      setUser({
        id: data.id,
        email: data.email,
        company_id: data.company_id,
        role: data.role || (await fetchUserRole(id, data.company_id))
      });
      setError(null);
    } catch (err: any) {
      setUser(null);
      setError(err.message || 'تعذر تحميل بيانات المستخدم.');
    }
    setLoadingProfile(false);
  };

  const fetchUserRole = async (userId: string, companyId: string) => {
    const { data } = await supabase.from('user_roles').select('role_id, roles(name)').eq('user_id', userId).eq('company_id', companyId).single();
    if (!data || !data.roles) return null;
    if (Array.isArray(data.roles)) {
      return data.roles.length > 0 && data.roles[0] && typeof data.roles[0].name === 'string' ? data.roles[0].name : null;
    }
    if (typeof data.roles === 'object' && data.roles !== null && 'name' in data.roles) {
      return (data.roles as any).name;
    }
    return null;
  };

  const signIn = async (email: string, password: string) => {
    setLoadingAuth(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    let result = { hasSession: !!data?.session, hasUser: !!data?.user, error: error?.message };
    if (data?.user) {
      await fetchAppUser(data.user.id);
      setLoadingAuth(false);
      return result;
    }
    setLoadingAuth(false);
    return result;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <SupabaseAuthContext.Provider value={{ user, loading, loadingAuth, loadingProfile, error, signIn, signOut }}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};

export const useSupabaseAuth = () => {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx) throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider');
  return ctx;
};
