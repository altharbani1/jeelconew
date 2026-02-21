import React, { useState, useEffect } from 'react';
import { FileWarning, Plus, Search, Edit, Trash2, Printer, Save, ArrowLeft, Building, Phone, Mail, MapPin, Globe } from 'lucide-react';
import { FinancialClaim, Customer, CompanyConfig } from '../types';
import { useData } from '../contexts/DataContext.tsx';

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

// --- Tafqit Helper (Reusable) ---
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

export const FinancialClaimModule: React.FC = () => {
  const {
    financialClaims: claims,
    customers,
    saveRecord, deleteRecordLocallyAndCloud
  } = useData();

  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [config, setConfig] = useState<CompanyConfig>(INITIAL_CONFIG);
  const [searchTerm, setSearchTerm] = useState('');

  const [currentClaim, setCurrentClaim] = useState<FinancialClaim>({
    id: '',
    number: `FC-${new Date().getFullYear()}-001`,
    date: new Date().toISOString().split('T')[0],
    customerId: '',
    customerName: '',
    projectName: '',
    claimAmount: 0,
    description: '',
    notes: 'نرجو من سعادتكم التكرم بسداد المبلغ المستحق لاستكمال الأعمال حسب الجدول الزمني.',
    status: 'pending'
  });

  // Load Data
  useEffect(() => {
    const savedConfig = localStorage.getItem('jilco_quote_data');
    if (savedConfig) try {
      const parsed = JSON.parse(savedConfig);
      if (parsed.config) setConfig(parsed.config);
    } catch (e) { }
  }, []);

  // Actions
  const handleCreateNew = () => {
    setCurrentClaim({
      id: Date.now().toString(),
      number: `FC-${new Date().getFullYear()}-${String(claims.length + 1).padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0],
      customerId: '',
      customerName: '',
      projectName: '',
      claimAmount: 0,
      description: '',
      notes: 'نرجو من سعادتكم التكرم بسداد المبلغ المستحق لاستكمال الأعمال حسب الجدول الزمني.',
      status: 'pending'
    });
    setViewMode('editor');
  };

  const handleEdit = (claim: FinancialClaim) => {
    setCurrentClaim(claim);
    setViewMode('editor');
  };

  const handleSave = async () => {
    if (!currentClaim.customerName) return alert('اسم العميل مطلوب');
    if (currentClaim.claimAmount <= 0) return alert('مبلغ المطالبة يجب أن يكون أكبر من صفر');

    await saveRecord('jilco_claims_archive', currentClaim.id, currentClaim);
    setViewMode('list');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه المطالبة؟')) {
      await deleteRecordLocallyAndCloud('jilco_claims_archive', id);
    }
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customer = customers.find(c => c.id === e.target.value);
    if (customer) {
      setCurrentClaim(prev => ({
        ...prev,
        customerId: customer.id,
        customerName: customer.fullName,
        projectName: customer.companyName || customer.address || ''
      }));
    }
  };

  // --- Views ---

  if (viewMode === 'list') {
    return (
      <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
                <FileWarning className="text-gold-500" /> المطالبات المالية
              </h1>
              <p className="text-gray-500 text-sm mt-1">إدارة ومتابعة طلبات الدفعات المستحقة</p>
            </div>
            <button onClick={handleCreateNew} className="bg-jilco-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md">
              <Plus size={20} /> مطالبة جديدة
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <div className="relative max-w-md">
                <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="بحث برقم المطالبة، العميل..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-jilco-500 outline-none"
                />
              </div>
            </div>
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="p-4">رقم المطالبة</th>
                  <th className="p-4">العميل</th>
                  <th className="p-4">البيان</th>
                  <th className="p-4">المبلغ</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {claims.filter(c => c.number.includes(searchTerm) || c.customerName.includes(searchTerm)).map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="p-4 font-mono font-bold text-jilco-900">{c.number}</td>
                    <td className="p-4 font-bold text-gray-800">{c.customerName}</td>
                    <td className="p-4 text-gray-600 truncate max-w-[200px]">{c.description}</td>
                    <td className="p-4 font-bold text-jilco-900">{c.claimAmount.toLocaleString()}</td>
                    <td className="p-4 font-mono text-xs">{c.date}</td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => handleEdit(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit size={16} /></button>
                      <button onClick={() => { handleEdit(c); setTimeout(() => window.print(), 500); }} className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"><Printer size={16} /></button>
                      <button onClick={() => handleDelete(c.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {claims.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-gray-400">لا توجد مطالبات مسجلة.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- EDITOR VIEW ---
  return (
    <div className="flex flex-col lg:flex-row h-full w-full overflow-hidden animate-fade-in print:h-auto print:overflow-visible print:block">

      {/* Editor Sidebar */}
      <div className="w-full lg:w-1/3 bg-white border-l border-gray-200 h-full overflow-y-auto p-6 no-print shadow-lg z-10 sidebar-container">
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <h2 className="text-xl font-bold text-jilco-900 flex items-center gap-2">
            <FileWarning className="text-gold-500" /> محرر المطالبة
          </h2>
          <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><ArrowLeft size={20} /></button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleSave} className="bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-700">
              <Save size={18} /> حفظ
            </button>
            <button onClick={() => window.print()} className="bg-jilco-900 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-jilco-800">
              <Printer size={18} /> طباعة
            </button>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
            <label className="text-xs font-bold text-gray-700 block">العميل</label>
            <select onChange={handleCustomerSelect} className="w-full p-2 border rounded text-sm mb-2" value={currentClaim.customerId}>
              <option value="" disabled>-- اختر عميل مسجل --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
            </select>
            <input type="text" placeholder="اسم العميل" value={currentClaim.customerName} onChange={e => setCurrentClaim({ ...currentClaim, customerName: e.target.value })} className="w-full p-2 border rounded text-sm" />
            <input type="text" placeholder="المشروع" value={currentClaim.projectName} onChange={e => setCurrentClaim({ ...currentClaim, projectName: e.target.value })} className="w-full p-2 border rounded text-sm" />
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">رقم المطالبة</label>
                <input type="text" value={currentClaim.number} onChange={e => setCurrentClaim({ ...currentClaim, number: e.target.value })} className="w-full p-2 border rounded text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">التاريخ</label>
                <input type="date" value={currentClaim.date} onChange={e => setCurrentClaim({ ...currentClaim, date: e.target.value })} className="w-full p-2 border rounded text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">المبلغ المطلوب (ر.س)</label>
              <input type="number" value={currentClaim.claimAmount} onChange={e => setCurrentClaim({ ...currentClaim, claimAmount: parseFloat(e.target.value) })} className="w-full p-2 border rounded text-sm font-bold text-jilco-900" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">البيان / الوصف</label>
              <textarea value={currentClaim.description} onChange={e => setCurrentClaim({ ...currentClaim, description: e.target.value })} className="w-full p-2 border rounded text-sm h-20" placeholder="مثال: دفعة تشغيل المصعد..." />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">ملاحظات ختامية</label>
            <textarea value={currentClaim.notes} onChange={e => setCurrentClaim({ ...currentClaim, notes: e.target.value })} className="w-full p-2 border rounded text-sm h-20" />
          </div>
        </div>
      </div>

      {/* Preview Area - Adjusted for Print with Royal Frame */}
      <div className="flex-1 bg-gray-200 p-8 overflow-auto flex justify-center items-start print:p-0 print:m-0 print:w-full print:h-full print:fixed print:top-0 print:left-0 print:z-50 print:bg-white print:overflow-hidden">

        {/* The A4 Page with specific ID for printing */}
        <div id="printable-area" className="bg-white shadow-2xl w-[210mm] h-[297mm] relative flex flex-col p-0 print:shadow-none print:w-[210mm] print:h-[297mm] print:overflow-hidden">

          {/* Royal Frame Borders */}
          <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
          <div className="absolute inset-[18px] border border-gold-500 pointer-events-none z-0"></div>
          <div className="absolute inset-[24px] border border-gray-100 pointer-events-none z-0"></div>

          {/* Content Wrapper inside the frame */}
          <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">

            {/* Unified Header */}
            <header className="px-10 py-6 border-b-2 border-jilco-100 flex justify-between items-center bg-white h-[160px] relative overflow-hidden shrink-0">
              <div className="w-1/3 text-right">
                <h1 className="text-2xl font-black text-jilco-900 mb-0.5">{config.headerTitle || 'جيلكو للمصاعد'}</h1>
                <p className="text-[10px] font-bold text-gray-500 mb-3">{config.headerSubtitle || 'للمصاعد والسلالم الكهربائية'}</p>
                <div className="text-[9px] text-gray-400 font-bold border-r-2 border-gold-500 pr-2 leading-tight">
                  <p>سجل تجاري: ١٠١٠٧٢٤٥٨٢</p>
                  <p>الرقم الضريبي: ٣١٠٢٤٥٦٧٨٩٠٠٠٠٣</p>
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
                    <Phone size={10} className="text-jilco-600" />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black text-gray-700 bg-gray-50 px-2 py-1 rounded-l-full border-r-2 border-gold-500">
                    <span>{config.contactEmail}</span>
                    <Mail size={10} className="text-gold-600" />
                  </div>
                </div>
              </div>
            </header>

            {/* Body */}
            <div className="flex-1 px-12 py-4 flex flex-col relative overflow-hidden">
              {/* Watermark */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none z-0">
                <h1 className="text-[120px] font-bold rotate-[-45deg] whitespace-nowrap">CLAIM</h1>
              </div>

              <div className="relative z-10 flex-1 flex flex-col">
                <div className="flex justify-between items-end border-b border-gray-200 pb-2 mb-4 shrink-0">
                  <div>
                    <h2 className="text-xl font-bold text-jilco-900 border-r-4 border-gold-500 pr-3">مطالبة مالية</h2>
                    <p className="text-[10px] text-gray-500 mt-1 font-mono">Financial Claim</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-gray-600">التاريخ: <span className="font-mono text-black">{currentClaim.date}</span></p>
                    <p className="text-xs font-bold text-gray-600">الرقم: <span className="font-mono text-red-600">{currentClaim.number}</span></p>
                  </div>
                </div>

                <div className="space-y-3 text-sm font-bold text-gray-800 leading-loose flex-1">
                  <div className="flex gap-2">
                    <span className="w-24 text-gray-500 text-xs">السادة /</span>
                    <span className="border-b border-dotted border-gray-400 flex-1 px-2">{currentClaim.customerName}</span>
                    <span className="text-gray-500 text-xs">المحترمين</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-24 text-gray-500 text-xs">المشروع /</span>
                    <span className="border-b border-dotted border-gray-400 flex-1 px-2">{currentClaim.projectName}</span>
                  </div>

                  <div className="py-2 text-center shrink-0">
                    <p className="text-sm mb-1">السلام عليكم ورحمة الله وبركاته،،،</p>
                    <p className="text-xs">نأمل من سعادتكم التكرم بصرف الدفعة المستحقة للمشروع المذكور أعلاه وذلك عن:</p>
                  </div>

                  <div className="my-2 shrink-0">
                    <table className="w-full text-sm border-collapse border border-gray-300 rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-jilco-900 text-white text-[10px] font-bold uppercase">
                          <th className="p-2 text-right border-l border-white/20">تفاصيل الدفعة / البيان</th>
                          <th className="p-2 text-center w-40">المبلغ (SAR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white">
                          <td className="p-3 border-b border-l border-gray-200 text-gray-800 font-bold leading-relaxed align-top text-xs">
                            {currentClaim.description}
                          </td>
                          <td className="p-3 border-b border-gray-200 text-center align-top bg-gray-50">
                            <div className="text-lg font-black text-black font-mono mb-1">{currentClaim.claimAmount.toLocaleString()}</div>
                            <div className="text-[9px] text-gray-500 font-bold">ريال سعودي</div>
                          </td>
                        </tr>
                      </tbody>
                      <tfoot className="bg-gray-100">
                        <tr>
                          <td colSpan={2} className="p-2 border-t border-gray-300 text-center">
                            <span className="text-[10px] text-gray-500 font-bold ml-2">المبلغ كتابة:</span>
                            <span className="text-xs font-bold text-jilco-900">{tafqit(currentClaim.claimAmount)}</span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <p className="mt-2 leading-relaxed text-justify text-[10px] shrink-0 text-gray-600">{currentClaim.notes}</p>

                  <div className="mt-4 shrink-0">
                    <h4 className="font-bold text-jilco-900 border-b border-gray-200 pb-2 mb-2 flex items-center gap-2 text-xs"><Building size={14} /> بيانات الحساب البنكي</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {config.bankAccounts.length > 0 ? config.bankAccounts.map((bank, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 p-2 rounded-lg text-[10px] shadow-sm">
                          <p className="font-bold text-jilco-900 mb-1 text-xs">{bank.bankName}</p>
                          <p className="text-gray-700 mb-1" dir="ltr">Account: <span className="font-mono text-black font-bold">{bank.accountNumber}</span></p>
                          <p className="text-gray-700" dir="ltr">IBAN: <span className="font-mono text-black font-bold">{bank.iban}</span></p>
                        </div>
                      )) : <p className="text-gray-400 text-xs">يرجى إضافة حسابات بنكية في ملف الشركة.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer & Stamp */}
            <div className="mt-auto px-12 pb-6 shrink-0">
              <div className="flex justify-between items-end mt-2">
                <div className="text-center">
                  <p className="font-bold text-jilco-900 mb-4 text-sm">الختم الرسمي</p>
                  {/* Large Square Stamp - Straight */}
                  <div className="w-40 h-40 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center relative bg-white">
                    {config.stamp && <img src={config.stamp} alt="stamp" className="absolute w-full h-full object-contain p-2 opacity-90 mix-blend-multiply" />}
                    {!config.stamp && <span className="text-xs text-gray-400">ختم الشركة</span>}
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-bold text-jilco-900 mb-12 text-sm">الإدارة المالية</p>
                  <div className="w-40 border-b-2 border-gray-300"></div>
                </div>
              </div>
            </div>

            {/* Unified Footer */}
            <footer className="w-full bg-white shrink-0 mt-auto">
              <div className="bg-jilco-900 text-white py-3 px-10 flex justify-between items-center text-[10px] font-bold h-[45px]">
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-gold-400" />
                  <span>{config.footerText || 'المملكة العربية السعودية - الرياض'}</span>
                </div>
                <div className="flex items-center gap-2" dir="ltr">
                  <Globe size={12} className="text-gold-400" />
                  <span>www.jilco-elevators.com</span>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
};