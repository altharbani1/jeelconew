
import React, { useState, useEffect } from 'react';
import { Printer, FileSignature, Building, User, ShieldCheck, FileText, Phone, Mail, Globe, MapPin, AlertCircle, ClipboardList, ChevronDown, ArrowLeft, Plus, Search, Edit, Trash2, Save, Send, Import, X, DollarSign, Cpu, Settings, Zap, Receipt } from 'lucide-react';
import { ContractData, CompanyConfig, TechnicalSpecs, SpecsDatabase, Customer, QuoteItem, QuoteDetails, InvoiceData } from '../types';

// Interface for saved quotes structure in localStorage
interface SavedQuote {
    id: string;
    details: QuoteDetails;
    items: QuoteItem[];
    techSpecs: TechnicalSpecs;
    lastModified: string;
}

// Fallback Default Options if DB is empty
const DEFAULT_OPTIONS: SpecsDatabase = {
  elevatorType: ['مصعد ركاب (Passenger)', 'مصعد بضائع (Freight)', 'مصعد طعام (Dumbwaiter)', 'مصعد بانوراما (Panoramic)', 'مصعد منزلي (Home Lift)'],
  capacity: ['320 كجم - 4 أشخاص', '450 كجم - 6 أشخاص', '630 كجم - 8 أشخاص', '800 كجم - 10 أشخاص', '1000 كجم - 13 شخص', '1250 كجم - 16 شخص'],
  speed: ['0.5 متر/ثانية', '1.0 متر/ثانية', '1.6 متر/ثانية', '2.0 متر/ثانية'],
  stops: ['2 وقفات / 2 فتحات', '3 وقفات / 3 فتحات', '4 وقفات / 4 فتحات', '5 وقفات / 5 فتحات', '6 وقفات / 6 فتحات', '7 وقفات / 7 فتحات', '8 وقفات / 8 فتحات'],
  driveType: ['Gearless Machine (Montanari Italy)', 'Gearless Machine (Sicor Italy)', 'Geared Machine (Alberto Sassi)', 'Geared Machine (Torin Drive)', 'Hydraulic System'],
  controlSystem: ['Microprocessor Full Collective (VVVF)', 'Monarch Nice 3000+', 'Step Control System', 'INVT System'],
  powerSupply: ['3 Phase, 380V, 60Hz', '3 Phase, 220V, 60Hz', 'Single Phase, 220V, 60Hz'],
  cabin: ['ستانلس ستيل مع ديكورات ليزر ومرايا', 'ستانلس ستيل ذهبي (Ti-Gold)', 'بانوراما زجاجي كامل', 'تشطيب خشبي فاخر'],
  doors: ['أوتوماتيكية بالكامل (Center Opening)', 'أوتوماتيكية بالكامل (Telescopic)', 'نصف أوتوماتيك (Semi-Auto)', 'أبواب يدوية (Manual)'],
  machineRoom: ['غرفة ماكينة علوية (MR)', 'بدون غرفة ماكينة (MRL)', 'غرفة ماكينة جانبية'],
  rails: ['سكك مسحوبة على البارد (Marazzi Italy)', 'سكك مشغولة (Machined)'],
  ropes: ['حبال صلب (Drako German)', 'حبال صلب (Italian)'],
  safety: ['نظام باراشوت تدريجي (Progressive)', 'نظام باراشوت فوري', 'منظم سرعة (Overspeed Governor)'],
  emergency: ['نظام الطوارئ الأوتوماتيكي (ARD/UPS)', 'بطارية طوارئ للإضاءة والجرس', 'لا يوجد']
};

const INITIAL_CONFIG: CompanyConfig = {
    logo: null, stamp: null, headerTitle: 'جيلكو للمصاعد', headerSubtitle: 'JILCO ELEVATORS', footerText: 'الرياض - المملكة العربية السعودية', contactPhone: '', contactEmail: '', bankAccounts: []
};

