
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Printer, FileText, Phone, Mail, Globe, MapPin, Plus, ArrowLeft, Search, Trash2, Edit, Send, Save, User, ShoppingCart, DollarSign, Calendar, PieChart, CheckCircle2, X, Wrench } from 'lucide-react';
import { InvoiceData, QuoteItem, CompanyConfig, Customer, SupplierProduct, QuoteDetails } from '../types';
import { ShareButton } from './ShareButton';
import { useAuth } from '../contexts/AuthContext.tsx';
import { loggerService } from '../services/loggerService.ts';
import { useSales } from '../contexts/SalesContext.tsx';
import { useMaintenance } from '../contexts/MaintenanceContext.tsx';
import { useData } from '../contexts/DataContext.tsx';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';
import { invoiceDraftKey, readInvoiceDraft, writeInvoiceDraft } from '../lib/invoiceDrafts.mjs';
import { amountInArabicWords, calculateInvoiceAmounts, formatInvoiceMoney } from '../lib/invoiceCalculations.mjs';

const localDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const dateAfterDays = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localDateString(date);
};

const INITIAL_CONFIG: CompanyConfig = {
    logo: null,
    stamp: null,
    headerTitle: 'جيلكو للمصاعد',
    headerSubtitle: 'Jilco Elevators Co.',
    taxNumber: '311834758800003', // الرقم الضريبي للشركة
    footerText: 'المملكة العربية السعودية - الرياض',
    contactPhone: '+966 50 000 0000',
    contactEmail: 'sales@jilco-elevators.com',
    bankAccounts: []
};

interface SavedQuote {
    id: string;
    details: QuoteDetails;
    items: QuoteItem[];
}

