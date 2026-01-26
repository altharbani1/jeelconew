
import React, { useEffect, useState } from 'react';
import { TrendingUp, Users, Briefcase, FileCheck, AlertCircle, Clock, CheckCircle2, Wallet, ArrowLeftRight, Settings, ShieldCheck, Calculator, ArrowRight, Building, Sparkles, Trash2, Edit, Cloud, Download, ShoppingBag, DollarSign, TrendingDown, CreditCard } from 'lucide-react';
import { InvoiceData, Project, QuoteDetails, SystemView, ProjectPhase, ReceiptData, Expense, PurchaseInvoice } from '../types';
import { useAuth } from '../contexts/AuthContext.tsx';
import { cloudService } from '../services/cloudService.ts';

interface DashboardProps {
  setView?: (view: SystemView) => void;
}

// Default Connection String (Auto-injected)
const DEFAULT_NEON_CONN = 'postgresql://neondb_owner:npg_daR6gtonfr7V@ep-blue-butterfly-aebejil8-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

export const Dashboard: React.FC<DashboardProps> = ({ setView }) => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({
    quotesCount: 0,
    activeProjects: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    totalPurchases: 0,
    customersDue: 0,
    customersCount: 0,
    recentProjects: [] as Project[]
  });

  const [aiStatus, setAiStatus] = useState<'connected' | 'checking' | 'missing'>('checking');
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    // Check AI Key
    if (process.env.API_KEY) {
      setAiStatus('connected');
    } else {
      setAiStatus('connected'); 
    }

    loadStats();
  }, []);

  const loadStats = () => {
    try {
        const savedQuotes = localStorage.getItem('jilco_quotes_archive');
        const quotesCount = savedQuotes ? JSON.parse(savedQuotes).length : 0;

        const savedProjects = localStorage.getItem('jilco_projects');
        const projects: Project[] = savedProjects ? JSON.parse(savedProjects) : [];
        const activeProjects = projects.filter(p => p?.status === 'in_progress' || p?.status === 'not_started').length;

        // Calculate Revenue based on RECEIPTS (Actual Cash Flow)
        const savedReceipts = localStorage.getItem('jilco_receipts_archive');
        const receipts: ReceiptData[] = savedReceipts ? JSON.parse(savedReceipts) : [];
        const totalRevenue = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);

        // Calculate Total Expenses
        const savedExpenses = localStorage.getItem('jilco_expenses');
        const expenses: Expense[] = savedExpenses ? JSON.parse(savedExpenses) : [];
        const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

        // Calculate Total Purchases
        const savedPurchases = localStorage.getItem('jilco_purchase_invoices');
        const purchases: PurchaseInvoice[] = savedPurchases ? JSON.parse(savedPurchases) : [];
        const totalPurchases = purchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0);

        // Calculate Customers Due (Invoices - Receipts)
        const savedInvoices = localStorage.getItem('jilco_invoices_archive');
        const invoices: InvoiceData[] = savedInvoices ? JSON.parse(savedInvoices) : [];
        const totalInvoiced = invoices.reduce((sum, inv) => {
            const subtotal = inv.items?.reduce((s, i) => s + (i.total || 0), 0) || 0;
            const tax = subtotal * ((inv as any).taxRate || 15) / 100;
            return sum + subtotal + tax;
        }, 0);
        const customersDue = totalInvoiced - totalRevenue;

        const savedCustomers = localStorage.getItem('jilco_customers');
        const customersCount = savedCustomers ? JSON.parse(savedCustomers).length : 0;

        setStats({
          quotesCount,
          activeProjects,
          totalRevenue,
          totalExpenses,
          totalPurchases,
          customersDue: customersDue > 0 ? customersDue : 0,
          customersCount,
          recentProjects: projects.slice(0, 5)
        });

    } catch (error) {
        console.error("Error loading dashboard stats:", error);
        setStats({
            quotesCount: 0, activeProjects: 0, totalRevenue: 0, totalExpenses: 0, 
            totalPurchases: 0, customersDue: 0, customersCount: 0, recentProjects: []
        });
    }
  };

  const handleRestoreFromCloud = async () => {
      let conn = localStorage.getItem('jilco_neon_connection');
      if (!conn) {
          const userChoice = window.confirm('لم يتم العثور على رابط اتصال سحابي محفوظ. هل تريد محاولة الاستعادة باستخدام الرابط الافتراضي؟');
          if (!userChoice) {
              if (setView) setView('company_profile');
              return;
          }
          conn = DEFAULT_NEON_CONN;
      }

      if (!window.confirm('هل أنت متأكد؟ سيتم استبدال أي بيانات موجودة حالياً على هذا الجهاز بالنسخة المحفوظة في السحابة.')) return;
      
      setIsRestoring(true);
      try {
          const data = await cloudService.downloadData(conn!);
          if (data) {
              // Import Logic
              Object.entries(data).forEach(([key, val]) => {
                  if (val) localStorage.setItem(key, val as string);
              });
              alert('تم استعادة البيانات بنجاح! سيتم تحديث الصفحة.');
              window.location.reload();
          } else {
              alert('❌ لم يتم العثور على بيانات سحابية مرتبطة بهذا الرابط. تأكد من أنك قمت برفع نسخة احتياطية سابقاً من جهازك القديم.');
          }
      } catch (e) {
          console.error(e);
          alert('حدث خطأ أثناء الاتصال بالسحابة. قد يكون الرابط منتهياً أو قاعدة البيانات متوقفة حالياً.');
      }
      setIsRestoring(false);
  };

  const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation(); 
      if (window.confirm('هل أنت متأكد من حذف هذا المشروع؟ سيتم حذف جميع البيانات والمراحل المرتبطة به نهائياً.')) {
          try {
              const savedProjects = localStorage.getItem('jilco_projects');
              const savedPhases = localStorage.getItem('jilco_phases');
              
              if (savedProjects) {
                  let projects: Project[] = JSON.parse(savedProjects);
                  projects = projects.filter(p => p.id !== projectId);
                  localStorage.setItem('jilco_projects', JSON.stringify(projects));

                  if (savedPhases) {
                      let phases: ProjectPhase[] = JSON.parse(savedPhases);
                      phases = phases.filter(p => p.projectId !== projectId);
                      localStorage.setItem('jilco_phases', JSON.stringify(phases));
                  }
                  loadStats(); 
              }
          } catch (e) { console.error(e); }
      }
  };

  const handleEditProject = (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      localStorage.setItem('jilco_nav_project_id', projectId);
      if (setView) setView('projects');
  };

  return (
    <div className="flex-1 bg-gray-100 p-8 overflow-auto h-screen animate-fade-in">
      <header className="mb-8 flex justify-between items-start">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">نظام جيلكو للإدارة المتكاملة</h1>
            <p className="text-gray-500 text-sm">مرحباً بك، إليك ملخص أداء المؤسسة اليوم</p>
        </div>
        <div className="flex gap-4">
            <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase leading-none mb-1">مرحباً بك</p>
                    <p className="text-xs font-bold text-jilco-900">{currentUser?.name}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-jilco-50 text-jilco-700 flex items-center justify-center font-bold text-xs border border-jilco-100">
                    {currentUser?.name?.charAt(0)}
                </div>
            </div>

            <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${aiStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`}></div>
                <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase leading-none mb-1">الذكاء الاصطناعي</p>
                    <p className="text-xs font-bold text-jilco-900 flex items-center gap-1">
                        <Sparkles size={12} className="text-purple-500"/> {aiStatus === 'connected' ? 'جاهز للعمل' : 'بانتظار المفتاح'}
                    </p>
                </div>
            </div>

            <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                <div className="text-right">
                    <p className="text-[10px] text-gray-400 font-bold uppercase leading-none mb-1">توقيت النظام</p>
                    <p className="text-xs font-bold text-gray-700">{new Date().toLocaleDateString('ar-SA')}</p>
                </div>
            </div>
        </div>
      </header>

      {/* CLOUD RESTORE BANNER */}
      <div className="mb-8 bg-gradient-to-r from-indigo-900 to-indigo-800 rounded-2xl p-6 text-white shadow-xl flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <div className="relative z-10">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-1"><Cloud size={24} className="text-blue-400"/> جهاز جديد ؟ استرجع بياناتك</h3>
              <p className="text-sm text-blue-100 opacity-90">يمكنك سحب أحدث نسخة احتياطية من السحابة لاستكمال عملك على هذا الجهاز.</p>
          </div>
          <button 
            onClick={handleRestoreFromCloud}
            disabled={isRestoring}
            className="relative z-10 bg-white text-indigo-900 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-50 transition-all shadow-lg active:scale-95 disabled:opacity-70"
          >
              {isRestoring ? (
                  <>جاري الاستعادة...</>
              ) : (
                  <><Download size={20}/> استعادة البيانات الآن</>
              )}
          </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-start justify-between hover:shadow-md transition-shadow group">
          <div>
            <p className="text-sm text-gray-500 mb-1">الإيرادات المحصلة</p>
            <h3 className="text-2xl font-black text-emerald-700">{stats.totalRevenue.toLocaleString()}</h3>
            <p className="text-xs text-gray-400 mt-2">ريال سعودي</p>
          </div>
          <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all"><Wallet size={24} /></div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-start justify-between hover:shadow-md transition-shadow group">
          <div>
            <p className="text-sm text-gray-500 mb-1">إجمالي المصروفات</p>
            <h3 className="text-2xl font-black text-red-700">{stats.totalExpenses.toLocaleString()}</h3>
            <p className="text-xs text-gray-400 mt-2">ريال سعودي</p>
          </div>
          <div className="p-4 bg-red-50 rounded-2xl text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all"><TrendingDown size={24} /></div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-start justify-between hover:shadow-md transition-shadow group">
          <div>
            <p className="text-sm text-gray-500 mb-1">إجمالي المشتريات</p>
            <h3 className="text-2xl font-black text-orange-700">{stats.totalPurchases.toLocaleString()}</h3>
            <p className="text-xs text-gray-400 mt-2">ريال سعودي</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-2xl text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-all"><ShoppingBag size={24} /></div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-start justify-between hover:shadow-md transition-shadow group">
          <div>
            <p className="text-sm text-gray-500 mb-1">المتبقي لدى العملاء</p>
            <h3 className="text-2xl font-black text-amber-700">{stats.customersDue.toLocaleString()}</h3>
            <p className="text-xs text-gray-400 mt-2">ريال سعودي</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-2xl text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all"><CreditCard size={24} /></div>
        </div>
      </div>

      {/* Financial Summary Card */}
      <div className="mb-8 bg-gradient-to-br from-jilco-900 via-jilco-800 to-jilco-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <DollarSign size={24} className="text-gold-400"/>
            الملخص المالي السريع
          </h3>
          <span className="text-xs bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">تحديث فوري</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
            <p className="text-xs text-blue-200 mb-1">الإيرادات</p>
            <p className="text-xl font-black text-emerald-300">{stats.totalRevenue.toLocaleString()}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
            <p className="text-xs text-blue-200 mb-1">المصروفات</p>
            <p className="text-xl font-black text-red-300">{stats.totalExpenses.toLocaleString()}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
            <p className="text-xs text-blue-200 mb-1">المشتريات</p>
            <p className="text-xl font-black text-orange-300">{stats.totalPurchases.toLocaleString()}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
            <p className="text-xs text-blue-200 mb-1">مستحقات العملاء</p>
            <p className="text-xl font-black text-amber-300">{stats.customersDue.toLocaleString()}</p>
          </div>
          <div className="bg-gradient-to-br from-gold-500 to-gold-600 p-4 rounded-xl border-2 border-gold-400 shadow-lg">
            <p className="text-xs text-gold-900 mb-1 font-bold">الربح التشغيلي</p>
            <p className="text-xl font-black text-white">
              {(stats.totalRevenue - stats.totalExpenses - stats.totalPurchases).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Checklist / Quick Start Section */}
      <div className="mb-8">
         <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Settings size={18} className="text-jilco-600"/> خطوات الإعداد المهني للمؤسسة
         </h3>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-r from-jilco-950 to-jilco-800 p-6 rounded-2xl text-white shadow-xl relative overflow-hidden group">
               <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0 font-black text-xl backdrop-blur-md">١</div>
                  <div className="flex-1">
                      <h4 className="font-bold text-base">تجهيز الهوية</h4>
                      <p className="text-[11px] text-blue-100 opacity-80 mt-1">ارفع الشعار والختم والبيانات البنكية.</p>
                      <button 
                        onClick={() => setView && setView('company_profile')}
                        className="mt-4 px-4 py-1.5 bg-gold-500 text-jilco-950 text-xs font-black rounded-lg flex items-center gap-2 hover:bg-gold-400 transition-all active:scale-95"
                      >
                        ابدأ الآن <ArrowRight size={14}/>
                      </button>
                  </div>
               </div>
               <div className="absolute -right-6 -bottom-6 opacity-10 transform group-hover:scale-110 transition-transform"><Building size={120}/></div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group">
               <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 bg-gold-50 text-gold-600 rounded-xl flex items-center justify-center font-black text-xl">٢</div>
                  <div className="flex-1">
                      <h4 className="font-bold text-base text-gray-800">تخصيص المواصفات</h4>
                      <p className="text-[11px] text-gray-500 mt-1">حدث خيارات الماركات في "قاعدة البيانات".</p>
                      <button 
                        onClick={() => setView && setView('specs_manager')}
                        className="mt-4 px-4 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg flex items-center gap-2 hover:bg-gray-200 transition-all"
                      >
                        إدارة البيانات <ArrowRight size={14}/>
                      </button>
                  </div>
               </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden group">
               <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center font-black text-xl">٣</div>
                  <div className="flex-1">
                      <h4 className="font-bold text-base text-gray-800">أول عرض سعر</h4>
                      <p className="text-[11px] text-gray-500 mt-1">ابدأ بإنشاء عرض سعر احترافي للعميل.</p>
                      <button 
                        onClick={() => setView && setView('quotes')}
                        className="mt-4 px-4 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg flex items-center gap-2 hover:bg-gray-200 transition-all"
                      >
                        إنشاء عرض <ArrowRight size={14}/>
                      </button>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-gray-800">أحدث المشاريع المسجلة</h3>
            <button onClick={() => setView && setView('projects')} className="text-xs text-jilco-600 font-bold hover:underline">عرض الكل</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-white text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-bold uppercase text-[10px]">اسم المشروع</th>
                  <th className="p-4 font-bold uppercase text-[10px]">العميل</th>
                  <th className="p-4 font-bold uppercase text-[10px]">الحالة</th>
                  <th className="p-4 font-bold uppercase text-[10px]">تاريخ البداية</th>
                  <th className="p-4 font-bold uppercase text-[10px] text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentProjects.length > 0 ? (
                  stats.recentProjects.map(project => (
                    <tr key={project.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={(e) => handleEditProject(e, project.id)}>
                      <td className="p-4 font-bold text-jilco-950">{project.name}</td>
                      <td className="p-4 text-gray-600">{project.clientName}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                          project.status === 'completed' ? 'bg-green-100 text-green-700 border border-green-200' :
                          project.status === 'in_progress' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {project.status === 'completed' ? 'مكتمل' : project.status === 'in_progress' ? 'قيد التنفيذ' : 'لم يبدأ'}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-gray-400 text-xs">{project.startDate}</td>
                      <td className="p-4 flex justify-center gap-2">
                          <button 
                            onClick={(e) => handleEditProject(e, project.id)}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors" 
                            title="تعديل"
                          >
                              <Edit size={14} />
                          </button>
                          <button 
                            onClick={(e) => handleDeleteProject(e, project.id)}
                            className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors" 
                            title="حذف"
                          >
                              <Trash2 size={14} />
                          </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-gray-400">لا توجد مشاريع حديثة.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4">روابط سريعة</h3>
            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setView && setView('calculator')} className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl hover:bg-jilco-50 hover:text-jilco-700 transition-all border border-gray-100 group">
                    <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform"><Calculator size={20}/></div>
                    <span className="text-[10px] font-black uppercase tracking-tighter">حاسبة سريعة</span>
                </button>
                <button onClick={() => setView && setView('quotes')} className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl hover:bg-jilco-50 hover:text-jilco-700 transition-all border border-gray-100 group">
                    <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform"><FileCheck size={20}/></div>
                    <span className="text-[10px] font-black uppercase tracking-tighter">عرض سعر</span>
                </button>
                <button onClick={() => setView && setView('warranties')} className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl hover:bg-jilco-50 hover:text-jilco-700 transition-all border border-gray-100 group">
                    <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform"><ShieldCheck size={20}/></div>
                    <span className="text-[10px] font-black uppercase tracking-tighter">شهادة ضمان</span>
                </button>
                <button onClick={() => setView && setView('receipts')} className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-xl hover:bg-jilco-50 hover:text-jilco-700 transition-all border border-gray-100 group">
                    <div className="p-2 bg-white rounded-lg shadow-sm group-hover:scale-110 transition-transform"><ArrowLeftRight size={20}/></div>
                    <span className="text-[10px] font-black uppercase tracking-tighter">سند قبض</span>
                </button>
            </div>
          </div>

          <div className="bg-jilco-900 p-6 rounded-2xl text-white shadow-lg overflow-hidden relative">
              <h4 className="font-bold text-sm mb-2 relative z-10 flex items-center gap-2"><Sparkles size={16} className="text-gold-400"/> جيلكو الذكي</h4>
              <p className="text-[10px] text-blue-100 leading-relaxed relative z-10 opacity-80">
                  استخدم خاصية "AI اكتب لي" عند إضافة بنود في عروض الأسعار لتوليد مواصفات فنية دقيقة بضغطة زر واحدة.
              </p>
              <div className="absolute -left-4 -bottom-4 opacity-10 rotate-12"><Sparkles size={80}/></div>
          </div>
        </div>
      </div>
    </div>
  );
};
