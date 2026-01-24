
import React, { useState, useEffect } from 'react';
import { Building, Upload, Trash2, CreditCard, Save, Phone, Mail, MapPin, FileSignature, User, CheckCircle2, Download, DatabaseBackup, AlertTriangle, Cloud, CloudRain, Server, RefreshCw, HardDrive, Info, Eye } from 'lucide-react';
import { CompanyConfig, BankAccount } from '../types';
import { cloudService } from '../services/cloudService.ts';

const INITIAL_CONFIG: CompanyConfig = {
    logo: null,
    stamp: null,
    headerTitle: 'جيلكو للمصاعد',
    headerSubtitle: 'Jilco Elevators Co.',
    footerText: 'المملكة العربية السعودية - الرياض - هاتف: 920000000 - س.ت: 1010101010',
    contactPhone: '+966 50 000 0000',
    contactEmail: 'sales@jilco-elevators.com',
    bankAccounts: [
       {
        id: 'ncb',
        bankName: 'البنك الأهلي التجاري (SNB)',
        accountNumber: '',
        iban: 'SA'
      },
      {
        id: 'rajhi',
        bankName: 'مصرف الراجحي',
        accountNumber: '',
        iban: 'SA'
      }
    ]
  };

export const CompanyProfileModule: React.FC = () => {
  const [config, setConfig] = useState<CompanyConfig>(INITIAL_CONFIG);
  const [showSaved, setShowSaved] = useState(false);
  
  // Cloud State
  const [cloudConnString, setCloudConnString] = useState('');
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'testing' | 'connected' | 'error' | 'syncing'>('idle');
  const [cloudMsg, setCloudMsg] = useState('');
  const [backupInfo, setBackupInfo] = useState<{exists: boolean, date?: string, size?: string} | null>(null);

  // Load Data
  useEffect(() => {
    const savedData = localStorage.getItem('jilco_quote_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.config) setConfig({ ...INITIAL_CONFIG, ...parsed.config });
      } catch (e) {
        console.error("Failed to load config", e);
      }
    }

    const savedConn = localStorage.getItem('jilco_neon_connection');
    if (savedConn) {
        setCloudConnString(savedConn);
        // Auto check on load if string exists
        checkCloudData(savedConn);
    }
  }, []);

  // Save Data
  const handleSave = () => {
    const savedData = localStorage.getItem('jilco_quote_data');
    let dataToSave: any = { config };
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        dataToSave = { ...parsed, config };
      } catch (e) {}
    }
    localStorage.setItem('jilco_quote_data', JSON.stringify(dataToSave));
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'stamp') => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setConfig(prev => ({ ...prev, [type]: ev.target!.result as string }));
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleBankChange = (index: number, field: keyof BankAccount, value: string) => {
    const newBanks = [...config.bankAccounts];
    newBanks[index] = { ...newBanks[index], [field]: value };
    setConfig({ ...config, bankAccounts: newBanks });
  };

  const addBankAccount = () => {
    setConfig(prev => ({
        ...prev,
        bankAccounts: [...prev.bankAccounts, { id: Date.now().toString(), bankName: 'بنك جديد', accountNumber: '', iban: 'SA' }]
    }));
  };

  const removeBankAccount = (index: number) => {
    const newBanks = [...config.bankAccounts];
    newBanks.splice(index, 1);
    setConfig({ ...config, bankAccounts: newBanks });
  };

  // --- Backup & Restore Logic (Local) ---
  const getAllData = () => {
    const keys = [
      'jilco_quote_data', 'jilco_quotes_archive', 'jilco_invoices_archive', 
      'jilco_receipts_archive', 'jilco_contracts_archive', 'jilco_customers', 
      'jilco_projects', 'jilco_phases', 'jilco_specs_db', 'jilco_suppliers',
      'jilco_supplier_products', 'jilco_purchase_invoices', 'jilco_supplier_payments',
      'jilco_warranties_archive', 'jilco_hr_employees', 'jilco_hr_commissions',
      'jilco_smart_elevators', 'jilco_documents', 'jilco_system_users'
    ];
    const data: Record<string, string | null> = {};
    keys.forEach(k => data[k] = localStorage.getItem(k));
    return data;
  };

  const importData = (data: any) => {
      Object.entries(data).forEach(([key, val]) => {
        if (val) localStorage.setItem(key, val as string);
      });
      window.location.reload();
  };

  // --- Cloud Logic ---
  const checkCloudData = async (connStr: string) => {
      if (!connStr) return;
      const info: any = await cloudService.getBackupInfo(connStr);
      if (info.exists) {
          const date = new Date(info.updatedAt).toLocaleString('ar-SA');
          const sizeKB = (info.sizeBytes / 1024).toFixed(2);
          setBackupInfo({ exists: true, date, size: sizeKB });
          setCloudStatus('connected');
      } else {
          setBackupInfo({ exists: false });
      }
  };

  const handleCloudConnect = async () => {
      if (!cloudConnString) return;
      setCloudStatus('testing');
      setCloudMsg('جاري الاتصال...');
      setBackupInfo(null);
      
      const success = await cloudService.testConnection(cloudConnString);
      if (success) {
          localStorage.setItem('jilco_neon_connection', cloudConnString);
          
          // Init DB
          try {
              await cloudService.initDb(cloudConnString);
              setCloudMsg('تم الاتصال بنجاح.');
              setCloudStatus('connected');
              await checkCloudData(cloudConnString);
          } catch (e) {
              setCloudMsg('تم الاتصال ولكن فشل إنشاء الجدول.');
          }
      } else {
          setCloudStatus('error');
          setCloudMsg('فشل الاتصال. تأكد من صحة الرابط.');
      }
  };

  const handleCloudUpload = async () => {
      if (cloudStatus !== 'connected') { alert('يرجى الاتصال بقاعدة البيانات أولاً'); return; }
      if (!window.confirm('سيتم رفع جميع بياناتك الحالية إلى السحابة واستبدال النسخة الموجودة هناك. متابعة؟')) return;

      setCloudStatus('syncing');
      setCloudMsg('جاري رفع البيانات...');
      try {
          const data = getAllData();
          await cloudService.uploadData(cloudConnString, data);
          setCloudMsg('تم رفع النسخة الاحتياطية للسحابة بنجاح ✅');
          setCloudStatus('connected');
          await checkCloudData(cloudConnString); // Refresh info
      } catch (e) {
          setCloudStatus('error');
          setCloudMsg('حدث خطأ أثناء الرفع.');
      }
  };

  const handleCloudDownload = async () => {
      if (cloudStatus !== 'connected') { alert('يرجى الاتصال بقاعدة البيانات أولاً'); return; }
      if (!window.confirm('تحذير: سيتم استبدال جميع البيانات الموجودة على هذا الجهاز بالنسخة المسحوبة من السحابة. لا يمكن التراجع. هل أنت متأكد؟')) return;

      setCloudStatus('syncing');
      setCloudMsg('جاري سحب البيانات...');
      try {
          const data = await cloudService.downloadData(cloudConnString);
          if (data) {
              importData(data); // This reloads the page
          } else {
              setCloudMsg('لا توجد نسخة احتياطية في السحابة.');
              setCloudStatus('connected');
          }
      } catch (e) {
          setCloudStatus('error');
          setCloudMsg('حدث خطأ أثناء التنزيل.');
      }
  };

  return (
    <div className="flex-1 bg-gray-100 h-full overflow-y-auto animate-fade-in p-8">
        <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                        <Building className="text-gold-500" /> الملف التعريفي للشركة
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">إدارة الهوية البصرية، معلومات التواصل، والحسابات البنكية</p>
                </div>
                
                <button 
                    onClick={handleSave} 
                    className={`px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all ${showSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-jilco-900 hover:bg-jilco-800'} text-white`}
                >
                    {showSaved ? <CheckCircle2 size={18} /> : <Save size={18} />}
                    {showSaved ? 'تم الحفظ بنجاح' : 'حفظ التغييرات'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Branding Images & Cloud */}
                <div className="lg:col-span-1 space-y-6">
                    
                    {/* Cloud Database Card */}
                    <div className="bg-jilco-950 p-6 rounded-xl shadow-lg border border-jilco-800 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500 opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                        <h3 className="font-bold text-gold-400 mb-4 flex items-center gap-2 border-b border-jilco-800 pb-2">
                            <Cloud size={18}/> المزامنة السحابية (Neon)
                        </h3>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 block mb-1">رابط الاتصال (Connection String)</label>
                                <input 
                                    type="text" 
                                    value={cloudConnString}
                                    onChange={e => setCloudConnString(e.target.value)}
                                    placeholder="postgres://user:pass@host/neondb..."
                                    className="w-full p-2 rounded bg-jilco-900 border border-jilco-800 text-white text-xs font-mono outline-none focus:border-gold-500"
                                />
                            </div>
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleCloudConnect}
                                    disabled={cloudStatus === 'testing'}
                                    className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors ${cloudStatus === 'connected' ? 'bg-green-600 text-white' : 'bg-gold-500 text-black hover:bg-gold-400'}`}
                                >
                                    {cloudStatus === 'testing' ? 'جاري الفحص...' : cloudStatus === 'connected' ? 'متصل بنجاح ✅' : 'اتصال وتهيئة'}
                                </button>
                            </div>

                            {/* Status Message */}
                            {cloudMsg && (
                                <p className={`text-[10px] p-2 rounded text-center font-bold ${cloudStatus === 'error' ? 'bg-red-900/50 text-red-200' : 'bg-jilco-800 text-green-200'}`}>
                                    {cloudMsg}
                                </p>
                            )}

                            {/* Backup Info Display */}
                            <div className="bg-white/5 p-3 rounded-lg border border-white/10 mt-2">
                                <p className="text-[10px] font-bold text-gray-400 mb-2 flex items-center gap-1"><Info size={10}/> حالة البيانات في السحابة:</p>
                                {backupInfo ? (
                                    backupInfo.exists ? (
                                        <div className="text-xs space-y-1">
                                            <p className="text-green-400 font-bold flex items-center gap-1"><CheckCircle2 size={10}/> توجد نسخة احتياطية</p>
                                            <p className="text-gray-300">التاريخ: <span className="text-white font-mono">{backupInfo.date}</span></p>
                                            <p className="text-gray-300">الحجم: <span className="text-white font-mono">{backupInfo.size} KB</span></p>
                                        </div>
                                    ) : (
                                        <p className="text-amber-400 text-xs font-bold flex items-center gap-1"><AlertTriangle size={10}/> لا توجد بيانات محفوظة على هذا الرابط.</p>
                                    )
                                ) : (
                                    <p className="text-gray-500 text-[10px] italic">اضغط "اتصال" لفحص البيانات...</p>
                                )}
                            </div>

                            {/* Actions */}
                            {cloudStatus === 'connected' && (
                                <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-jilco-800">
                                    <button onClick={handleCloudUpload} disabled={cloudStatus === 'syncing'} className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-[10px] font-bold flex flex-col items-center gap-1">
                                        <Upload size={14}/> رفع للسحابة (يدوي)
                                    </button>
                                    <button onClick={handleCloudDownload} disabled={cloudStatus === 'syncing'} className="bg-jilco-700 hover:bg-jilco-600 text-white py-2 rounded-lg text-[10px] font-bold flex flex-col items-center gap-1">
                                        <Download size={14}/> استعادة من السحابة
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Logo Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Upload size={18} className="text-jilco-600"/> شعار الشركة (Logo)
                        </h3>
                        <div className="w-full aspect-video border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden relative group mb-4">
                            {config.logo ? (
                                <>
                                    <img src={config.logo} alt="Logo" className="w-full h-full object-contain p-4" />
                                    <button onClick={() => setConfig(c => ({...c, logo: null}))} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><Trash2 size={14} /></button>
                                </>
                            ) : (
                                <div className="text-center text-gray-400">
                                    <Building size={48} className="mx-auto mb-2 opacity-50"/>
                                    <span className="text-sm">لا يوجد شعار</span>
                                </div>
                            )}
                        </div>
                        <label className="block w-full text-center py-2 bg-jilco-50 text-jilco-700 font-bold rounded border border-jilco-200 hover:bg-jilco-100 cursor-pointer transition-colors text-sm">
                             اختر ملف الشعار
                             <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} />
                        </label>
                    </div>

                    {/* Stamp Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <FileSignature size={18} className="text-jilco-600"/> الختم الرسمي (Stamp)
                        </h3>
                        <div className="w-full aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden relative group mb-4">
                            {config.stamp ? (
                                <>
                                    <img src={config.stamp} alt="Stamp" className="w-full h-full object-contain p-4" />
                                    <button onClick={() => setConfig(c => ({...c, stamp: null}))} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><Trash2 size={14} /></button>
                                </>
                            ) : (
                                <div className="text-center text-gray-400">
                                    <FileSignature size={48} className="mx-auto mb-2 opacity-50"/>
                                    <span className="text-sm">لا يوجد ختم</span>
                                </div>
                            )}
                        </div>
                        <label className="block w-full text-center py-2 bg-jilco-50 text-jilco-700 font-bold rounded border border-jilco-200 hover:bg-jilco-100 cursor-pointer transition-colors text-sm">
                             اختر ملف الختم
                             <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'stamp')} />
                        </label>
                    </div>
                </div>

                {/* Right Column: Forms */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Basic Info */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">معلومات الشركة الأساسية</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">اسم الشركة (العنوان الرئيسي)</label>
                                <input type="text" value={config.headerTitle} onChange={e => setConfig({...config, headerTitle: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black font-bold" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">العنوان الفرعي (Subtitle)</label>
                                <input type="text" value={config.headerSubtitle} onChange={e => setConfig({...config, headerSubtitle: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black font-bold" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">نص التذييل (Footer Text)</label>
                                <input type="text" value={config.footerText} onChange={e => setConfig({...config, footerText: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black font-bold" />
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100">معلومات التواصل</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">رقم الهاتف الرسمي</label>
                                <div className="relative">
                                    <Phone size={16} className="absolute right-3 top-3 text-gray-400"/>
                                    <input type="text" value={config.contactPhone} onChange={e => setConfig({...config, contactPhone: e.target.value})} className="w-full pr-9 pl-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black font-bold" dir="ltr" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">البريد الإلكتروني</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute right-3 top-3 text-gray-400"/>
                                    <input type="email" value={config.contactEmail} onChange={e => setConfig({...config, contactEmail: e.target.value})} className="w-full pr-9 pl-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black font-bold" dir="ltr" />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 mb-1">رقم الضريبة / السجل التجاري</label>
                                <div className="relative">
                                    <CreditCard size={16} className="absolute right-3 top-3 text-gray-400"/>
                                    <input type="text" value={config.vatNumber || ''} onChange={e => setConfig({...config, vatNumber: e.target.value})} placeholder="مثال: 300000000000003" className="w-full pr-9 pl-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black font-bold" dir="ltr" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bank Accounts */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800">الحسابات البنكية</h3>
                            <button onClick={addBankAccount} className="text-xs bg-jilco-50 text-jilco-700 px-3 py-1.5 rounded-lg font-bold hover:bg-jilco-100">+ إضافة بنك</button>
                        </div>
                        
                        <div className="space-y-4">
                            {config.bankAccounts.map((bank, idx) => (
                                <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200 relative group">
                                    <button onClick={() => removeBankAccount(idx)} className="absolute top-2 left-2 text-red-300 hover:text-red-500"><Trash2 size={16}/></button>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 mb-1">اسم البنك</label>
                                            <input type="text" value={bank.bankName} onChange={e => handleBankChange(idx, 'bankName', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs font-bold bg-white text-black" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 mb-1">رقم الحساب</label>
                                            <input type="text" value={bank.accountNumber} onChange={e => handleBankChange(idx, 'accountNumber', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs font-bold font-mono bg-white text-black" dir="ltr" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 mb-1">IBAN</label>
                                            <input type="text" value={bank.iban} onChange={e => handleBankChange(idx, 'iban', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs font-bold font-mono bg-white text-black" dir="ltr" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {config.bankAccounts.length === 0 && <p className="text-center text-sm text-gray-400 py-4">لا توجد حسابات بنكية مضافة.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
