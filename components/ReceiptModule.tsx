
import React, { useState, useEffect, useMemo } from 'react';
import { Printer, Banknote, Building, AlertCircle, Search, Plus, Edit, Trash2, ArrowLeft, Save, Send, Download, User, Phone, Mail, MapPin, Globe, Upload, ImageIcon, FileText, X, Paperclip, PieChart, Filter, Users } from 'lucide-react';
import { ReceiptData, CompanyConfig, Customer, Attachment } from '../types';
import { loggerService } from '../services/loggerService.ts';
import { useAuth } from '../contexts/AuthContext.tsx';

// --- Helper: Arabic Number to Words (Tafqit) ---
const tafqit = (number: number): string => {
  if (number === 0) return "صفر";

  const units = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
  const thousands = ["", "ألف", "ألفان", "ثلاثة آلاف", "أربعة آلاف", "خمسة آلاف", "ستة آلاف", "سبعة آلاف", "ثمانية آلاف", "تسعة آلاف"];

  let text = "";

  const processSegment = (n: number): string => {
      let res = "";
      const h = Math.floor(n / 100);
      const r = n % 100;
      
      if (h > 0) {
          res += hundreds[h];
          if (r > 0) res += " و ";
      }
      
      if (r > 0) {
          if (r < 10) res += units[r];
          else if (r < 20) res += teens[r - 10];
          else {
              const u = r % 10;
              const t = Math.floor(r / 10);
              if (u > 0) res += units[u] + " و ";
              res += tens[t];
          }
      }
      return res;
  };

  if (number >= 1000000) return `${number} ريال سعودي`;

  const k = Math.floor(number / 1000);
  const remainder = number % 1000;

  if (k > 0) {
      if (k === 1) text += "ألف";
      else if (k === 2) text += "ألفان";
      else if (k >= 3 && k <= 10) text += thousands[k];
      else text += processSegment(k) + " ألف";
      
      if (remainder > 0) text += " و ";
  }

  if (remainder > 0 || text === "") {
      text += processSegment(remainder);
  }

  return text + " ريال سعودي فقط لا غير";
};

const INITIAL_CONFIG: CompanyConfig = {
    logo: null,
    stamp: null,
    headerTitle: 'جيلكو للمصاعد',
    headerSubtitle: 'Jilco Elevators Co.',
    footerText: 'المملكة العربية السعودية - الرياض - هاتف: 920000000',
    contactPhone: '+966 50 000 0000',
    contactEmail: 'sales@jilco-elevators.com',
    bankAccounts: []
};

