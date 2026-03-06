import React, { useState, useRef, useEffect } from 'react';
import { User, Bell, Search, LayoutDashboard, Calculator, Database, Users, Building, ShieldCheck, ChevronRight, Menu, FileText, FileSignature, Receipt, Settings, Scale, Coins, Clock, Smartphone, ScrollText, Activity, Box, TrendingUp, Wrench, Briefcase, Wallet, ShoppingBag, FileWarning, UserCog, FolderOpen, ClipboardCheck, Lock, QrCode, CloudRain, CloudOff, CheckCircle2, Wifi, X, Languages, LogOut } from 'lucide-react';
import { SystemView, Permission } from '../types';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { useNotifications } from '../lib/useNotifications';

interface SystemNavProps {
  currentView: SystemView;
  setView: (view: SystemView) => void;
  syncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
}

export const SystemNav: React.FC<SystemNavProps> = ({ currentView, setView, syncStatus = 'idle' }) => {
  const { currentUser, logout, hasPermission } = useAuth();
  const { t, toggleLanguage, language } = useLanguage();
  const { notifications, count } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // إغلاق الـ dropdown عند النقر خارجه
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navItems: { id: SystemView; label: string; icon: any; permission: Permission }[] = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, permission: 'view_dashboard' },
    { id: 'customers', label: t('customers'), icon: Users, permission: 'view_customers' },
    { id: 'quotes', label: t('quotes'), icon: Calculator, permission: 'view_quotes' },
    { id: 'contracts', label: t('contracts'), icon: ScrollText, permission: 'view_contracts' },
    { id: 'projects', label: t('projects'), icon: Briefcase, permission: 'view_projects' },
    { id: 'invoices', label: t('invoices'), icon: FileText, permission: 'view_invoices' },
    { id: 'receipts', label: t('receipts'), icon: Receipt, permission: 'view_receipts' },
    { id: 'expenses', label: t('expenses'), icon: Wallet, permission: 'view_expenses' },
    { id: 'purchases', label: t('purchases'), icon: ShoppingBag, permission: 'view_purchases' },
    { id: 'inventory', label: 'المخزون', icon: Database, permission: 'view_inventory' },
    { id: 'claims', label: t('claims'), icon: FileWarning, permission: 'view_claims' },
    { id: 'hr', label: t('hr'), icon: UserCog, permission: 'view_hr' },
    { id: 'documents', label: 'الوثائق', icon: FolderOpen, permission: 'view_documents' },
    { id: 'forms', label: t('forms'), icon: ClipboardCheck, permission: 'view_forms' },
    { id: 'users', label: t('users'), icon: Lock, permission: 'view_users' },
    { id: 'warranties', label: t('warranties'), icon: ShieldCheck, permission: 'view_warranties' },
    { id: 'smart_elevator', label: t('smart_elevator'), icon: QrCode, permission: 'view_smart_elevator' },
    { id: 'calculator', label: t('calculator'), icon: Scale, permission: 'view_calculator' },
    { id: 'financial_report', label: 'التقارير المالية', icon: TrendingUp, permission: 'view_reports' },
    { id: 'maintenance', label: 'الصيانة والتذاكر', icon: Wrench, permission: 'view_maintenance' },
    { id: 'company_profile', label: t('company_profile'), icon: Building, permission: 'view_company_profile' },
    { id: 'specs_manager', label: t('specs_manager'), icon: Database, permission: 'view_specs_manager' },
    { id: 'activity_log', label: 'السجلات', icon: Activity, permission: 'view_activity_log' },
    { id: 'subcontracts', label: 'عقود الباطن', icon: Building, permission: 'view_subcontracts' },
  ];

  // الدور مُستمد من AuthContext مباشرةً (نظام المصادقة الرئيسي)
  const allowedModules: Record<string, string[]> = {
    admin: [
      'dashboard', 'customers', 'quotes', 'contracts', 'projects', 'invoices', 'receipts', 'expenses', 'purchases', 'inventory', 'claims', 'hr', 'documents', 'forms', 'users', 'warranties', 'smart_elevator', 'calculator', 'company_profile', 'specs_manager', 'activity_log', 'subcontracts'
    ],
    manager: [
      'dashboard', 'customers', 'quotes', 'contracts', 'projects', 'invoices', 'receipts', 'expenses', 'purchases', 'inventory', 'claims', 'hr', 'documents', 'forms', 'warranties', 'smart_elevator', 'calculator', 'company_profile', 'specs_manager', 'activity_log', 'subcontracts'
    ],
    staff: [
      'dashboard', 'customers', 'quotes', 'contracts', 'projects', 'invoices', 'receipts', 'expenses', 'purchases', 'inventory', 'claims', 'hr', 'documents', 'forms', 'warranties', 'smart_elevator', 'calculator', 'company_profile', 'specs_manager', 'activity_log'
    ]
  };

  const role = currentUser?.role || 'admin';
  const currentAllowed = allowedModules[role as keyof typeof allowedModules] || allowedModules['admin'];
  const visibleItems = navItems.filter(item => hasPermission(item.permission) || role === 'admin');

  return (
    <div className="w-28 bg-jilco-950 flex flex-col items-center py-6 h-screen text-white shadow-2xl z-50 print:hidden shrink-0 border-l border-white/5 relative transition-all duration-300">
      <button title="الرئيسية" className="mb-4 p-3 bg-gradient-to-b from-gold-500 to-gold-600 rounded-2xl cursor-pointer shadow-lg active:scale-95 transition-transform" onClick={() => hasPermission('view_dashboard') && setView('dashboard')}>
        <div className="font-black text-2xl tracking-tighter text-jilco-950 italic">J</div>
      </button>

      <div className="mb-2 text-center px-1 w-full">
        <div className="w-10 h-10 rounded-full bg-white/10 mx-auto flex items-center justify-center font-bold text-sm mb-1 border border-white/20">
          {currentUser?.name.charAt(0)}
        </div>
        <p className="text-[10px] text-gray-300 truncate w-full px-2 font-medium">{currentUser?.role}</p>
      </div>

      {/* Cloud Status Indicator */}
      <div className="mb-4 w-full px-4">
        <div className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-bold border transition-all duration-500 ${syncStatus === 'syncing' ? 'bg-blue-600 text-white border-blue-400 animate-pulse shadow-[0_0_10px_rgba(37,99,235,0.5)]' :
          syncStatus === 'synced' ? 'bg-green-600 text-white border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.5)]' :
            syncStatus === 'error' ? 'bg-red-600 text-white border-red-400' :
              'bg-emerald-900/80 text-emerald-400 border-emerald-700 shadow-inner' // Connected/Idle state
          }`}>
          {syncStatus === 'syncing' ? <CloudRain size={12} /> :
            syncStatus === 'error' ? <CloudOff size={12} /> :
              syncStatus === 'synced' ? <CheckCircle2 size={12} /> :
                <Wifi size={12} />}
          <span>
            {syncStatus === 'syncing' ? 'جاري المزامنة' :
              syncStatus === 'synced' ? 'تم الحفظ' :
                syncStatus === 'error' ? 'فشل الاتصال' :
                  'متصل بالسحابة'}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col gap-2 px-2 overflow-y-auto no-scrollbar pb-4">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              title={item.label}
              key={item.id}
              onClick={() => setView(item.id)}
              className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 group w-full min-h-[60px] ${isActive
                ? 'bg-gold-500 text-jilco-950 shadow-[0_0_15px_rgba(245,158,11,0.2)] scale-100'
                : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} className="mb-1.5 transition-transform group-hover:scale-110" />
              <span className={`text-[10px] font-bold text-center leading-tight w-full break-words px-1 ${isActive ? 'text-jilco-950' : 'text-gray-300 group-hover:text-white'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto px-2 w-full pt-4 border-t border-white/5 space-y-2 pb-2">

        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(p => !p)}
            className="w-full p-2 rounded-xl hover:bg-white/5 text-gold-400 hover:text-gold-300 transition-all flex flex-col items-center justify-center gap-1 relative"
            title="الإشعارات"
          >
            <div className="relative">
              <Bell size={18} />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold">تنبيهات</span>
          </button>

          {/* Dropdown */}
          {showNotifications && (
            <div className="absolute bottom-0 right-full ml-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 z-[9999] overflow-hidden">
              <div className="p-3 bg-jilco-900 text-white flex justify-between items-center">
                <span className="font-black text-sm">الإشعارات {count > 0 && `(${count})`}</span>
                <button title="إغلاق الإشعارات" onClick={() => setShowNotifications(false)} className="text-white/60 hover:text-white"><X size={16} /></button>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                {notifications.length === 0 && (
                  <div className="p-6 text-center text-gray-400 text-sm">لا توجد تنبيهات 🎉</div>
                )}
                {notifications.map(n => (
                  <button
                    title={`عرض ${n.title}`}
                    key={n.id}
                    onClick={() => { if (n.actionView) setView(n.actionView as any); setShowNotifications(false); }}
                    className={`w-full text-right p-3 hover:bg-gray-50 transition-colors flex items-start gap-2 ${n.severity === 'critical' ? 'border-r-4 border-red-500' :
                      n.severity === 'warning' ? 'border-r-4 border-amber-500' : 'border-r-4 border-blue-400'
                      }`}
                  >
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${n.severity === 'critical' ? 'bg-red-500' :
                      n.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-400'
                      }`} />
                    <div>
                      <p className="text-xs font-bold text-gray-800">{n.title}</p>
                      <p className="text-[11px] text-gray-500">{n.description}</p>
                      {n.date && <p className="text-[10px] text-gray-400 mt-0.5">{n.date}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={toggleLanguage}
          className="w-full p-2 rounded-xl text-gold-400 hover:bg-white/5 hover:text-gold-300 transition-all flex flex-col items-center justify-center gap-1 group"
          title={language === 'ar' ? 'Switch to English' : 'تغيير للعربية'}
        >
          <Languages size={18} />
          <span className="text-[10px] font-bold uppercase">{language === 'ar' ? 'English' : 'عربي'}</span>
        </button>

        <button
          onClick={logout}
          className="w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all flex justify-center group"
          title={t('logout')}
        >
          <LogOut size={20} className="group-hover:rotate-180 transition-transform duration-500" />
        </button>
      </div>
    </div>
  );
};
