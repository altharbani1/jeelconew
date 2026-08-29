
import React, { useState, useEffect, useMemo } from 'react';
import { Wallet, Plus, Search, Edit, Trash2, Printer, Save, ArrowLeft, Upload, FileText, X, ImageIcon, Banknote, Calendar, Download, PieChart, Filter, Eye, Paperclip, Briefcase } from 'lucide-react';
import { Expense, ExpenseCategory, Attachment, CompanyConfig, Project, SupplierPayment, Supplier, EmployeePayment } from '../types';
import { useProject } from '../contexts/ProjectContext.tsx';
import { usePurchase } from '../contexts/PurchaseContext.tsx';
import { useHR } from '../contexts/HRContext.tsx';

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

const EXPENSE_BANKS = [
    "مصرف الراجحي",
    "البنك الأهلي التجاري (SNB)",
    "بنك الرياض",
    "بنك الإنماء",
    "بنك البلاد",
    "البنك السعودي الفرنسي",
    "STC Pay",
    "أخرى"
];

// --- Helper: Tafqit ---
const tafqit = (number: number): string => {
    if (number === 0) return "صفر";
    const units = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
    const thousands = ["", "ألف", "ألفان", "ثلاثة آلاف", "أربعة آلاف", "خمسة آلاف", "ستة آلاف", "سبعة آلاف", "ثمانية آلاف", "تسعة آلاف"];
    if (number >= 1000000) return `${number} ريال سعودي`;
    const k = Math.floor(number / 1000);
    const remainder = number % 1000;
    let text = "";
    if (k > 0) {
        if (k === 1) text += "ألف";
        else if (k === 2) text += "ألفان";
        else if (k >= 3 && k <= 10) text += thousands[k];
        else text += `${k} ألف`;
        if (remainder > 0) text += " و ";
    }
    if (remainder > 0 || text === "") text += `${remainder}`;
    return text + " ريال سعودي فقط لا غير";
};

const DEFAULT_CATEGORIES: ExpenseCategory[] = [
    { id: 'rent', name: 'إيجارات' },
    { id: 'salary', name: 'رواتب وأجور' },
    { id: 'fuel', name: 'وقود وصيانة سيارات' },
    { id: 'office', name: 'ضيافة ولوازم مكتبية' },
    { id: 'gov', name: 'رسوم حكومية' },
    { id: 'marketing', name: 'تسويق وإعلان' },
    { id: 'material', name: 'مشتريات مواد' },
    { id: 'supplier_payment', name: 'مشتريات / موردين' },
    { id: 'other', name: 'نثريات ومصروفات أخرى' }
];

