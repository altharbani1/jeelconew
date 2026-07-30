import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

export const FirstRunSetup: React.FC = () => {
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // يجب إنشاء جلسة Supabase أولاً، لأن قاعدة البيانات لا تقبل الكتابة
      // إلا للمستخدمين المسجلين.
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError && !/already registered/i.test(signUpError.message)) {
        throw new Error(signUpError.message);
      }
      let userId = data.session?.user?.id || data.user?.id;
      if (!data.session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw new Error('فعّل البريد الإلكتروني أولاً، ثم أعد المحاولة لإكمال الإعداد.');
        userId = signInData.user?.id;
      }
      if (!userId) throw new Error('لم يتم تسجيل الدخول بعد إنشاء المستخدم');

      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert({ name: companyName })
        .select('id')
        .single();
      if (companyError) throw new Error(companyError.message);

      const { error: userError } = await supabase.from('app_users').upsert({
        id: userId,
        email,
        full_name: 'Admin',
        company_id: companyData.id,
        role: 'admin',
      });
      if (userError) throw new Error(userError.message);

      setSuccess(true);
      // الانتقال مباشرة للتطبيق بعد نجاح التسجيل والدخول
      // يمكنك هنا توجيه المستخدم لصفحة رئيسية أو داشبورد
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <form onSubmit={handleSetup} className="bg-white p-8 rounded shadow w-96">
        <h2 className="text-xl font-bold mb-2">إعداد المزامنة السحابية</h2>
        <p className="text-sm text-gray-600 mb-4">أنشئ حساب المدير لحفظ بيانات النظام في القاعدة الجديدة.</p>
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
