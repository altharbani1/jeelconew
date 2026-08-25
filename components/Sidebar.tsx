
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { Plus, Trash2, Printer, Sparkles, Save, Database, User, ClipboardList, DollarSign, FileText, Star, ShieldCheck, Scale, Users, ImageIcon, Image as ImageIconLucide, ChevronDown } from 'lucide-react';
import { QuoteItem, QuoteDetails, CompanyConfig, TechnicalSpecs, SpecsDatabase, SupplierProduct, Customer } from '../types.ts';
import { generateTechnicalDescription } from '../services/geminiService.ts';
import { ShareButton } from './ShareButton.tsx';
import { useSales } from '../contexts/SalesContext.tsx';
import { useData } from '../contexts/DataContext.tsx';

const DEFAULT_SPECS_DB: SpecsDatabase = {
    elevatorType: ['مصعد ركاب (Passenger)', 'مصعد بضائع (Freight)', 'مصعد طعام (Dumbwaiter)', 'مصعد بانوراما (Panoramic)', 'مصعد منزلي (Home Lift)'],
    capacity: ['320 كجم - 4 أشخاص', '450 كجم - 6 أشخاص', '630 كجم - 8 أشخاص', '800 كجم - 10 أشخاص', '1000 كجم - 13 شخص', '1250 كجم - 16 شخص'],
    speed: ['0.5 متر/ثانية', '1.0 متر/ثانية', '1.6 متر/ثانية', '2.0 متر/ثانية'],
    stops: ['2 وقفات / 2 فتحات', '3 وقفات / 3 فتحات', '4 وقفات / 4 فتحات', '5 وقفات / 5 فتحات', '6 وقفات / 6 فتحات'],
    driveType: ['Gearless Machine (Montanari Italy)', 'Gearless Machine (Sicor Italy)', 'Geared Machine (Alberto Sassi)', 'Geared Machine (Torin Drive)', 'FUJI Gearless Machine'],
    controlSystem: ['Microprocessor Full Collective (VVVF)', 'Monarch Nice 3000+', 'Step Control System'],
    powerSupply: ['3 Phase, 380V, 60Hz', '3 Phase, 220V, 60Hz', 'Single Phase, 220V, 60Hz'],
    cabin: ['ستانلس ستيل مع ديكورات ليزر ومرايا', 'ستانلس ستيل ذهبي (Ti-Gold)', 'بانوراما زجاجي كامل'],
    doors: ['أوتوماتيكية بالكامل (Center Opening)', 'أوتوماتيكية بالكامل (Telescopic)', 'نصف أوتوماتيك (Semi-Auto)', 'أبواب سيلكوم إيطالي فل أوتوماتيك'],
    externalDoors: ['أوتوماتيكية بالكامل (Center Opening)', 'أوتوماتيكية بالكامل (Telescopic)', 'نصف أوتوماتيك (Semi-Auto)', 'أبواب سيلكوم إيطالي فل أوتوماتيك'],
    machineRoom: ['غرفة ماكينة علوية (MR)', 'بدون غرفة ماكينة (MRL)', 'غرفة ماكينة جانبية'],
    rails: ['سكك مسحوبة على البارد (Marazzi Italy)', 'سكك مشغولة (Machined)'],
    ropes: ['حبال صلب (Drako German)', 'حبال صلب (Italian)'],
    safety: ['نظام باراشوت تدريجي (Progressive)', 'منظم سرعة (Overspeed Governor)'],
    emergency: ['نظام الطوارئ الأوتوماتيكي (ARD/UPS)', 'بطارية طوارئ للإضاءة والجرس']
};

