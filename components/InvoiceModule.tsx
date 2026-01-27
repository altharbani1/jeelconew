
import React, { useState, useEffect, useMemo } from 'react';
import { Printer, FileText, Phone, Mail, QrCode, Globe, MapPin, Plus, ArrowLeft, Search, Trash2, Edit, Send, Save, User, ShoppingCart, DollarSign, Calendar, PieChart, CheckCircle2, X } from 'lucide-react';
import { InvoiceData, QuoteItem, CompanyConfig, Customer, SupplierProduct, QuoteDetails } from '../types';
import { useAuth } from '../contexts/AuthContext.tsx';
import { loggerService } from '../services/loggerService.ts';

// --- Tafqit Helper ---
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

const INITIAL_CONFIG: CompanyConfig = {
    logo: null,
    stamp: null,
    headerTitle: 'جيلكو للمصاعد',
    headerSubtitle: 'Jilco Elevators Co.',
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
  const { currentUser } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'statement'>('list');
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [productsDb, setProductsDb] = useState<SupplierProduct[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [config, setConfig] = useState<CompanyConfig>(INITIAL_CONFIG);

  const [currentInvoice, setCurrentInvoice] = useState<InvoiceData>({
    number: `INV-${new Date().getFullYear()}-001`,
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    customerName: '',
    customerVatNumber: '',
    items: [],
    status: 'pending',
    discount: 0
  });

  const [availableQuotes, setAvailableQuotes] = useState<SavedQuote[]>([]);
  const [priceIncludesVat, setPriceIncludesVat] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [currentItem, setCurrentItem] = useState<QuoteItem>({
      id: '', description: '', details: '', quantity: 1, unitPrice: 0, total: 0
  });

  useEffect(() => {
    const savedConfig = localStorage.getItem('jilco_quote_data');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (parsed.config) setConfig(prev => ({ ...prev, ...parsed.config }));
      } catch (e) {}
    }
    const savedInvoices = localStorage.getItem('jilco_invoices_archive');
    if (savedInvoices) {
      try { setInvoices(JSON.parse(savedInvoices)); } catch (e) {}
    }
    const savedCustomers = localStorage.getItem('jilco_customers');
    if (savedCustomers) {
        try { setCustomers(JSON.parse(savedCustomers)); } catch (e) {}
    }
    const quotes = localStorage.getItem('jilco_quotes_archive');
    if (quotes) {
        try { setSavedQuotes(JSON.parse(quotes)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('jilco_invoices_archive', JSON.stringify(invoices));
  }, [invoices]);

  const handleCreateNew = () => {
    setCurrentInvoice({
        number: `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`,
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        customerName: '',
        customerVatNumber: '',
        items: [],
        status: 'pending',
        discount: 0
    });
    setAvailableQuotes([]);
    setShowDiscount(false);
    setViewMode('editor');
  };

  const handleSaveInvoice = () => {
    if (!currentInvoice.customerName) return alert('يرجى اختيار العميل');
    if (currentInvoice.items.length === 0) return alert('يرجى إضافة بند واحد على الأقل');

    const exists = invoices.find(i => i.number === currentInvoice.number);
    if (exists) {
        setInvoices(invoices.map(i => i.number === currentInvoice.number ? currentInvoice : i));
        loggerService.addLog(currentUser, 'تعديل فاتورة', `رقم الفاتورة: ${currentInvoice.number}`, 'المحاسبة');
    } else {
        setInvoices([currentInvoice, ...invoices]);
        loggerService.addLog(currentUser, 'إنشاء فاتورة', `رقم الفاتورة: ${currentInvoice.number}`, 'المحاسبة');
    }
    setViewMode('list');
  };

  const handleDeleteInvoice = (number: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
        setInvoices(invoices.filter(i => i.number !== number));
        loggerService.addLog(currentUser, 'حذف فاتورة', `رقم الفاتورة: ${number}`, 'المحاسبة');
    }
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const customerId = e.target.value;
      const customer = customers.find(c => c.id === customerId);
      if(customer) {
          setCurrentInvoice(prev => ({
              ...prev,
              customerName: customer.fullName,
              customerVatNumber: customer.vatNumber || ''
          }));
          const customerQuotes = savedQuotes.filter(q => q.details.customerName === customer.fullName);
          setAvailableQuotes(customerQuotes);
      }
  };

  const handleImportQuote = (quote: SavedQuote) => {
      if (window.confirm(`استيراد بنود عرض السعر رقم ${quote.details.number}؟`)) {
          setCurrentInvoice(prev => ({
              ...prev,
              items: quote.items
          }));
      }
  };

  const subtotal = currentInvoice.items.reduce((s, i) => s + i.total, 0);
  const tax = subtotal * 0.15;
  const totalWithTax = subtotal + tax;
  const discountAmount = showDiscount && currentInvoice.discount ? currentInvoice.discount : 0;
  const grandTotal = totalWithTax - discountAmount;

  if (viewMode === 'list') {
      return (
        <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-jilco-900">أرشيف الفواتير الضريبية</h1>
                        <p className="text-gray-500 text-sm">إدارة الفواتير الصادرة للعملاء</p>
                    </div>
                    <button onClick={handleCreateNew} className="bg-jilco-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md">
                        <Plus size={20} /> فاتورة جديدة
                    </button>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                            <input type="text" placeholder="بحث برقم الفاتورة أو اسم العميل..." className="w-full pr-10 pl-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-jilco-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 text-gray-500">
                            <tr>
                                <th className="p-4">رقم الفاتورة</th>
                                <th className="p-4">العميل</th>
                                <th className="p-4">التاريخ</th>
                                <th className="p-4">الإجمالي</th>
                                <th className="p-4">الحالة</th>
                                <th className="p-4 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {invoices.filter(i => i.number.includes(searchTerm) || i.customerName.includes(searchTerm)).map(inv => (
                                <tr key={inv.number} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-mono font-bold text-jilco-900">{inv.number}</td>
                                    <td className="p-4 font-bold">{inv.customerName}</td>
                                    <td className="p-4 font-mono text-xs">{inv.date}</td>
                                    <td className="p-4 font-black text-green-700">{(() => {
                                        const sub = inv.items.reduce((s, it) => s + it.total, 0);
                                        const withTax = sub * 1.15;
                                        const disc = inv.discount || 0;
                                        return (withTax - disc).toLocaleString();
                                    })()}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {inv.status === 'paid' ? 'مدفوعة' : 'بانتظار الدفع'}
                                        </span>
                                    </td>
                                    <td className="p-4 flex justify-center gap-2">
                                        <button onClick={() => { setCurrentInvoice(inv); setShowDiscount(!!inv.discount && inv.discount > 0); setViewMode('editor'); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit size={16}/></button>
                                        <button onClick={() => { setCurrentInvoice(inv); setShowDiscount(!!inv.discount && inv.discount > 0); setViewMode('editor'); setTimeout(() => window.print(), 500); }} className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"><Printer size={16}/></button>
                                        <button onClick={() => handleDeleteInvoice(inv.number)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16}/></button>
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
                <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
            </div>
            
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleSaveInvoice} className="bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-700"><Save size={18}/> حفظ</button>
                    <button onClick={() => window.print()} className="bg-jilco-900 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-jilco-800"><Printer size={18}/> طباعة</button>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                    <label className="text-xs font-bold text-gray-700">بيانات العميل</label>
                    <select onChange={handleCustomerSelect} className="w-full p-2 border rounded text-sm bg-white font-bold text-black" defaultValue="">
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

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1">رقم الفاتورة</label>
                            <input type="text" value={currentInvoice.number} onChange={e => setCurrentInvoice({...currentInvoice, number: e.target.value})} className="w-full p-2 border rounded text-sm bg-white font-bold" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1">التاريخ</label>
                            <input type="date" value={currentInvoice.date} onChange={e => setCurrentInvoice({...currentInvoice, date: e.target.value})} className="w-full p-2 border rounded text-sm bg-white font-bold" />
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-gray-700">إضافة أصناف يدوياً</h3>
                    </div>
                    <div className="space-y-3">
                        <input type="text" placeholder="اسم الصنف / الوصف" value={currentItem.description} onChange={e => setCurrentItem({...currentItem, description: e.target.value})} className="w-full p-2 border rounded text-sm bg-white font-bold" />
                        <div className="grid grid-cols-2 gap-3">
                            <input type="number" placeholder="الكمية" value={currentItem.quantity} onChange={e => setCurrentItem({...currentItem, quantity: parseFloat(e.target.value) || 1})} className="p-2 border rounded text-sm text-center bg-white font-bold" />
                            <input type="number" placeholder="سعر الوحدة" value={currentItem.unitPrice} onChange={e => setCurrentItem({...currentItem, unitPrice: parseFloat(e.target.value) || 0})} className="p-2 border rounded text-sm text-center bg-white font-bold" />
                        </div>
                        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer bg-amber-50 p-2 rounded border border-amber-200">
                            <input type="checkbox" checked={priceIncludesVat} onChange={e => setPriceIncludesVat(e.target.checked)} className="w-4 h-4" />
                            <span>السعر شامل الضريبة (سيتم خصم 15% تلقائياً)</span>
                        </label>
                        <button 
                            onClick={() => {
                                if(!currentItem.description || !currentItem.unitPrice) return;
                                let finalPrice = currentItem.unitPrice;
                                if(priceIncludesVat) {
                                    finalPrice = currentItem.unitPrice / 1.15;
                                }
                                const item = { ...currentItem, id: Date.now().toString(), unitPrice: finalPrice, total: currentItem.quantity * finalPrice };
                                setCurrentInvoice({...currentInvoice, items: [...currentInvoice.items, item]});
                                setCurrentItem({id: '', description: '', details: '', quantity: 1, unitPrice: 0, total: 0});
                            }}
                            className="w-full bg-blue-600 text-white py-2 rounded font-bold text-sm"
                        >
                            + إضافة للجدول
                        </button>
                    </div>
                </div>

                {currentInvoice.items.length > 0 && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-blue-900">البنود المضافة ({currentInvoice.items.length})</h3>
                            <span className="text-[10px] font-bold text-blue-600">شاهد التفاصيل في الفاتورة ←</span>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {currentInvoice.items.map((item, idx) => (
                                <div key={item.id} className="bg-white p-2 rounded-lg border border-blue-100 flex justify-between items-center group hover:border-blue-300 transition-all">
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-gray-900">{idx + 1}. {item.description}</p>
                                        <p className="text-[10px] text-gray-500 font-bold">{item.quantity} × {item.unitPrice.toLocaleString()} = {item.total.toLocaleString()} ريال</p>
                                    </div>
                                    <button 
                                        onClick={() => setCurrentInvoice({...currentInvoice, items: currentInvoice.items.filter(i => i.id !== item.id)})} 
                                        className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                        title="حذف البند"
                                    >
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-blue-200 space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-gray-600">
                                <span>المجموع:</span>
                                <span className="font-mono">{subtotal.toLocaleString()} ريال</span>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-gray-600">
                                <span>الضريبة 15%:</span>
                                <span className="font-mono text-red-600">{tax.toLocaleString()} ريال</span>
                            </div>
                            {showDiscount && discountAmount > 0 && (
                                <div className="flex justify-between text-[10px] font-bold text-green-600">
                                    <span>الخصم:</span>
                                    <span className="font-mono">- {discountAmount.toLocaleString()} ريال</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm font-black text-jilco-900">
                                <span>الإجمالي:</span>
                                <span className="font-mono">{grandTotal.toLocaleString()} ريال</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer mb-3">
                        <input 
                            type="checkbox" 
                            checked={showDiscount} 
                            onChange={e => {
                                setShowDiscount(e.target.checked);
                                if (!e.target.checked) {
                                    setCurrentInvoice({...currentInvoice, discount: 0});
                                }
                            }} 
                            className="w-4 h-4" 
                        />
                        <span>تفعيل الخصم على الفاتورة</span>
                    </label>
                    {showDiscount && (
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-gray-500">مبلغ الخصم (ريال)</label>
                            <input 
                                type="number" 
                                placeholder="0.00" 
                                value={currentInvoice.discount || ''} 
                                onChange={e => setCurrentInvoice({...currentInvoice, discount: parseFloat(e.target.value) || 0})} 
                                className="w-full p-2 border rounded text-sm bg-white font-bold text-center" 
                                min="0"
                                step="0.01"
                            />
                            <p className="text-[9px] text-gray-500 font-bold text-center">سيتم خصم المبلغ من الإجمالي بعد احتساب الضريبة</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Invoice Preview View */}
        <div className="flex-1 bg-gray-200 p-8 overflow-auto flex justify-center items-start print:p-0 print:bg-white print:overflow-visible print:block">
            <div id="printable-area" className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-0 relative flex flex-col print:shadow-none print:w-full print:break-inside-avoid">
                <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
                <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
                <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
                    <header className="px-10 py-6 border-b-2 border-jilco-100 flex justify-between items-center bg-white h-[160px] relative overflow-hidden shrink-0">
                        <div className="w-1/3 text-right">
                            <h1 className="text-2xl font-black text-jilco-900 mb-0.5">{config.headerTitle}</h1>
                            <p className="text-[10px] font-bold text-gray-500 mb-3">{config.headerSubtitle}</p>
                            {config.vatNumber && <p className="text-[9px] font-bold text-gray-600">رقم الضريبة: {config.vatNumber}</p>}
                        </div>
                        <div className="w-1/3 flex justify-center">
                            {config.logo && <img src={config.logo} alt="Logo" className="h-32 w-auto object-contain" />}
                        </div>
                        <div className="w-1/3 text-left flex flex-col items-end" dir="ltr">
                            <h2 className="text-lg font-black text-jilco-900 tracking-tighter uppercase">Tax Invoice</h2>
                            <p className="text-[10px] text-gray-400 font-bold">فاتورة ضريبية</p>
                            {config.vatNumber && <p className="text-[9px] font-bold text-gray-600 mt-1">VAT: {config.vatNumber}</p>}
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
                            </div>
                        </div>

                        <table className="w-full border-collapse mb-8 flex-1">
                            <thead>
                                <tr className="bg-jilco-900 text-white text-[11px] font-black uppercase">
                                    <th className="p-3 text-center w-12 border border-white/20">#</th>
                                    <th className="p-3 text-right border border-white/20">البيان / Description</th>
                                    <th className="p-3 text-center w-24 border border-white/20">الكمية<br/><span className="text-[8px] font-normal">Qty</span></th>
                                    <th className="p-3 text-center w-36 border border-white/20">سعر الوحدة<br/><span className="text-[8px] font-normal">Unit Price</span></th>
                                    <th className="p-3 text-center w-36 border border-white/20">الإجمالي<br/><span className="text-[8px] font-normal">Total (SAR)</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentInvoice.items.map((item, idx) => (
                                    <tr key={idx} className="bg-gray-100 border-b border-gray-200">
                                        <td className="p-3 text-center font-black text-black border-l border-r border-gray-200">{idx + 1}</td>
                                        <td className="p-3 font-black text-black text-sm border-r border-gray-200">{item.description}</td>
                                        <td className="p-3 text-center font-black text-black border-r border-gray-200">{item.quantity}</td>
                                        <td className="p-3 text-center font-mono font-black text-black border-r border-gray-200">{item.unitPrice.toLocaleString()}</td>
                                        <td className="p-3 text-center font-mono font-black text-black border-r border-gray-200">{item.total.toLocaleString()}</td>
                                    </tr>
                                ))}
                                {currentInvoice.items.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-gray-300 italic text-sm border border-gray-200">
                                            لم يتم إضافة بنود بعد
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        <div className="flex justify-between items-end mt-6">
                            <div className="p-2 border border-gray-200 rounded-lg">
                                <QrCode size={100} className="text-gray-800" />
                                <p className="text-[8px] text-center font-bold text-gray-400 mt-1 uppercase">ZATCA Compliant</p>
                            </div>
                            <div className="w-72 bg-white p-5 rounded-2xl border-4 border-jilco-900 shadow-xl space-y-3 relative overflow-hidden">
                                <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase">
                                    <span>المجموع / Subtotal:</span>
                                    <span className="font-mono text-black">{subtotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase">
                                    <span>الضريبة / VAT 15%:</span>
                                    <span className="font-mono text-red-600">{tax.toLocaleString()}</span>
                                </div>
                                {showDiscount && discountAmount > 0 && (
                                    <div className="flex justify-between text-[10px] font-black text-green-600 uppercase">
                                        <span>الخصم / Discount:</span>
                                        <span className="font-mono">- {discountAmount.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="border-t-2 border-gray-100 pt-3 flex justify-between items-center">
                                    <span className="font-black text-jilco-900 text-xs uppercase">Grand Total:</span>
                                    <div className="text-left">
                                        <span className="font-black text-black text-2xl font-mono">{grandTotal.toLocaleString()}</span>
                                        <p className="text-[8px] text-gold-600 font-black text-center uppercase">SAR</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 border-t-2 border-gray-100 pt-6">
                            <div className="flex justify-between items-end px-4">
                                <div className="text-center">
                                    <div className="border-t-2 border-gray-300 w-48 mb-2"></div>
                                    <p className="text-[10px] font-bold text-gray-500">التوقيع / Signature</p>
                                </div>
                                
                                {config.stamp && (
                                    <div className="flex flex-col items-center">
                                        <img src={config.stamp} alt="Stamp" className="h-40 w-40 object-contain" />
                                        <p className="text-[9px] font-bold text-gray-500 mt-1">الختم الرسمي / Official Stamp</p>
                                    </div>
                                )}
                                
                                {!config.stamp && (
                                    <div className="flex flex-col items-center">
                                        <div className="h-40 w-40 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center">
                                            <p className="text-xs text-gray-300 font-bold text-center">الختم</p>
                                        </div>
                                        <p className="text-[9px] font-bold text-gray-400 mt-1">Company Stamp</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <footer className="w-full bg-white shrink-0 mt-auto">
                        <div className="bg-jilco-900 text-white py-3 px-10 flex justify-between items-center text-[10px] font-bold h-[45px]">
                            <div className="flex items-center gap-2"><MapPin size={12} className="text-gold-400"/><span>{config.footerText}</span></div>
                            <div className="flex items-center gap-2" dir="ltr"><Globe size={12} className="text-gold-400"/><span>www.jilco-elevators.com</span></div>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    </div>
  );
};
