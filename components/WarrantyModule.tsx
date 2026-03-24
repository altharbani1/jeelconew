
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Search, Edit, Trash2, Printer, ArrowLeft, Save, User, Calendar, MapPin, Award } from 'lucide-react';
import { WarrantyData, CompanyConfig, Customer } from '../types';
import { useData } from '../contexts/DataContext.tsx';
import { useSales } from '../contexts/SalesContext.tsx';
import { useProject } from '../contexts/ProjectContext.tsx';

const INITIAL_CONFIG: CompanyConfig = {
    logo: null,
    stamp: null,
    headerTitle: 'جيلكو للمصاعد',
    headerSubtitle: 'Jilco Elevators Co.',
    footerText: '',
    contactPhone: '',
    contactEmail: '',
    bankAccounts: []
};

export const WarrantyModule: React.FC = () => {
    const { customers } = useSales();
    const { warranties, saveProjectRecord, deleteProjectRecord } = useProject();

    const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [config, setConfig] = useState<CompanyConfig>(INITIAL_CONFIG);

    const [currentWarranty, setCurrentWarranty] = useState<WarrantyData>({
        id: '',
        certificateNumber: `WR-${new Date().getFullYear()}-001`,
        date: new Date().toISOString().split('T')[0],
        customerName: '',
        projectName: '',
        location: '', // Use location field internally for filtering/display
        elevatorType: 'مصعد ركاب (Passenger)',
        machineNumber: '',
        capacity: '630 كجم - 8 أشخاص',
        stops: '4 وقفات',
        warrantyStartDate: new Date().toISOString().split('T')[0],
        warrantyEndDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
        periodYears: 2,
        notes: 'يشمل هذا الضمان إصلاح أو استبدال القطع المعيبة نتيجة سوء التصنيع أو التركيب، ولا يشمل الأعطال الناتجة عن سوء الاستخدام أو تذبذب التيار الكهربائي.',
        status: 'active'
    });

    // Load Config
    useEffect(() => {
        const savedConfig = localStorage.getItem('jilco_quote_data');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                if (parsed.config) setConfig(parsed.config);
            } catch (e) { }
        }
    }, []);

    // Actions
    const handleCreateNew = () => {
        const today = new Date().toISOString().split('T')[0];
        const nextYear = new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0];

        setCurrentWarranty({
            id: Date.now().toString(),
            certificateNumber: `WR-${new Date().getFullYear()}-${String(warranties.length + 1).padStart(3, '0')}`,
            date: today,
            customerName: '',
            projectName: '',
            location: '',
            elevatorType: 'مصعد ركاب (Passenger)',
            machineNumber: '',
            capacity: '630 كجم',
            stops: '4 وقفات',
            warrantyStartDate: today,
            warrantyEndDate: nextYear,
            periodYears: 2,
            notes: 'يشمل هذا الضمان إصلاح أو استبدال القطع المعيبة نتيجة سوء التصنيع أو التركيب، ولا يشمل الأعطال الناتجة عن سوء الاستخدام أو تذبذب التيار الكهربائي.',
            status: 'active'
        });
        setViewMode('editor');
    };

    const handleEdit = (warranty: WarrantyData) => {
        // Ensure location exists for backward compatibility with old data
        setCurrentWarranty({
            ...warranty,
            location: warranty.location || ''
        });
        setViewMode('editor');
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذه الشهادة؟')) {
            await deleteProjectRecord('jilco_warranties_archive', id);
        }
    };

    const handleSave = async () => {
        if (!currentWarranty.customerName) return alert('اسم العميل مطلوب');

        await saveProjectRecord('jilco_warranties_archive', currentWarranty.id, currentWarranty);
        setViewMode('list');
    };

    const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const customer = customers.find(c => c.id === e.target.value);
        if (customer) {
            setCurrentWarranty(prev => ({
                ...prev,
                customerName: customer.fullName,
                location: customer.address || '',
                projectName: customer.companyName || ''
            }));
        }
    };

    const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const years = parseInt(e.target.value);
        const start = new Date(currentWarranty.warrantyStartDate);
        const end = new Date(start.setFullYear(start.getFullYear() + years));

        setCurrentWarranty(prev => ({
            ...prev,
            periodYears: years,
            warrantyEndDate: end.toISOString().split('T')[0]
        }));
    };

    // --- Views ---

    if (viewMode === 'list') {
        return (
            <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                                <ShieldCheck className="text-gold-500" /> شهادات الضمان
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">إصدار ومتابعة شهادات ضمان المصاعد للعملاء</p>
                        </div>
                        <button onClick={handleCreateNew} className="bg-jilco-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md">
                            <Plus size={20} /> إصدار شهادة جديدة
                        </button>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                            <div className="relative max-w-md">
                                <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                                <input
                                    title="Search Warranty Certificates"
                                    type="text"
                                    placeholder="بحث برقم الشهادة، العميل..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pr-10 pl-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-jilco-500 outline-none"
                                />
                            </div>
                        </div>
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-50 text-gray-500 font-medium">
                                <tr>
                                    <th className="p-4">رقم الشهادة</th>
                                    <th className="p-4">العميل</th>
                                    <th className="p-4">المشروع</th>
                                    <th className="p-4">تاريخ الانتهاء</th>
                                    <th className="p-4">الحالة</th>
                                    <th className="p-4 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {warranties.filter(w => w.certificateNumber.includes(searchTerm) || w.customerName.includes(searchTerm)).map(w => {
                                    const isExpired = new Date(w.warrantyEndDate) < new Date();
                                    return (
                                        <tr key={w.id} className="hover:bg-gray-50">
                                            <td className="p-4 font-mono font-bold text-jilco-900">{w.certificateNumber}</td>
                                            <td className="p-4 font-bold text-gray-800">{w.customerName}</td>
                                            <td className="p-4 text-gray-600">{w.projectName || '-'}</td>
                                            <td className="p-4 font-mono text-xs">{w.warrantyEndDate}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {isExpired ? 'منتهي' : 'ساري المفعول'}
                                                </span>
                                            </td>
                                            <td className="p-4 flex justify-center gap-2">
                                                <button title="Edit" onClick={() => handleEdit(w)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit size={16} /></button>
                                                <button title="Print" onClick={() => { handleEdit(w); setTimeout(() => window.print(), 500); }} className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"><Printer size={16} /></button>
                                                <button title="Delete" onClick={() => handleDelete(w.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {warranties.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-gray-400">لا توجد شهادات ضمان مصدرة.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // --- EDITOR VIEW (Form & Preview) ---
    return (
        <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden animate-fade-in print:h-auto print:overflow-visible print:block">

            {/* Editor Sidebar */}
            <div className="w-full lg:w-72 bg-white border-l border-gray-200 h-full overflow-y-auto p-4 print:hidden shadow-lg z-10 sidebar-container shrink-0">
                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                    <h2 className="text-base font-bold text-jilco-900 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-gold-500" /> محرر الشهادة
                    </h2>
                    <button title="Close Editor" onClick={() => setViewMode('list')} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600"><ArrowLeft size={18} /></button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleSave} className="bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 hover:bg-green-700 text-sm">
                            <Save size={15} /> حفظ
                        </button>
                        <button onClick={() => window.print()} className="bg-jilco-900 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 hover:bg-jilco-800 text-sm">
                            <Printer size={15} /> طباعة
                        </button>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-xs text-jilco-800 flex items-center gap-1.5 uppercase tracking-wide"><User size={12} /> بيانات العميل</h3>
                        <select title="Select Customer" onChange={handleCustomerSelect} className="w-full p-2 border rounded text-xs" defaultValue="">
                            <option value="" disabled>-- اختر عميل مسجل --</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                        </select>
                        <input title="Customer Name" type="text" placeholder="اسم العميل" value={currentWarranty.customerName} onChange={e => setCurrentWarranty({ ...currentWarranty, customerName: e.target.value })} className="w-full p-2 border rounded text-xs" />
                        <input title="Project Name" type="text" placeholder="اسم المشروع / المبنى" value={currentWarranty.projectName} onChange={e => setCurrentWarranty({ ...currentWarranty, projectName: e.target.value })} className="w-full p-2 border rounded text-xs" />
                        <input title="Location" type="text" placeholder="الموقع" value={currentWarranty.location} onChange={e => setCurrentWarranty({ ...currentWarranty, location: e.target.value })} className="w-full p-2 border rounded text-xs" />
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-xs text-jilco-800 flex items-center gap-1.5 uppercase tracking-wide"><Award size={12} /> تفاصيل المصعد</h3>
                        <div className="grid grid-cols-2 gap-1.5">
                            <input title="Elevator Type" type="text" placeholder="نوع المصعد" value={currentWarranty.elevatorType} onChange={e => setCurrentWarranty({ ...currentWarranty, elevatorType: e.target.value })} className="w-full p-2 border rounded text-xs" />
                            <input title="Machine Number" type="text" placeholder="رقم الماكينة" value={currentWarranty.machineNumber} onChange={e => setCurrentWarranty({ ...currentWarranty, machineNumber: e.target.value })} className="w-full p-2 border rounded text-xs" />
                            <input title="Capacity" type="text" placeholder="الحمولة" value={currentWarranty.capacity} onChange={e => setCurrentWarranty({ ...currentWarranty, capacity: e.target.value })} className="w-full p-2 border rounded text-xs" />
                            <input title="Stops" type="text" placeholder="عدد الوقفات" value={currentWarranty.stops} onChange={e => setCurrentWarranty({ ...currentWarranty, stops: e.target.value })} className="w-full p-2 border rounded text-xs" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-xs text-jilco-800 flex items-center gap-1.5 uppercase tracking-wide"><Calendar size={12} /> فترة الضمان</h3>
                        <div className="grid grid-cols-2 gap-1.5">
                            <div>
                                <label className="text-[10px] text-gray-500 block mb-0.5">المدة (سنوات)</label>
                                <select title="Warranty Period" value={currentWarranty.periodYears} onChange={handlePeriodChange} className="w-full p-2 border rounded text-xs">
                                    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} سنة</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 block mb-0.5">بداية الضمان</label>
                                <input title="Start Date" type="date" value={currentWarranty.warrantyStartDate} onChange={e => setCurrentWarranty({ ...currentWarranty, warrantyStartDate: e.target.value })} className="w-full p-2 border rounded text-xs" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[10px] text-gray-500 block mb-0.5">نهاية الضمان</label>
                                <input title="End Date" type="date" value={currentWarranty.warrantyEndDate} onChange={e => setCurrentWarranty({ ...currentWarranty, warrantyEndDate: e.target.value })} className="w-full p-2 border rounded text-xs bg-gray-50" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-700 block mb-1">الشروط والأحكام</label>
                        <textarea title="Terms" value={currentWarranty.notes} onChange={e => setCurrentWarranty({ ...currentWarranty, notes: e.target.value })} className="w-full p-2 border rounded text-xs h-20 resize-none leading-relaxed" />
                    </div>
                </div>
            </div>

            {/* Certificate Preview - A4 sized */}
            <div className="flex-1 bg-gray-300 overflow-auto flex justify-center items-start p-6 print:p-0 print:bg-white print:overflow-visible print:block print:flex-none">
                {/* A4 container: 210mm × 297mm */}
                <div
                    dir="rtl"
                    className="bg-white relative print:shadow-none"
                    style={{
                        width: '210mm',
                        minHeight: '297mm',
                        maxHeight: '297mm',
                        overflow: 'hidden',
                        boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '10mm 12mm',
                        boxSizing: 'border-box',
                        position: 'relative'
                    }}
                >
                    {/* Gold border frame */}
                    <div style={{ position: 'absolute', inset: '5mm', border: '2.5px double #d97706', borderRadius: '2px', pointerEvents: 'none', zIndex: 20 }} />
                    {/* Corner ornaments */}
                    {[['top-[5mm]','right-[5mm]','border-t-2 border-r-2'],['top-[5mm]','left-[5mm]','border-t-2 border-l-2'],['bottom-[5mm]','right-[5mm]','border-b-2 border-r-2'],['bottom-[5mm]','left-[5mm]','border-b-2 border-l-2']].map(([t,l,b],i) => (
                        <div key={i} className={`absolute ${t} ${l} ${b} border-gold-600 w-8 h-8`} style={{ zIndex: 21 }} />
                    ))}

                    {/* ========== HEADER ========== */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-jilco-900">
                        {/* Logo + company name */}
                        <div className="flex items-center gap-3">
                            {config.logo
                                ? <img src={config.logo} alt="Logo" className="h-14 object-contain" />
                                : <div className="w-14 h-14 bg-jilco-900 rounded-lg flex items-center justify-center text-white font-black text-2xl italic">J</div>
                            }
                            <div>
                                <p className="font-black text-jilco-900 text-base leading-tight">{config.headerTitle}</p>
                                <p className="text-gray-500 text-xs">{config.headerSubtitle || 'Jilco Elevators Co.'}</p>
                                {config.contactPhone && <p className="text-gray-400 text-[10px]" dir="ltr">{config.contactPhone}</p>}
                            </div>
                        </div>
                        {/* Certificate title */}
                        <div className="text-center">
                            <h1 className="text-2xl font-black text-jilco-900 tracking-wide">شهادة ضمان</h1>
                            <p className="text-gold-600 text-xs font-bold uppercase tracking-widest">Warranty Certificate</p>
                            <p className="text-gray-400 text-[10px] mt-0.5 font-mono">رقم: {currentWarranty.certificateNumber}</p>
                            <p className="text-gray-400 text-[10px] font-mono">{currentWarranty.date}</p>
                        </div>
                    </div>

                    {/* ========== INTRO TEXT ========== */}
                    <div className="bg-jilco-50 border border-jilco-100 rounded-lg px-4 py-2.5 mb-3 text-center">
                        <p className="text-gray-700 text-sm leading-relaxed">
                            تشهد شركة <span className="font-black text-jilco-900">{config.headerTitle}</span> بأن العميل الكريم:
                        </p>
                        <p className="text-xl font-black text-jilco-900 mt-1 border-b border-dotted border-gray-400 inline-block px-6 pb-0.5">
                            {currentWarranty.customerName || '..........................................'}
                        </p>
                        <p className="text-gray-600 text-xs mt-1.5">
                            يتمتع بضمان شامل للمصعد المُركَّب في:{' '}
                            <span className="font-bold text-jilco-800">{currentWarranty.projectName}{currentWarranty.location ? ` - ${currentWarranty.location}` : ''}</span>
                        </p>
                    </div>

                    {/* ========== TECHNICAL DETAILS ========== */}
                    <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="h-0.5 flex-1 bg-gold-400" />
                            <span className="text-[10px] font-black text-gold-600 uppercase tracking-widest">بيانات المصعد الفنية</span>
                            <div className="h-0.5 flex-1 bg-gold-400" />
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { label: 'نوع المصعد', value: currentWarranty.elevatorType },
                                { label: 'رقم الماكينة', value: currentWarranty.machineNumber || 'N/A' },
                                { label: 'الحمولة', value: currentWarranty.capacity },
                                { label: 'عدد الوقفات', value: currentWarranty.stops },
                            ].map(({ label, value }) => (
                                <div key={label} className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
                                    <p className="text-[9px] text-gray-500 mb-0.5">{label}</p>
                                    <p className="font-black text-jilco-900 text-xs leading-tight">{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ========== WARRANTY PERIOD ========== */}
                    <div className="bg-gold-50 border border-gold-200 rounded-lg px-4 py-2.5 mb-3">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-0.5 flex-1 bg-gold-300" />
                            <span className="text-[10px] font-black text-gold-700 uppercase tracking-widest">فترة الضمان</span>
                            <div className="h-0.5 flex-1 bg-gold-300" />
                        </div>
                        <div className="flex justify-center items-center gap-6">
                            <div className="text-center">
                                <p className="text-[9px] text-gray-500 mb-0.5">البداية</p>
                                <p className="font-black text-jilco-900 text-sm font-mono">{currentWarranty.warrantyStartDate}</p>
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                                <div className="w-16 h-0.5 bg-gold-500" />
                                <p className="text-[10px] font-black text-gold-700 bg-white px-2 border border-gold-300 rounded-full">
                                    {currentWarranty.periodYears} سنة
                                </p>
                                <div className="w-16 h-0.5 bg-gold-500" />
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] text-gray-500 mb-0.5">النهاية</p>
                                <p className="font-black text-jilco-900 text-sm font-mono">{currentWarranty.warrantyEndDate}</p>
                            </div>
                        </div>
                    </div>

                    {/* ========== TERMS ========== */}
                    <div className="mb-3 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="h-0.5 flex-1 bg-gray-300" />
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">الشروط والأحكام</span>
                            <div className="h-0.5 flex-1 bg-gray-300" />
                        </div>
                        <p className="text-[10px] text-gray-600 leading-relaxed text-justify">{currentWarranty.notes}</p>
                    </div>

                    {/* ========== SIGNATURES ========== */}
                    <div className="grid grid-cols-3 gap-4 mt-auto pt-3 border-t border-gray-200">
                        <div className="text-center">
                            <div className="h-10 flex items-end justify-center mb-1"></div>
                            <div className="border-b-2 border-gray-700 w-32 mx-auto" />
                            <p className="text-[10px] font-bold text-gray-600 mt-1">إدارة الصيانة والضمان</p>
                        </div>
                        <div className="text-center flex flex-col items-center">
                            {config.stamp
                                ? <img src={config.stamp} alt="Stamp" className="h-14 object-contain opacity-90 rotate-[-4deg] mix-blend-multiply" />
                                : <div className="w-14 h-14 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center text-gray-400 text-[9px]">الختم</div>
                            }
                        </div>
                        <div className="text-center">
                            <div className="h-10 flex items-end justify-center mb-1"></div>
                            <div className="border-b-2 border-gray-700 w-32 mx-auto" />
                            <p className="text-[10px] font-bold text-gray-600 mt-1">المدير العام</p>
                        </div>
                    </div>

                    {/* ========== FOOTER ========== */}
                    <div className="mt-2 bg-jilco-900 text-white text-center py-1.5 text-[10px] mx-[-12mm] mb-[-10mm] px-4 flex justify-between">
                        <span>www.jilco.com.sa</span>
                        <span dir="ltr">{config.contactPhone} | {config.contactEmail}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};


