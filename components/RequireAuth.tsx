import React from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';

/**
 * مكون حماية: يعرض Loading أثناء التحقق، رسالة خطأ عند الفشل، أو children عند نجاح التحميل
 */
export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loadingAuth, loadingProfile, error } = useSupabaseAuth();

  if (loadingAuth || loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-lg font-bold text-blue-700 animate-pulse">جاري التحقق من بيانات الدخول...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="bg-white border border-red-200 p-8 rounded shadow text-center">
          <div className="text-2xl text-red-600 font-bold mb-2">خطأ في تسجيل الدخول</div>
          <div className="text-red-700 mb-4">{error}</div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={() => window.location.reload()}>إعادة المحاولة</button>
        </div>
      </div>
    );
  }

  if (!user) {
    // لا يوجد مستخدم مسجل
    return null;
  }

  return <>{children}</>;
};