export const ExpenseModule: React.FC = () => {
    const {
        suppliers,
        supplierPayments
    } = usePurchase();
    const {
        expenses: rawExpenses,
        projects,
        saveProjectRecord, deleteProjectRecord
    } = useProject();
    const { hrEmployeePayments } = useHR();

    const [viewMode, setViewMode] = useState<'list' | 'editor' | 'report'>('list');
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>(DEFAULT_CATEGORIES);
    const [config, setConfig] = useState<CompanyConfig>(INITIAL_CONFIG);

    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Modal State
    const [viewAttachments, setViewAttachments] = useState<{ title: string, files: Attachment[] } | null>(null);

    const [currentExpense, setCurrentExpense] = useState<Expense>({
        id: '',
        number: '',
        date: new Date().toISOString().split('T')[0],
        categoryId: '',
        categoryName: '',
        paidTo: '',
        description: '',
        amount: 0,
        paymentMethod: 'cash',
        bankName: '',
        attachments: []
    });

    // Load Data
    useEffect(() => {
        // Generate derived expenses from supplier payments
        const convertedPayments: Expense[] = supplierPayments.map(p => {
            const supplier = suppliers.find(s => s.id === p.supplierId);
            return {
                id: `SP-${p.id}`,
                number: `SPV-${p.id.slice(-6)}`,
                date: p.date,
                categoryId: 'supplier_payment',
                categoryName: 'مشتريات / موردين',
                paidTo: supplier ? supplier.name : 'مورد غير معروف',
                description: `دفعة مورد - ${p.notes || ''}`,
                amount: p.amount,
                paymentMethod: p.method,
                attachments: [],
            };
        });

        // Generate derived expenses from employee payments
        const convertedHR: Expense[] = hrEmployeePayments
          // Payroll vouchers are stored by the HR module and are projected here
          // as read-only expenses. Normalize legacy/cloud JSON values so a
          // string amount or a missing date cannot hide the voucher or break
          // filtering/report totals.
          .filter(p => p && p.id)
          .map(p => ({
            id: `HR-${p.id}`,
            number: `HRV-${p.id.slice(-6)}`,
            date: p.date || new Date().toISOString().split('T')[0],
            categoryId: 'salary',
            categoryName: 'رواتب وأجور',
            paidTo: p.employeeName,
            description: p.description,
            amount: Number(p.amount) || 0,
            paymentMethod: p.paymentMethod,
            referenceNumber: p.referenceNumber,
            attachments: []
          }));

        setExpenses([...rawExpenses, ...convertedPayments, ...convertedHR]);

        const savedConfig = localStorage.getItem('jilco_quote_data');
        if (savedConfig) try {
            const parsed = JSON.parse(savedConfig);
            if (parsed.config) setConfig(parsed.config);
        } catch (e) { }
    }, [rawExpenses, supplierPayments, suppliers, hrEmployeePayments]);

    // Actions
    const handleCreateNew = () => {
        setCurrentExpense({
            id: Date.now().toString(),
            number: `PV-${new Date().getFullYear()}-${String(expenses.filter(e => !e.id.startsWith('SP-')).length + 1).padStart(3, '0')}`,
            date: new Date().toISOString().split('T')[0],
            categoryId: '',
            categoryName: '',
            paidTo: '',
            description: '',
            amount: 0,
            paymentMethod: 'cash',
            bankName: '',
            attachments: []
        });
        setViewMode('editor');
    };

    const handleEdit = (expense: Expense) => {
        if (expense.id.startsWith('SP-') || expense.id.startsWith('HR-')) {
            alert('هذا السند تم إنشاؤه تلقائياً من نظام المشتريات أو الموارد البشرية. لا يمكن تعديله من هنا.');
            return;
        }
        setCurrentExpense(expense);
        setViewMode('editor');
    };

    const handleDelete = async (id: string) => {
        if (id.startsWith('SP-') || id.startsWith('HR-')) {
            alert('لا يمكن حذف هذا السند المولد تلقائياً.');
            return;
        }
        if (window.confirm('هل أنت متأكد من حذف سند الصرف؟')) {
            await deleteProjectRecord('jilco_expenses_archive', id);
        }
    };

    const handleSave = async () => {
        if (!currentExpense.amount || !currentExpense.paidTo) return alert('الرجاء إدخال المبلغ واسم المستفيد');

        // Auto-set category name
        const cat = categories.find(c => c.id === currentExpense.categoryId);
        const proj = projects.find(p => p.id === currentExpense.projectId);

        const expenseToSave: Expense = {
            ...currentExpense,
            categoryName: cat ? cat.name : 'أخرى',
            projectName: proj ? proj.name : undefined
        };

        await saveProjectRecord('jilco_expenses_archive', expenseToSave.id, expenseToSave);

        setViewMode('list');
    };

    // Attachments Handling
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    const newAttachment: Attachment = {
                        id: Date.now().toString(),
                        name: file.name,
                        url: ev.target.result as string,
                        type: file.type.includes('image') ? 'image' : 'pdf',
                        date: new Date().toISOString().split('T')[0]
                    };
                    setCurrentExpense(prev => ({
                        ...prev,
                        attachments: [...prev.attachments, newAttachment]
                    }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const removeAttachment = (id: string) => {
        setCurrentExpense(prev => ({
            ...prev,
            attachments: prev.attachments.filter(a => a.id !== id)
        }));
    };

    // --- Renderers ---

    const renderAttachmentModal = () => {
        if (!viewAttachments) return null;
        return (
            <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Paperclip size={18} /> مرفقات: {viewAttachments.title}</h3>
                        <button title="إغلاق" onClick={() => setViewAttachments(null)} className="p-1 hover:bg-gray-200 rounded-full"><X size={20} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {viewAttachments.files.map(att => (
                                <div key={att.id} className="bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                                    <div className="flex justify-between items-center mb-2 px-1">
                                        <span className="text-xs font-bold text-gray-500 truncate max-w-[200px]">{att.name}</span>
                                        <a href={att.url} download={att.name} title="تحميل" aria-label="تحميل المرفق" className="text-blue-500 hover:text-blue-700"><Download size={16} /></a>
                                    </div>
                                    <div className="h-64 bg-gray-50 rounded flex items-center justify-center overflow-hidden border border-gray-100">
                                        {att.type === 'image' ? (
                                            <img src={att.url} alt={att.name} className="w-full h-full object-contain" />
                                        ) : (
                                            <iframe src={att.url} className="w-full h-full" title={att.name}></iframe>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- Filtered Data for Report ---
    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            const matchesSearch = (e.number || '').includes(searchTerm) ||
                (e.paidTo || '').includes(searchTerm) ||
                (e.description || '').includes(searchTerm);
            const matchesDate = (e.date || '') >= startDate && (e.date || '') <= endDate;
            const matchesCategory = categoryFilter === 'all' || e.categoryId === categoryFilter;
            return matchesSearch && matchesDate && matchesCategory;
        });
    }, [expenses, searchTerm, startDate, endDate, categoryFilter]);

    const stats = useMemo(() => {
        const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
        const byCategory: Record<string, number> = {};
        filteredExpenses.forEach(e => {
            byCategory[e.categoryName || 'غير مصنف'] = (byCategory[e.categoryName || 'غير مصنف'] || 0) + e.amount;
        });
        return { total, byCategory };
    }, [filteredExpenses]);

    const renderReportView = () => (
        <div className="flex-1 bg-gray-200 p-8 overflow-auto flex justify-center items-start print:p-0 print:m-0 print:bg-white print:w-full print:h-full print:absolute print:top-0 print:left-0 print:z-[200]">
            <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-0 relative flex flex-col print:shadow-none print:w-full">
                {/* Header */}
                <div className="px-10 py-6 border-b-2 border-jilco-900 flex justify-between items-center">
                    <div className="w-1/3 text-right">
                        <h1 className="text-xl font-black text-jilco-900">{config.headerTitle}</h1>
                        <p className="text-xs font-bold text-gray-500">{config.headerSubtitle}</p>
                    </div>
                    <div className="w-1/3 text-center">
                        <h2 className="text-2xl font-black text-red-700 border-2 border-red-700 px-4 py-1 inline-block rounded-lg uppercase">كشف مصاريف</h2>
                    </div>
                    <div className="w-1/3 text-left">
                        <p className="text-xs font-bold text-gray-500">تاريخ الطباعة</p>
                        <p className="font-mono text-sm">{new Date().toLocaleDateString('en-GB')}</p>
                    </div>
                </div>

                {/* Table */}
                <div className="px-10 py-6 flex-1">
                    <table className="w-full text-xs text-right border-collapse">
                        <thead>
                            <tr className="bg-jilco-900 text-white">
                                <th className="p-2 border border-jilco-900 w-10">#</th>
                                <th className="p-2 border border-jilco-900 w-24">التاريخ</th>
                                <th className="p-2 border border-jilco-900">المستفيد / البيان</th>
                                <th className="p-2 border border-jilco-900 w-32">المشروع</th>
                                <th className="p-2 border border-jilco-900 w-32">التصنيف</th>
                                <th className="p-2 border border-jilco-900 w-24 text-center">المبلغ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExpenses.map((exp, idx) => (
                                <tr key={exp.id} className="border-b border-gray-200">
                                    <td className="p-2 border border-gray-200 text-center">{idx + 1}</td>
                                    <td className="p-2 border border-gray-200 font-mono">{exp.date}</td>
                                    <td className="p-2 border border-gray-200">
                                        <p className="font-bold text-gray-800">{exp.paidTo}</p>
                                        <p className="text-[10px] text-gray-500 font-bold">{exp.description}</p>
                                    </td>
                                    <td className="p-2 border border-gray-200">{exp.projectName || '-'}</td>
                                    <td className="p-2 border border-gray-200">{exp.categoryName}</td>
                                    <td className="p-2 border border-gray-200 text-center font-bold font-mono">{exp.amount.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-4 print:hidden">
                <button onClick={() => window.print()} className="bg-jilco-900 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:bg-black flex items-center gap-2">
                    <Printer size={18} /> طباعة التقرير
                </button>
                <button onClick={() => setViewMode('list')} className="bg-white text-gray-700 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-gray-50 flex items-center gap-2">
                    <ArrowLeft size={18} /> رجوع
                </button>
            </div>
        </div>
    );

    // --- LIST VIEW ---
    if (viewMode === 'list') {
        return (
            <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in relative">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                                <Wallet className="text-red-500" /> المصروفات وسندات الصرف
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">إدارة نفقات المؤسسة وأرشيف الفواتير</p>
                        </div>
                        <button onClick={handleCreateNew} className="bg-jilco-900 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-800 shadow-md">
                            <Plus size={20} /> سند صرف جديد
                        </button>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">بحث عام</label>
                            <div className="relative">
                                <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
                                <input
                                    type="text" placeholder="رقم السند، المستفيد..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pr-9 pl-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none text-black bg-white font-bold"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">من تاريخ</label>
                            <input title="من تاريخ" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border border-gray-400 rounded-lg text-sm outline-none w-36 text-black bg-white font-bold" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">إلى تاريخ</label>
                            <input title="إلى تاريخ" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border border-gray-400 rounded-lg text-sm outline-none w-36 text-black bg-white font-bold" />
                        </div>
                        <div className="w-48">
                            <label className="text-xs font-bold text-gray-500 mb-1 block">التصنيف</label>
                            <select title="تصفية بالتصنيف" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full p-2 border border-gray-400 rounded-lg text-sm outline-none bg-white text-black font-bold">
                                <option value="all">الكل</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <button
                            onClick={() => setViewMode('report')}
                            className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-100 flex items-center gap-2 h-[38px]"
                        >
                            <PieChart size={16} /> تقرير مفصل
                        </button>
                    </div>

                    {/* Stats Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                            <div>
                                <p className="text-xs text-gray-500 font-bold">إجمالي الفترة</p>
                                <p className="text-xl font-black text-jilco-900">{stats.total.toLocaleString()}</p>
                            </div>
                            <div className="p-2 bg-gray-100 rounded-lg"><Banknote size={20} className="text-gray-600" /></div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                            <div>
                                <p className="text-xs text-gray-500 font-bold">عدد السندات</p>
                                <p className="text-xl font-black text-jilco-900">{filteredExpenses.length}</p>
                            </div>
                            <div className="p-2 bg-gray-100 rounded-lg"><FileText size={20} className="text-gray-600" /></div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-50 text-gray-500 font-medium">
                                <tr>
                                    <th className="p-4">رقم السند</th>
                                    <th className="p-4">التاريخ</th>
                                    <th className="p-4">المستفيد (يصرف لـ)</th>
                                    <th className="p-4">التصنيف</th>
                                    <th className="p-4">المبلغ</th>
                                    <th className="p-4 text-center">مرفقات</th>
                                    <th className="p-4 text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredExpenses.map(exp => (
                                    <tr key={exp.id} className={`hover:bg-gray-50 ${exp.id.startsWith('SP-') ? 'bg-blue-50/30' : exp.id.startsWith('HR-') ? 'bg-green-50/30' : ''}`}>
                                        <td className="p-4 font-mono font-bold text-gray-800">{exp.number}</td>
                                        <td className="p-4 font-mono text-gray-500 text-xs font-bold">{exp.date}</td>
                                        <td className="p-4 font-bold text-jilco-900">
                                            {exp.paidTo}
                                            <p className="text-[10px] text-gray-400 font-bold truncate max-w-[150px]">{exp.description}</p>
                                            {exp.projectName && <p className="text-[10px] text-blue-500 mt-1 flex items-center gap-1 font-bold"><Briefcase size={10} /> {exp.projectName}</p>}
                                        </td>
                                        <td className="p-4"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{exp.categoryName}</span></td>
                                        <td className="p-4 font-bold text-red-600 font-mono">{exp.amount.toLocaleString()}</td>
                                        <td className="p-4 text-center">
                                            {exp.attachments.length > 0 ? (
                                                <button
                                                    onClick={() => setViewAttachments({ title: `سند رقم ${exp.number}`, files: exp.attachments })}
                                                    className="flex items-center justify-center gap-1 text-blue-600 text-xs font-bold hover:bg-blue-50 px-2 py-1 rounded mx-auto transition-colors"
                                                >
                                                    <Paperclip size={14} /> {exp.attachments.length}
                                                </button>
                                            ) : <span className="text-gray-300 text-xs">-</span>}
                                        </td>
                                        <td className="p-4 flex justify-center gap-2">
                                            {(!exp.id.startsWith('SP-') && !exp.id.startsWith('HR-')) && (
                                              <>
                                                <button title="تعديل" onClick={() => handleEdit(exp)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit size={16} /></button>
                                                <button title="حذف" onClick={() => handleDelete(exp.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                                              </>
                                            )}
                                            <button title="طباعة" onClick={() => { setCurrentExpense(exp); setViewMode('editor'); setTimeout(() => window.print(), 500); }} className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"><Printer size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredExpenses.length === 0 && <tr><td colSpan={7} className="p-12 text-center text-gray-400">لا توجد مصروفات تطابق البحث.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
                {renderAttachmentModal()}
            </div>
        );
    }

    if (viewMode === 'report') return renderReportView();

    // --- EDITOR VIEW ---
    return (
        <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden animate-fade-in print:h-auto print:overflow-visible print:block">

            {/* Editor Sidebar */}
            <div className="w-full lg:w-1/3 bg-white border-l border-gray-200 h-full overflow-y-auto p-6 no-print shadow-lg z-10 sidebar-container">
                <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-jilco-900 flex items-center gap-2">
                        <Wallet className="text-red-500" /> سند صرف (Payment)
                    </h2>
                    <button title="رجوع" onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><ArrowLeft size={20} /></button>
                </div>

                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={handleSave} className="bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-700">
                            <Save size={18} /> حفظ السند
                        </button>
                        <button onClick={() => window.print()} className="bg-jilco-900 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-jilco-800">
                            <Printer size={18} /> طباعة
                        </button>
                    </div>

                    <div className="bg-red-50 p-4 rounded-lg border border-red-400 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">رقم السند</label>
                                <input title="رقم السند" placeholder="رقم السند" type="text" value={currentExpense.number} onChange={e => setCurrentExpense({ ...currentExpense, number: e.target.value })} className="w-full p-2 border border-gray-400 rounded text-sm bg-white text-black font-bold" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">التاريخ</label>
                                <input title="التاريخ" type="date" value={currentExpense.date} onChange={e => setCurrentExpense({ ...currentExpense, date: e.target.value })} className="w-full p-2 border border-gray-400 rounded text-sm bg-white text-black font-bold" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">المبلغ (ر.س)</label>
                            <input title="المبلغ" placeholder="المبلغ" type="number" value={currentExpense.amount} onChange={e => setCurrentExpense({ ...currentExpense, amount: parseFloat(e.target.value) })} className="w-full p-2 border border-gray-400 rounded text-sm font-black text-red-600 bg-white" />
                            <p className="text-[10px] text-gray-500 mt-1 font-bold">{tafqit(currentExpense.amount)}</p>
                        </div>
                    </div>

                    <div className="bg-gray-100 p-4 rounded-lg border border-gray-400 space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">يصرف إلى السيد / السادة</label>
                            <input type="text" placeholder="اسم المستفيد" value={currentExpense.paidTo} onChange={e => setCurrentExpense({ ...currentExpense, paidTo: e.target.value })} className="w-full p-2 border border-gray-400 rounded text-sm bg-white text-black font-bold" />
                        </div>

                        {/* Project Linking */}
                        <div className="bg-white border border-blue-200 rounded p-2">
                            <label className="text-[10px] font-bold text-blue-700 block mb-1 flex items-center gap-1"><Briefcase size={10} /> ربط بمشروع (اختياري)</label>
                            <select title="المشروع"
                                value={currentExpense.projectId || ''}
                                onChange={e => setCurrentExpense({ ...currentExpense, projectId: e.target.value })}
                                className="w-full p-1.5 border border-gray-400 rounded text-xs bg-white text-black font-bold"
                            >
                                <option value="">-- عام (بدون مشروع) --</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name} - {p.clientName}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">وذلك مقابل (البيان)</label>
                            <textarea placeholder="شرح المصروف" value={currentExpense.description} onChange={e => setCurrentExpense({ ...currentExpense, description: e.target.value })} className="w-full p-2 border border-gray-400 rounded text-sm h-20 bg-white text-black font-bold" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">تصنيف المصروف</label>
                            <select title="تصنيف المصروف" value={currentExpense.categoryId} onChange={e => setCurrentExpense({ ...currentExpense, categoryId: e.target.value })} className="w-full p-2 border border-gray-400 rounded text-sm bg-white text-black font-bold">
                                <option value="">-- اختر تصنيف --</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="bg-gray-100 p-4 rounded-lg border border-gray-400 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">طريقة الدفع</label>
                                <select title="طريقة الدفع" value={currentExpense.paymentMethod} onChange={e => setCurrentExpense({ ...currentExpense, paymentMethod: e.target.value as any })} className="w-full p-2 border border-gray-400 rounded text-sm bg-white text-black font-bold">
                                    <option value="cash">نقداً</option>
                                    <option value="transfer">تحويل بنكي</option>
                                    <option value="check">شيك</option>
                                </select>
                            </div>
                            {currentExpense.paymentMethod !== 'cash' && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">اسم البنك</label>
                                    <select title="اسم البنك"
                                        value={currentExpense.bankName || ''}
                                        onChange={e => setCurrentExpense({ ...currentExpense, bankName: e.target.value })}
                                        className="w-full p-2 border border-gray-400 rounded text-sm bg-white text-black font-bold"
                                    >
                                        <option value="">-- اختر البنك --</option>
                                        {EXPENSE_BANKS.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        {currentExpense.paymentMethod !== 'cash' && (
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">رقم المرجع / الشيك</label>
                                <input title="رقم المرجع" placeholder="رقم المرجع" type="text" value={currentExpense.referenceNumber || ''} onChange={e => setCurrentExpense({ ...currentExpense, referenceNumber: e.target.value })} className="w-full p-2 border border-gray-400 rounded text-sm bg-white text-black font-bold" />
                            </div>
                        )}
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                            <div className="text-center">
                                <Upload size={24} className="mx-auto text-blue-500 mb-1" />
                                <span className="text-xs font-bold text-blue-700">إرفاق فاتورة / مستند</span>
                            </div>
                            <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} />
                        </label>

                        {currentExpense.attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {currentExpense.attachments.map(att => (
                                    <div key={att.id} className="flex items-center justify-between bg-white p-2 rounded border border-blue-200 text-xs text-black font-bold">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            {att.type === 'image' ? <ImageIcon size={14} className="text-purple-500 shrink-0" /> : <FileText size={14} className="text-red-500 shrink-0" />}
                                            <span className="truncate max-w-[150px]">{att.name}</span>
                                        </div>
                                        <button title="إزالة المرفق" onClick={() => removeAttachment(att.id)} className="text-red-400 hover:text-red-600 p-1 rounded"><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Preview Area (A4 Payment Voucher) */}
            <div className="flex-1 bg-gray-200 p-8 overflow-auto flex justify-center items-start print:p-0 print:bg-white print:overflow-visible print:block print:w-full print:h-full print:absolute print:top-0 print:left-0 print:z-200">

                {/* Printable Area with Royal Frame Style */}
                <div id="printable-area" className="bg-white shadow-2xl w-[210mm] min-h-[148mm] relative flex flex-col p-0 print:shadow-none print:w-full print:h-[148mm] print:m-0 mx-auto print:break-inside-avoid">

                    {/* Decorative Borders */}
                    <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
                    <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
                    <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

                    <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-8 border-b-2 border-jilco-100 pb-4 px-8 pt-6">
                            <div className="text-right">
                                <h1 className="text-2xl font-black text-jilco-900">{config.headerTitle}</h1>
                                <p className="text-xs font-bold text-gray-500">{config.headerSubtitle}</p>
                            </div>
                            <div>
                                {config.logo ? <img src={config.logo} alt="Logo" className="h-20 object-contain" /> : <div className="text-gray-300 font-bold border p-2 rounded">LOGO</div>}
                            </div>
                            <div className="text-left">
                                <h2 className="text-xl font-black text-red-700 uppercase tracking-widest bg-red-50 px-4 py-1 rounded border border-red-100">Payment Voucher</h2>
                                <p className="text-sm font-bold text-gray-600 mt-1 text-center">سند صرف</p>
                            </div>
                        </div>

                        {/* Watermark */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none z-0 overflow-hidden">
                            <h1 className="text-[100px] font-bold rotate-[-15deg] whitespace-nowrap text-red-900">PAYMENT</h1>
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-6 px-8 relative z-10">

                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded border border-gray-200">
                                    <span className="font-bold text-gray-500 text-sm">رقم السند:</span>
                                    <span className="font-mono font-black text-lg text-red-600">{currentExpense.number}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-500 text-sm">التاريخ:</span>
                                    <span className="font-mono font-bold text-black border-b border-gray-300 px-4">{currentExpense.date}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 bg-red-50 p-4 rounded-lg border border-red-100 shadow-sm">
                                <span className="font-bold text-red-900 text-sm w-24">المبلغ:</span>
                                <div className="flex-1 flex justify-between items-center">
                                    <span className="font-mono font-black text-3xl text-red-700">{currentExpense.amount.toLocaleString()}</span>
                                    <span className="text-xs font-bold bg-white px-2 py-1 rounded text-red-800 border border-red-200">ريال سعودي SAR</span>
                                </div>
                            </div>

                            <div className="space-y-5 text-sm">
                                <div className="flex items-end gap-2">
                                    <span className="font-bold text-gray-600 w-24 shrink-0">يصرف إلى:</span>
                                    <span className="flex-1 border-b border-dotted border-gray-400 pb-1 font-bold text-gray-900 px-2 text-lg">{currentExpense.paidTo}</span>
                                </div>

                                <div className="flex items-end gap-2">
                                    <span className="font-bold text-gray-600 w-24 shrink-0">مبلغ وقدره:</span>
                                    <span className="flex-1 border-b border-dotted border-gray-400 pb-1 font-medium text-gray-800 px-2 italic font-bold">{tafqit(currentExpense.amount)}</span>
                                </div>

                                <div className="flex items-end gap-2">
                                    <span className="font-bold text-gray-600 w-24 shrink-0">وذلك مقابل:</span>
                                    <span className="flex-1 border-b border-dotted border-gray-400 pb-1 font-bold text-gray-900 px-2 leading-loose">{currentExpense.description}</span>
                                </div>

                                <div className="flex gap-8 pt-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-4 h-4 border-2 border-gray-400 rounded-sm flex items-center justify-center ${currentExpense.paymentMethod === 'cash' ? 'bg-black border-black' : ''}`}>
                                            {currentExpense.paymentMethod === 'cash' && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                                        </div>
                                        <span className="font-bold text-gray-700">نقداً</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-4 h-4 border-2 border-gray-400 rounded-sm flex items-center justify-center ${currentExpense.paymentMethod === 'check' ? 'bg-black border-black' : ''}`}>
                                            {currentExpense.paymentMethod === 'check' && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                                        </div>
                                        <span className="font-bold text-gray-700">شيك</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-4 h-4 border-2 border-gray-400 rounded-sm flex items-center justify-center ${currentExpense.paymentMethod === 'transfer' ? 'bg-black border-black' : ''}`}>
                                            {currentExpense.paymentMethod === 'transfer' && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                                        </div>
                                        <span className="font-bold text-gray-700">تحويل بنكي</span>
                                    </div>
                                </div>
                                {/* Display Bank Name and Reference if applicable */}
                                {currentExpense.paymentMethod !== 'cash' && (
                                    <div className="flex gap-8 text-xs pt-1">
                                        {currentExpense.bankName && <span className="text-gray-600 font-bold">البنك: <span className="text-black">{currentExpense.bankName}</span></span>}
                                        <span className="text-gray-600 font-bold">الرقم المرجعي: <span className="font-mono text-black">{currentExpense.referenceNumber || '.........'}</span></span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="mt-12 flex justify-between items-end px-8 pb-6">
                            <div className="text-center">
                                <p className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-wider">المحاسب</p>
                                <div className="w-32 border-b-2 border-gray-300"></div>
                            </div>
                            <div className="text-center relative">
                                {config.stamp && <img src={config.stamp} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-24 opacity-80 mix-blend-multiply" alt="stamp" />}
                                <p className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-wider">الاعتماد (المدير العام)</p>
                                <div className="w-32 border-b-2 border-gray-300"></div>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-wider">المستلم</p>
                                <div className="w-32 border-b-2 border-gray-300"></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-jilco-900 text-white text-center py-2 text-[10px] w-full mt-auto relative z-20">
                        {config.footerText || 'Jilco Elevators System'} | {config.contactPhone}
                    </div>
                </div>
            </div>
        </div>
    );
};