// --- Helper Components for Preview ---
const QuoteHeader: React.FC<{ config: CompanyConfig }> = ({ config }) => (
  <header className="px-10 py-6 border-b-2 border-jilco-100 flex justify-between items-center h-[160px] shrink-0">
    <div className="w-1/3 text-right">
      <h1 className="text-2xl font-black text-jilco-900 mb-0.5">{config.headerTitle}</h1>
      <p className="text-[10px] font-bold text-gray-500 mb-3">{config.headerSubtitle}</p>
      <div className="text-[9px] text-gray-400 font-bold border-r-2 border-gold-500 pr-2 leading-tight">
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
        <img src={config.logo} alt="Logo" className="h-32 w-auto object-contain" />
      ) : (
        <div className="h-24 w-24 bg-gray-50 border border-dashed border-gray-200 rounded-full flex items-center justify-center text-[8px] text-gray-300 uppercase">Logo</div>
      )}
    </div>
    <div className="w-1/3 text-left flex flex-col items-end" dir="ltr">
      <h2 className="text-lg font-black text-jilco-900 tracking-tighter">JILCO ELEVATORS</h2>
      <div className="mt-3 space-y-1">
        <div className="flex items-center gap-2 text-[10px] font-black text-gray-700 bg-gray-50 px-2 py-1 rounded-l-full border-r-2 border-jilco-600">
            <span>{config.contactPhone}</span>
            <Phone size={10} className="text-jilco-600"/>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black text-gray-700 bg-gray-50 px-2 py-1 rounded-l-full border-r-2 border-gold-500">
            <span>{config.contactEmail}</span>
            <Mail size={10} className="text-gold-600"/>
        </div>
      </div>
    </div>
  </header>
);

const QuoteFooter: React.FC<{ config: CompanyConfig }> = ({ config }) => (
  <footer className="w-full bg-white shrink-0 mt-auto">
      <div className="bg-jilco-900 text-white py-3 px-10 flex justify-between items-center text-[10px] font-bold h-[45px]">
          <div className="flex items-center gap-2">
              <MapPin size={12} className="text-gold-400"/>
              <span>{config.footerText || 'المملكة العربية السعودية - الرياض'}</span>
          </div>
          <div className="flex items-center gap-2" dir="ltr">
             <Globe size={12} className="text-gold-400"/>
             <span>www.jilco-elevators.com</span>
          </div>
      </div>
  </footer>
);