interface SidebarProps {
    items: QuoteItem[];
    setItems: React.Dispatch<React.SetStateAction<QuoteItem[]>>;
    details: QuoteDetails;
    setDetails: React.Dispatch<React.SetStateAction<QuoteDetails>>;
    techSpecs: TechnicalSpecs;
    setTechSpecs: React.Dispatch<React.SetStateAction<TechnicalSpecs>>;
    config: CompanyConfig;
    setConfig: React.Dispatch<React.SetStateAction<CompanyConfig>>;
    onPrint: () => void;
    onSave: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    items, setItems, details, setDetails, techSpecs, setTechSpecs, config, setConfig, onPrint, onSave
}) => {
    const { currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState<'details' | 'specs' | 'items' | 'features' | 'obligations' | 'handover' | 'terms' | 'gallery'>('details');

    // صلاحيات الموديولات حسب الدور — مُشتق من AuthContext
    const role = currentUser?.role;
    const allowedModules = {
        admin: [
            'dashboard', 'customers', 'quotes', 'contracts', 'projects', 'invoices', 'receipts', 'expenses', 'purchases', 'claims', 'hr', 'documents', 'forms', 'users', 'warranties', 'smart_elevator', 'calculator', 'company_profile', 'specs_manager', 'activity_log'
        ],
        manager: [
            'dashboard', 'customers', 'quotes', 'contracts', 'projects', 'invoices', 'receipts', 'expenses', 'purchases', 'claims', 'hr', 'documents', 'forms', 'warranties', 'smart_elevator', 'calculator', 'company_profile', 'specs_manager', 'activity_log'
        ],
        staff: [
            'dashboard', 'customers', 'quotes', 'contracts', 'projects', 'invoices', 'receipts', 'expenses', 'purchases', 'claims', 'hr', 'documents', 'forms', 'warranties', 'smart_elevator', 'calculator', 'company_profile', 'specs_manager', 'activity_log'
        ]
    };
    // استخدم allowedModules[role] لتصفية الموديولات
    const { customers } = useSales();
    const { specsDb: globalSpecsDb } = useData();
    const [specsDb, setSpecsDb] = useState<SpecsDatabase>(DEFAULT_SPECS_DB);
    const [productsDb, setProductsDb] = useState<SupplierProduct[]>([]);

    const [newItemDesc, setNewItemDesc] = useState('');
    const [newItemDetails, setNewItemDetails] = useState('');
    const [newItemPrice, setNewItemPrice] = useState(0);
    const [newItemQty, setNewItemQty] = useState(1);
    const [priceIncludesTax, setPriceIncludesTax] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (globalSpecsDb && Object.keys(globalSpecsDb).length > 0) {
            setSpecsDb({ ...DEFAULT_SPECS_DB, ...globalSpecsDb });
        }
    }, [globalSpecsDb]);

    useEffect(() => {
        const savedProducts = localStorage.getItem('jilco_supplier_products');
        if (savedProducts) {
            try { setProductsDb(JSON.parse(savedProducts)); } catch (e) { }
        }
    }, []);

    const handleAddItem = () => {
        if (!newItemDesc) return;

        let finalUnitPrice = newItemPrice;
        if (priceIncludesTax) {
            const taxRate = details.taxRate || 15;
            finalUnitPrice = newItemPrice / (1 + (taxRate / 100));
        }

        const item: QuoteItem = {
            id: Date.now().toString(),
            description: newItemDesc,
            details: newItemDetails,
            quantity: newItemQty,
            unitPrice: finalUnitPrice,
            total: finalUnitPrice * newItemQty
        };
        setItems([...items, item]);
        setNewItemDesc('');
        setNewItemDetails('');
        setNewItemPrice(0);
        setNewItemQty(1);
        setPriceIncludesTax(false);
    };

    const handleDescChange = (val: string) => {
        setNewItemDesc(val);
        const product = productsDb.find(p => p.name === val);
        if (product) setNewItemPrice(product.purchasePrice);
    };

    const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const customerId = e.target.value;
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            setDetails(prev => ({
                ...prev,
                customerName: customer.fullName,
                customerAddress: customer.address || prev.customerAddress,
                projectName: prev.projectName || (customer.companyName ? customer.companyName : '')
            }));
        }
    };

    const handleAIAssist = async () => {
        if (!newItemDesc) return;
        setIsGenerating(true);
        const result = await generateTechnicalDescription(newItemDesc);
        setNewItemDetails(result);
        setIsGenerating(false);
    };

    const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'cabin' | 'buttons' | 'doors') => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setDetails(prev => ({
                        ...prev,
                        galleryImages: {
                            ...(prev.galleryImages || {}),
                            [type]: ev.target!.result as string
                        }
                    }));
                }
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const addPaymentTerm = () => {
        setDetails({
            ...details,
            paymentTerms: [...details.paymentTerms, { name: 'دفعة جديدة', percentage: 0 }]
        });
    };

    const updatePaymentTerm = (idx: number, field: 'name' | 'percentage', value: any) => {
        const newTerms = [...details.paymentTerms];
        newTerms[idx] = { ...newTerms[idx], [field]: value };
        setDetails({ ...details, paymentTerms: newTerms });
    };

    const removePaymentTerm = (idx: number) => {
        const newTerms = details.paymentTerms.filter((_, i) => i !== idx);
        setDetails({ ...details, paymentTerms: newTerms });
    };

    const renderSpecSelect = (label: string, field: keyof TechnicalSpecs) => (
        <div className="mb-4">
            <label className="block text-[11px] font-black text-gray-500 mb-1 uppercase">{label}</label>
            <select
                title={`اختر ${label}`}
                value={techSpecs[field] || ''}
                onChange={e => setTechSpecs({ ...techSpecs, [field]: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-jilco-600 outline-none shadow-sm font-bold text-gray-900"
            >
                <option value="">-- اختر {label} --</option>
                {(specsDb[field] || DEFAULT_SPECS_DB[field] || []).map((opt: string, idx: number) => (
                    <option key={`${field}-${idx}`} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );

    return (
        <div className="w-full lg:w-1/3 bg-white border-l border-gray-200 h-full overflow-y-auto no-print shadow-2xl z-20 flex flex-col">
            <div className="p-6 bg-jilco-900 text-white flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-xl font-bold">جيلكو | التحكم</h2>
                    <p className="text-[10px] opacity-60">نظام عروض الأسعار الذكي</p>
                </div>
                <div className="flex gap-2 items-center">
                    <button onClick={onSave} className="bg-green-600 p-2.5 rounded-xl hover:bg-green-700 shadow-lg transition-all" title="حفظ العرض"><Save size={18} /></button>
                    <button onClick={onPrint} className="bg-gold-500 p-2.5 rounded-xl hover:bg-gold-600 shadow-lg transition-all" title="تحميل PDF / طباعة"><Printer size={18} /></button>
                    <ShareButton
                        elementId="printable-area"
                        fileName={`عرض_سعر_${details.number || 'جديد'}`}
                        documentTitle={`عرض السعر رقم ${details.number || ''}`}
                        recipientName={details.customerName || ''}
                        documentType="quote"
                        className="shrink-0"
                    />
                </div>
            </div>

            <div className="flex border-b border-gray-100 bg-gray-50 shrink-0 overflow-x-auto no-scrollbar">
                {['details', 'items', 'specs', 'obligations', 'features', 'handover', 'gallery', 'terms'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex-1 py-4 px-4 text-xs font-black whitespace-nowrap transition-all ${activeTab === tab ? 'border-b-4 border-jilco-600 text-jilco-900 bg-white' : 'text-gray-400'}`}
                    >
                        {tab === 'details' ? 'العميل' : tab === 'items' ? 'البنود' : tab === 'specs' ? 'مواصفات' : tab === 'obligations' ? 'الالتزامات' : tab === 'features' ? 'المزايا' : tab === 'handover' ? 'التسليم' : tab === 'gallery' ? 'الصور' : 'الشروط'}
                    </button>
                ))}
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-gray-50/30">
                {activeTab === 'details' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex items-center gap-2 text-jilco-900 font-bold mb-2"><User size={16} /> معلومات المشروع</div>

                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                            <label className="text-[10px] font-black text-blue-800 mb-1 flex items-center gap-1">
                                <Users size={12} /> استيراد بيانات عميل مسجل
                            </label>
                            <select
                                title="اختر عميلاً لاستيراد بياناته"
                                onChange={handleCustomerSelect}
                                className="w-full p-2 text-xs border border-gray-300 rounded-lg outline-none bg-white font-bold text-gray-900"
                                defaultValue=""
                            >
                                <option value="" disabled>-- اختر العميل --</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.fullName} - {c.phone}</option>
                                ))}
                            </select>
                        </div>

                        <div><label className="block text-[10px] font-black text-gray-500 mb-1">رقم العرض</label><input type="text" title="رقم العرض" placeholder="Q-2024-001" value={details.number} onChange={e => setDetails({ ...details, number: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg font-mono text-sm bg-white text-gray-900 focus:border-jilco-500 outline-none" /></div>
                        <div><label className="block text-[10px] font-black text-gray-500 mb-1">اسم العميل</label><input type="text" title="اسم العميل" placeholder="اسم العميل" value={details.customerName} onChange={e => setDetails({ ...details, customerName: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:border-jilco-500 outline-none" /></div>
                        <div><label className="block text-[10px] font-black text-gray-500 mb-1">الموقع/المشروع</label><input type="text" title="اسم المشروع أو الموقع" placeholder="موقع المشروع" value={details.projectName} onChange={e => setDetails({ ...details, projectName: e.target.value })} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:border-jilco-500 outline-none" /></div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                            <div><label className="block text-[10px] font-black text-gray-500 mb-1 uppercase">ضمان التركيب (سنة)</label><input type="text" title="فترة ضمان التركيب" placeholder="1" value={details.warrantyInstallation} onChange={e => setDetails({ ...details, warrantyInstallation: e.target.value })} className="w-full p-2 border border-gray-300 rounded text-center font-bold bg-white text-gray-900" /></div>
                            <div><label className="block text-[10px] font-black text-gray-500 mb-1 uppercase">ضمان الماكينة (سنة)</label><input type="text" title="فترة ضمان الماكينة" placeholder="3" value={details.warrantyMotor} onChange={e => setDetails({ ...details, warrantyMotor: e.target.value })} className="w-full p-2 border border-gray-300 rounded text-center font-bold bg-white text-gray-900" /></div>
                        </div>

                        <div className="pt-2">
                            <label className="block text-[10px] font-black text-gray-500 mb-1 uppercase text-jilco-900">مدة التنفيذ (يوم)</label>
                            <input
                                title="مدة التنفيذ"
                                type="text"
                                value={details.worksDuration}
                                onChange={e => setDetails({ ...details, worksDuration: e.target.value })}
                                className="w-full p-2.5 border border-jilco-300 rounded-lg text-center font-black bg-white text-gray-900 focus:ring-2 focus:ring-jilco-500 outline-none"
                                placeholder="60 يوماً"
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'items' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                            <h4 className="text-xs font-black text-jilco-900 mb-4 flex items-center gap-2">إضافة بند مالي جديد</h4>
                            <div className="space-y-4">
                                <div>
                                    <input
                                        title="اسم البند"
                                        type="text"
                                        placeholder="اسم البند (مثال: توريد مصعد إيطالي)"
                                        value={newItemDesc}
                                        onChange={e => handleDescChange(e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-xl text-sm font-black bg-white text-gray-900 focus:border-jilco-500 outline-none"
                                        list="savedProducts"
                                    />
                                    <datalist id="savedProducts">
                                        {productsDb.map((p, idx) => (
                                            <option key={idx} value={p.name} />
                                        ))}
                                    </datalist>
                                </div>

                                <div className="relative">
                                    <textarea
                                        title="المواصفات الفنية التفصيلية"
                                        placeholder="المواصفات الفنية التفصيلية..."
                                        value={newItemDetails}
                                        onChange={e => setNewItemDetails(e.target.value)}
                                        className="w-full p-3 border border-gray-300 rounded-xl h-40 text-xs leading-relaxed font-bold bg-white text-gray-900 focus:border-jilco-500 outline-none"
                                    />
                                    <button title="توليد ذكي (AI)" onClick={handleAIAssist} disabled={isGenerating} className="absolute bottom-3 left-3 bg-jilco-900 text-white px-3 py-2 rounded-lg text-[10px] font-bold flex items-center gap-2 hover:bg-black transition-all shadow-md">
                                        <Sparkles size={14} className="text-gold-400" /> {isGenerating ? 'جاري التوليد...' : 'توليد ذكي (AI)'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-black text-gray-500 block">السعر (SAR)</label>
                                            <label className="flex items-center gap-1 cursor-pointer select-none">
                                                <input
                                                    title="ضريبة مشمولة بالمبلغ"
                                                    type="checkbox"
                                                    checked={priceIncludesTax}
                                                    onChange={e => setPriceIncludesTax(e.target.checked)}
                                                    className="w-3 h-3 accent-jilco-600 rounded"
                                                />
                                                <span className={`text-[9px] font-bold ${priceIncludesTax ? 'text-jilco-700' : 'text-gray-400'}`}>شامل؟</span>
                                            </label>
                                        </div>
                                        <input title="السعر" type="number" value={newItemPrice} onChange={e => setNewItemPrice(parseFloat(e.target.value) || 0)} className="w-full p-3 border border-gray-300 rounded-xl font-mono font-black text-jilco-700 bg-white focus:border-jilco-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-500 mb-1 block">الكمية</label>
                                        <input title="الكمية" type="number" value={newItemQty} onChange={e => setNewItemQty(parseFloat(e.target.value) || 1)} className="w-full p-3 border border-gray-300 rounded-xl text-center font-black bg-white text-gray-900 focus:border-jilco-500 outline-none" />
                                    </div>
                                </div>
                                <button title="إدراج البند" onClick={handleAddItem} className="w-full bg-jilco-600 text-white py-3 rounded-xl font-black text-sm hover:bg-jilco-700 transition-all shadow-lg">+ إدراج البند</button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {items.map(item => (
                                <div key={item.id} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex justify-between items-center group">
                                    <div className="flex-1">
                                        <p className="font-black text-sm text-gray-900">{item.description}</p>
                                        <p className="text-xs font-mono text-jilco-600 font-bold">{item.total.toLocaleString()} SAR</p>
                                    </div>
                                    <button title="حذف البند" onClick={() => setItems(items.filter(i => i.id !== item.id))} className="text-red-300 hover:text-red-600 p-2"><Trash2 size={18} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'specs' && (
                    <div className="animate-fade-in bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-2 text-jilco-900 font-black mb-6 p-2 border-b"><Database size={16} /> قاعدة المواصفات</div>
                        <div className="space-y-2">
                            {renderSpecSelect('نوع المصعد', 'elevatorType')}
                            {renderSpecSelect('الحمولة', 'capacity')}
                            {renderSpecSelect('السرعة', 'speed')}
                            {renderSpecSelect('الوقفات', 'stops')}
                            {renderSpecSelect('الماكينة', 'driveType')}
                            {renderSpecSelect('نظام التحكم', 'controlSystem')}
                            {renderSpecSelect('الكهرباء', 'powerSupply')}
                            {renderSpecSelect('الكابينة', 'cabin')}
                            {renderSpecSelect('الأبواب الداخلية', 'doors')}
                            {renderSpecSelect('الأبواب الخارجية', 'externalDoors')}
                            {renderSpecSelect('غرفة الماكينة', 'machineRoom')}
                            {renderSpecSelect('السكك', 'rails')}
                            {renderSpecSelect('الحبال', 'ropes')}
                            {renderSpecSelect('أنظمة الأمان', 'safety')}
                            {renderSpecSelect('جهاز الطوارئ', 'emergency')}
                        </div>
                    </div>
                )}

                {activeTab === 'obligations' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-xs font-black text-jilco-900 mb-3 flex items-center gap-2">
                                <Scale size={16} /> جدول الدفعات المالية
                            </h3>
                            <div className="space-y-2 mb-3">
                                {details.paymentTerms.map((term, idx) => (
                                    <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded border border-gray-200">
                                        <span className="text-[10px] font-black text-gray-400 w-4">{idx + 1}</span>
                                        <input
                                            title="نسبة الدفعة واسمها"
                                            type="text"
                                            value={term.name}
                                            onChange={(e) => updatePaymentTerm(idx, 'name', e.target.value)}
                                            className="flex-1 p-1.5 text-xs border border-gray-300 rounded outline-none font-black bg-white text-gray-900"
                                            placeholder="وصف الدفعة"
                                        />
                                        <div className="relative w-16">
                                            <input
                                                type="number"
                                                title="نسبة الدفعة"
                                                placeholder="0"
                                                value={term.percentage}
                                                onChange={(e) => updatePaymentTerm(idx, 'percentage', parseFloat(e.target.value))}
                                                className="w-full p-1.5 text-xs border border-gray-300 rounded outline-none text-center font-black bg-white text-gray-900"
                                            />
                                            <span className="absolute left-1 top-1.5 text-[9px] text-gray-400 pointer-events-none">%</span>
                                        </div>
                                        <button title="حذف الدفعة" onClick={() => removePaymentTerm(idx)} className="text-red-300 hover:text-red-500"><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center border-t pt-2">
                                <span className={`text-xs font-black ${details.paymentTerms.reduce((sum, t) => sum + t.percentage, 0) === 100 ? 'text-green-600' : 'text-red-500'}`}>
                                    الإجمالي: {details.paymentTerms.reduce((sum, t) => sum + t.percentage, 0)}%
                                </span>
                                <button title="إضافة دفعة" onClick={addPaymentTerm} className="text-xs bg-jilco-50 text-jilco-700 px-3 py-1 rounded font-black hover:bg-jilco-100">+ إضافة دفعة</button>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-xs font-black text-jilco-900 mb-2">إلتزامات الطرف الأول (المؤسسة)</h3>
                            <textarea
                                title="إلتزامات الطرف الأول"
                                placeholder="تحديد إلتزامات المؤسسة..."
                                value={details.firstPartyObligations || ''}
                                onChange={e => setDetails({ ...details, firstPartyObligations: e.target.value })}
                                className="w-full h-32 p-3 border border-gray-300 rounded-lg text-xs leading-loose outline-none focus:border-jilco-500 font-bold resize-none bg-white text-gray-900"
                            />
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-xs font-black text-jilco-900 mb-2">إلتزامات الطرف الثاني (العميل)</h3>
                            <textarea
                                title="إلتزامات الطرف الثاني"
                                placeholder="تحديد إلتزامات العميل..."
                                value={details.secondPartyObligations || ''}
                                onChange={e => setDetails({ ...details, secondPartyObligations: e.target.value })}
                                className="w-full h-32 p-3 border border-gray-300 rounded-lg text-xs leading-loose outline-none focus:border-jilco-500 font-bold resize-none bg-white text-gray-900"
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'features' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-xs font-black text-jilco-900 mb-3 flex items-center gap-2">
                                <Star size={16} /> قائمة المزايا الإضافية
                            </h3>
                            <textarea
                                title="قائمة المزايا الإضافية"
                                value={details.features ? details.features.join('\n') : ''}
                                onChange={e => setDetails({ ...details, features: e.target.value.split('\n') })}
                                className="w-full h-96 p-4 border border-gray-300 rounded-lg text-xs leading-loose outline-none focus:border-jilco-500 font-black resize-none bg-white text-gray-900"
                                placeholder="ميزة 1&#10;ميزة 2..."
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'handover' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-xs font-black text-jilco-900 mb-3 flex items-center gap-2">
                                <ShieldCheck size={16} /> بنود التسليم والضمان
                            </h3>
                            <textarea
                                title="بنود التسليم والضمان"
                                placeholder="أدخل بنود التسليم والضمان..."
                                value={details.handoverAndWarranty || ''}
                                onChange={e => setDetails({ ...details, handoverAndWarranty: e.target.value })}
                                className="w-full h-96 p-4 border border-gray-300 rounded-lg text-xs leading-loose outline-none focus:border-jilco-500 font-black resize-none bg-white text-gray-900"
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'gallery' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-6 border-b pb-4">
                                <h3 className="text-xs font-black text-jilco-900 flex items-center gap-2"><ImageIcon size={16} /> صور الملحقات</h3>
                                <label className="flex items-center gap-2 cursor-pointer bg-blue-50 px-3 py-1 rounded-lg">
                                    <input
                                        title="تفعيل صفحة الصور"
                                        type="checkbox"
                                        checked={details.showGallery || false}
                                        onChange={e => setDetails({ ...details, showGallery: e.target.checked })}
                                        className="w-4 h-4 accent-jilco-600"
                                    />
                                    <span className="text-xs font-black text-blue-900">تفعيل صفحة الصور</span>
                                </label>
                            </div>

                            <div className="space-y-6">
                                {['cabin', 'buttons', 'doors'].map((type) => (
                                    <div key={type} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase">
                                            {type === 'cabin' ? 'صور الكبينة' : type === 'buttons' ? 'صور أزرار الطلبات' : 'صور الأبواب والديكور'}
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-white relative overflow-hidden shadow-inner">
                                                {(details.galleryImages as any)?.[type] ? (
                                                    <img src={(details.galleryImages as any)[type]} className="w-full h-full object-contain" alt={type} />
                                                ) : (
                                                    <ImageIconLucide className="text-gray-200" size={32} />
                                                )}
                                            </div>
                                            <label className="px-4 py-2 bg-jilco-900 text-white rounded-lg text-xs font-black cursor-pointer hover:bg-black shadow-md">
                                                رفع صورة
                                                <input title="رفع صورة" type="file" className="hidden" accept="image/*" onChange={e => handleGalleryUpload(e, type as any)} />
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'terms' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-xs font-black text-jilco-900 mb-3">الشروط والأحكام العامة</h3>
                            <textarea
                                title="الشروط والأحكام"
                                value={details.termsAndConditions || ''}
                                onChange={e => setDetails({ ...details, termsAndConditions: e.target.value })}
                                className="w-full h-96 p-4 border border-gray-300 rounded-lg text-xs leading-loose outline-none focus:border-jilco-500 font-black resize-none bg-white text-gray-900"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