export const InvoiceModule: React.FC = () => {
    const { config: companyConfig } = useData();
    const { user: cloudUser } = useSupabaseAuth();
    const draftKey = invoiceDraftKey(cloudUser?.company_id, cloudUser?.id);
    const [restoredDraft] = useState<InvoiceData | null>(() => readInvoiceDraft(localStorage, draftKey));
    const [hasDraft, setHasDraft] = useState(Boolean(restoredDraft));
    const [draftError, setDraftError] = useState(false);
    const { currentUser } = useAuth();
    const {
        invoices, customers, receipts, quotes: savedQuotes,
        setInvoices, saveSalesRecord, deleteSalesRecord, reserveInvoiceNumber
    } = useSales();
    const { contracts, tickets } = useMaintenance();

    const [viewMode, setViewMode] = useState<'list' | 'editor' | 'statement'>(restoredDraft ? 'editor' : 'list');
    const [searchTerm, setSearchTerm] = useState('');
    const [creatingInvoice, setCreatingInvoice] = useState(false);
    const creatingInvoiceRef = useRef(false);
    const [savingInvoice, setSavingInvoice] = useState(false);
    const savingInvoiceRef = useRef(false);
    const [productsDb, setProductsDb] = useState<SupplierProduct[]>([]);
    const [config, setConfig] = useState<CompanyConfig>(INITIAL_CONFIG);
    useEffect(() => {
        if (companyConfig) setConfig({ ...INITIAL_CONFIG, ...companyConfig });
    }, [companyConfig]);

    const [currentInvoice, setCurrentInvoice] = useState<InvoiceData>(restoredDraft || {
        number: `INV-${new Date().getFullYear()}-001`,
        date: localDateString(),
        dueDate: dateAfterDays(15),
        customerName: '',
        customerVatNumber: '',
        items: [],
        status: 'pending',
        discountAmount: 0,
        isTaxInclusive: true // افتراضي شامل الضريبة
    });

    const [availableQuotes, setAvailableQuotes] = useState<SavedQuote[]>([]);
    const [currentItem, setCurrentItem] = useState<QuoteItem>({
        id: '', description: '', details: '', quantity: 1, unitPrice: 0, total: 0
    });

    useEffect(() => {
        if (viewMode !== 'editor') return;
        const saved = writeInvoiceDraft(localStorage, draftKey, currentInvoice);
        setDraftError(!saved);
        if (saved) setHasDraft(true);
    }, [currentInvoice, viewMode, draftKey]);

    useEffect(() => {
        const savedConfig = localStorage.getItem('jilco_quote_data');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                if (parsed.config) setConfig(prev => ({ ...prev, ...parsed.config }));
            } catch (e) { }
        }
    }, []);

    const handleCreateNew = async () => {
        if (hasDraft && !window.confirm('توجد مسودة فاتورة محفوظة. هل تريد استبدالها بفاتورة جديدة؟')) return;
        if (creatingInvoiceRef.current) return;
        creatingInvoiceRef.current = true;
        setCreatingInvoice(true);
        try {
            const number = await reserveInvoiceNumber(new Date().getFullYear());
            setCurrentInvoice({
                number,
                date: localDateString(),
                dueDate: dateAfterDays(15),
                customerName: '',
                customerVatNumber: '',
                items: [],
                status: 'pending',
                discountAmount: 0,
                isTaxInclusive: true // افتراضي شامل الضريبة
            });
            setAvailableQuotes([]);
            setViewMode('editor');
        } catch (error) {
            console.error('Failed to reserve an invoice number:', error);
            alert('تعذر حجز رقم فاتورة جديد من الخادم. تحقق من الاتصال وحاول مرة أخرى.');
        } finally {
            creatingInvoiceRef.current = false;
            setCreatingInvoice(false);
        }
    };

    const handleSaveInvoice = async () => {
        if (savingInvoiceRef.current) return;
        if (!currentInvoice.customerName) return alert('يرجى اختيار العميل');
        if (currentInvoice.items.length === 0) return alert('يرجى إضافة بند واحد على الأقل');
        if (!currentInvoice.date || !currentInvoice.dueDate) return alert('يرجى إدخال تاريخ الفاتورة وتاريخ الاستحقاق.');
        if (currentInvoice.dueDate < currentInvoice.date) return alert('يجب أن يكون تاريخ الاستحقاق في يوم الفاتورة أو بعده.');
        const invalidItem = currentInvoice.items.find(item =>
            !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0
            || !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0
        );
        if (invalidItem) return alert('تحقق من البنود: الكمية يجب أن تكون أكبر من صفر والسعر لا يمكن أن يكون سالباً.');

        savingInvoiceRef.current = true;
        setSavingInvoice(true);
        try {
        const normalizedItems = currentInvoice.items.map(item => ({
            ...item,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            total: Math.round((Number(item.quantity) * Number(item.unitPrice) + Number.EPSILON) * 100) / 100
        }));
        const amounts = calculateInvoiceAmounts(normalizedItems, currentInvoice.discountAmount, currentInvoice.isTaxInclusive);
        if (Number(currentInvoice.paidAmount || 0) > amounts.grandTotal + 0.01) {
            return alert('إجمالي الدفعات المسجلة أكبر من قيمة الفاتورة الجديدة. راجع سندات القبض أو عدّلها قبل تخفيض الإجمالي.');
        }

        const invoiceToSave = {
            ...currentInvoice,
            items: normalizedItems,
            discountAmount: amounts.discount,
            subtotal: amounts.subtotal,
            taxAmount: amounts.taxAmount,
            grandTotal: amounts.grandTotal
        };

        const existingInvoice = invoices.find(invoice =>
            invoice.number === currentInvoice.number
            || ((currentInvoice as any).id && invoice.id === (currentInvoice as any).id)
        );
        const saved = await saveSalesRecord('jilco_invoices_archive', currentInvoice.number, invoiceToSave);
        if (!saved) {
            const restoreInvoices = (records: any[]) => {
                const remaining = records.filter(invoice =>
                    invoice.number !== currentInvoice.number
                    && (!existingInvoice || invoice.number !== existingInvoice.number)
                    && (!(currentInvoice as any).id || invoice.id !== (currentInvoice as any).id)
                );
                return existingInvoice ? [existingInvoice, ...remaining] : remaining;
            };
            setInvoices(restoreInvoices);
            try {
                const cachedInvoices = JSON.parse(localStorage.getItem('jilco_invoices_archive') || '[]');
                localStorage.setItem('jilco_invoices_archive', JSON.stringify(restoreInvoices(Array.isArray(cachedInvoices) ? cachedInvoices : [])));
            } catch (error) {
                console.error('Invoice save failed and its local cache could not be rolled back:', error);
            }
            alert('تعذر حفظ الفاتورة في السحابة. لم تُعتمد التغييرات؛ تحقق من الاتصال أو رقم الفاتورة ثم أعد المحاولة.');
            return;
        }

        const exists = invoices.find(i => i.number === currentInvoice.number);
        if (exists) {
            loggerService.addLog(currentUser, 'تعديل فاتورة', `رقم الفاتورة: ${currentInvoice.number}`, 'المحاسبة');
        } else {
            loggerService.addLog(currentUser, 'إنشاء فاتورة', `رقم الفاتورة: ${currentInvoice.number}`, 'المحاسبة');
        }
        try { if (draftKey) localStorage.removeItem(draftKey); } catch (error) { console.error('Could not clear invoice draft:', error); }
        setHasDraft(false);
        setViewMode('list');
        } finally {
            savingInvoiceRef.current = false;
            setSavingInvoice(false);
        }
    };

    const handleDeleteInvoice = async (invoice: InvoiceData & { id?: string }) => {
        const number = invoice.number;
        if (receipts.some(receipt => receipt.invoiceId === number || receipt.invoiceNumber === number)) {
            alert('لا يمكن حذف هذه الفاتورة لأنها مرتبطة بسند قبض. احذف سند القبض أو فك ارتباطه أولاً.');
            return;
        }
        if (window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
            const deleted = await deleteSalesRecord('jilco_invoices_archive', invoice.id || number);
            if (!deleted) {
                alert('تعذر حذف الفاتورة من السحابة. تحقق من الاتصال ثم أعد المحاولة.');
                return;
            }
            loggerService.addLog(currentUser, 'حذف فاتورة', `رقم الفاتورة: ${number}`, 'المحاسبة');
        }
    };

    const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const customerId = e.target.value;
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            setCurrentInvoice(prev => ({
                ...prev,
                customerId: customer.id,
                customerName: customer.fullName,
                customerVatNumber: customer.vatNumber || ''
            }));
            const customerQuotes = savedQuotes.filter(q => q.details.customerName === customer.fullName);
            setAvailableQuotes(customerQuotes);
        }
    };

    const openInvoice = (invoice: InvoiceData) => {
        if (hasDraft && invoice.number !== currentInvoice.number
            && !window.confirm('توجد مسودة لفاتورة أخرى. هل تريد استبدالها بهذه الفاتورة؟')) return false;
        setCurrentInvoice(invoice);
        setViewMode('editor');
        return true;
    };

    const handleImportQuote = (quote: SavedQuote) => {
        if (window.confirm(`استيراد بنود عرض السعر رقم ${quote.details.number}؟`)) {
            setCurrentInvoice(prev => ({
                ...prev,
                items: quote.items
            }));
        }
    };

    const { subtotal, discount, taxableAmount, baseAmount, taxAmount: tax, grandTotal } =
        calculateInvoiceAmounts(currentInvoice.items || [], currentInvoice.discountAmount, currentInvoice.isTaxInclusive);
    const today = localDateString();
    const invoiceOverdue = (invoice: InvoiceData) => invoice.status === 'overdue'
        || (invoice.status !== 'paid' && Boolean(invoice.dueDate) && invoice.dueDate < today);

    if (viewMode === 'list') {
        return (
            <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
                <div className="max-w-6xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-jilco-900">أرشيف الفواتير الضريبية</h1>
                            <p className="text-gray-500 text-sm">إدارة الفواتير الصادرة للعملاء</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {hasDraft && <button onClick={() => setViewMode('editor')} className="px-4 py-2.5 rounded-lg border border-jilco-600 font-bold text-jilco-700">استكمال المسودة</button>}
                            <button onClick={async () => {
                                if(window.confirm('هل أنت متأكد من ترحيل الفواتير من قاعدة البيانات القديمة للجديدة؟')) {
                                    import('../services/cloudService').then(async m => {
                                        const result = await m.cloudService.migrateLegacyInvoices();
                                        if (result.failed) {
                                            alert(`تم ترحيل ${result.migrated} فاتورة، وتعذر ترحيل ${result.failed}. راجع الأرقام والصلاحيات ثم أعد المحاولة.`);
                                        } else {
                                            alert(`✅ تم ترحيل ${result.migrated} فاتورة بنجاح للجدول الجديد! يرجى تحديث الصفحة.`);
                                        }
                                    });
                                }
                            }} className="bg-orange-500 text-white px-4 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-orange-600 shadow-sm text-sm">ترحيل البيانات للجدول الجديد</button>
                            <button onClick={handleCreateNew} disabled={creatingInvoice} className="bg-jilco-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md disabled:cursor-wait disabled:opacity-60">
                                <Plus size={20} /> {creatingInvoice ? 'جارٍ حجز رقم الفاتورة…' : 'فاتورة جديدة'}
                            </button>
                        </div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                                <input title="بحث" type="text" placeholder="بحث برقم الفاتورة أو اسم العميل..." className="w-full pr-10 pl-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-jilco-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-900 text-white">
                                <tr>
                                    <th className="p-4 font-black">رقم الفاتورة</th>
                                    <th className="p-4 font-black">العميل</th>
                                    <th className="p-4 font-black">التاريخ</th>
                                    <th className="p-4 font-black">تاريخ الاستحقاق</th>
                                    <th className="p-4 font-black">الإجمالي</th>
                                    <th className="p-4 font-black">الحالة</th>
                                    <th className="p-4 text-center font-black">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {invoices.filter(i => (i.number || '').includes(searchTerm) || (i.customerName || '').includes(searchTerm)).map(inv => (
                                    <tr key={inv.number} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 font-mono font-bold text-jilco-900">{inv.number}</td>
                                        <td className="p-4 font-bold">{inv.customerName}</td>
                                        <td className="p-4 font-mono text-xs">{inv.date}</td>
                                        <td className={`p-4 font-mono text-xs ${invoiceOverdue(inv) ? 'font-black text-red-700' : ''}`}>
                                            {inv.dueDate || '—'}{invoiceOverdue(inv) && <span className="mr-2 rounded bg-red-50 px-2 py-1 font-sans">متأخرة</span>}
                                        </td>
                                        <td className="p-4 font-black text-green-700">
                                            {formatInvoiceMoney(calculateInvoiceAmounts(inv.items || [], inv.discountAmount, inv.isTaxInclusive).grandTotal)}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${invoiceOverdue(inv) ? 'bg-red-100 text-red-700' : inv.status === 'paid' ? 'bg-green-100 text-green-700' : inv.status === 'partial' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {invoiceOverdue(inv) ? (inv.status === 'partial' ? 'متأخرة جزئياً' : 'متأخرة') : inv.status === 'paid' ? 'مدفوعة' : inv.status === 'partial' ? 'مدفوعة جزئياً' : 'بانتظار الدفع'}
                                            </span>
                                        </td>
                                        <td className="p-4 flex justify-center gap-2">
                                            <button
                                                title="مشاركة عبر واتساب"
                                                onClick={() => {
                                                    if (!openInvoice(inv)) return;
                                                    setTimeout(() => {
                                                        const shareBtn = document.querySelector('[title="مشاركة المستند"]') as HTMLButtonElement;
                                                        if (shareBtn) shareBtn.click();
                                                    }, 300);
                                                }}
                                                className="p-2 text-green-600 hover:bg-green-50 rounded-full"
                                            >
                                                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.528 5.858L0 24l6.335-1.658A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.017-1.376l-.36-.214-3.734.979.994-3.634-.235-.374A9.818 9.818 0 1112 21.818z" />
                                                </svg>
                                            </button>
                                            <button title="تعديل" onClick={() => openInvoice(inv)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit size={16} /></button>
                                            <button title="طباعة" onClick={() => { if (openInvoice(inv)) setTimeout(() => window.print(), 500); }} className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"><Printer size={16} /></button>
                                            <button title="حذف" onClick={() => handleDeleteInvoice(inv)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden print:block">
            <div className="w-full lg:w-1/3 bg-white border-l border-gray-200 h-full overflow-y-auto p-6 no-print shadow-lg z-10">
                <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-jilco-900 flex items-center gap-2"><FileText className="text-blue-600" /> محرر الفاتورة</h2>
                    <button title="رجوع" onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={20} /></button>
                </div>
                <p role="status" className={`text-xs mb-4 ${draftError ? 'text-red-700' : 'text-gray-500'}`}>{draftError ? 'تعذر حفظ المسودة على هذا الجهاز. احفظ الفاتورة قبل مغادرة الصفحة.' : 'تُحفظ مسودة التعديلات على هذا الجهاز. اضغط حفظ لاعتماد الفاتورة في السحابة.'}</p>

                <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-2">
                        <button onClick={handleSaveInvoice} disabled={savingInvoice} className="bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-700 disabled:cursor-wait disabled:opacity-60"><Save size={18} /> {savingInvoice ? 'جارٍ الحفظ…' : 'حفظ'}</button>
                        <button onClick={() => window.print()} className="bg-jilco-900 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-jilco-800"><Printer size={18} /> طباعة</button>
                        <ShareButton
                            elementId="printable-area"
                            fileName={`فاتورة_${currentInvoice.number}`}
                            documentTitle={`فاتورة ضريبية رقم ${currentInvoice.number}`}
                            recipientName={currentInvoice.customerName || ''}
                            documentType="invoice"
                        />
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                        <label className="text-xs font-bold text-gray-700">بيانات العميل</label>
                        <select title="اختيار العميل" value={currentInvoice.customerId || ''} onChange={handleCustomerSelect} className="w-full p-2 border rounded text-sm bg-white font-bold text-black">
                            <option value="" disabled>-- اختر عميل مسجل --</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                        </select>
                        {availableQuotes.length > 0 && (
                            <div className="bg-amber-50 p-2 rounded border border-amber-200 mt-2">
                                <p className="text-[10px] font-bold text-amber-800 mb-1">عروض أسعار مرتبطة بالعميل:</p>
                                {availableQuotes.map(q => (
                                    <button key={q.id} onClick={() => handleImportQuote(q)} className="w-full text-right p-1.5 hover:bg-amber-100 text-[10px] font-bold flex justify-between items-center border-b border-amber-100 last:border-0">
                                        <span>{q.details.number}</span>
                                        <span className="text-amber-600 underline">استيراد البنود</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 space-y-3">
                        <label className="text-xs font-bold text-orange-800 flex items-center gap-1"><Wrench size={14} /> استيراد بنود صيانة (تلقائي)</label>
                        <select title="استيراد من عقد صيانة" onChange={(e) => {
                            const contract = contracts.find(c => c.id === e.target.value);
                            if (contract) {
                                const customer = customers.find(c => c.id === contract.customerId);
                                setCurrentInvoice(prev => ({
                                    ...prev,
                                    customerId: customer?.id || prev.customerId,
                                    customerName: customer?.fullName || prev.customerName,
                                    customerVatNumber: customer?.vatNumber || prev.customerVatNumber,
                                    items: [{
                                        id: 'contract-' + Date.now(),
                                        description: `عقد صيانة مصعد الدورية رقم ${contract.number}`,
                                        details: `صيانة مصعد لعدد ${contract.visitsPerYear} زيارات - تاريخ التغطية: ${contract.startDate} إلى ${contract.endDate}`,
                                        quantity: 1,
                                        unitPrice: contract.amount,
                                        total: contract.amount
                                    }]
                                }));
                            }
                        }} className="w-full p-2 border border-orange-300 rounded-lg bg-white font-bold text-sm outline-none mb-2 focus:ring-1 focus:ring-orange-500">
                            <option value="">-- استيراد من عقد صيانة --</option>
                            {contracts.map(c => <option key={c.id} value={c.id}>عقد {c.number} ({customers.find(cust => cust.id === c.customerId)?.fullName})</option>)}
                        </select>
                        <select title="استيراد من تذكرة أعطال" onChange={(e) => {
                            const ticket = tickets.find(t => t.id === e.target.value);
                            if (ticket) {
                                const customer = customers.find(c => c.id === ticket.customerId);
                                setCurrentInvoice(prev => ({
                                    ...prev,
                                    customerId: customer?.id || prev.customerId,
                                    customerName: customer?.fullName || prev.customerName,
                                    customerVatNumber: customer?.vatNumber || prev.customerVatNumber,
                                    items: [{
                                        id: 'ticket-' + Date.now(),
                                        description: `فاتورة إصلاح / تذكرة صيانة رقم ${ticket.number}`,
                                        details: ticket.description || 'أجور الإصلاح وقطع الغيار',
                                        quantity: 1,
                                        unitPrice: 0,
                                        total: 0
                                    }]
                                }));
                            }
                        }} className="w-full p-2 border border-orange-300 rounded-lg bg-white font-bold text-sm outline-none focus:ring-1 focus:ring-orange-500">
                            <option value="">-- استيراد من تذكرة أعطال --</option>
                            {tickets.map(t => <option key={t.id} value={t.id}>تذكرة {t.number} ({customers.find(cust => cust.id === t.customerId)?.fullName})</option>)}
                        </select>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1">رقم الفاتورة</label>
                                <input title="رقم الفاتورة يُحجز تلقائياً ولا يمكن تغييره يدوياً" placeholder="رقم الفاتورة" type="text" value={currentInvoice.number} readOnly className="w-full p-2 border rounded text-sm bg-gray-50 font-bold text-gray-700" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1">التاريخ</label>
                                <input title="التاريخ" type="date" value={currentInvoice.date} onChange={e => setCurrentInvoice({ ...currentInvoice, date: e.target.value })} className="w-full p-2 border rounded text-sm bg-white font-bold" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1">تاريخ الاستحقاق</label>
                                <input title="تاريخ الاستحقاق" type="date" min={currentInvoice.date} value={currentInvoice.dueDate || ''} onChange={e => setCurrentInvoice({ ...currentInvoice, dueDate: e.target.value })} className="w-full p-2 border rounded text-sm bg-white font-bold" />
                            </div>
                            <div className="flex items-end text-xs font-bold text-gray-500">{invoiceOverdue(currentInvoice) ? 'هذه الفاتورة تجاوزت تاريخ الاستحقاق.' : 'تظهر حالة التأخير تلقائياً بعد تاريخ الاستحقاق.'}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1">خصم مكتسب (مبلغ مالي)</label>
                                <input title="خصم مكتسب" type="number" min="0" step="0.01" value={currentInvoice.discountAmount || ''} onChange={e => setCurrentInvoice({ ...currentInvoice, discountAmount: parseFloat(e.target.value) || 0 })} className="w-full p-2 border rounded text-sm bg-white font-bold" placeholder="مثال: 500" />
                            </div>
                            <div className="flex items-end pb-1">
                                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 w-full border border-gray-200 rounded text-sm font-bold shadow-sm transition-all hover:bg-gray-50">
                                    <input
                                        title="تفعيل الضريبة"
                                        type="checkbox"
                                        checked={currentInvoice.isTaxInclusive ?? false}
                                        onChange={e => setCurrentInvoice({ ...currentInvoice, isTaxInclusive: e.target.checked })}
                                        className="w-4 h-4 text-jilco-600 rounded border-gray-300 focus:ring-jilco-500 cursor-pointer"
                                    />
                                    <span>إجمالي الفاتورة تشمل الضريبة (15%)</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h3 className="text-xs font-bold text-gray-700 mb-4">إضافة أصناف يدوياً</h3>
                        <div className="space-y-3">
                            <input title="اسم الصنف / الوصف" type="text" placeholder="اسم الصنف / الوصف" value={currentItem.description} onChange={e => setCurrentItem({ ...currentItem, description: e.target.value })} className="w-full p-2 border rounded text-sm bg-white font-bold" />
                            <div className="grid grid-cols-2 gap-3">
                                <input title="الكمية" type="number" min="0.01" step="0.01" placeholder="الكمية" value={currentItem.quantity} onChange={e => setCurrentItem({ ...currentItem, quantity: parseFloat(e.target.value) || 0 })} className="p-2 border rounded text-sm text-center bg-white font-bold" />
                                <input title="سعر الوحدة" type="number" min="0" step="0.01" placeholder="سعر الوحدة" value={currentItem.unitPrice} onChange={e => setCurrentItem({ ...currentItem, unitPrice: parseFloat(e.target.value) || 0 })} className="p-2 border rounded text-sm text-center bg-white font-bold" />
                            </div>
                            <button
                                onClick={() => {
                                    if (!currentItem.description.trim()) {
                                        alert('يرجى كتابة اسم أو وصف الصنف');
                                        return;
                                    }
                                    if (!Number.isFinite(currentItem.quantity) || currentItem.quantity <= 0 || !Number.isFinite(currentItem.unitPrice) || currentItem.unitPrice < 0) {
                                        alert('أدخل كمية أكبر من صفر وسعراً لا يقل عن صفر.');
                                        return;
                                    }
                                    const item = {
                                        ...currentItem,
                                        id: Date.now().toString(),
                                        total: Math.round((currentItem.quantity * currentItem.unitPrice + Number.EPSILON) * 100) / 100
                                    };
                                    setCurrentInvoice(prev => ({ ...prev, items: [...(prev.items || []), item] }));
                                    setCurrentItem({ id: '', description: '', details: '', quantity: 1, unitPrice: 0, total: 0 });
                                }}
                                className="w-full bg-blue-600 text-white py-2 rounded font-bold text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors"
                            >
                                + إضافة للجدول
                            </button>
                        </div>
                    </div>

                    {(currentInvoice.items || []).length > 0 && (
                        <div className="border border-blue-200 rounded-lg overflow-hidden bg-white">
                            <div className="bg-blue-600 text-white px-3 py-2 text-xs font-black">
                                الأصناف المضافة ({currentInvoice.items.length})
                            </div>
                            <table className="w-full text-xs">
                                <thead className="bg-gray-800 text-white">
                                    <tr>
                                        <th className="p-2 text-right font-bold">الصنف</th>
                                        <th className="p-2 text-center font-bold w-10">كمية</th>
                                        <th className="p-2 text-center font-bold w-16">السعر</th>
                                        <th className="p-2 text-center font-bold w-16">الإجمالي</th>
                                        <th className="p-2 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(currentInvoice.items || []).map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50 group">
                                            <td className="p-2 font-bold text-gray-800 truncate max-w-[100px]">{item.description}</td>
                                            <td className="p-2 text-center text-gray-600 font-mono">{item.quantity}</td>
                                            <td className="p-2 text-center font-mono text-gray-700">{formatInvoiceMoney(item.unitPrice)}</td>
                                            <td className="p-2 text-center font-black text-green-700">{formatInvoiceMoney(item.total)}</td>
                                            <td className="p-2 text-center">
                                                <button
                                                    title="حذف البند"
                                                    onClick={() => setCurrentInvoice(prev => ({ ...prev, items: (prev.items || []).filter(i => i.id !== item.id) }))}
                                                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                ><Trash2 size={13} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                    <tr>
                                        <td colSpan={3} className="p-2 text-right font-black text-gray-600 text-[10px] uppercase">الإجمالي الفرعي:</td>
                                        <td className="p-2 text-center font-black text-jilco-900">{formatInvoiceMoney(subtotal)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Invoice Preview View */}
            <div className="flex-1 bg-gray-200 p-8 overflow-auto flex justify-center items-start print:p-0 print:bg-white print:overflow-visible print:block">
                <div id="printable-area" className="invoice-print-document bg-white shadow-2xl w-[210mm] min-h-[297mm] p-0 relative flex flex-col print:shadow-none print:w-full">
                    <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
                    <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
                    <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
                        <header className="px-10 py-6 border-b-2 border-jilco-100 flex justify-between items-center bg-white min-h-[180px] relative shrink-0">
                            <div className="w-1/3 text-right">
                                <h1 className="text-2xl font-black text-jilco-900 mb-0.5">{config.headerTitle}</h1>
                                <p className="text-[10px] font-bold text-gray-500 mb-1">{config.headerSubtitle}</p>
                                <p className="text-[11px] font-black text-jilco-800">الرقم الضريبي: {config.taxNumber}</p>
                                {config.commercialRegistration && <p className="text-[10px] text-gray-600">السجل التجاري: {config.commercialRegistration}</p>}
                                {config.contactPhone && <p className="text-[10px]" dir="ltr">{config.contactPhone}</p>}
                                {config.contactEmail && <p className="text-[10px]" dir="ltr">{config.contactEmail}</p>}
                            </div>
                            <div className="w-1/3 flex justify-center">
                                {config.logo && <img src={config.logo} alt="Logo" className="h-32 w-auto object-contain" />}
                            </div>
                            <div className="w-1/3 text-left flex flex-col items-end" dir="ltr">
                                <h2 className="text-lg font-black text-jilco-900 tracking-tighter uppercase">Tax Invoice</h2>
                                <p className="text-[10px] text-gray-400 font-bold">فاتورة ضريبية</p>
                            </div>
                        </header>

                        <div className="px-10 py-6 flex-1 flex flex-col">
                            <div className="grid grid-cols-2 gap-6 mb-8 bg-gray-50/80 p-5 rounded-xl border border-gray-100">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">فاتورة إلى / Invoice To</p>
                                    <h3 className="text-xl font-black text-black mb-1">{currentInvoice.customerName || '..........................'}</h3>
                                    <p className="text-xs font-bold text-gray-500">الرقم الضريبي: {currentInvoice.customerVatNumber || 'N/A'}</p>
                                </div>
                                <div className="text-left font-mono text-xs flex flex-col items-end justify-center" dir="ltr">
                                    <p className="bg-white px-4 py-1.5 rounded-lg border border-gray-200 min-w-[160px] flex justify-between gap-4 mb-2">
                                        <span className="text-gray-400 font-sans font-black text-[9px] uppercase">Invoice No:</span>
                                        <span className="font-black text-jilco-900">{currentInvoice.number}</span>
                                    </p>
                                    <p className="bg-white px-4 py-1.5 rounded-lg border border-gray-200 min-w-[160px] flex justify-between gap-4">
                                        <span className="text-gray-400 font-sans font-black text-[9px] uppercase">Date:</span>
                                        <span className="font-black text-jilco-900">{currentInvoice.date}</span>
                                    </p>
                                    <p className="bg-white px-4 py-1.5 rounded-lg border border-gray-200 min-w-[160px] flex justify-between gap-4 mt-2">
                                        <span className="text-gray-400 font-sans font-black text-[9px] uppercase">Due date:</span>
                                        <span className="font-black text-jilco-900">{currentInvoice.dueDate || '—'}</span>
                                    </p>
                                </div>
                            </div>

                            <table className="invoice-items-table w-full border-collapse border-2 border-jilco-900 mb-6">
                                <thead>
                                    <tr className="bg-jilco-900 text-white text-[10px] font-black uppercase">
                                        <th className="p-2 text-center w-10 border border-jilco-900">#</th>
                                        <th className="p-2 text-right border border-jilco-900">البيان / Description</th>
                                        <th className="p-2 text-center w-20 border border-jilco-900">الكمية</th>
                                        <th className="p-2 text-center w-28 border border-jilco-900">سعر الوحدة</th>
                                        <th className="p-2 text-center w-28 border border-jilco-900">الإجمالي (SAR)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(currentInvoice.items || []).length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-4 text-center text-gray-300 text-xs font-bold border border-gray-300">
                                                لا توجد بنود مضافة
                                            </td>
                                        </tr>
                                    )}
                                    {(currentInvoice.items || []).map((item, idx) => (
                                        <tr key={idx} className="border-b border-gray-300">
                                            <td className="p-2 text-center font-bold text-gray-600 border border-gray-300 text-xs">{idx + 1}</td>
                                            <td className="p-2 font-bold text-gray-900 text-xs border border-gray-300 leading-tight">{item.description}{item.details?.trim() && <span className="mt-1 block whitespace-pre-line text-[10px] font-medium text-gray-600">{item.details}</span>}</td>
                                            <td className="p-2 text-center font-bold text-gray-900 border border-gray-300 text-xs">{item.quantity}</td>
                                            <td className="p-2 text-center font-mono font-bold border border-gray-300 text-xs">{formatInvoiceMoney(item.unitPrice)}</td>
                                            <td className="p-2 text-center font-black text-black border border-gray-300 text-xs">{formatInvoiceMoney(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="flex justify-between items-end mt-6">
                                <div className="w-64 space-y-2 rounded-lg border border-gray-200 p-4 text-xs">
                                    <p className="font-black text-jilco-900">حالة الفاتورة</p>
                                    <p className={`font-bold ${invoiceOverdue(currentInvoice) ? 'text-red-700' : 'text-gray-700'}`}>
                                        {invoiceOverdue(currentInvoice) ? 'متأخرة عن السداد' : currentInvoice.status === 'paid' ? 'مدفوعة' : currentInvoice.status === 'partial' ? 'مدفوعة جزئياً' : 'بانتظار الدفع'}
                                    </p>
                                    <p className="text-gray-600">المبلغ المسدد: <b>{formatInvoiceMoney(currentInvoice.paidAmount || 0)} ر.س</b></p>
                                    <p className="text-gray-600">المتبقي: <b>{formatInvoiceMoney(Math.max(0, grandTotal - (Number(currentInvoice.paidAmount) || 0)))} ر.س</b></p>
                                </div>
                                <div className="w-72 bg-white p-5 rounded-2xl border-4 border-jilco-900 shadow-xl space-y-3 relative overflow-hidden">
                                    <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase">
                                        <span>الإجمالي الفرعي / Subtotal:</span>
                                        <span className="font-mono text-black">{formatInvoiceMoney(subtotal)}</span>
                                    </div>
                                    {discount > 0 && <div className="flex justify-between text-[10px] font-black text-red-600">
                                        <span>الخصم / Discount:</span>
                                        <span className="font-mono">−{formatInvoiceMoney(discount)}</span>
                                    </div>}
                                    <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase">
                                        <span>الوعاء الضريبي / Ex. VAT:</span>
                                        <span className="font-mono text-black">
                                            {formatInvoiceMoney(baseAmount)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase">
                                        <span>الضريبة / VAT 15%:</span>
                                        <span className="font-mono text-red-600">
                                            {formatInvoiceMoney(tax)}
                                        </span>
                                    </div>
                                    <div className="border-t-2 border-gray-100 pt-3 flex justify-between items-center">
                                        <span className="font-black text-jilco-900 text-xs uppercase">الإجمالي شامل الضريبة / Total:</span>
                                        <div className="text-left">
                                            <span className="font-black text-black text-2xl font-mono">{formatInvoiceMoney(grandTotal)}</span>
                                            <p className="text-[8px] text-gold-600 font-black text-center uppercase">SAR</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 border-t-2 border-gray-100 pt-4 text-center">
                                <p className="text-xs text-gray-400 font-bold mb-1">المبلغ كتابة: <span className="text-jilco-900 font-black">{amountInArabicWords(grandTotal)}</span></p>
                                <div className="flex justify-between items-end gap-4 mt-4 text-right">
                                    <div className="space-y-2 text-[10px]">
                                        {(config.bankAccounts || []).filter(bank => bank.bankName?.trim()).map(bank => (
                                            <div key={bank.id}>
                                                <p className="font-bold">{bank.bankName}</p>
                                                {bank.accountNumber && <p>رقم الحساب: <span dir="ltr">{bank.accountNumber}</span></p>}
                                                {bank.iban && <p dir="ltr">IBAN: {bank.iban}</p>}
                                            </div>
                                        ))}
                                    </div>
                                    {config.stamp && <img src={config.stamp} alt="ختم الشركة" className="h-24 w-32 object-contain shrink-0" />}
                                </div>
                            </div>
                        </div>

                        <footer className="w-full bg-white shrink-0 mt-auto">
                            <div className="bg-jilco-900 text-white py-3 px-10 flex justify-between items-center text-[10px] font-bold h-[45px]">
                                <div className="flex items-center gap-2"><MapPin size={12} className="text-gold-400" /><span>{config.footerText}</span></div>
                                {config.website && <div className="flex items-center gap-2" dir="ltr"><Globe size={12} className="text-gold-400" /><span>{config.website}</span></div>}
                            </div>
                        </footer>
                    </div>
                </div>
            </div>
        </div>
    );
};