export const ContractModule: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [contracts, setContracts] = useState<{data: ContractData, specs: TechnicalSpecs}[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'specs' | 'payments'>('details');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [config, setConfig] = useState<CompanyConfig>(INITIAL_CONFIG);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  
  // Specs Database State (Loaded from DB)
  const [specsDb, setSpecsDb] = useState<SpecsDatabase>(DEFAULT_OPTIONS);

  const [currentContract, setCurrentContract] = useState<ContractData>({
    number: '', date: new Date().toISOString().split('T')[0], firstPartyName: 'شركة جيلكو للمصاعد',
    secondPartyName: '', secondPartyId: '', location: '', totalValue: 0, elevatorType: '', stops: 2, durationMonths: 2, elevatorCount: 1,
    paymentTerms: [
        { name: 'الدفعة الأولى (توقيع العقد)', percentage: 40 },
        { name: 'الدفعة الثانية (عند توريد السكك)', percentage: 30 },
        { name: 'الدفعة الثالثة (عند توريد الماكينة)', percentage: 20 },
        { name: 'الدفعة الرابعة (التسليم والتشغيل)', percentage: 10 }
    ]
  });

  const [currentSpecs, setCurrentSpecs] = useState<TechnicalSpecs>({
    elevatorType: '', capacity: '', speed: '', stops: '', driveType: '', controlSystem: '', powerSupply: '', cabin: '', doors: '', machineRoom: '', rails: '', ropes: '', safety: '', emergency: ''
  });

  // Load Data
  useEffect(() => {
    const saved = localStorage.getItem('jilco_contracts_archive');
    if (saved) try { setContracts(JSON.parse(saved)); } catch(e) {}

    const savedCustomers = localStorage.getItem('jilco_customers');
    if (savedCustomers) try { setCustomers(JSON.parse(savedCustomers)); } catch(e) {}

    const quotes = localStorage.getItem('jilco_quotes_archive');
    if (quotes) try { setSavedQuotes(JSON.parse(quotes)); } catch(e) {}

    const global = localStorage.getItem('jilco_quote_data');
    if (global) try { 
        const parsed = JSON.parse(global);
        if (parsed.config) setConfig(parsed.config);
    } catch(e) {}

    // Load Specs DB from local storage (synced with Specs Manager)
    const savedSpecs = localStorage.getItem('jilco_specs_db');
    if (savedSpecs) {
        try {
            setSpecsDb({ ...DEFAULT_OPTIONS, ...JSON.parse(savedSpecs) });
        } catch(e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('jilco_contracts_archive', JSON.stringify(contracts));
  }, [contracts]);

  // Actions
  const handleCreateNew = () => {
    setCurrentContract({
        number: `CN-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(3, '0')}`,
        date: new Date().toISOString().split('T')[0],
        firstPartyName: config.headerTitle || 'شركة جيلكو للمصاعد',
        secondPartyName: '', secondPartyId: '', location: '', totalValue: 0, elevatorType: '', stops: 2, durationMonths: 2, elevatorCount: 1,
        paymentTerms: [
            { name: 'الدفعة الأولى (توقيع العقد)', percentage: 40 },
            { name: 'الدفعة الثانية (عند توريد السكك)', percentage: 30 },
            { name: 'الدفعة الثالثة (عند توريد الماكينة)', percentage: 20 },
            { name: 'الدفعة الرابعة (التسليم والتشغيل)', percentage: 10 }
        ]
    });
    setCurrentSpecs({
        elevatorType: '', capacity: '', speed: '', stops: '', driveType: '', controlSystem: '', powerSupply: '', cabin: '', doors: '', machineRoom: '', rails: '', ropes: '', safety: '', emergency: ''
    });
    setViewMode('editor');
  };

  // Generate Invoice from Payment Term
  const handleGenerateInvoice = (contract: {data: ContractData, specs: TechnicalSpecs}, paymentTerm: {name: string, percentage: number}, termIndex: number) => {
    const paymentAmount = (contract.data.totalValue * paymentTerm.percentage) / 100;
    const subtotal = paymentAmount / 1.15; // Remove VAT to get subtotal
    const tax = paymentAmount - subtotal;

    const invoiceItem: QuoteItem = {
      id: Date.now().toString(),
      description: `${paymentTerm.name} - عقد رقم ${contract.data.number}`,
      details: `عقد توريد وتركيب ${contract.data.elevatorCount || 1} مصعد - ${contract.specs.elevatorType || 'مصعد'}`,
      quantity: 1,
      unitPrice: subtotal,
      total: subtotal
    };

    const newInvoice: InvoiceData = {
      number: `INV-${Date.now().toString().slice(-8)}`,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0], // 30 days
      customerName: contract.data.secondPartyName,
      customerVatNumber: contract.data.secondPartyId || '',
      items: [invoiceItem],
      status: 'pending',
      contractId: contract.data.number,
      contractNumber: contract.data.number,
      paymentTermName: paymentTerm.name
    };

    // Save to localStorage
    const savedInvoices = localStorage.getItem('jilco_invoices_archive');
    const invoices: InvoiceData[] = savedInvoices ? JSON.parse(savedInvoices) : [];
    invoices.unshift(newInvoice);
    localStorage.setItem('jilco_invoices_archive', JSON.stringify(invoices));

    alert(`✅ تم إصدار فاتورة ضريبية رقم ${newInvoice.number}\n\nالمبلغ: ${paymentAmount.toLocaleString()} ر.س (شامل الضريبة)\n\nيمكنك طباعتها من قسم الفواتير`);
  };

  const handleImportQuote = (quote: SavedQuote) => {
    if (window.confirm(`استيراد بيانات عرض السعر رقم ${quote.details.number}؟`)) {
        // Calculate total quantity from items (sum of quantities)
        const totalQty = quote.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        setCurrentContract(prev => ({
            ...prev,
            secondPartyName: quote.details.customerName,
            location: quote.details.projectName,
            totalValue: quote.items.reduce((s, i) => s + i.total, 0) * 1.15, // Including tax
            paymentTerms: quote.details.paymentTerms || prev.paymentTerms,
            elevatorCount: totalQty > 0 ? totalQty : 1 // Import count or default to 1
        }));
        setCurrentSpecs(quote.techSpecs);
        alert('تم استيراد البيانات والمواصفات وعدد المصاعد بنجاح.');
    }
  };

  const handleSave = () => {
    if (!currentContract.secondPartyName) return alert('يرجى تحديد الطرف الثاني');
    const contractObj = { data: currentContract, specs: currentSpecs };
    const exists = contracts.find(c => c.data.number === currentContract.number);
    if (exists) {
        setContracts(contracts.map(c => c.data.number === currentContract.number ? contractObj : c));
    } else {
        setContracts([contractObj, ...contracts]);
    }
    setViewMode('list');
  };

  const handleCustomerSelect = (customerId: string) => {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
          setCurrentContract(prev => ({
              ...prev,
              secondPartyName: customer.fullName,
              secondPartyId: customer.id,
              location: customer.address || prev.location
          }));
      }
  };

  if (viewMode === 'list') {
    return (
        <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                            <FileSignature className="text-gold-500" /> أرشيف العقود القانونية
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">إدارة ومتابعة عقود التوريد والتركيب</p>
                    </div>
                    <button onClick={handleCreateNew} className="bg-jilco-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md">
                        <Plus size={20} /> عقد جديد
                    </button>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                            <input 
                                type="text" placeholder="بحث برقم العقد أو اسم الطرف الثاني..." 
                                className="w-full pr-10 pl-4 py-2 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold outline-none focus:ring-2 focus:ring-jilco-500"
                                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 text-gray-500">
                            <tr>
                                <th className="p-4">رقم العقد</th>
                                <th className="p-4">الطرف الثاني (العميل)</th>
                                <th className="p-4">القيمة الإجمالية</th>
                                <th className="p-4">التاريخ</th>
                                <th className="p-4 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {contracts.filter(c => c.data.number.includes(searchTerm) || c.data.secondPartyName.includes(searchTerm)).map((c, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 group transition-colors">
                                    <td className="p-4 font-mono font-bold text-jilco-900">{c.data.number}</td>
                                    <td className="p-4 font-bold text-gray-800">{c.data.secondPartyName}</td>
                                    <td className="p-4 font-black text-green-700 font-mono">{c.data.totalValue.toLocaleString()}</td>
                                    <td className="p-4 font-mono text-gray-500 text-xs">{c.data.date}</td>
                                    <td className="p-4 flex justify-center gap-2">
                                        <button onClick={() => { setCurrentContract(c.data); setCurrentSpecs(c.specs); setViewMode('editor'); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit size={16}/></button>
                                        <button 
                                            onClick={() => { 
                                                setCurrentContract(c.data); 
                                                setCurrentSpecs(c.specs); 
                                                setViewMode('editor'); // Switch view first!
                                                setTimeout(() => window.print(), 500); // Then print
                                            }} 
                                            className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"
                                        >
                                            <Printer size={16}/>
                                        </button>
                                        <button onClick={() => setContracts(contracts.filter(con => con.data.number !== c.data.number))} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                            {contracts.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-gray-400">لا توجد عقود مسجلة.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full bg-gray-100 print:h-auto print:block">
        {/* Editor Sidebar */}
        <div className="w-full lg:w-1/3 bg-white border-l border-gray-200 h-full overflow-y-auto no-print shadow-xl z-20 flex flex-col sidebar-container">
            <div className="p-6 bg-jilco-900 text-white flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-xl font-bold">محرر العقود</h2>
                    <p className="text-[10px] opacity-60">صياغة العقود القانونية للمؤسسة</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSave} className="bg-green-600 p-2.5 rounded-xl hover:bg-green-700 shadow-lg"><Save size={18} /></button>
                    <button onClick={() => window.print()} className="bg-gold-500 p-2.5 rounded-xl hover:bg-gold-600 shadow-lg"><Printer size={18} /></button>
                    <button onClick={() => setViewMode('list')} className="bg-white/10 p-2.5 rounded-xl hover:bg-white/20"><ArrowLeft size={18} /></button>
                </div>
            </div>

            {/* Quick Import Quote Bar */}
            <div className="p-4 bg-amber-50 border-b border-amber-100">
                <label className="block text-[10px] font-black text-amber-800 mb-2 uppercase flex items-center gap-1"><Import size={12}/> استيراد من عرض سعر</label>
                <select 
                    onChange={e => {
                        const q = savedQuotes.find(sq => sq.id === e.target.value);
                        if (q) handleImportQuote(q);
                    }}
                    className="w-full p-2 text-xs border border-amber-300 rounded-lg outline-none bg-white font-bold text-black"
                    defaultValue=""
                >
                    <option value="" disabled>-- اختر عرض سعر لاستيراد بياناته --</option>
                    {savedQuotes.map(q => <option key={q.id} value={q.id}>{q.details.number} - {q.details.customerName}</option>)}
                </select>
            </div>

            <div className="flex border-b border-gray-100 bg-gray-50 shrink-0">
                <button onClick={() => setActiveTab('details')} className={`flex-1 py-4 text-xs font-black transition-all ${activeTab === 'details' ? 'border-b-4 border-jilco-600 text-jilco-900 bg-white' : 'text-gray-400'}`}>البيانات الأساسية</button>
                <button onClick={() => setActiveTab('specs')} className={`flex-1 py-4 text-xs font-black transition-all ${activeTab === 'specs' ? 'border-b-4 border-jilco-600 text-jilco-900 bg-white' : 'text-gray-400'}`}>المواصفات الفنية</button>
                <button onClick={() => setActiveTab('payments')} className={`flex-1 py-4 text-xs font-black transition-all ${activeTab === 'payments' ? 'border-b-4 border-jilco-600 text-jilco-900 bg-white' : 'text-gray-400'}`}>الدفعات المالية</button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-gray-50/30">
                {activeTab === 'details' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-200">
                            <label className="text-[10px] font-black text-blue-800 mb-1 flex items-center gap-1"><User size={12}/> ربط العقد بعميل مسجل</label>
                            <select onChange={e => handleCustomerSelect(e.target.value)} className="w-full p-2 text-xs border border-gray-400 rounded-lg outline-none bg-white text-black font-bold" defaultValue="">
                                <option value="" disabled>-- اختر العميل --</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                            </select>
                        </div>
                        <div><label className="block text-[10px] font-black text-gray-500 mb-1">رقم العقد</label><input type="text" value={currentContract.number} onChange={e => setCurrentContract({...currentContract, number: e.target.value})} className="w-full p-2.5 border border-gray-400 rounded-lg font-mono text-sm bg-white text-black font-bold" /></div>
                        <div><label className="block text-[10px] font-black text-gray-500 mb-1">تاريخ العقد</label><input type="date" value={currentContract.date} onChange={e => setCurrentContract({...currentContract, date: e.target.value})} className="w-full p-2.5 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold" /></div>
                        <div><label className="block text-[10px] font-black text-gray-500 mb-1">اسم العميل (الطرف الثاني)</label><input type="text" value={currentContract.secondPartyName} onChange={e => setCurrentContract({...currentContract, secondPartyName: e.target.value})} className="w-full p-2.5 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold" /></div>
                        <div><label className="block text-[10px] font-black text-gray-500 mb-1">الموقع / المدينة</label><input type="text" value={currentContract.location} onChange={e => setCurrentContract({...currentContract, location: e.target.value})} className="w-full p-2.5 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold" /></div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[10px] font-black text-gray-500 mb-1">قيمة العقد (شامل الضريبة)</label><input type="number" value={currentContract.totalValue} onChange={e => setCurrentContract({...currentContract, totalValue: parseFloat(e.target.value) || 0})} className="w-full p-2.5 border border-gray-400 rounded-lg font-black text-green-700 bg-white" /></div>
                            <div><label className="block text-[10px] font-black text-gray-500 mb-1">عدد المصاعد</label><input type="number" value={currentContract.elevatorCount || 1} onChange={e => setCurrentContract({...currentContract, elevatorCount: parseFloat(e.target.value) || 1})} className="w-full p-2.5 border border-gray-400 rounded-lg font-black text-center bg-white text-black" /></div>
                        </div>
                        
                        <div><label className="block text-[10px] font-black text-gray-500 mb-1">مدة التنفيذ (أشهر)</label><input type="number" value={currentContract.durationMonths} onChange={e => setCurrentContract({...currentContract, durationMonths: parseInt(e.target.value) || 2})} className="w-full p-2.5 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold" /></div>
                    </div>
                )}

                {activeTab === 'specs' && (
                    <div className="space-y-4 animate-fade-in bg-white p-4 rounded-xl border border-gray-200">
                        {Object.entries(specsDb).map(([key, opts]) => (
                            <div key={key}>
                                <label className="block text-[10px] font-black text-gray-400 mb-1 uppercase">{key}</label>
                                <select 
                                    value={currentSpecs[key as keyof TechnicalSpecs] || ''} 
                                    onChange={e => setCurrentSpecs({...currentSpecs, [key]: e.target.value})}
                                    className="w-full p-2.5 border border-gray-400 rounded-lg text-xs bg-white text-black font-bold"
                                >
                                    <option value="">-- اختر --</option>
                                    {(opts as string[]).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'payments' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-xs font-black text-jilco-900 mb-3 flex items-center gap-2"><DollarSign size={16}/> جدول الدفعات المالية</h3>
                            <div className="space-y-2">
                                {currentContract.paymentTerms.map((term, idx) => (
                                    <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded border border-gray-200">
                                        <input type="text" value={term.name} onChange={e => {
                                            const newTerms = [...currentContract.paymentTerms];
                                            newTerms[idx].name = e.target.value;
                                            setCurrentContract({...currentContract, paymentTerms: newTerms});
                                        }} className="flex-1 p-1.5 text-xs border border-gray-400 rounded bg-white text-black font-bold" />
                                        <div className="relative w-16">
                                            <input type="number" value={term.percentage} onChange={e => {
                                                const newTerms = [...currentContract.paymentTerms];
                                                newTerms[idx].percentage = parseFloat(e.target.value) || 0;
                                                setCurrentContract({...currentContract, paymentTerms: newTerms});
                                            }} className="w-full p-1.5 text-xs border border-gray-400 rounded text-center bg-white text-black font-bold" />
                                            <span className="absolute left-1 top-1.5 text-[9px] text-gray-400 pointer-events-none">%</span>
                                        </div>
                                        <button onClick={() => setCurrentContract({...currentContract, paymentTerms: currentContract.paymentTerms.filter((_, i) => i !== idx)})} className="text-red-300 hover:text-red-500"><X size={14}/></button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setCurrentContract({...currentContract, paymentTerms: [...currentContract.paymentTerms, {name: 'دفعة جديدة', percentage: 0}]})} className="mt-4 w-full py-2 bg-gray-100 text-xs font-bold rounded border border-dashed border-gray-300">+ إضافة دفعة</button>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Preview Area (Container for A4 Pages) */}
        <div className="flex-1 bg-gray-200 p-8 overflow-auto flex justify-center items-start print:p-0 print:m-0 print:bg-white print:overflow-visible print:block">
            <div id="printable-area" className="flex flex-col items-center gap-10 print:block print:gap-0 print:w-full">
                
                {/* PAGE 1: CONTRACT DETAILS - USING a4-page CLASS */}
                <div className="a4-page bg-white shadow-2xl mb-10 print:mb-0 mx-auto flex flex-col relative">
                    
                    {/* Royal Frame Borders */}
                    <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
                    <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
                    <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

                    <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
                        <QuoteHeader config={config} />

                        {/* Body */}
                        <div className="px-12 py-6 flex-1 text-xs leading-loose relative overflow-hidden">
                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0"><h1 className="text-[140px] font-bold rotate-[-15deg]">CONTRACT</h1></div>
                            <div className="relative z-10">
                                <div className="text-center mb-8 border-b-2 border-jilco-900 pb-2"><h2 className="text-2xl font-black text-jilco-900">عقد توريد وتركيب مصعد</h2></div>
                                <p className="mb-4">إنه في يوم <span className="font-bold">{currentContract.date}</span> تم الاتفاق بين كل من:</p>
                                <div className="space-y-4">
                                    <p><span className="font-bold underline">الطرف الأول (المقاول):</span> {currentContract.firstPartyName} - ويمثلها في هذا العقد الإدارة المختصة.</p>
                                    <p><span className="font-bold underline">الطرف الثاني (العميل):</span> {currentContract.secondPartyName} - ومقره في {currentContract.location}.</p>
                                    <p className="font-bold border-r-4 border-gold-500 pr-3 bg-gray-50 p-2 mt-6">موضوع العقد:</p>
                                    <p>اتفق الطرفان على قيام الطرف الأول بتوريد وتركيب عدد (<span className="font-bold px-1">{currentContract.elevatorCount || 1}</span>) مصعد ({currentSpecs.elevatorType || 'محدد بالمواصفات'}) للطرف الثاني بقيمة إجمالية قدرها <span className="font-black text-jilco-900 text-sm">{currentContract.totalValue.toLocaleString()} ر.س</span> شاملة الضريبة، وذلك وفقاً للجدول الزمني والمواصفات المرفقة.</p>
                                    
                                    <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-2">
                                        <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">نوع الماكينة:</span> <span className="font-bold">{currentSpecs.driveType || '...'}</span></div>
                                        <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">الحمولة:</span> <span className="font-bold">{currentSpecs.capacity || '...'}</span></div>
                                        <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">عدد الوقفات:</span> <span className="font-bold">{currentSpecs.stops || '...'}</span></div>
                                        <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">نظام الأبواب:</span> <span className="font-bold">{currentSpecs.doors || '...'}</span></div>
                                    </div>

                                    <p className="font-bold border-r-4 border-gold-500 pr-3 bg-gray-50 p-2 mt-6">جدول الدفعات:</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        {currentContract.paymentTerms.map((t, i) => (
                                            <div key={i} className="flex justify-between items-center p-2 border border-gray-100 rounded group">
                                                <div className="flex-1">
                                                    <span className="text-[10px] text-gray-500 block">{t.name}</span>
                                                    <span className="font-bold">{t.percentage}% - {((currentContract.totalValue * t.percentage)/100).toLocaleString()}</span>
                                                </div>
                                                <button 
                                                    onClick={() => handleGenerateInvoice({data: currentContract, specs: currentSpecs}, t, i)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity bg-green-600 text-white p-1.5 rounded hover:bg-green-700 print:hidden"
                                                    title="إصدار فاتورة ضريبية"
                                                >
                                                    <Receipt size={14}/>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Signatures */}
                        <div className="px-12 py-10 grid grid-cols-2 gap-16 shrink-0 relative">
                            <div className="text-center relative">
                                <p className="font-bold text-sm mb-12">توقيع الطرف الأول</p>
                                <div className="w-40 border-b-2 border-jilco-900 mx-auto"></div>
                                {config.stamp && <img src={config.stamp} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-56 h-56 opacity-90 mix-blend-multiply" />}
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-sm mb-12">توقيع الطرف الثاني (العميل)</p>
                                <div className="w-40 border-b-2 border-gray-300 mx-auto"></div>
                            </div>
                        </div>

                        <QuoteFooter config={config} />
                    </div>
                </div>

                {/* PAGE 2: TECHNICAL SPECIFICATIONS - USING a4-page CLASS */}
                <div className="a4-page bg-white shadow-2xl mb-10 print:mb-0 mx-auto flex flex-col relative">
                
                    <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
                    <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
                    <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

                    <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
                        <QuoteHeader config={config} />
                        
                        <div className="px-10 py-6 flex-1 flex flex-col">
                            <div className="flex items-center justify-between border-b-2 border-jilco-900 pb-4 mb-6">
                                <h3 className="text-xl font-black text-jilco-900 flex items-center gap-3 uppercase tracking-tighter">
                                    <div className="w-10 h-10 bg-jilco-900 text-gold-500 flex items-center justify-center rounded-xl shadow-lg"><Zap size={20}/></div>
                                    جدول المواصفات الفنية المعتمدة
                                </h3>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Technical Data</span>
                            </div>
                            
                            <div className="grid grid-cols-1 border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-8">
                            {[
                                { label: 'نوع المصعد (Elevator Type)', value: currentSpecs.elevatorType },
                                { label: 'الحمولة (Capacity)', value: currentSpecs.capacity },
                                { label: 'السرعة (Speed)', value: currentSpecs.speed },
                                { label: 'الوقفات / الفتحات (Stops)', value: currentSpecs.stops },
                                { label: 'نظام الحركة (Drive System)', value: currentSpecs.driveType },
                                { label: 'لوحة التحكم (Control System)', value: currentSpecs.controlSystem },
                                { label: 'مصدر الكهرباء (Power Supply)', value: currentSpecs.powerSupply },
                                { label: 'تشطيب الكابينة (Cabin Finish)', value: currentSpecs.cabin },
                                { label: 'نظام الأبواب (Door System)', value: currentSpecs.doors },
                                { label: 'غرفة الماكينة (Machine Room)', value: currentSpecs.machineRoom },
                                { label: 'السكك والمسارات (Rails)', value: currentSpecs.rails },
                                { label: 'الحبال والأسلاك (Ropes)', value: currentSpecs.ropes },
                                { label: 'أنظمة الأمان (Safety)', value: currentSpecs.safety },
                                { label: 'جهاز الطوارئ (Emergency)', value: currentSpecs.emergency },
                            ].map((row, i) => (
                                <div key={i} className={`flex border-b border-gray-100 last:border-0 ${i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}`}>
                                    <div className="w-1/3 p-2.5 font-black text-[10px] text-jilco-700 bg-gray-100/30 border-l border-gray-100 uppercase tracking-tighter flex items-center">{row.label}</div>
                                    <div className="w-2/3 p-2.5 text-[11px] font-black text-black uppercase flex items-center">{row.value || 'سيتم التحديد لاحقاً'}</div>
                                </div>
                            ))}
                            </div>

                            <QuoteFooter config={config} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