export const ReceiptModule: React.FC = () => {
  const { currentUser } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'editor' | 'statement'>('list');
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [statementCustomer, setStatementCustomer] = useState<string>('');

  const [currentReceipt, setCurrentReceipt] = useState<ReceiptData>({
    number: `RV-${new Date().getFullYear()}-001`,
    date: new Date().toISOString().split('T')[0],
    receivedFrom: '',
    amount: 0,
    amountInWords: '',
    paymentMethod: 'transfer',
    forReason: '',
    bankName: '',
    checkNumber: '',
    attachments: []
  });

  const [config, setConfig] = useState<CompanyConfig>(INITIAL_CONFIG);

  useEffect(() => {
    const savedConfig = localStorage.getItem('jilco_quote_data');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (parsed.config) setConfig(prev => ({ ...prev, ...parsed.config }));
      } catch (e) { console.error(e); }
    }
    const savedReceipts = localStorage.getItem('jilco_receipts_archive');
    if (savedReceipts) {
        try { setReceipts(JSON.parse(savedReceipts)); } catch (e) { console.error(e); }
    }
    const savedCustomers = localStorage.getItem('jilco_customers');
    if (savedCustomers) {
        try { setCustomers(JSON.parse(savedCustomers)); } catch(e) {}
    }
  }, []);

  useEffect(() => {
      localStorage.setItem('jilco_receipts_archive', JSON.stringify(receipts));
  }, [receipts]);

  useEffect(() => {
    if (currentReceipt.amount > 0) {
      setCurrentReceipt(prev => ({ ...prev, amountInWords: tafqit(prev.amount) }));
    } else {
      setCurrentReceipt(prev => ({ ...prev, amountInWords: '' }));
    }
  }, [currentReceipt.amount]);

  const handleCreateNew = () => {
    setCurrentReceipt({
        number: `RV-${new Date().getFullYear()}-${String(receipts.length + 1).padStart(3, '0')}`,
        date: new Date().toISOString().split('T')[0],
        receivedFrom: '',
        amount: 0,
        amountInWords: '',
        paymentMethod: 'transfer',
        forReason: '',
        bankName: '',
        checkNumber: '',
        attachments: []
    });
    setViewMode('editor');
  };

  const handleSaveReceipt = () => {
      if(!currentReceipt.receivedFrom || currentReceipt.amount <= 0) return alert('الرجاء تعبئة بيانات العميل والمبلغ');
      const exists = receipts.find(r => r.number === currentReceipt.number);
      if(exists) {
          setReceipts(receipts.map(r => r.number === currentReceipt.number ? currentReceipt : r));
          loggerService.addLog(currentUser, 'تعديل سند قبض', `سند رقم: ${currentReceipt.number} - العميل: ${currentReceipt.receivedFrom}`, 'المحاسبة');
      } else {
          setReceipts([currentReceipt, ...receipts]);
          loggerService.addLog(currentUser, 'إنشاء سند قبض', `سند رقم: ${currentReceipt.number} - المبلغ: ${currentReceipt.amount}`, 'المحاسبة');
      }
      setViewMode('list');
  };

  const handleDelete = (number: string) => {
      if(window.confirm("هل أنت متأكد من حذف هذا السند؟")) {
          setReceipts(receipts.filter(r => r.number !== number));
          loggerService.addLog(currentUser, 'حذف سند قبض', `رقم السند: ${number}`, 'المحاسبة');
      }
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const customer = customers.find(c => c.id === e.target.value);
      if (customer) {
          setCurrentReceipt(prev => ({ ...prev, receivedFrom: customer.fullName }));
      }
  };

  if (viewMode === 'statement') {
      const filteredReceipts = receipts.filter(r => {
          const inDateRange = r.date >= startDate && r.date <= endDate;
          const matchesCustomer = statementCustomer ? r.receivedFrom.includes(statementCustomer) : true;
          return inDateRange && matchesCustomer;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const totalAmount = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);

      return (
        <div className="flex-1 bg-gray-200 p-8 overflow-auto flex justify-center items-start print:p-0 print:m-0 print:bg-white print:w-full">
            <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-0 relative flex flex-col print:shadow-none print:w-full">
                <div className="px-10 py-6 border-b-2 border-jilco-900 flex justify-between items-center">
                    <div className="w-1/3 text-right"><h1 className="text-xl font-black text-jilco-900">{config.headerTitle}</h1><p className="text-xs font-bold text-gray-500">{config.headerSubtitle}</p></div>
                    <div className="w-1/3 text-center"><h2 className="text-2xl font-black text-jilco-900 border-2 border-jilco-900 px-4 py-1 inline-block rounded-lg uppercase">كشف حساب مقبوضات</h2></div>
                    <div className="w-1/3 text-left"><p className="text-xs font-bold text-gray-500">تاريخ الطباعة</p><p className="font-mono text-sm">{new Date().toLocaleDateString('en-GB')}</p></div>
                </div>
                <div className="px-10 py-6 bg-gray-50 border-b border-gray-200 print:hidden flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-700 mb-1">اسم العميل</label>
                        <input type="text" value={statementCustomer} onChange={e => setStatementCustomer(e.target.value)} className="w-full p-2 border border-gray-400 rounded text-sm text-black bg-white font-bold" placeholder="بحث..." />
                    </div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">من</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border border-gray-400 rounded text-sm bg-white font-bold" /></div>
                    <div><label className="block text-xs font-bold text-gray-700 mb-1">إلى</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border border-gray-400 rounded text-sm bg-white font-bold" /></div>
                    <div className="flex gap-2"><button onClick={() => window.print()} className="bg-jilco-900 text-white px-4 py-2 rounded font-bold text-sm flex items-center gap-2"><Printer size={16}/> طباعة</button><button onClick={() => setViewMode('list')} className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded font-bold text-sm">إغلاق</button></div>
                </div>
                <div className="px-10 py-6 flex-1">
                    <table className="w-full text-xs text-right border-collapse">
                        <thead>
                            <tr className="bg-jilco-900 text-white">
                                <th className="p-2 border border-jilco-900 w-10">#</th>
                                <th className="p-2 border border-jilco-900 w-24">التاريخ</th>
                                <th className="p-2 border border-jilco-900 w-24">رقم السند</th>
                                <th className="p-2 border border-jilco-900">المستلم من</th>
                                <th className="p-2 border border-jilco-900 w-24 text-center">المبلغ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredReceipts.map((r, idx) => (
                                <tr key={idx} className="border-b border-gray-200">
                                    <td className="p-2 border text-center">{idx + 1}</td>
                                    <td className="p-2 border font-mono">{r.date}</td>
                                    <td className="p-2 border font-mono font-bold">{r.number}</td>
                                    <td className="p-2 border font-bold">{r.receivedFrom}</td>
                                    <td className="p-2 border text-center font-bold font-mono">{r.amount.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-6 flex justify-end"><div className="bg-gray-100 p-4 rounded-xl border-2 border-jilco-900 w-64 flex justify-between font-black"><span>الإجمالي:</span><span className="font-mono">{totalAmount.toLocaleString()} SAR</span></div></div>
                </div>
                <div className="mt-auto bg-gray-50 p-4 text-center text-xs text-gray-400 border-t border-gray-200">{config.footerText}</div>
            </div>
        </div>
      );
  }

  if (viewMode === 'list') {
    return (
        <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div><h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2"><Banknote className="text-green-600" /> أرشيف سندات القبض</h1><p className="text-gray-500 text-sm mt-1">متابعة التحصيلات المالية</p></div>
                    <button onClick={handleCreateNew} className="bg-jilco-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md"><Plus size={20} /> سند جديد</button>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center">
                         <div className="relative flex-1 max-w-md"><Search className="absolute right-3 top-2.5 text-gray-400" size={18} /><input type="text" placeholder="بحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pr-10 pl-4 py-2 border rounded-lg text-sm bg-white font-bold" /></div>
                         <button onClick={() => setViewMode('statement')} className="bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-100 flex items-center gap-2"><PieChart size={16}/> كشف الحساب</button>
                    </div>
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-50 text-gray-500">
                            <tr><th className="p-4">رقم السند</th><th className="p-4">استلمنا من</th><th className="p-4">المبلغ</th><th className="p-4">التاريخ</th><th className="p-4 text-center">إجراءات</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {receipts.filter(r => r.number.includes(searchTerm) || r.receivedFrom.includes(searchTerm)).map(receipt => (
                                <tr key={receipt.number} className="hover:bg-gray-50">
                                    <td className="p-4 font-mono font-bold text-gray-800">{receipt.number}</td>
                                    <td className="p-4">{receipt.receivedFrom}</td>
                                    <td className="p-4 font-bold text-green-700">{receipt.amount.toLocaleString()} SAR</td>
                                    <td className="p-4 font-mono text-xs text-gray-500 font-bold">{receipt.date}</td>
                                    <td className="p-4 flex justify-center gap-2">
                                        <button onClick={() => { setCurrentReceipt(receipt); setViewMode('editor'); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit size={16}/></button>
                                        <button onClick={() => { setCurrentReceipt(receipt); setViewMode('editor'); setTimeout(window.print, 500); }} className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"><Printer size={16}/></button>
                                        <button onClick={() => handleDelete(receipt.number)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16}/></button>
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
    <div className="flex flex-col lg:flex-row h-full bg-gray-100 print:h-auto print:block">
      <div className="w-full lg:w-1/3 bg-white border-l border-gray-200 h-full overflow-y-auto p-6 no-print shadow-lg z-10 sidebar-container">
        <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
           <div className="flex items-center gap-2 text-jilco-900"><div className="p-2 bg-green-100 rounded-lg text-green-700"><Banknote size={24} /></div><div><h2 className="text-xl font-bold">سند قبض</h2><p className="text-xs text-gray-500">{currentReceipt.number}</p></div></div>
           <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-100 rounded-full"><ArrowLeft size={20}/></button>
        </div>
        <div className="space-y-4">
           <div className="grid grid-cols-2 gap-2"><button onClick={handleSaveReceipt} className="bg-green-600 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-700"><Save size={16} /> حفظ</button><button onClick={() => window.print()} className="bg-jilco-900 text-white py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-jilco-800"><Printer size={16} /> طباعة</button></div>
           
           <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3">
              <label className="text-xs font-bold text-blue-800 flex items-center gap-1"><Users size={14}/> ربط العميل (من قاعدة البيانات)</label>
              <select onChange={handleCustomerSelect} className="w-full p-2 border border-gray-400 rounded-lg bg-white font-bold text-sm outline-none">
                  <option value="">-- اختر عميل مسجل --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
              </select>
           </div>

           <div className="bg-gray-100 p-4 rounded border border-gray-400 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-bold text-gray-700 mb-1">رقم السند</label><input type="text" value={currentReceipt.number} onChange={(e) => setCurrentReceipt({...currentReceipt, number: e.target.value})} className="w-full p-2 border rounded bg-white text-sm font-bold" /></div>
                <div><label className="block text-[10px] font-bold text-gray-700 mb-1">التاريخ</label><input type="date" value={currentReceipt.date} onChange={(e) => setCurrentReceipt({...currentReceipt, date: e.target.value})} className="w-full p-2 border rounded bg-white text-sm font-bold" /></div>
              </div>
              <div><label className="block text-xs font-bold text-gray-700 mb-1">استلمنا من</label><input type="text" value={currentReceipt.receivedFrom} onChange={(e) => setCurrentReceipt({...currentReceipt, receivedFrom: e.target.value})} className="w-full p-2 border rounded bg-white font-bold" placeholder="اسم العميل" /></div>
           </div>
           <div className="bg-green-50 p-4 rounded border border-green-400 space-y-3">
              <div><label className="block text-xs font-bold text-gray-700 mb-1">المبلغ (ر.س)</label><input type="number" value={currentReceipt.amount} onChange={(e) => setCurrentReceipt({...currentReceipt, amount: parseFloat(e.target.value)})} className="w-full p-2 border rounded font-black text-black bg-white" /></div>
              <div><label className="block text-xs font-bold text-gray-700 mb-1">طريقة الدفع</label><select value={currentReceipt.paymentMethod} onChange={(e) => setCurrentReceipt({...currentReceipt, paymentMethod: e.target.value as any})} className="w-full p-2 border rounded bg-white font-bold"><option value="cash">نقداً</option><option value="check">شيك</option><option value="transfer">تحويل</option></select></div>
           </div>
           <div><label className="block text-xs font-bold text-gray-700 mb-1">وذلك عن</label><textarea value={currentReceipt.forReason} onChange={(e) => setCurrentReceipt({...currentReceipt, forReason: e.target.value})} className="w-full p-2 border rounded h-20 bg-white font-bold" /></div>
        </div>
      </div>

      <div className="flex-1 bg-gray-200 p-8 overflow-auto flex justify-center items-start print:p-0 print:bg-white print:overflow-hidden">
        <div id="printable-area" className="bg-white shadow-2xl w-[210mm] h-[297mm] relative flex flex-col p-0 print:shadow-none print:w-[210mm] print:h-[297mm]">
           <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
           <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
           <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
               <header className="px-10 py-6 border-b-2 border-jilco-100 flex justify-between items-center h-[160px] shrink-0">
                    <div className="w-1/3 text-right">
                        <h1 className="text-2xl font-black text-jilco-900 mb-0.5">{config.headerTitle}</h1>
                        <p className="text-[10px] font-bold text-gray-500">{config.headerSubtitle}</p>
                        {config.vatNumber && <p className="text-[9px] font-bold text-gray-600 mt-1">رقم الضريبة: {config.vatNumber}</p>}
                    </div>
                    <div className="w-1/3 flex justify-center">{config.logo && <img src={config.logo} className="h-32 w-auto object-contain" />}</div>
                    <div className="w-1/3 text-left flex flex-col items-end" dir="ltr">
                        <h2 className="text-lg font-black text-jilco-900 tracking-tighter uppercase">Receipt Voucher</h2>
                        <p className="text-[10px] text-gray-400 font-bold">سند قبض</p>
                        {config.vatNumber && <p className="text-[9px] font-bold text-gray-600 mt-1">VAT: {config.vatNumber}</p>}
                    </div>
                </header>
               <div className="px-10 flex-1 flex flex-col relative py-8">
                   <div className="flex justify-between items-center mb-10">
                       <div className="bg-jilco-900 text-white px-6 py-2 rounded-lg"><h2 className="text-xl font-bold tracking-widest uppercase">سند قبض</h2></div>
                       <div className="text-left font-mono font-bold" dir="ltr"><div>No: <span className="text-red-600">{currentReceipt.number}</span></div><div>Date: {currentReceipt.date}</div></div>
                   </div>
                   <div className="border border-gray-300 rounded-xl p-8 space-y-8 bg-white/90 relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-2 h-full bg-gold-500"></div>
                       <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg"><span className="text-jilco-900 font-bold w-32 shrink-0">المبلغ المستلم:</span><span className="font-mono font-black text-3xl text-jilco-900">{currentReceipt.amount.toLocaleString()} SAR</span></div>
                       <div className="flex items-baseline gap-2 leading-loose border-b border-gray-100 pb-2"><span className="text-gray-500 font-bold w-32 shrink-0">استلمنا من:</span><span className="flex-1 font-bold text-xl text-gray-800">{currentReceipt.receivedFrom || '..........................'}</span></div>
                       <div className="flex items-baseline gap-2 leading-loose border-b border-gray-100 pb-2"><span className="text-gray-500 font-bold w-32 shrink-0">مبلغ وقدره:</span><span className="flex-1 font-medium text-jilco-700 italic text-base">{currentReceipt.amountInWords}</span></div>
                       <div className="flex items-baseline gap-2 leading-loose border-b border-gray-100 pb-2"><span className="text-gray-500 font-bold w-32 shrink-0">وذلك عن:</span><span className="flex-1 text-gray-800 font-bold">{currentReceipt.forReason || '..........................................................'}</span></div>
                   </div>
                   <div className="flex justify-between items-end mt-16 px-6">
                       <div className="text-center"><p className="text-xs font-bold text-gray-400 mb-8 uppercase">المستلم</p><div className="w-40 border-b-2 border-gray-300"></div></div>
                       <div className="text-center relative">{config.stamp && <img src={config.stamp} className="w-56 h-56 opacity-90 mix-blend-multiply p-2" />}<p className="text-xs font-bold text-gray-400 mb-2 uppercase">الختم</p></div>
                       <div className="text-center"><p className="text-xs font-bold text-gray-400 mb-8 uppercase">المحاسب</p><div className="w-40 border-b-2 border-gray-300"></div></div>
                   </div>
               </div>
               <footer className="w-full mt-auto bg-jilco-900 text-white py-3 px-10 flex justify-between items-center text-[10px] font-bold h-[45px]">{config.footerText}</footer>
           </div>
        </div>
      </div>
    </div>
  );
};
