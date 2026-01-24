import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Printer, Save, ArrowLeft, Upload, Image as ImageIcon, Phone, Mail, MapPin, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { loggerService } from '../services/loggerService.ts';
import { CompanyConfig } from '../types.ts';

interface InstallationItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface PaymentSchedule {
  id: string;
  name: string;
  percentage: number;
  amount?: number;
}

interface InstallationQuote {
  id: string;
  quoteNumber: string;
  date: string;
  customerName: string;
  customerAddress: string;
  customerPhone?: string;
  projectName: string;
  items: InstallationItem[];
  paymentSchedule: PaymentSchedule[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
  stamp?: string | null;
  bankAccounts?: BankAccount[];
  lastModified: string;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  iban: string;
}

export const InstallationQuoteModule: React.FC = () => {
  const { currentUser } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'preview'>('list');
  const [savedQuotes, setSavedQuotes] = useState<InstallationQuote[]>(() => {
    const saved = localStorage.getItem('jilco_installation_quotes');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(null);
  
  // Form States
  const [quoteNumber, setQuoteNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [projectName, setProjectName] = useState('');
  const [items, setItems] = useState<InstallationItem[]>([]);
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentSchedule[]>([
    { id: '1', name: 'الدفعة الأولى (عند توقيع العقد)', percentage: 40 },
    { id: '2', name: 'الدفعة الثانية (عند بدء التركيب)', percentage: 30 },
    { id: '3', name: 'الدفعة الثالثة (عند إكمال التركيب)', percentage: 20 },
    { id: '4', name: 'الدفعة الرابعة (عند التسليم النهائي)', percentage: 10 }
  ]);
  const [taxRate, setTaxRate] = useState(15);
  const [notes, setNotes] = useState('');
  const [stamp, setStamp] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [config, setConfig] = useState<CompanyConfig>({
    logo: null,
    stamp: null,
    headerTitle: 'جيلكو للمصاعد',
    headerSubtitle: 'JILCO ELEVATORS',
    footerText: '',
    contactPhone: '',
    contactEmail: '',
    bankAccounts: [],
    vatNumber: ''
  });

  // Item Form States
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(0);

  useEffect(() => {
    localStorage.setItem('jilco_installation_quotes', JSON.stringify(savedQuotes));
  }, [savedQuotes]);

  useEffect(() => {
    // Load company config from localStorage
    const savedConfig = localStorage.getItem('jilco_quote_data');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (parsed.config) {
          setConfig(parsed.config);
          setStamp(parsed.config.stamp || null);
          setBankAccounts(parsed.config.bankAccounts || []);
        }
      } catch (e) {}
    }
  }, []);

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleAddItem = () => {
    if (!newItemDesc || newItemQty <= 0 || newItemPrice <= 0) {
      alert('يرجى إدخال جميع البيانات بشكل صحيح');
      return;
    }

    const newItem: InstallationItem = {
      id: Date.now().toString(),
      description: newItemDesc,
      quantity: newItemQty,
      unitPrice: newItemPrice,
      total: newItemQty * newItemPrice
    };

    setItems([...items, newItem]);
    setNewItemDesc('');
    setNewItemQty(1);
    setNewItemPrice(0);
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleAddPayment = () => {
    const newPayment: PaymentSchedule = {
      id: Date.now().toString(),
      name: 'دفعة جديدة',
      percentage: 0
    };
    setPaymentSchedule([...paymentSchedule, newPayment]);
  };

  const handleUpdatePayment = (id: string, field: 'name' | 'percentage', value: string | number) => {
    setPaymentSchedule(paymentSchedule.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const handleDeletePayment = (id: string) => {
    setPaymentSchedule(paymentSchedule.filter(p => p.id !== id));
  };

  const handleAddBankAccount = () => {
    const newAccount: BankAccount = {
      id: Date.now().toString(),
      bankName: '',
      accountNumber: '',
      iban: ''
    };
    setBankAccounts([...bankAccounts, newAccount]);
  };

  const handleUpdateBankAccount = (id: string, field: keyof BankAccount, value: string) => {
    setBankAccounts(bankAccounts.map(acc => 
      acc.id === id ? { ...acc, [field]: value } : acc
    ));
  };

  const handleDeleteBankAccount = (id: string) => {
    setBankAccounts(bankAccounts.filter(acc => acc.id !== id));
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStamp(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateNew = () => {
    const newQuoteNumber = `IQ-${new Date().getFullYear()}-${String(savedQuotes.length + 1).padStart(3, '0')}`;
    setQuoteNumber(newQuoteNumber);
    setDate(new Date().toISOString().split('T')[0]);
    setCustomerName('');
    setCustomerAddress('');
    setCustomerPhone('');
    setProjectName('');
    setItems([]);
    setPaymentSchedule([
      { id: '1', name: 'الدفعة الأولى (عند توقيع العقد)', percentage: 40 },
      { id: '2', name: 'الدفعة الثانية (عند بدء التركيب)', percentage: 30 },
      { id: '3', name: 'الدفعة الثالثة (عند إكمال التركيب)', percentage: 20 },
      { id: '4', name: 'الدفعة الرابعة (عند التسليم النهائي)', percentage: 10 }
    ]);
    setTaxRate(15);
    setNotes('');
    setCurrentQuoteId(null);
    setViewMode('editor');
  };

  const handleEdit = (quote: InstallationQuote) => {
    setCurrentQuoteId(quote.id);
    setQuoteNumber(quote.quoteNumber);
    setDate(quote.date);
    setCustomerName(quote.customerName);
    setCustomerAddress(quote.customerAddress);
    setCustomerPhone(quote.customerPhone || '');
    setProjectName(quote.projectName);
    setItems(quote.items);
    setPaymentSchedule(quote.paymentSchedule);
    setTaxRate(quote.taxRate);
    setNotes(quote.notes || '');
    if (quote.stamp) setStamp(quote.stamp);
    if (quote.bankAccounts) setBankAccounts(quote.bankAccounts);
    setViewMode('editor');
  };

  const handleSave = () => {
    if (!quoteNumber || !customerName || items.length === 0) {
      alert('يرجى إدخال البيانات الأساسية على الأقل (رقم العرض، العميل، والبنود)');
      return;
    }

    const { subtotal, taxAmount, total } = calculateTotals();
    
    // Calculate payment amounts
    const scheduleWithAmounts = paymentSchedule.map(p => ({
      ...p,
      amount: (total * p.percentage) / 100
    }));

    const quoteData: InstallationQuote = {
      id: currentQuoteId || Date.now().toString(),
      quoteNumber,
      date,
      customerName,
      customerAddress,
      customerPhone,
      projectName,
      items,
      paymentSchedule: scheduleWithAmounts,
      subtotal,
      taxRate,
      taxAmount,
      total,
      notes,
      stamp,
      bankAccounts,
      lastModified: new Date().toISOString()
    };

    if (currentQuoteId) {
      setSavedQuotes(prev => prev.map(q => q.id === currentQuoteId ? quoteData : q));
      loggerService.addLog(currentUser, 'تعديل عرض تركيب', `رقم العرض: ${quoteNumber}`, 'عروض التركيبات');
    } else {
      setSavedQuotes(prev => [quoteData, ...prev]);
      setCurrentQuoteId(quoteData.id);
      loggerService.addLog(currentUser, 'إنشاء عرض تركيب', `رقم العرض: ${quoteNumber}`, 'عروض التركيبات');
    }

    alert('تم حفظ العرض بنجاح');
  };

  const handleDelete = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا العرض؟')) {
      const quote = savedQuotes.find(q => q.id === id);
      setSavedQuotes(savedQuotes.filter(q => q.id !== id));
      if (quote) {
        loggerService.addLog(currentUser, 'حذف عرض تركيب', `رقم العرض: ${quote.quoteNumber}`, 'عروض التركيبات');
      }
    }
  };

  const handlePreview = () => {
    if (!quoteNumber || !customerName || items.length === 0) {
      alert('يرجى إدخال البيانات الأساسية على الأقل (رقم العرض، العميل، والبنود)');
      return;
    }
    setViewMode('preview');
  };

  const handlePrint = () => {
    window.print();
  };

  // List View
  if (viewMode === 'list') {
    return (
      <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-jilco-900">عروض التركيبات</h1>
              <p className="text-gray-500 text-sm">إدارة عروض أسعار التركيبات</p>
            </div>
            <button 
              onClick={handleCreateNew} 
              className="bg-jilco-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md transition-all"
            >
              <Plus size={20} /> عرض تركيب جديد
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-4">رقم العرض</th>
                  <th className="p-4">العميل</th>
                  <th className="p-4">المشروع</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">الإجمالي</th>
                  <th className="p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {savedQuotes.map(quote => (
                  <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-jilco-700">{quote.quoteNumber}</td>
                    <td className="p-4">{quote.customerName}</td>
                    <td className="p-4 text-gray-600">{quote.projectName || '-'}</td>
                    <td className="p-4 font-mono text-xs text-gray-500">{quote.date}</td>
                    <td className="p-4 font-bold text-green-700">{quote.total.toLocaleString('ar-SA')} ريال</td>
                    <td className="p-4 flex justify-center gap-2">
                      <button 
                        onClick={() => handleEdit(quote)} 
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        title="تعديل"
                      >
                        <Edit size={16}/>
                      </button>
                      <button 
                        onClick={() => { handleEdit(quote); setTimeout(() => handlePreview(), 100); }} 
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
                        title="طباعة"
                      >
                        <Printer size={16}/>
                      </button>
                      <button 
                        onClick={() => handleDelete(quote.id)} 
                        className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="حذف"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
                {savedQuotes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      لا توجد عروض محفوظة. ابدأ بإنشاء عرض تركيب جديد!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Preview/Print View
  if (viewMode === 'preview') {
    const { subtotal, taxAmount, total } = calculateTotals();
    const scheduleWithAmounts = paymentSchedule.map(p => ({
      ...p,
      amount: (total * p.percentage) / 100
    }));

    return (
      <div className="flex-1 bg-gray-100 overflow-auto print:bg-white">
        <div className="max-w-5xl mx-auto p-8 print:p-0">
          {/* Print Actions */}
          <div className="flex justify-between items-center mb-6 print:hidden">
            <button 
              onClick={() => setViewMode('editor')} 
              className="flex items-center gap-2 text-gray-600 hover:text-jilco-600 transition-colors"
            >
              <ArrowLeft size={20} />
              <span>العودة للتحرير</span>
            </button>
            <button 
              onClick={handlePrint} 
              className="bg-jilco-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md transition-all"
            >
              <Printer size={20} /> طباعة
            </button>
          </div>

          {/* Printable Content - A4 Page */}
          <div id="printable-area">
            <div className="a4-page bg-white shadow-2xl print:shadow-none mx-auto flex flex-col relative">
            
            {/* Royal Frame */}
            <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
            <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
            <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

            {/* Content */}
            <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white" dir="rtl">
              
              {/* Company Header - Compact */}
              <header className="px-8 py-3 border-b border-jilco-100 flex justify-between items-center bg-white h-[100px] relative overflow-hidden shrink-0">
                <div className="w-1/3 text-right">
                  <h1 className="text-lg font-black text-jilco-900 mb-0">{config.headerTitle || 'جيلكو للمصاعد'}</h1>
                  <p className="text-[8px] font-bold text-gray-500 mb-1">{config.headerSubtitle || 'للمصاعد والسلالم الكهربائية'}</p>
                  <div className="text-[8px] text-gray-400 font-bold border-r border-gold-500 pr-1.5 leading-tight">
                    <p>سجل تجاري: ١٠١٠٧٢٤٥٨٢</p>
                    {config.vatNumber ? (
                      <p>الرقم الضريبي: {config.vatNumber}</p>
                    ) : (
                      <p>الرقم الضريبي: ٣١٠٢٤٥٦٧٨٩٠٠٠٠٣</p>
                    )}
                  </div>
                </div>
                <div className="w-1/3 flex justify-center">
                  {config.logo ? (
                    <img src={config.logo} alt="Logo" className="h-20 w-auto object-contain" />
                  ) : (
                    <div className="h-16 w-16 bg-gray-50 border border-dashed border-gray-200 rounded-full flex items-center justify-center text-[8px] text-gray-300 uppercase">Logo</div>
                  )}
                </div>
                <div className="w-1/3 text-left flex flex-col items-end" dir="ltr">
                  <h2 className="text-sm font-black text-jilco-900 tracking-tighter">JILCO ELEVATORS</h2>
                  <div className="mt-1.5 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[8px] font-black text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded-l-full border-r border-jilco-600">
                        <span>{config.contactPhone}</span>
                        <Phone size={8} className="text-jilco-600"/>
                    </div>
                    <div className="flex items-center gap-1.5 text-[8px] font-black text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded-l-full border-r border-gold-500">
                        <span>{config.contactEmail}</span>
                        <Mail size={8} className="text-gold-600"/>
                    </div>
                  </div>
                </div>
              </header>

              {/* Title Section - Compact */}
              <div className="text-center mb-3 mt-3">
                <h2 className="text-base font-black text-white bg-jilco-900 py-1.5 px-8 rounded-lg inline-block shadow-md border-b-2 border-gold-500 uppercase tracking-tighter">عرض سعر تركيب</h2>
                <p className="text-[10px] text-gray-400 mt-1">INSTALLATION QUOTATION</p>
              </div>

            {/* Content Area */}
            <div className="px-8 py-2 flex-1 flex flex-col">
              
              {/* Quote Info - Compact */}
              <div className="grid grid-cols-4 gap-2 mb-3 bg-gray-50/80 p-2 rounded-lg border border-gray-100 text-sm">
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">رقم العرض</p>
                <p className="font-bold text-sm text-jilco-900">{quoteNumber}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">التاريخ</p>
                <p className="font-bold text-sm">{date}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">العميل</p>
                <p className="font-bold text-sm">{customerName}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 mb-0.5">المشروع</p>
                <p className="font-bold text-sm">{projectName || '-'}</p>
              </div>
              {(customerAddress || customerPhone) && (
                <div className="col-span-4 pt-2 border-t border-gray-200 grid grid-cols-2 gap-2">
                  {customerAddress && (
                    <div>
                      <p className="text-[10px] text-gray-500 mb-0.5">العنوان</p>
                      <p className="text-xs text-gray-700">{customerAddress}</p>
                    </div>
                  )}
                  {customerPhone && (
                    <div>
                      <p className="text-[10px] text-gray-500 mb-0.5">الهاتف</p>
                      <p className="text-xs text-gray-700" dir="ltr">{customerPhone}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="mb-4">
              <h2 className="text-base font-bold text-jilco-900 mb-2">البنود</h2>
              <table className="w-full border border-gray-300 text-xs">
                <thead className="bg-jilco-50">
                  <tr>
                    <th className="border border-gray-300 p-1.5 text-right w-8">#</th>
                    <th className="border border-gray-300 p-1.5 text-right">الوصف</th>
                    <th className="border border-gray-300 p-1.5 text-center w-16">الكمية</th>
                    <th className="border border-gray-300 p-1.5 text-center w-24">السعر</th>
                    <th className="border border-gray-300 p-1.5 text-center w-24">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="border border-gray-300 p-1.5 text-center">{index + 1}</td>
                      <td className="border border-gray-300 p-1.5">{item.description}</td>
                      <td className="border border-gray-300 p-1.5 text-center">{item.quantity}</td>
                      <td className="border border-gray-300 p-1.5 text-center">{item.unitPrice.toLocaleString('ar-SA')}</td>
                      <td className="border border-gray-300 p-1.5 text-center font-bold">{item.total.toLocaleString('ar-SA')}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="border border-gray-300 p-1.5 text-left font-bold">المجموع الفرعي</td>
                    <td className="border border-gray-300 p-1.5 text-center font-bold">{subtotal.toLocaleString('ar-SA')} ريال</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="border border-gray-300 p-1.5 text-left font-bold">ضريبة القيمة المضافة ({taxRate}%)</td>
                    <td className="border border-gray-300 p-1.5 text-center font-bold">{taxAmount.toLocaleString('ar-SA')} ريال</td>
                  </tr>
                  <tr className="bg-jilco-100">
                    <td colSpan={4} className="border border-gray-300 p-1.5 text-left font-bold">الإجمالي النهائي</td>
                    <td className="border border-gray-300 p-1.5 text-center font-bold text-jilco-900">{total.toLocaleString('ar-SA')} ريال</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Payment Schedule */}
            {paymentSchedule.length > 0 && (
              <div className="mb-4">
                <h2 className="text-base font-bold text-jilco-900 mb-2">جدول الدفعات</h2>
                <table className="w-full border border-gray-300 text-xs">
                  <thead className="bg-jilco-50">
                    <tr>
                      <th className="border border-gray-300 p-1.5 text-right">الدفعة</th>
                      <th className="border border-gray-300 p-1.5 text-center w-20">النسبة</th>
                      <th className="border border-gray-300 p-1.5 text-center w-24">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleWithAmounts.map((payment, index) => (
                      <tr key={payment.id}>
                        <td className="border border-gray-300 p-1.5">{payment.name}</td>
                        <td className="border border-gray-300 p-1.5 text-center">{payment.percentage}%</td>
                        <td className="border border-gray-300 p-1.5 text-center font-bold">{payment.amount?.toLocaleString('ar-SA')} ريال</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom Section - Notes, Bank Accounts & Terms */}
            <div className="grid grid-cols-2 gap-4 mt-auto">
              
              {/* Left Column - Terms & Conditions */}
              <div>
                <h2 className="text-sm font-bold text-jilco-900 mb-2 bg-jilco-100 p-2 rounded">الشروط والأحكام</h2>
                <div className="text-[9px] leading-relaxed text-gray-900 font-bold space-y-1">
                  <p>• مدة صلاحية هذا العرض (15) يوماً من تاريخه.</p>
                  <p>• جميع الأسعار شاملة ضريبة القيمة المضافة.</p>
                  <p>• يتم التسليم حسب جدول الدفعات المتفق عليه.</p>
                  <p>• يتحمل العميل مسؤولية توفير الموقع الجاهز للتركيب.</p>
                  <p>• لا يشمل العرض أعمال التشطيبات والدهانات.</p>
                  <p>• يجب تأمين مكان آمن للمواد خلال فترة التركيب.</p>
                  <p>• الضمان يبدأ من تاريخ التسليم النهائي.</p>
                  <p>• أي تعديلات على العرض تتطلب موافقة كتابية.</p>
                </div>

                {/* Notes if exists */}
                {notes && (
                  <div className="mt-3">
                    <h3 className="text-sm font-bold text-jilco-900 mb-1">ملاحظات إضافية</h3>
                    <div className="bg-gray-50 p-2 rounded text-[9px] text-gray-700">
                      <p className="whitespace-pre-wrap">{notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Bank Accounts */}
              <div>
                {bankAccounts.length > 0 && (
                  <div>
                    <h2 className="text-sm font-bold text-jilco-900 mb-2 bg-jilco-100 p-2 rounded">الحسابات البنكية</h2>
                    <div className="space-y-2">
                      {bankAccounts.map(account => (
                        <div key={account.id} className="bg-gray-50 p-2 rounded border border-gray-200">
                          <p className="font-bold text-jilco-900 text-xs mb-1">{account.bankName}</p>
                          <div className="space-y-0.5 text-[9px]">
                            <div>
                              <span className="text-gray-500">رقم الحساب: </span>
                              <span className="font-mono font-black text-gray-900" dir="ltr">{account.accountNumber}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">IBAN: </span>
                              <span className="font-mono font-black text-gray-900" dir="ltr">{account.iban}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            </div>

            {/* Company Footer */}
            <footer className="w-full bg-white shrink-0 mt-auto relative">
              {/* Company Stamp in corner */}
              {stamp && (
                <div className="absolute left-10 -top-12 z-10">
                  <img src={stamp} alt="Company Stamp" className="w-24 h-24 object-contain opacity-70" />
                </div>
              )}
              <div className="bg-jilco-900 text-white py-3 px-10 flex justify-between items-center text-[10px] font-bold h-[45px]">
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-gold-400"/>
                  <span>{config.footerText || 'المملكة العربية السعودية - الرياض'}</span>
                </div>
                <div className="flex items-center gap-2" dir="ltr">
                  <FileText size={12} className="text-gold-400"/>
                  <span>www.jilco-elevators.com</span>
                </div>
              </div>
            </footer>

            </div>
          </div>
          </div>
        </div>
      </div>
    );
  }

  // Editor View
  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <div className="flex-1 bg-gray-100 overflow-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={() => setViewMode('list')} 
            className="flex items-center gap-2 text-gray-600 hover:text-jilco-600 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>العودة للقائمة</span>
          </button>
          <div className="flex gap-3">
            <button 
              onClick={handleSave} 
              className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 transition-all"
            >
              <Save size={18} /> حفظ
            </button>
            <button 
              onClick={handlePreview} 
              className="bg-jilco-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 transition-all"
            >
              <Printer size={18} /> معاينة وطباعة
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-jilco-900 mb-4">معلومات العرض</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">رقم العرض *</label>
                  <input 
                    type="text" 
                    value={quoteNumber} 
                    onChange={(e) => setQuoteNumber(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 focus:border-transparent"
                    placeholder="IQ-2026-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">التاريخ *</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم العميل *</label>
                  <input 
                    type="text" 
                    value={customerName} 
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 focus:border-transparent"
                    placeholder="اسم العميل"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">رقم الهاتف</label>
                  <input 
                    type="text" 
                    value={customerPhone} 
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 focus:border-transparent"
                    placeholder="+966 5X XXX XXXX"
                    dir="ltr"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">عنوان العميل</label>
                  <input 
                    type="text" 
                    value={customerAddress} 
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 focus:border-transparent"
                    placeholder="عنوان العميل"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">اسم المشروع</label>
                  <input 
                    type="text" 
                    value={projectName} 
                    onChange={(e) => setProjectName(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 focus:border-transparent"
                    placeholder="اسم المشروع (اختياري)"
                  />
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-jilco-900 mb-4">البنود</h2>
              
              {/* Add Item Form */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-4 lg:col-span-2">
                    <input 
                      type="text" 
                      value={newItemDesc} 
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-jilco-500"
                      placeholder="وصف البند"
                    />
                  </div>
                  <div>
                    <input 
                      type="number" 
                      value={newItemQty} 
                      onChange={(e) => setNewItemQty(Number(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-jilco-500"
                      placeholder="الكمية"
                      min="1"
                    />
                  </div>
                  <div>
                    <input 
                      type="number" 
                      value={newItemPrice} 
                      onChange={(e) => setNewItemPrice(Number(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-jilco-500"
                      placeholder="السعر"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAddItem}
                  className="mt-3 w-full bg-jilco-600 text-white py-2 rounded-lg font-bold hover:bg-jilco-700 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> إضافة بند
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                    <span className="text-sm font-bold text-gray-500 w-8">{index + 1}</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.description}</p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} × {item.unitPrice.toLocaleString('ar-SA')} = {item.total.toLocaleString('ar-SA')} ريال
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-center text-gray-400 py-8">لم يتم إضافة أي بنود بعد</p>
                )}
              </div>
            </div>

            {/* Payment Schedule */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-jilco-900">جدول الدفعات</h2>
                <button 
                  onClick={handleAddPayment}
                  className="text-sm bg-gray-100 text-jilco-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-all flex items-center gap-2"
                >
                  <Plus size={16} /> إضافة دفعة
                </button>
              </div>
              
              <div className="space-y-3">
                {paymentSchedule.map((payment, index) => (
                  <div key={payment.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                    <span className="text-sm font-bold text-gray-500 w-8">{index + 1}</span>
                    <input 
                      type="text" 
                      value={payment.name}
                      onChange={(e) => handleUpdatePayment(payment.id, 'name', e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-jilco-500"
                      placeholder="اسم الدفعة"
                    />
                    <input 
                      type="number" 
                      value={payment.percentage}
                      onChange={(e) => handleUpdatePayment(payment.id, 'percentage', Number(e.target.value))}
                      className="w-24 p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-jilco-500 text-center"
                      placeholder="%"
                      min="0"
                      max="100"
                    />
                    <span className="text-sm text-gray-500">%</span>
                    <button 
                      onClick={() => handleDeletePayment(payment.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 text-sm text-gray-500">
                <p>المجموع: {paymentSchedule.reduce((sum, p) => sum + p.percentage, 0)}%</p>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-jilco-900 mb-4">ملاحظات</h2>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-jilco-500 focus:border-transparent"
                rows={4}
                placeholder="أي ملاحظات إضافية..."
              />
            </div>
          </div>

          {/* Right Column - Summary & Settings */}
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-6">
              <h2 className="text-xl font-bold text-jilco-900 mb-4">الملخص المالي</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between pb-2 border-b border-gray-200">
                  <span className="text-gray-600">المجموع الفرعي:</span>
                  <span className="font-bold">{subtotal.toLocaleString('ar-SA')} ريال</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-gray-600">الضريبة:</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value))}
                      className="w-16 p-1 border border-gray-300 rounded text-center text-xs"
                      min="0"
                      max="100"
                    />
                    <span className="text-xs">%</span>
                  </div>
                </div>
                <div className="flex justify-between pb-2 border-b border-gray-200">
                  <span className="text-gray-600">قيمة الضريبة:</span>
                  <span className="font-bold">{taxAmount.toLocaleString('ar-SA')} ريال</span>
                </div>
                <div className="flex justify-between text-lg pt-2">
                  <span className="font-bold text-jilco-900">الإجمالي النهائي:</span>
                  <span className="font-black text-jilco-600">{total.toLocaleString('ar-SA')} ريال</span>
                </div>
              </div>
            </div>

            {/* Bank Accounts */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-jilco-900">الحسابات البنكية</h2>
                <button 
                  onClick={handleAddBankAccount}
                  className="text-xs bg-gray-100 text-jilco-600 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-200 transition-all"
                >
                  <Plus size={14} className="inline ml-1" /> إضافة
                </button>
              </div>
              <div className="space-y-3">
                {bankAccounts.map((account) => (
                  <div key={account.id} className="bg-gray-50 p-3 rounded-lg relative">
                    <button 
                      onClick={() => handleDeleteBankAccount(account.id)}
                      className="absolute top-2 left-2 p-1 text-red-500 hover:bg-red-100 rounded-full"
                    >
                      <Trash2 size={14} />
                    </button>
                    <input 
                      type="text" 
                      value={account.bankName}
                      onChange={(e) => handleUpdateBankAccount(account.id, 'bankName', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded mb-2 text-sm"
                      placeholder="اسم البنك"
                    />
                    <input 
                      type="text" 
                      value={account.accountNumber}
                      onChange={(e) => handleUpdateBankAccount(account.id, 'accountNumber', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded mb-2 text-sm"
                      placeholder="رقم الحساب"
                      dir="ltr"
                    />
                    <input 
                      type="text" 
                      value={account.iban}
                      onChange={(e) => handleUpdateBankAccount(account.id, 'iban', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded text-sm"
                      placeholder="IBAN"
                      dir="ltr"
                    />
                  </div>
                ))}
                {bankAccounts.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">لا توجد حسابات بنكية</p>
                )}
              </div>
            </div>

            {/* Company Stamp */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-bold text-jilco-900 mb-4">ختم الشركة</h2>
              <div className="space-y-3">
                {stamp && (
                  <div className="relative">
                    <img src={stamp} alt="Company Stamp" className="w-full rounded-lg border border-gray-200" />
                    <button 
                      onClick={() => setStamp(null)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                <label className="block">
                  <div className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-jilco-500 transition-colors">
                    <Upload size={18} className="text-gray-400" />
                    <span className="text-sm text-gray-600">{stamp ? 'تغيير الختم' : 'رفع ختم الشركة'}</span>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleStampUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
