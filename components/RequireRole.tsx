import React from 'react';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';

interface Props {
  role: string;
  children: React.ReactNode;
}

export const RequireRole: React.FC<Props> = ({ role, children }) => {
  const { user, loading } = useSupabaseAuth();
  if (loading) return <div>جاري التحقق من الصلاحيات...</div>;
  if (!user || user.role !== role) return <div>ليس لديك صلاحية الوصول لهذه الصفحة.</div>;
  return <>{children}</>;
};
