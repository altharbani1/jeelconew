
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

            {/* Certificate Preview - screen wrapper (hidden during print) */}
            <div className="flex-1 bg-gray-300 overflow-auto flex justify-center items-start p-6 print:hidden">
                {/* On-screen preview: scaled-down A4 visual */}
                <CertificateContent
                    currentWarranty={currentWarranty}
                    config={config}
                    isPreview={true}
                />
            </div>

            {/* Hidden actual print target - shown ONLY during print via CSS */}
            <CertificateContent
                currentWarranty={currentWarranty}
                config={config}
                isPreview={false}
            />
        </div>
    );
};

/* ─── Certificate content rendered both on-screen preview and for print ─── */
const CertificateContent: React.FC<{
    currentWarranty: any;
    config: any;
    isPreview: boolean;
}> = ({ currentWarranty, config, isPreview }) => {
    const wrapperClass = isPreview
        ? 'bg-white relative'
        : 'warranty-certificate-page bg-white relative hidden print:flex print:shadow-none';

    const wrapperStyle: React.CSSProperties = {
        width: '210mm',
        height: '297mm',
        overflow: 'hidden',
        boxShadow: isPreview ? '0 4px 32px rgba(0,0,0,0.18)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'relative',
        flexShrink: 0,
        margin: '0 auto',
        pageBreakAfter: 'always',
        pageBreakInside: 'avoid',
        backgroundColor: 'white',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
    };

    return (
        <div dir="rtl" className={wrapperClass} style={wrapperStyle}>
            {/* ═══ OUTER GOLD BORDER FRAME (absolute, inside edge 5mm) ═══ */}
            <div style={{
                position: 'absolute',
                inset: '6mm',
                border: '2px solid #d97706',
                outline: '1px solid #f59e0b',
                outlineOffset: '3px',
                borderRadius: '1px',
                pointerEvents: 'none',
                zIndex: 30,
                boxSizing: 'border-box',
            }} />
            {/* Corner accents */}
            {([['top', 'right'], ['top', 'left'], ['bottom', 'right'], ['bottom', 'left']] as const).map(([v, h], i) => (
                <div key={i} style={{
                    position: 'absolute',
                    [v]: '4mm',
                    [h]: '4mm',
                    width: '10mm',
                    height: '10mm',
                    borderTop: v === 'top' ? '3px solid #b45309' : 'none',
                    borderBottom: v === 'bottom' ? '3px solid #b45309' : 'none',
                    borderRight: h === 'right' ? '3px solid #b45309' : 'none',
                    borderLeft: h === 'left' ? '3px solid #b45309' : 'none',
                    zIndex: 31,
                }} />
            ))}

            {/* ═══ MAIN CONTENT — padding inside the border ═══ */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '14mm 14mm 0mm 14mm',
                overflow: 'hidden',
                gap: '3mm',
            }}>

                {/* ── HEADER ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0c4a6e', paddingBottom: '3mm' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3mm' }}>
                        {config.logo
                            ? <img src={config.logo} alt="Logo" style={{ height: '13mm', objectFit: 'contain' }} />
                            : <div style={{ width: '13mm', height: '13mm', background: '#0c4a6e', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '6mm', fontStyle: 'italic' }}>J</div>
                        }
                        <div>
                            <p style={{ fontWeight: 900, color: '#0c4a6e', fontSize: '4.5mm', lineHeight: 1.2 }}>{config.headerTitle}</p>
                            <p style={{ color: '#6b7280', fontSize: '2.8mm' }}>{config.headerSubtitle || 'Jilco Elevators Co.'}</p>
                            {config.contactPhone && <p style={{ color: '#9ca3af', fontSize: '2.5mm' }} dir="ltr">{config.contactPhone}</p>}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <h1 style={{ fontWeight: 900, color: '#0c4a6e', fontSize: '8mm', letterSpacing: '1px', margin: 0 }}>شهادة ضمان</h1>
                        <p style={{ color: '#d97706', fontSize: '2.5mm', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', margin: '1mm 0 0' }}>Warranty Certificate</p>
                        <p style={{ color: '#9ca3af', fontSize: '2.5mm', fontFamily: 'monospace', margin: '1mm 0 0' }}>رقم: {currentWarranty.certificateNumber}</p>
                        <p style={{ color: '#9ca3af', fontSize: '2.5mm', fontFamily: 'monospace', margin: '0.5mm 0 0' }}>{currentWarranty.date}</p>
                    </div>
                </div>

                {/* ── INTRO BOX ── */}
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '3px', padding: '4mm 6mm', textAlign: 'center' }}>
                    <p style={{ color: '#374151', fontSize: '3.5mm', margin: 0 }}>
                        تشهد شركة <strong style={{ color: '#0c4a6e' }}>{config.headerTitle}</strong> بأن العميل الكريم:
                    </p>
                    <p style={{ fontWeight: 900, color: '#0c4a6e', fontSize: '6mm', borderBottom: '1px dotted #9ca3af', display: 'inline-block', padding: '0 8mm', margin: '2mm 0 1mm' }}>
                        {currentWarranty.customerName || '..........................................'}
                    </p>
                    <p style={{ color: '#4b5563', fontSize: '3mm', margin: 0 }}>
                        يتمتع بضمان شامل للمصعد المُركَّب في:&nbsp;
                        <strong style={{ color: '#1e40af' }}>{currentWarranty.projectName}{currentWarranty.location ? ` - ${currentWarranty.location}` : ''}</strong>
                    </p>
                </div>

                {/* ── TECHNICAL DETAILS (4 cards) ── */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', marginBottom: '2mm' }}>
                        <div style={{ flex: 1, height: '0.5px', background: '#f59e0b' }} />
                        <span style={{ fontSize: '2.3mm', fontWeight: 900, color: '#d97706', letterSpacing: '1.5px', textTransform: 'uppercase' }}>بيانات المصعد الفنية</span>
                        <div style={{ flex: 1, height: '0.5px', background: '#f59e0b' }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '2mm' }}>
                        {[
                            { label: 'نوع المصعد', value: currentWarranty.elevatorType },
                            { label: 'رقم الماكينة', value: currentWarranty.machineNumber || 'N/A' },
                            { label: 'الحمولة', value: currentWarranty.capacity },
                            { label: 'عدد الوقفات', value: currentWarranty.stops },
                        ].map(({ label, value }) => (
                            <div key={label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '2px', padding: '2mm', textAlign: 'center' }}>
                                <p style={{ fontSize: '2.2mm', color: '#6b7280', margin: '0 0 1mm' }}>{label}</p>
                                <p style={{ fontWeight: 900, color: '#0c4a6e', fontSize: '3mm', margin: 0 }}>{value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── WARRANTY PERIODS & COVERAGE ── */}
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '3px', padding: '3mm 6mm' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', marginBottom: '2mm' }}>
                        <div style={{ flex: 1, height: '0.5px', background: '#fcd34d' }} />
                        <span style={{ fontSize: '2.3mm', fontWeight: 900, color: '#92400e', letterSpacing: '1.5px', textTransform: 'uppercase' }}>تفاصيل وفترات الضمان</span>
                        <div style={{ flex: 1, height: '0.5px', background: '#fcd34d' }} />
                    </div>
                    
                    <div style={{ display: 'flex', justifySelf: 'center', alignSelf: 'center', gap: '4mm', marginBottom: '2mm', margin: '0 auto', width: 'max-content' }}>
                        <div style={{ background: 'white', padding: '1mm 3mm', border: '1px solid #fde68a', borderRadius: '3px', fontSize: '2.5mm' }}>
                            <span style={{ color: '#6b7280' }}>تاريخ بداية الضمان: </span>
                            <span style={{ fontWeight: 900, color: '#0c4a6e', fontFamily: 'monospace' }}>{currentWarranty.warrantyStartDate}</span>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', backgroundColor: 'white', fontSize: '2.5mm' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 'bold' }}>
                                <th style={{ border: '1px solid #fde68a', padding: '1.5mm' }}>نوع التغطية والضمان</th>
                                <th style={{ border: '1px solid #fde68a', padding: '1.5mm' }}>مدة الضمان</th>
                            </tr>
                        </thead>
                        <tbody style={{ color: '#374151', fontWeight: 700 }}>
                            <tr>
                                <td style={{ border: '1px solid #fde68a', padding: '1.5mm' }}>صيانة دورية</td>
                                <td style={{ border: '1px solid #fde68a', padding: '1.5mm', color: '#0c4a6e' }}>24 شهر</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #fde68a', padding: '1.5mm' }}>ضمان الماكينة</td>
                                <td style={{ border: '1px solid #fde68a', padding: '1.5mm', color: '#0c4a6e' }}>5 سنوات</td>
                            </tr>
                            <tr>
                                <td style={{ border: '1px solid #fde68a', padding: '1.5mm' }}>ضمان التركيبات</td>
                                <td style={{ border: '1px solid #fde68a', padding: '1.5mm', color: '#0c4a6e' }}>15 سنة</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                {/* <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '3px', padding: '3mm 6mm' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', marginBottom: '2mm' }}>
                        <div style={{ flex: 1, height: '0.5px', background: '#fcd34d' }} />
                        <span style={{ fontSize: '2.3mm', fontWeight: 900, color: '#92400e', letterSpacing: '1.5px', textTransform: 'uppercase' }}>فترة الضمان</span>
                        <div style={{ flex: 1, height: '0.5px', background: '#fcd34d' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8mm' }}>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '2.5mm', color: '#6b7280', margin: '0 0 1mm' }}>من تاريخ</p>
                            <p style={{ fontWeight: 900, color: '#0c4a6e', fontSize: '4mm', fontFamily: 'monospace', margin: 0 }}>{currentWarranty.warrantyStartDate}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1mm' }}>
                            <div style={{ width: '15mm', height: '0.5px', background: '#f59e0b' }} />
                            <span style={{ fontSize: '2.8mm', fontWeight: 900, color: '#92400e', background: 'white', padding: '0.5mm 2mm', border: '1px solid #fde68a', borderRadius: '99px' }}>{currentWarranty.periodYears} سنة</span>
                            <div style={{ width: '15mm', height: '0.5px', background: '#f59e0b' }} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{ fontSize: '2.5mm', color: '#6b7280', margin: '0 0 1mm' }}>إلى تاريخ</p>
                            <p style={{ fontWeight: 900, color: '#0c4a6e', fontSize: '4mm', fontFamily: 'monospace', margin: 0 }}>{currentWarranty.warrantyEndDate}</p>
                        </div>
                    </div>
                </div> */}

                {/* ── TERMS ── */}
                <div style={{ flex: 1, minHeight: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', marginBottom: '2mm' }}>
                        <div style={{ flex: 1, height: '0.5px', background: '#d1d5db' }} />
                        <span style={{ fontSize: '2.3mm', fontWeight: 900, color: '#6b7280', letterSpacing: '1.5px', textTransform: 'uppercase' }}>الشروط والأحكام</span>
                        <div style={{ flex: 1, height: '0.5px', background: '#d1d5db' }} />
                    </div>
                    <p style={{ fontSize: '2.8mm', color: '#4b5563', lineHeight: 1.7, textAlign: 'justify', margin: 0 }}>{currentWarranty.notes}</p>
                </div>

                {/* ── SIGNATURES ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '4mm', borderTop: '1px solid #e5e7eb', paddingTop: '3mm' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ height: '12mm' }} />
                        <div style={{ borderBottom: '2px solid #374151', width: '32mm', margin: '0 auto' }} />
                        <p style={{ fontSize: '2.5mm', color: '#4b5563', fontWeight: 700, margin: '1.5mm 0 0' }}>إدارة الصيانة والضمان</p>
                    </div>
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        {config.stamp
                            ? <img src={config.stamp} alt="Stamp" style={{ height: '35mm', objectFit: 'contain', opacity: 0.9, transform: 'rotate(-5deg)', mixBlendMode: 'multiply' }} />
                            : <div style={{ width: '35mm', height: '35mm', border: '1.5px dashed #d1d5db', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '4mm' }}>الختم</div>
                        }
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ height: '12mm' }} />
                        <div style={{ borderBottom: '2px solid #374151', width: '32mm', margin: '0 auto' }} />
                        <p style={{ fontSize: '2.5mm', color: '#4b5563', fontWeight: 700, margin: '1.5mm 0 0' }}>المدير العام</p>
                    </div>
                </div>
            </div>

            {/* ── FOOTER BAR ── */}
            <div style={{
                background: '#0c4a6e',
                color: 'white',
                display: 'flex',
                justifyContent: 'space-between',
                padding: '2mm 14mm',
                fontSize: '2.5mm',
                flexShrink: 0,
                marginTop: '3mm',
            }}>
                <span>www.jilco.com.sa</span>
                <span dir="ltr">{config.contactPhone} | {config.contactEmail}</span>
            </div>
        </div>
    );
};
