
import React, { useState, useEffect } from 'react';
import { Building, Upload, Trash2, CreditCard, Save, Phone, Mail, MapPin, FileSignature, User, CheckCircle2, Download, DatabaseBackup, AlertTriangle, Cloud, CloudRain, Server, RefreshCw, HardDrive, Info, Eye } from 'lucide-react';
import { CompanyConfig, BankAccount } from '../types';
import { cloudService } from '../services/cloudService.ts';
import { useData } from '../contexts/DataContext.tsx';

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
    const { config: globalConfig, saveConfig } = useData();

    const [config, setConfig] = useState<CompanyConfig>(INITIAL_CONFIG);
    const [showSaved, setShowSaved] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Load Data
    useEffect(() => {
        if (globalConfig) {
            setConfig(globalConfig);
        }
    }, [globalConfig]);

    // Save Data
    const handleSave = () => {
        // Save using DataContext which handles Supabase sync internally
        saveConfig(config);

        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 3000);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'stamp') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            // عرض الصورة فوراً من Base64 كمعاينة
            const reader = new FileReader();
            reader.onload = async (ev) => {
                if (ev.target?.result) {
                    const base64 = ev.target.result as string;
                    setConfig(prev => ({ ...prev, [type]: base64 }));
                    // رفع لـ Supabase Storage في الخلفية
                    setUploadingImage(true);
                    const url = await cloudService.uploadImage(base64, `jilco_${type}_${Date.now()}`);
                    if (url) {
                        setConfig(prev => ({ ...prev, [type]: url }));
                        console.log(`✅ ${type} uploaded to Supabase:`, url);
                    }
                    setUploadingImage(false);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleBankChange = (index: number, field: keyof BankAccount, value: string) => {
        setConfig(prev => {
            const newBanks = [...prev.bankAccounts];
            newBanks[index] = { ...newBanks[index], [field]: value };
            return { ...prev, bankAccounts: newBanks };
        });
    };

    const addBankAccount = () => {
        setConfig(prev => ({
            ...prev,
            bankAccounts: [...prev.bankAccounts, { id: Date.now().toString(), bankName: 'بنك جديد', accountNumber: '', iban: 'SA' }]
        }));
    };

    const removeBankAccount = (index: number) => {
        setConfig(prev => {
            const newBanks = [...prev.bankAccounts];
            newBanks.splice(index, 1);
            return { ...prev, bankAccounts: newBanks };
        });
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

                        {/* Info Card */}
                        <div className="bg-jilco-950 p-6 rounded-xl shadow-lg border border-jilco-800 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500 opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                            <h3 className="font-bold text-gold-400 mb-4 flex items-center gap-2 border-b border-jilco-800 pb-2">
                                <Info size={18} /> التحديثات المباشرة
                            </h3>
                            <p className="text-xs text-gray-300">يتم حفظ ومزامنة بيانات الشركة تلقائياً عبر السحابة لحظة التعديل.</p>
                        </div>



                        {/* Logo Card */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Upload size={18} className="text-jilco-600" /> شعار الشركة (Logo)
                            </h3>
                            <div className="w-full aspect-video border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden relative group mb-4">
                                {config.logo ? (
                                    <>
                                        <img src={config.logo} alt="Logo" className="w-full h-full object-contain p-4" />
                                        <button title="حذف الشعار" onClick={() => setConfig(c => ({ ...c, logo: null }))} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><Trash2 size={14} /></button>
                                    </>
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <Building size={48} className="mx-auto mb-2 opacity-50" />
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
                                <FileSignature size={18} className="text-jilco-600" /> الختم الرسمي (Stamp)
                            </h3>
                            <div className="w-full aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden relative group mb-4">
                                {config.stamp ? (
                                    <>
                                        <img src={config.stamp} alt="Stamp" className="w-full h-full object-contain p-4" />
                                        <button title="حذف الختم" onClick={() => setConfig(c => ({ ...c, stamp: null }))} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><Trash2 size={14} /></button>
                                    </>
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <FileSignature size={48} className="mx-auto mb-2 opacity-50" />
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
                                    <input title="اسم الشركة" placeholder="اسم الشركة" type="text" value={config.headerTitle} onChange={e => setConfig({ ...config, headerTitle: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black font-bold" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">العنوان الفرعي (Subtitle)</label>
                                    <input title="العنوان الفرعي" placeholder="العنوان الفرعي" type="text" value={config.headerSubtitle} onChange={e => setConfig({ ...config, headerSubtitle: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black font-bold" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">نص التذييل (Footer Text)</label>
                                    <input title="نص التذييل" placeholder="نص التذييل" type="text" value={config.footerText} onChange={e => setConfig({ ...config, footerText: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black font-bold" />
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
                                        <Phone size={16} className="absolute right-3 top-3 text-gray-400" />
                                        <input title="رقم الهاتف" placeholder="رقم الهاتف" type="text" value={config.contactPhone} onChange={e => setConfig({ ...config, contactPhone: e.target.value })} className="w-full pr-9 pl-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black font-bold" dir="ltr" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">البريد الإلكتروني</label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute right-3 top-3 text-gray-400" />
                                        <input title="البريد الإلكتروني" placeholder="البريد الإلكتروني" type="email" value={config.contactEmail} onChange={e => setConfig({ ...config, contactEmail: e.target.value })} className="w-full pr-9 pl-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black font-bold" dir="ltr" />
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
                                        <button title="حذف الحساب" onClick={() => removeBankAccount(idx)} className="absolute top-2 left-2 text-red-300 hover:text-red-500"><Trash2 size={16} /></button>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 mb-1">اسم البنك</label>
                                                <input title="اسم البنك" placeholder="اسم البنك" type="text" value={bank.bankName} onChange={e => handleBankChange(idx, 'bankName', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs font-bold bg-white text-black" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 mb-1">رقم الحساب</label>
                                                <input title="رقم الحساب" placeholder="رقم الحساب" type="text" value={bank.accountNumber} onChange={e => handleBankChange(idx, 'accountNumber', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs font-bold font-mono bg-white text-black" dir="ltr" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 mb-1">IBAN</label>
                                                <input title="الآيبان" placeholder="الآيبان" type="text" value={bank.iban} onChange={e => handleBankChange(idx, 'iban', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs font-bold font-mono bg-white text-black" dir="ltr" />
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
        </div >
    );
};
