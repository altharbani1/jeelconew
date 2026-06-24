import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';

export const FirstRunSetup: React.FC = () => {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.from('app_users').select('id').limit(1).then(({ data }) => {
      if (!data || data.length === 0) setNeedsSetup(true);
    });
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // 1. Create company
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({ name: companyName })
        .select()
        .single();
      if (companyError) throw new Error(companyError.message);
      const company_id = companyData?.id;
      if (!company_id) throw new Error('لم يتم إنشاء الشركة بنجاح');

      // 2. Create admin user
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw new Error(signUpError.message);
      // تسجيل الدخول مباشرة بعد التسجيل
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(signInError.message);
      const userId = signInData?.user?.id;
      if (!userId) throw new Error('لم يتم تسجيل الدخول بعد إنشاء المستخدم');

      // إدراج المستخدم في app_users في الخلفية بدون انتظار
      supabase.from('app_users').insert({
        id: userId,
        email,
        full_name: 'Admin',
        company_id,
      });

      // تعيين الدور الإداري في الخلفية أيضاً
      supabase.from('user_roles').insert({
        user_id: userId,
        role_id: 1,
        company_id,
      });

      setSuccess(true);
      // الانتقال مباشرة للتطبيق بعد نجاح التسجيل والدخول
      // يمكنك هنا توجيه المستخدم لصفحة رئيسية أو داشبورد
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (!needsSetup) return null;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <form onSubmit={handleSetup} className="bg-white p-8 rounded shadow w-96">
        <h2 className="text-xl font-bold mb-4">إعداد أول مدير للنظام</h2>
        <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="اسم الشركة" className="mb-2 w-full p-2 border rounded" required />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني" className="mb-2 w-full p-2 border rounded" required />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور" className="mb-2 w-full p-2 border rounded" required />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>إنشاء المدير</button>
        {error && <div className="text-red-600 mt-2">{error}</div>}
        {success && <div className="text-green-600 mt-2">تم إنشاء المدير والشركة بنجاح!</div>}
      </form>
    </div>
  );
};
