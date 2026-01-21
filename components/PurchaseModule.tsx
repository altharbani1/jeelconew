import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Users, Package, FileText, Banknote, 
  Plus, Search, Edit, Trash2, Save, X, Filter, 
  ArrowLeft, ArrowDown, ArrowUp, Calendar, Truck, Upload, ImageIcon, Paperclip, Download, Briefcase, Printer, MapPin, Phone, Mail, Globe, CreditCard, ClipboardList
} from 'lucide-react';
import { Supplier, SupplierProduct, PurchaseInvoice, SupplierPayment, QuoteItem, Attachment, Project, CompanyConfig } from '../types';

type PurchaseTab = 'suppliers' | 'products' | 'invoices' | 'payments' | 'statement';

const INITIAL_CONFIG: CompanyConfig = {
    logo: null, stamp: null, headerTitle: 'جيلكو للمصاعد', headerSubtitle: '', footerText: '', contactPhone: '', contactEmail: '', bankAccounts: []
};

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

export const PurchaseModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PurchaseTab>('invoices');
  
  // --- STATE ---
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [config, setConfig] = useState<CompanyConfig>(INITIAL_CONFIG);

  // Search States
  const [supplierSearch, setSupplierSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');

  // Form States (Modals)
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState<Partial<Supplier>>({});

  const [showProductModal, setShowProductModal] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<SupplierProduct>>({});

  const [showInvoiceEditor, setShowInvoiceEditor] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Partial<PurchaseInvoice>>({ items: [], attachments: [], paymentType: 'credit' });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentPayment, setCurrentPayment] = useState<Partial<SupplierPayment>>({ method: 'transfer', date: new Date().toISOString().split('T')[0] });

  // Quick Add Product Modal (from Invoice Editor)
  const [showQuickProductModal, setShowQuickProductModal] = useState(false);
  const [quickProduct, setQuickProduct] = useState<Partial<SupplierProduct>>({});

  // Print State
  const [printingInvoice, setPrintingInvoice] = useState<PurchaseInvoice | null>(null);
  const [printingPayment, setPrintingPayment] = useState<SupplierPayment | null>(null);
  const [printingStatement, setPrintingStatement] = useState<{supplier: Supplier, invoices: PurchaseInvoice[], payments: SupplierPayment[], balance: number} | null>(null);

  // Statement State
  const [statementSupplierId, setStatementSupplierId] = useState<string>('');

  // --- PERSISTENCE ---
  useEffect(() => {
    try {
      const s = localStorage.getItem('jilco_suppliers');
      const p = localStorage.getItem('jilco_supplier_products');
      const i = localStorage.getItem('jilco_purchase_invoices');
      const py = localStorage.getItem('jilco_supplier_payments');
      const proj = localStorage.getItem('jilco_projects');
      const conf = localStorage.getItem('jilco_quote_data');

      if (s) setSuppliers(JSON.parse(s));
      if (p) setProducts(JSON.parse(p));
      if (i) setInvoices(JSON.parse(i));
      if (py) setPayments(JSON.parse(py));
      if (proj) setProjects(JSON.parse(proj));
      if (conf) {
          const parsedConf = JSON.parse(conf);
          if (parsedConf.config) setConfig(parsedConf.config);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    localStorage.setItem('jilco_suppliers', JSON.stringify(suppliers));
    localStorage.setItem('jilco_supplier_products', JSON.stringify(products));
    localStorage.setItem('jilco_purchase_invoices', JSON.stringify(invoices));
    localStorage.setItem('jilco_supplier_payments', JSON.stringify(payments));
  }, [suppliers, products, invoices, payments]);

  // --- ACTIONS ---

  // Suppliers
  const handleSaveSupplier = () => {
    if (!currentSupplier.name) return alert('اسم المورد مطلوب');
    
    if (currentSupplier.id) {
      setSuppliers(suppliers.map(s => s.id === currentSupplier.id ? currentSupplier as Supplier : s));
    } else {
      const newSupplier: Supplier = { ...currentSupplier as Supplier, id: Date.now().toString() };
      setSuppliers([...suppliers, newSupplier]);
    }
    setShowSupplierModal(false);
    setCurrentSupplier({});
  };

  const handleDeleteSupplier = (id: string) => {
    if (window.confirm('حذف المورد سيؤثر على الفواتير المرتبطة. هل أنت متأكد؟')) {
      setSuppliers(suppliers.filter(s => s.id !== id));
    }
  };

  // Products
  const handleSaveProduct = () => {
    if (!currentProduct.name) return;
    if (currentProduct.id) {
      setProducts(products.map(p => p.id === currentProduct.id ? currentProduct as SupplierProduct : p));
    } else {
      const newProd: SupplierProduct = { 
        ...currentProduct as SupplierProduct, 
        id: Date.now().toString(),
        supplierId: currentProduct.supplierId || '' 
      };
      setProducts([...products, newProd]);
    }
    setShowProductModal(false);
    setCurrentProduct({});
  };

  // Quick Add Product (from Invoice)
  const handleSaveQuickProduct = () => {
    if (!quickProduct.name || !quickProduct.purchasePrice) {
      alert('يجب ملء اسم المنتج والسعر على الأقل');
      return;
    }
    
    const newProd: SupplierProduct = { 
      ...quickProduct as SupplierProduct, 
      id: Date.now().toString(),
      supplierId: currentInvoice.supplierId || '',
      unit: quickProduct.unit || 'قطعة'
    };
    
    setProducts([...products, newProd]);
    
    // Auto-fill the invoice item with the new product
    (document.getElementById('newItemDesc') as HTMLSelectElement).value = newProd.name;
    (document.getElementById('newItemPrice') as HTMLInputElement).value = newProd.purchasePrice.toString();
    
    setShowQuickProductModal(false);
    setQuickProduct({});
    
    alert('تم إضافة المنتج بنجاح! يمكنك الآن اختياره من القائمة');
  };

  // Invoices
  const handleSaveInvoice = () => {
    // التحقق من البيانات المطلوبة
    if (!currentInvoice.supplierId) return alert('اختر المورد من فضلك');
    if (!currentInvoice.number || currentInvoice.number.trim() === '') return alert('أدخل رقم الفاتورة من فضلك');
    if (!currentInvoice.date) return alert('اختر تاريخ الفاتورة من فضلك');
    if (!currentInvoice.items || currentInvoice.items.length === 0) return alert('أضف منتجات واحد على الأقل');
    
    const subtotal = currentInvoice.items.reduce((s, i) => s + i.total, 0);
    const taxRate = currentInvoice.taxRate ?? 15; // Default 15% VAT if not specified
    const tax = subtotal * (taxRate / 100);
    const grandTotal = subtotal + tax;

    const proj = projects.find(p => p.id === currentInvoice.projectId);

    const invoiceData: PurchaseInvoice = {
      ...currentInvoice as PurchaseInvoice,
      id: currentInvoice.id || Date.now().toString(),
      number: currentInvoice.number,
      date: currentInvoice.date,
      supplierId: currentInvoice.supplierId,
      totalAmount: subtotal,
      taxRate: taxRate,
      taxAmount: tax,
      grandTotal: grandTotal,
      status: currentInvoice.status || 'pending',
      paymentType: currentInvoice.paymentType || 'credit',
      attachments: currentInvoice.attachments || [],
      projectId: currentInvoice.projectId,
      projectName: proj ? proj.name : undefined
    };

    if (currentInvoice.id) {
      setInvoices(invoices.map(i => i.id === currentInvoice.id ? invoiceData : i));
    } else {
      setInvoices([invoiceData, ...invoices]);
    }
    setShowInvoiceEditor(false);
    setCurrentInvoice({ items: [], attachments: [], paymentType: 'credit' });
  };

  // Payments
  const handleSavePayment = () => {
    if (!currentPayment.supplierId || !currentPayment.amount) return alert('بيانات ناقصة');
    
    const paymentData: SupplierPayment = {
      ...currentPayment as SupplierPayment,
      id: currentPayment.id || Date.now().toString(),
    };

    if (currentPayment.id) {
      setPayments(payments.map(p => p.id === currentPayment.id ? paymentData : p));
    } else {
      setPayments([paymentData, ...payments]);
    }
    setShowPaymentModal(false);
    setCurrentPayment({ method: 'transfer', date: new Date().toISOString().split('T')[0] });
  };

  // --- FILE HANDLING ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (file.size > 2 * 1024 * 1024) return alert('حجم الملف كبير جداً (الحد الأقصى 2 ميجا)');
        
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
                setCurrentInvoice(prev => ({
                    ...prev,
                    attachments: [...(prev.attachments || []), newAttachment]
                }));
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const removeAttachment = (id: string) => {
      setCurrentInvoice(prev => ({
          ...prev,
          attachments: (prev.attachments || []).filter(a => a.id !== id)
      }));
  };

  // --- RENDER HELPERS ---

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'غير معروف';

  // --- PRINTABLE PAYMENT VOUCHER ---
  const renderPrintablePayment = () => {
      if (!printingPayment) return null;
      const supplier = suppliers.find(s => s.id === printingPayment.supplierId);

      return (
        <div className="fixed inset-0 bg-gray-200 z-[200] overflow-auto flex justify-center items-start print:static print:bg-white print:p-0 print:h-full">
            <div id="printable-area" className="bg-white shadow-2xl w-[210mm] min-h-[148mm] relative flex flex-col p-0 print:shadow-none print:w-full print:h-[148mm] my-8 print:my-0">
                
                {/* Royal Frame Borders */}
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
                            {config.logo ? <img src={config.logo} className="h-20 object-contain"/> : null}
                        </div>
                        <div className="text-left">
                            <h2 className="text-xl font-black text-red-700 uppercase tracking-widest bg-red-50 px-4 py-1 rounded border border-red-100">Payment Voucher</h2>
                            <p className="text-sm font-bold text-gray-600 mt-1 text-center">سند صرف مورد</p>
                        </div>
                    </div>

                    <button onClick={() => setPrintingPayment(null)} className="absolute top-4 right-4 bg-gray-200 hover:bg-gray-300 p-2 rounded-full print:hidden z-50"><X size={20}/></button>
                    <button onClick={() => window.print()} className="absolute top-4 right-16 bg-jilco-900 text-white px-4 py-2 rounded-lg font-bold print:hidden z-50 flex items-center gap-2"><Printer size={18}/> طباعة</button>

                    {/* Content */}
                    <div className="flex-1 space-y-6 px-8 relative z-10">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded border border-gray-200">
                                <span className="font-bold text-gray-500 text-sm">رقم السند:</span>
                                <span className="font-mono font-black text-lg text-red-600">PV-{printingPayment.id.slice(-6)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-500 text-sm">التاريخ:</span>
                                <span className="font-mono font-bold text-black border-b border-gray-300 px-4">{printingPayment.date}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 bg-red-50 p-4 rounded-lg border border-red-100 shadow-sm">
                            <span className="font-bold text-red-900 text-sm w-24">المبلغ:</span>
                            <div className="flex-1 flex justify-between items-center">
                                <span className="font-mono font-black text-3xl text-red-700">{printingPayment.amount.toLocaleString()}</span>
                                <span className="text-xs font-bold bg-white px-2 py-1 rounded text-red-800 border border-red-200">ريال سعودي SAR</span>
                            </div>
                        </div>

                        <div className="space-y-5 text-sm">
                            <div className="flex items-end gap-2">
                                <span className="font-bold text-gray-600 w-24 shrink-0">يصرف إلى:</span>
                                <span className="flex-1 border-b border-dotted border-gray-400 pb-1 font-bold text-gray-900 px-2 text-lg">{supplier?.name}</span>
                            </div>
                            
                            <div className="flex items-end gap-2">
                                <span className="font-bold text-gray-600 w-24 shrink-0">مبلغ وقدره:</span>
                                <span className="flex-1 border-b border-dotted border-gray-400 pb-1 font-medium text-gray-800 px-2 italic font-bold">{tafqit(printingPayment.amount)}</span>
                            </div>

                            <div className="flex items-end gap-2">
                                <span className="font-bold text-gray-600 w-24 shrink-0">وذلك مقابل:</span>
                                <span className="flex-1 border-b border-dotted border-gray-400 pb-1 font-bold text-gray-900 px-2 leading-loose">{printingPayment.notes || 'دفعة من الحساب'}</span>
                            </div>

                            <div className="flex gap-8 pt-4">
                                <span className="font-bold text-gray-600">طريقة الدفع:</span>
                                <span className="font-bold text-black bg-gray-100 px-3 py-1 rounded">
                                    {printingPayment.method === 'cash' ? 'نقداً' : printingPayment.method === 'check' ? 'شيك' : 'تحويل بنكي'}
                                </span>
                                {printingPayment.referenceNumber && (
                                    <span className="font-bold text-gray-600">المرجع: <span className="font-mono text-black">{printingPayment.referenceNumber}</span></span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className="mt-12 flex justify-between items-end px-8 pb-6">
                        <div className="text-center">
                            <p className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-wider">المحاسب</p>
                            <div className="w-32 border-b-2 border-gray-300"></div>
                        </div>
                        <div className="text-center relative">
                            {config.stamp && <img src={config.stamp} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-24 opacity-80 mix-blend-multiply" alt="stamp"/>}
                            <p className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-wider">الاعتماد (المدير العام)</p>
                            <div className="w-32 border-b-2 border-gray-300"></div>
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-wider">المستلم</p>
                            <div className="w-32 border-b-2 border-gray-300"></div>
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="bg-jilco-900 text-white text-center py-2 text-[10px] w-full mt-auto relative z-20">
                        {config.footerText || 'Jilco Elevators System'} | {config.contactPhone}
                    </div>
                </div>
            </div>
        </div>
      );
  };

  // --- PRINTABLE INVOICE VIEW ---
  const renderPrintableInvoice = () => {
      if (!printingInvoice) return null;
      
      const supplier = suppliers.find(s => s.id === printingInvoice.supplierId);

      return (
        <div className="fixed inset-0 bg-gray-200 z-[200] overflow-auto flex justify-center items-start print:static print:bg-white print:p-0 print:h-full">
            <div id="printable-area" className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-0 relative flex flex-col print:shadow-none print:w-full my-8 print:my-0">
                {/* Close Button */}
                <button onClick={() => setPrintingInvoice(null)} className="absolute top-4 right-4 bg-gray-200 hover:bg-gray-300 p-2 rounded-full print:hidden z-50"><X size={20}/></button>
                <button onClick={() => window.print()} className="absolute top-4 right-16 bg-jilco-900 text-white px-4 py-2 rounded-lg font-bold print:hidden z-50 flex items-center gap-2"><Printer size={18}/> طباعة</button>

                {/* Header */}
                <div className="px-10 py-6 border-b-2 border-jilco-900 flex justify-between items-center">
                    <div className="w-1/3 text-right">
                        <h1 className="text-xl font-black text-jilco-900">{config.headerTitle}</h1>
                        <p className="text-xs font-bold text-gray-500">{config.headerSubtitle}</p>
                    </div>
                    <div className="w-1/3 text-center">
                        <h2 className="text-2xl font-black text-jilco-900 border-2 border-jilco-900 px-4 py-1 inline-block rounded-lg uppercase">فاتورة مشتريات</h2>
                        <p className="text-xs font-bold text-gray-400 mt-1 uppercase">Purchase Invoice</p>
                    </div>
                    <div className="w-1/3 flex justify-end">
                        {config.logo ? <img src={config.logo} className="h-20 object-contain"/> : null}
                    </div>
                </div>

                {/* Info */}
                <div className="px-10 py-8">
                    <div className="flex justify-between mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
                        <div>
                            <p className="text-xs text-gray-500 font-bold mb-1">المورد (Supplier)</p>
                            <h3 className="text-lg font-black text-jilco-900 mb-1">{supplier?.name}</h3>
                            <p className="text-xs text-gray-600">هاتف: {supplier?.phone}</p>
                            <p className="text-xs text-gray-600">ضريبي: {supplier?.vatNumber}</p>
                        </div>
                        <div className="text-left">
                            <div className="mb-2">
                                <span className="text-xs text-gray-500 font-bold block">رقم الفاتورة</span>
                                <span className="font-mono text-lg font-black text-black">{printingInvoice.number}</span>
                            </div>
                            <div className="mb-2">
                                <span className="text-xs text-gray-500 font-bold block">التاريخ</span>
                                <span className="font-mono text-black font-bold">{printingInvoice.date}</span>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 font-bold block">طريقة الدفع</span>
                                <span className="font-bold text-jilco-900">
                                    {printingInvoice.paymentType === 'credit' ? 'أجل (Credit)' : 
                                     printingInvoice.paymentType === 'transfer' ? 'تحويل بنكي' : 'نقد (Cash)'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Items */}
                    <table className="w-full text-sm border-collapse mb-8">
                        <thead>
                            <tr className="bg-jilco-900 text-white">
                                <th className="p-3 text-center w-12 border border-jilco-900">#</th>
                                <th className="p-3 text-right border border-jilco-900">الصنف / الوصف</th>
                                <th className="p-3 text-center w-24 border border-jilco-900">الكمية</th>
                                <th className="p-3 text-center w-32 border border-jilco-900">سعر الوحدة</th>
                                <th className="p-3 text-center w-32 border border-jilco-900">الإجمالي</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printingInvoice.items.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="p-3 border border-gray-300 text-center">{idx + 1}</td>
                                    <td className="p-3 border border-gray-300 font-bold">{item.description}</td>
                                    <td className="p-3 border border-gray-300 text-center">{item.quantity}</td>
                                    <td className="p-3 border border-gray-300 text-center font-mono">{item.unitPrice.toLocaleString()}</td>
                                    <td className="p-3 border border-gray-300 text-center font-bold font-mono">{item.total.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div className="flex justify-end">
                        <div className="w-72">
                            <div className="flex justify-between py-2 border-b border-gray-200">
                                <span className="font-bold text-gray-600">المجموع الفرعي</span>
                                <span className="font-mono font-bold">{printingInvoice.totalAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200">
                                <span className="font-bold text-gray-600">ضريبة القيمة المضافة ({printingInvoice.taxRate ?? 15}%)</span>
                                <span className="font-mono font-bold text-red-600">{printingInvoice.taxAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-3 bg-jilco-900 text-white px-4 rounded-lg mt-2 shadow-sm">
                                <span className="font-black">الإجمالي النهائي</span>
                                <span className="font-mono font-black text-xl">{printingInvoice.grandTotal.toLocaleString()}</span>
                            </div>
                            <div className="mt-2 text-center text-xs text-gray-500 font-bold">
                                {tafqit(printingInvoice.grandTotal)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-auto px-10 pb-6">
                    <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[10px] text-gray-500 font-bold">
                        <div className="flex items-center gap-1"><Phone size={12}/> {config.contactPhone}</div>
                        <div className="flex items-center gap-1"><MapPin size={12}/> {config.footerText}</div>
                        <div className="flex items-center gap-1"><Globe size={12}/> jilco-elevators.com</div>
                    </div>
                </div>
            </div>
        </div>
      );
  };

  // --- TAB CONTENT ---

  const renderSuppliers = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text" placeholder="بحث عن مورد..." 
            value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black bg-white font-bold"
          />
        </div>
        <button 
          onClick={() => { setCurrentSupplier({}); setShowSupplierModal(true); }}
          className="bg-jilco-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-jilco-700"
        >
          <Plus size={18} /> إضافة مورد
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {suppliers.filter(s => s.name.includes(supplierSearch)).map(supplier => (
          <div key={supplier.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative group">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold">
                  {supplier.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">{supplier.name}</h3>
                  <p className="text-xs text-gray-500 font-bold">{supplier.contactPerson}</p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setCurrentSupplier(supplier); setShowSupplierModal(true); }} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                <button onClick={() => handleDeleteSupplier(supplier.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
              </div>
            </div>
            <div className="space-y-1 text-sm text-gray-600 mt-3 border-t pt-3 border-gray-50 font-bold">
              <p className="flex items-center gap-2"><span className="font-bold text-xs">هاتف:</span> {supplier.phone}</p>
              <p className="flex items-center gap-2"><span className="font-bold text-xs">ضريبي:</span> {supplier.vatNumber || '-'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-4">
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => { setCurrentProduct({}); setShowProductModal(true); }}
          className="bg-jilco-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-jilco-700"
        >
          <Plus size={18} /> إضافة منتج
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 text-gray-500 font-medium">
            <tr>
              <th className="p-4">اسم المنتج</th>
              <th className="p-4">المورد</th>
              <th className="p-4">سعر الشراء</th>
              <th className="p-4">الوحدة</th>
              <th className="p-4 w-24 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map(product => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="p-4 font-bold text-gray-800">{product.name}</td>
                <td className="p-4 text-gray-600 font-bold">{getSupplierName(product.supplierId)}</td>
                <td className="p-4 text-gray-800 font-black">{product.purchasePrice.toLocaleString()}</td>
                <td className="p-4 text-gray-500 font-bold">{product.unit}</td>
                <td className="p-4 text-center">
                  <div className="flex justify-center gap-2">
                    <button 
                        onClick={() => { setCurrentProduct(product); setShowProductModal(true); }} 
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-1.5 rounded transition-colors"
                        title="تعديل المنتج"
                    >
                        <Edit size={16}/>
                    </button>
                    <button 
                        onClick={() => { setProducts(products.filter(p => p.id !== product.id)) }} 
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                        title="حذف المنتج"
                    >
                        <Trash2 size={16}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400">لا توجد منتجات مسجلة</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderInvoices = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text" placeholder="بحث برقم الفاتورة..." 
            value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-gray-400 rounded-lg focus:ring-2 focus:ring-jilco-500 outline-none text-sm text-black bg-white font-bold"
          />
        </div>
        <button 
          onClick={() => { 
            const invoiceNumber = `PI-${Date.now().toString().slice(-8)}`;
            setCurrentInvoice({ 
              number: invoiceNumber,
              date: new Date().toISOString().split('T')[0], 
              items: [],
              status: 'pending',
              paymentType: 'credit',
              attachments: []
            }); 
            setShowInvoiceEditor(true); 
          }}
          className="bg-jilco-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-jilco-700 font-bold"
        >
          <Plus size={18} /> فاتورة شراء جديدة
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 text-gray-500 font-medium">
            <tr>
              <th className="p-4">رقم الفاتورة</th>
              <th className="p-4">المورد</th>
              <th className="p-4">المشروع</th>
              <th className="p-4">الإجمالي</th>
              <th className="p-4">الحالة</th>
              <th className="p-4 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.filter(i => i.number.includes(invoiceSearch)).map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="p-4 font-mono font-bold text-gray-800">{inv.number}</td>
                <td className="p-4 font-bold text-gray-600">{getSupplierName(inv.supplierId)}</td>
                <td className="p-4 text-xs font-bold text-gray-500">{inv.projectName || '-'}</td>
                <td className="p-4 font-black text-jilco-900">{inv.grandTotal.toLocaleString()}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {inv.status === 'paid' ? 'مدفوعة' : 'مستحقة'}
                  </span>
                </td>
                <td className="p-4 text-center flex justify-center gap-2">
                   <button onClick={() => setPrintingInvoice(inv)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="طباعة"><Printer size={16}/></button>
                   <button onClick={() => { setCurrentInvoice(inv); setShowInvoiceEditor(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-full"><Edit size={16}/></button>
                   <button onClick={() => setInvoices(invoices.filter(i => i.id !== inv.id))} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400 font-bold">لا توجد فواتير مسجلة</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderPayments = () => (
      <div className="space-y-4">
          <div className="flex justify-end mb-4">
              <button 
                  onClick={() => { setCurrentPayment({ method: 'transfer', date: new Date().toISOString().split('T')[0] }); setShowPaymentModal(true); }}
                  className="bg-jilco-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold hover:bg-jilco-800"
              >
                  <Plus size={18} /> تسجيل دفعة جديدة
              </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-right">
                  <thead className="bg-gray-50 text-gray-500 font-medium">
                      <tr>
                          <th className="p-4">رقم السند</th>
                          <th className="p-4">المورد</th>
                          <th className="p-4">التاريخ</th>
                          <th className="p-4">المبلغ</th>
                          <th className="p-4">طريقة الدفع</th>
                          <th className="p-4 text-center">طباعة</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {payments.map(pay => (
                          <tr key={pay.id} className="hover:bg-gray-50">
                              <td className="p-4 font-mono font-bold text-gray-800">PV-{pay.id.slice(-6)}</td>
                              <td className="p-4 font-bold text-gray-600">{getSupplierName(pay.supplierId)}</td>
                              <td className="p-4 font-mono text-xs font-bold">{pay.date}</td>
                              <td className="p-4 font-black text-red-600">{pay.amount.toLocaleString()}</td>
                              <td className="p-4 text-xs font-bold">
                                  {pay.method === 'cash' ? 'نقد' : pay.method === 'check' ? 'شيك' : 'تحويل'}
                              </td>
                              <td className="p-4 text-center">
                                  <button onClick={() => setPrintingPayment(pay)} className="text-jilco-600 hover:bg-jilco-50 p-2 rounded-full transition-colors">
                                      <Printer size={16}/>
                                  </button>
                              </td>
                          </tr>
                      ))}
                      {payments.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400 font-bold">لا توجد دفعات مسجلة</td></tr>}
                  </tbody>
              </table>
          </div>
      </div>
  );

  const renderPrintableStatement = () => {
    if (!printingStatement) return null;
    const {supplier, invoices: stmtInvoices, payments: stmtPayments, balance} = printingStatement;

    return (
      <div className="fixed inset-0 bg-gray-200 z-[200] overflow-auto flex justify-center items-start print:static print:bg-white print:p-0 print:h-full">
        <div id="printable-statement" className="bg-white shadow-2xl w-[210mm] min-h-[297mm] relative flex flex-col p-0 print:shadow-none print:w-full print:h-[297mm] my-8 print:my-0">
          
          {/* Header */}
          <div className="px-10 py-8 border-b-2 border-jilco-100">
            <div className="flex justify-between items-center mb-6">
              <div className="text-right">
                <h1 className="text-2xl font-black text-jilco-900">{config.headerTitle}</h1>
                <p className="text-xs font-bold text-gray-500 mt-1">{config.headerSubtitle}</p>
              </div>
              <h2 className="text-xl font-black text-jilco-900 border-2 border-jilco-900 px-4 py-2 rounded">كشف حساب</h2>
              <div>
                {config.logo ? <img src={config.logo} className="h-24 object-contain"/> : null}
              </div>
            </div>

            {/* Supplier Info */}
            <div className="bg-gray-50 p-4 rounded border border-gray-200">
              <h3 className="font-bold text-lg text-jilco-900 mb-3">بيانات المورد</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500 font-bold">الاسم:</p>
                  <p className="font-bold text-gray-800">{supplier.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold">الهاتف:</p>
                  <p className="font-bold text-gray-800">{supplier.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold">الرقم الضريبي:</p>
                  <p className="font-bold text-gray-800">{supplier.vatNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold">الفترة:</p>
                  <p className="font-bold text-gray-800">{new Date().toISOString().split('T')[0]}</p>
                </div>
              </div>
            </div>
          </div>

          <button onClick={() => setPrintingStatement(null)} className="absolute top-4 right-4 bg-gray-200 hover:bg-gray-300 p-2 rounded-full print:hidden z-50"><X size={20}/></button>
          <button onClick={() => window.print()} className="absolute top-4 right-16 bg-jilco-900 text-white px-4 py-2 rounded-lg font-bold print:hidden z-50 flex items-center gap-2"><Printer size={18}/> طباعة</button>

          {/* Transactions */}
          <div className="px-10 py-8 flex-1">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-jilco-900 text-white">
                  <th className="p-3 text-center border border-jilco-900">#</th>
                  <th className="p-3 text-right border border-jilco-900">التاريخ</th>
                  <th className="p-3 text-right border border-jilco-900">النوع</th>
                  <th className="p-3 text-right border border-jilco-900">الوصف</th>
                  <th className="p-3 text-center border border-jilco-900">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {stmtInvoices.map((inv, idx) => (
                  <tr key={inv.id}>
                    <td className="p-3 border border-gray-300 text-center font-bold">{idx + 1}</td>
                    <td className="p-3 border border-gray-300 font-mono text-xs">{inv.date}</td>
                    <td className="p-3 border border-gray-300 font-bold text-red-600">فاتورة</td>
                    <td className="p-3 border border-gray-300 font-bold">رقم {inv.number}</td>
                    <td className="p-3 border border-gray-300 text-center font-bold text-red-600">{inv.grandTotal.toLocaleString()}</td>
                  </tr>
                ))}
                {stmtPayments.map((pay, idx) => (
                  <tr key={pay.id} className="bg-blue-50">
                    <td className="p-3 border border-gray-300 text-center font-bold">{stmtInvoices.length + idx + 1}</td>
                    <td className="p-3 border border-gray-300 font-mono text-xs">{pay.date}</td>
                    <td className="p-3 border border-gray-300 font-bold text-green-600">دفعة</td>
                    <td className="p-3 border border-gray-300 font-bold">{pay.method === 'cash' ? 'نقداً' : pay.method === 'check' ? 'شيك' : 'تحويل'}</td>
                    <td className="p-3 border border-gray-300 text-center font-bold text-green-600">-{pay.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary */}
            <div className="mt-8 flex justify-end">
              <div className="w-80">
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-bold">إجمالي الفواتير</span>
                  <span className="font-mono font-bold">{stmtInvoices.reduce((s, i) => s + i.grandTotal, 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="font-bold">إجمالي المدفوعات</span>
                  <span className="font-mono font-bold">{stmtPayments.reduce((s, p) => s + p.amount, 0).toLocaleString()}</span>
                </div>
                <div className={`flex justify-between py-3 px-4 rounded-lg mt-2 ${balance >= 0 ? 'bg-amber-50 border-amber-200 border' : 'bg-green-50 border-green-200 border'}`}>
                  <span className="font-black">{balance >= 0 ? 'الرصيد عليك' : 'الرصيد لك'}</span>
                  <span className={`font-mono font-black text-lg ${balance >= 0 ? 'text-amber-700' : 'text-green-700'}`}>{Math.abs(balance).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-auto px-10 pb-6">
            <div className="border-t border-gray-200 pt-4 flex justify-between items-center text-[10px] text-gray-500 font-bold">
              <div>{config.contactPhone}</div>
              <div>{config.footerText}</div>
              <div>jilco-elevators.com</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStatement = () => {
    const supplier = suppliers.find(s => s.id === statementSupplierId);
    if (!supplier) {
      return (
        <div className="space-y-4">
          <div className="flex justify-end mb-4">
            <select className="p-2 border rounded font-bold" value={statementSupplierId} onChange={e => setStatementSupplierId(e.target.value)}>
              <option value="">-- اختر مورد --</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="bg-white p-8 rounded-xl text-center text-gray-400 font-bold">
            اختر مورداً لعرض كشف حسابه
          </div>
        </div>
      );
    }

    const supplierInvoices = invoices.filter(i => i.supplierId === supplier.id);
    const supplierPayments = payments.filter(p => p.supplierId === supplier.id);
    
    const totalInvoices = supplierInvoices.reduce((sum, i) => sum + i.grandTotal, 0);
    const totalPayments = supplierPayments.reduce((sum, p) => sum + p.amount, 0);
    const balance = totalInvoices - totalPayments;

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <select className="p-2 border rounded font-bold" value={statementSupplierId} onChange={e => setStatementSupplierId(e.target.value)}>
            <option value="">-- اختر مورد --</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={() => setPrintingStatement({supplier, invoices: supplierInvoices, payments: supplierPayments, balance})} className="bg-jilco-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-jilco-700 font-bold">
            <Printer size={18}/> طباعة الكشف
          </button>
        </div>

        {/* Supplier Info */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">اسم المورد</p>
              <p className="text-lg font-bold text-jilco-900">{supplier.name}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">الهاتف</p>
              <p className="text-lg font-bold text-gray-700">{supplier.phone}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">الرقم الضريبي</p>
              <p className="text-lg font-bold text-gray-700">{supplier.vatNumber || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">جهة الاتصال</p>
              <p className="text-lg font-bold text-gray-700">{supplier.contactPerson || '-'}</p>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-500 font-medium">
              <tr>
                <th className="p-4">التاريخ</th>
                <th className="p-4">النوع</th>
                <th className="p-4">البيان</th>
                <th className="p-4">المبلغ</th>
                <th className="p-4">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {supplierInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="p-4 font-mono text-xs">{inv.date}</td>
                  <td className="p-4"><span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">فاتورة</span></td>
                  <td className="p-4 font-bold">رقم {inv.number}</td>
                  <td className="p-4 font-bold text-red-600">{inv.grandTotal.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {inv.status === 'paid' ? 'مدفوعة' : 'مستحقة'}
                    </span>
                  </td>
                </tr>
              ))}
              {supplierPayments.map((pay) => (
                <tr key={pay.id} className="hover:bg-gray-50 bg-blue-50">
                  <td className="p-4 font-mono text-xs">{pay.date}</td>
                  <td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">دفعة</span></td>
                  <td className="p-4 font-bold">دفعة - {pay.method}</td>
                  <td className="p-4 font-bold text-green-600">-{pay.amount.toLocaleString()}</td>
                  <td className="p-4"><span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">مدفوعة</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 p-4 rounded-xl border border-red-200">
            <p className="text-xs font-bold text-red-600 mb-1">إجمالي الفواتير</p>
            <p className="text-2xl font-black text-red-700">{totalInvoices.toLocaleString()}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-xl border border-green-200">
            <p className="text-xs font-bold text-green-600 mb-1">إجمالي المدفوعات</p>
            <p className="text-2xl font-black text-green-700">{totalPayments.toLocaleString()}</p>
          </div>
          <div className={`${balance >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'} p-4 rounded-xl border`}>
            <p className={`text-xs font-bold ${balance >= 0 ? 'text-amber-600' : 'text-green-600'} mb-1`}>{balance >= 0 ? 'رصيد عليك' : 'رصيد لك'}</p>
            <p className={`text-2xl font-black ${balance >= 0 ? 'text-amber-700' : 'text-green-700'}`}>{Math.abs(balance).toLocaleString()}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                        <ShoppingBag className="text-gold-500" /> إدارة المشتريات والموردين
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">متابعة فواتير الشراء، حسابات الموردين، والمدفوعات</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden max-w-full flex-wrap gap-0">
                <button onClick={() => setActiveTab('invoices')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors min-w-max ${activeTab === 'invoices' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><FileText size={16}/> فواتير الشراء</button>
                <button onClick={() => setActiveTab('payments')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors min-w-max ${activeTab === 'payments' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><Banknote size={16}/> المدفوعات</button>
                <button onClick={() => setActiveTab('suppliers')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors min-w-max ${activeTab === 'suppliers' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><Users size={16}/> الموردين</button>
                <button onClick={() => setActiveTab('products')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors min-w-max ${activeTab === 'products' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><Package size={16}/> المنتجات</button>
                <button onClick={() => setActiveTab('statement')} className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 transition-colors min-w-max ${activeTab === 'statement' ? 'bg-jilco-50 text-jilco-800 border-b-4 border-jilco-600' : 'text-gray-500 hover:bg-gray-50'}`}><ClipboardList size={16}/> كشف حساب</button>
            </div>

            {/* Content */}
            {activeTab === 'suppliers' && renderSuppliers()}
            {activeTab === 'products' && renderProducts()}
            {activeTab === 'invoices' && renderInvoices()}
            {activeTab === 'payments' && renderPayments()}
            {activeTab === 'statement' && renderStatement()}
        </div>

        {/* Modals */}
        {/* Supplier Modal */}
        {showSupplierModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <h3 className="font-bold text-lg mb-4 text-jilco-900">بيانات المورد</h3>
                    <div className="space-y-3">
                        <input type="text" className="w-full p-2 border rounded font-bold" placeholder="اسم المورد / الشركة" value={currentSupplier.name || ''} onChange={e => setCurrentSupplier({...currentSupplier, name: e.target.value})} />
                        <input type="text" className="w-full p-2 border rounded font-bold" placeholder="الشخص المسؤول" value={currentSupplier.contactPerson || ''} onChange={e => setCurrentSupplier({...currentSupplier, contactPerson: e.target.value})} />
                        <input type="text" className="w-full p-2 border rounded font-bold" placeholder="رقم الهاتف" value={currentSupplier.phone || ''} onChange={e => setCurrentSupplier({...currentSupplier, phone: e.target.value})} />
                        <input type="text" className="w-full p-2 border rounded font-bold" placeholder="الرقم الضريبي" value={currentSupplier.vatNumber || ''} onChange={e => setCurrentSupplier({...currentSupplier, vatNumber: e.target.value})} />
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setShowSupplierModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold">إلغاء</button>
                        <button onClick={handleSaveSupplier} className="px-4 py-2 bg-jilco-600 text-white rounded hover:bg-jilco-700 font-bold">حفظ</button>
                    </div>
                </div>
            </div>
        )}

        {/* Product Modal */}
        {showProductModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <h3 className="font-bold text-lg mb-4 text-jilco-900">بيانات المنتج</h3>
                    <div className="space-y-3">
                        <select className="w-full p-2 border rounded font-bold" value={currentProduct.supplierId || ''} onChange={e => setCurrentProduct({...currentProduct, supplierId: e.target.value})}>
                            <option value="">-- اختر المورد --</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <input type="text" className="w-full p-2 border rounded font-bold" placeholder="اسم المنتج / الصنف" value={currentProduct.name || ''} onChange={e => setCurrentProduct({...currentProduct, name: e.target.value})} />
                        <input type="number" className="w-full p-2 border rounded font-bold" placeholder="سعر الشراء" value={currentProduct.purchasePrice || ''} onChange={e => setCurrentProduct({...currentProduct, purchasePrice: parseFloat(e.target.value)})} />
                        <input type="text" className="w-full p-2 border rounded font-bold" placeholder="الوحدة (قطعة, متر...)" value={currentProduct.unit || ''} onChange={e => setCurrentProduct({...currentProduct, unit: e.target.value})} />
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setShowProductModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold">إلغاء</button>
                        <button onClick={handleSaveProduct} className="px-4 py-2 bg-jilco-600 text-white rounded hover:bg-jilco-700 font-bold">حفظ</button>
                    </div>
                </div>
            </div>
        )}

        {/* Invoice Editor Modal */}
        {showInvoiceEditor && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-lg text-jilco-900">تسجيل فاتورة شراء</h3>
                        <button onClick={() => setShowInvoiceEditor(false)}><X size={20}/></button>
                    </div>
                    <div className="p-6 overflow-y-auto flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">المورد</label>
                                <select className="w-full p-2 border rounded font-bold" value={currentInvoice.supplierId || ''} onChange={e => setCurrentInvoice({...currentInvoice, supplierId: e.target.value})}>
                                    <option value="">-- اختر المورد --</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">رقم الفاتورة</label>
                                <input type="text" className="w-full p-2 border rounded font-bold" value={currentInvoice.number || ''} onChange={e => setCurrentInvoice({...currentInvoice, number: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">التاريخ</label>
                                <input type="date" className="w-full p-2 border rounded font-bold" value={currentInvoice.date || ''} onChange={e => setCurrentInvoice({...currentInvoice, date: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">مشروع (اختياري)</label>
                                <select className="w-full p-2 border rounded font-bold" value={currentInvoice.projectId || ''} onChange={e => setCurrentInvoice({...currentInvoice, projectId: e.target.value})}>
                                    <option value="">-- عام (مخزون) --</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Items Section */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-sm text-gray-700">الأصناف المضافة</h4>
                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">
                                    {currentInvoice.items?.length || 0} صنف
                                </span>
                            </div>
                            <div className="space-y-2">
                                {currentInvoice.items?.map((item, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input type="text" className="flex-1 p-2 border rounded font-bold text-sm" value={item.description} readOnly />
                                        <input type="number" className="w-20 p-2 border rounded font-bold text-sm text-center" value={item.quantity} readOnly />
                                        <input type="number" className="w-24 p-2 border rounded font-bold text-sm text-center" value={item.unitPrice} readOnly />
                                        <button onClick={() => setCurrentInvoice({...currentInvoice, items: currentInvoice.items?.filter((_, i) => i !== idx)})} className="text-red-500"><X size={16}/></button>
                                    </div>
                                ))}
                                
                                {/* Quick Add Item Row */}
                                <div className="flex gap-2 items-center mt-2 pt-2 border-t border-gray-200">
                                    <div className="flex-1 flex gap-1">
                                        <select id="newItemDesc" className="flex-1 p-2 border rounded font-bold text-sm focus:ring-2 focus:ring-jilco-500 outline-none">
                                            <option value="">-- اختر منتج --</option>
                                            {products.filter(p => !currentInvoice.supplierId || p.supplierId === currentInvoice.supplierId || p.supplierId === '').map(p => <option key={p.id} value={p.name}>{p.name} (سعر: {p.purchasePrice})</option>)}
                                        </select>
                                        <button
                                            onClick={() => {
                                                setQuickProduct({ supplierId: currentInvoice.supplierId || '' });
                                                setShowQuickProductModal(true);
                                            }}
                                            className="bg-green-600 text-white p-2 rounded hover:bg-green-700 transition-colors font-bold shrink-0"
                                            title="إضافة منتج جديد"
                                        >
                                            <Plus size={16}/>
                                        </button>
                                    </div>
                                    <input id="newItemQty" type="number" className="w-20 p-2 border rounded font-bold text-sm text-center" placeholder="العدد" min="1" step="0.5" />
                                    <input id="newItemPrice" type="number" className="w-24 p-2 border rounded font-bold text-sm text-center" placeholder="السعر" min="0" step="0.5" />
                                    <button 
                                        onClick={() => {
                                            const desc = (document.getElementById('newItemDesc') as HTMLSelectElement).value;
                                            const qtyInput = (document.getElementById('newItemQty') as HTMLInputElement).value;
                                            const priceInput = (document.getElementById('newItemPrice') as HTMLInputElement).value;
                                            
                                            // التحقق من المدخلات
                                            if (!desc || desc.trim() === '') {
                                                alert('اختر منتج من القائمة');
                                                return;
                                            }
                                            
                                            const qty = qtyInput ? parseFloat(qtyInput) : 0;
                                            const price = priceInput ? parseFloat(priceInput) : 0;
                                            
                                            if (qty <= 0) {
                                                alert('أدخل كمية صحيحة (أكبر من 0)');
                                                return;
                                            }
                                            if (price <= 0) {
                                                alert('أدخل سعر صحيح (أكبر من 0)');
                                                return;
                                            }
                                            
                                            const newItems = [...(currentInvoice.items || []), { 
                                                id: Date.now().toString(), 
                                                description: desc, 
                                                quantity: qty, 
                                                unitPrice: price, 
                                                total: qty * price, 
                                                details: '' 
                                            }];
                                            
                                            setCurrentInvoice({
                                                ...currentInvoice,
                                                items: newItems
                                            });
                                            
                                            // تفريغ الحقول
                                            (document.getElementById('newItemDesc') as HTMLSelectElement).value = '';
                                            (document.getElementById('newItemQty') as HTMLInputElement).value = '';
                                            (document.getElementById('newItemPrice') as HTMLInputElement).value = '';
                                        }}
                                        className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition-colors font-bold"
                                    ><Plus size={16}/></button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">نسبة الضريبة (%)</label>
                                <input type="number" min="0" max="100" step="0.5" className="w-full p-2 border rounded font-bold" value={currentInvoice.taxRate ?? 15} onChange={e => setCurrentInvoice({...currentInvoice, taxRate: parseFloat(e.target.value) || 0})} placeholder="15" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">حالة الدفع</label>
                                <select className="w-full p-2 border rounded font-bold" value={currentInvoice.status || 'pending'} onChange={e => setCurrentInvoice({...currentInvoice, status: e.target.value as any})}>
                                    <option value="pending">مستحقة (آجل)</option>
                                    <option value="paid">مدفوعة (نقد/تحويل)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">طريقة الدفع</label>
                                <select className="w-full p-2 border rounded font-bold" value={currentInvoice.paymentType || 'credit'} onChange={e => setCurrentInvoice({...currentInvoice, paymentType: e.target.value as any})}>
                                    <option value="credit">آجل (Credit)</option>
                                    <option value="cash">نقد</option>
                                    <option value="transfer">تحويل</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                        <button onClick={() => setShowInvoiceEditor(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded font-bold">إلغاء</button>
                        <button onClick={handleSaveInvoice} className="px-6 py-2 bg-jilco-600 text-white rounded font-bold hover:bg-jilco-700">حفظ الفاتورة</button>
                    </div>
                </div>
            </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                    <h3 className="font-bold text-lg mb-4 text-jilco-900">تسجيل دفعة لمورد</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">المورد</label>
                            <select className="w-full p-2 border rounded font-bold" value={currentPayment.supplierId || ''} onChange={e => setCurrentPayment({...currentPayment, supplierId: e.target.value})}>
                                <option value="">-- اختر المورد --</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">المبلغ</label>
                            <input type="number" className="w-full p-2 border rounded font-bold" value={currentPayment.amount || ''} onChange={e => setCurrentPayment({...currentPayment, amount: parseFloat(e.target.value)})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">التاريخ</label>
                            <input type="date" className="w-full p-2 border rounded font-bold" value={currentPayment.date || ''} onChange={e => setCurrentPayment({...currentPayment, date: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">طريقة الدفع</label>
                            <select className="w-full p-2 border rounded font-bold" value={currentPayment.method || 'transfer'} onChange={e => setCurrentPayment({...currentPayment, method: e.target.value as any})}>
                                <option value="transfer">تحويل بنكي</option>
                                <option value="cash">نقد</option>
                                <option value="check">شيك</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات / مرجع</label>
                            <input type="text" className="w-full p-2 border rounded font-bold" value={currentPayment.notes || ''} onChange={e => setCurrentPayment({...currentPayment, notes: e.target.value})} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded font-bold">إلغاء</button>
                        <button onClick={handleSavePayment} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold">حفظ الدفعة</button>
                    </div>
                </div>
            </div>
        )}

        {/* Quick Add Product Modal (from Invoice Editor) */}
        {showQuickProductModal && (
            <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border-4 border-green-500">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="bg-green-100 p-2 rounded-lg">
                            <Plus size={20} className="text-green-600"/>
                        </div>
                        <h3 className="font-bold text-lg text-gray-900">إضافة منتج جديد سريع</h3>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">المورد (اختياري)</label>
                            <select 
                                className="w-full p-2 border-2 border-gray-300 rounded-lg font-bold focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none"
                                value={quickProduct.supplierId || ''} 
                                onChange={e => setQuickProduct({...quickProduct, supplierId: e.target.value})}
                            >
                                <option value="">-- بدون مورد محدد (متاح من عدة موردين) --</option>
                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">اسم المنتج *</label>
                            <input 
                                type="text" 
                                className="w-full p-2 border-2 border-gray-300 rounded-lg font-bold focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none" 
                                placeholder="مثال: كابل كهرباء 3x2.5" 
                                value={quickProduct.name || ''} 
                                onChange={e => setQuickProduct({...quickProduct, name: e.target.value})} 
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">سعر الشراء *</label>
                            <input 
                                type="number" 
                                className="w-full p-2 border-2 border-gray-300 rounded-lg font-bold focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none" 
                                placeholder="0.00" 
                                value={quickProduct.purchasePrice || ''} 
                                onChange={e => setQuickProduct({...quickProduct, purchasePrice: parseFloat(e.target.value)})} 
                                step="0.01"
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">الوحدة</label>
                            <input 
                                type="text" 
                                className="w-full p-2 border-2 border-gray-300 rounded-lg font-bold focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none" 
                                placeholder="قطعة، متر، كرتون..." 
                                value={quickProduct.unit || ''} 
                                onChange={e => setQuickProduct({...quickProduct, unit: e.target.value})} 
                            />
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-xs text-blue-700 font-bold">
                                💡 يمكنك ربط المنتج بمورد محدد أو تركه عام (متاح من عدة موردين)
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button 
                            onClick={() => {
                                setShowQuickProductModal(false);
                                setQuickProduct({});
                            }} 
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-bold transition-colors"
                        >
                            إلغاء
                        </button>
                        <button 
                            onClick={handleSaveQuickProduct} 
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex items-center gap-2 transition-colors shadow-lg"
                        >
                            <Plus size={18}/>
                            حفظ وإضافة
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Printables */}
        {printingPayment && renderPrintablePayment()}
        {printingInvoice && renderPrintableInvoice()}
        {printingStatement && renderPrintableStatement()}
    </div>
  );
};

export default PurchaseModule;
