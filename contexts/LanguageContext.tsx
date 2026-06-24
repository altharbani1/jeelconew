import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'ar' | 'en';
type Direction = 'rtl' | 'ltr';

interface LanguageContextType {
  language: Language;
  direction: Direction;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations: Record<string, { ar: string; en: string }> = {
  // Navigation
  'dashboard': { ar: 'الرئيسية', en: 'Dashboard' },
  'users': { ar: 'المستخدمين', en: 'Users' },
  'company_profile': { ar: 'ملف الشركة', en: 'Company Profile' },
  'specs_manager': { ar: 'قاعدة البيانات', en: 'Specs Database' },
  'forms': { ar: 'النماذج', en: 'Forms' },
  'customers': { ar: 'العملاء', en: 'Customers' },
  'hr': { ar: 'الموظفين', en: 'HR' },
  'smart_elevator': { ar: 'المصعد الذكي', en: 'Smart Elevator' },
  'calculator': { ar: 'حاسبة التكاليف', en: 'Cost Calculator' },
  'quotes': { ar: 'عروض الأسعار', en: 'Quotations' },
  'invoices': { ar: 'فواتير ضريبية', en: 'Invoices' },
  'claims': { ar: 'مطالبات مالية', en: 'Financial Claims' },
  'receipts': { ar: 'سندات قبض', en: 'Receipts' },
  'expenses': { ar: 'المصروفات', en: 'Expenses' },
  'contracts': { ar: 'العقود', en: 'Contracts' },
  'warranties': { ar: 'شهادات الضمان', en: 'Warranties' },
  'projects': { ar: 'إدارة المشاريع', en: 'Project Management' },
  'purchases': { ar: 'المشتريات', en: 'Purchases' },
  'logout': { ar: 'تسجيل الخروج', en: 'Logout' },
  
  // General
  'welcome': { ar: 'مرحباً بك', en: 'Welcome' },
  'system_title': { ar: 'نظام جيلكو للإدارة', en: 'Jilco Management System' },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('jilco_lang') as Language) || 'ar';
  });

  useEffect(() => {
    localStorage.setItem('jilco_lang', language);
    const dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'ar' ? 'en' : 'ar');
  };

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  const direction = language === 'ar' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ language, direction, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};