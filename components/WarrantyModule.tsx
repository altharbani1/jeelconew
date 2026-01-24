
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, Search, Edit, Trash2, Printer, ArrowLeft, Save, User, Calendar, MapPin, Award } from 'lucide-react';
import { WarrantyData, CompanyConfig, Customer } from '../types';

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
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [warranties, setWarranties] = useState<WarrantyData[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
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

  // Load Data
  useEffect(() => {
    // Load Warranties
    const savedWarranties = localStorage.getItem('jilco_warranties_archive');
    if (savedWarranties) {
        try { setWarranties(JSON.parse(savedWarranties)); } catch(e) {}
    }

    // Load Customers
    const savedCustomers = localStorage.getItem('jilco_customers');
    if (savedCustomers) {
        try { setCustomers(JSON.parse(savedCustomers)); } catch(e) {}
    }

    // Load Config
    const savedConfig = localStorage.getItem('jilco_quote_data');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (parsed.config) setConfig(parsed.config);
      } catch (e) {}
    }
  }, []);

  // Save Warranties
  useEffect(() => {
      localStorage.setItem('jilco_warranties_archive', JSON.stringify(warranties));
  }, [warranties]);

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

  const handleDelete = (id: string) => {
      if(window.confirm('هل أنت متأكد من حذف هذه الشهادة؟')) {
          setWarranties(warranties.filter(w => w.id !== id));
      }
  };

  const handleSave = () => {
      if(!currentWarranty.customerName) return alert('اسم العميل مطلوب');
      
      const exists = warranties.find(w => w.id === currentWarranty.id);
      if(exists) {
          setWarranties(warranties.map(w => w.id === currentWarranty.id ? currentWarranty : w));
      } else {
          setWarranties([currentWarranty, ...warranties]);
      }
      setViewMode('list');
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const customer = customers.find(c => c.id === e.target.value);
      if(customer) {
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
                                            <button onClick={() => handleEdit(w)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit size={16}/></button>
                                            <button onClick={() => { handleEdit(w); setTimeout(() => window.print(), 500); }} className="p-2 text-gray-600 hover:bg-gray-50 rounded-full"><Printer size={16}/></button>
                                            <button onClick={() => handleDelete(w.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16}/></button>
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
        <div className="w-full lg:w-1/3 bg-white border-l border-gray-200 h-full overflow-y-auto p-6 no-print shadow-lg z-10 sidebar-container">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h2 className="text-xl font-bold text-jilco-900 flex items-center gap-2">
                    <ShieldCheck className="text-gold-500" /> محرر الشهادة
                </h2>
                <button onClick={() => setViewMode('list')} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><ArrowLeft size={20}/></button>
            </div>

            <div className="space-y-6">
                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleSave} className="bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-green-700">
                        <Save size={18}/> حفظ
                    </button>
                    <button onClick={() => window.print()} className="bg-jilco-900 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-jilco-800">
                        <Printer size={18}/> طباعة / PDF
                    </button>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                    <h3 className="font-bold text-sm text-jilco-800 border-b pb-2 mb-2 flex items-center gap-2"><User size={14}/> بيانات العميل</h3>
                    
                    <select 
                        onChange={handleCustomerSelect}
                        className="w-full p-2 border rounded text-sm mb-2"
                        defaultValue=""
                    >
                        <option value="" disabled>-- اختر عميل مسجل --</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                    </select>

                    <input 
                        type="text" placeholder="اسم العميل" value={currentWarranty.customerName} 
                        onChange={e => setCurrentWarranty({...currentWarranty, customerName: e.target.value})}
                        className="w-full p-2 border rounded text-sm"
                    />
                    <input 
                        type="text" placeholder="اسم المشروع / المبنى" value={currentWarranty.projectName} 
                        onChange={e => setCurrentWarranty({...currentWarranty, projectName: e.target.value})}
                        className="w-full p-2 border rounded text-sm"
                    />
                    <input 
                        type="text" placeholder="الموقع" value={currentWarranty.location} 
                        onChange={e => setCurrentWarranty({...currentWarranty, location: e.target.value})}
                        className="w-full p-2 border rounded text-sm"
                    />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                    <h3 className="font-bold text-sm text-jilco-800 border-b pb-2 mb-2 flex items-center gap-2"><Award size={14}/> تفاصيل المصعد</h3>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="نوع المصعد" value={currentWarranty.elevatorType} onChange={e => setCurrentWarranty({...currentWarranty, elevatorType: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                        <input type="text" placeholder="رقم الماكينة / التسلسلي" value={currentWarranty.machineNumber} onChange={e => setCurrentWarranty({...currentWarranty, machineNumber: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                        <input type="text" placeholder="الحمولة" value={currentWarranty.capacity} onChange={e => setCurrentWarranty({...currentWarranty, capacity: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                        <input type="text" placeholder="عدد الوقفات" value={currentWarranty.stops} onChange={e => setCurrentWarranty({...currentWarranty, stops: e.target.value})} className="w-full p-2 border rounded text-sm"/>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                    <h3 className="font-bold text-sm text-jilco-800 border-b pb-2 mb-2 flex items-center gap-2"><Calendar size={14}/> فترة الضمان</h3>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-gray-500">مدة الضمان (سنوات)</label>
                            <select value={currentWarranty.periodYears} onChange={handlePeriodChange} className="w-full p-2 border rounded text-sm mt-1">
                                {Array.from({length: 10}, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} سنة</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">بداية الضمان</label>
                            <input type="date" value={currentWarranty.warrantyStartDate} onChange={e => setCurrentWarranty({...currentWarranty, warrantyStartDate: e.target.value})} className="w-full p-2 border rounded text-sm mt-1"/>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-gray-500">نهاية الضمان</label>
                            <input type="date" value={currentWarranty.warrantyEndDate} onChange={e => setCurrentWarranty({...currentWarranty, warrantyEndDate: e.target.value})} className="w-full p-2 border rounded text-sm mt-1 bg-gray-100"/>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">الشروط والأحكام</label>
                    <textarea value={currentWarranty.notes} onChange={e => setCurrentWarranty({...currentWarranty, notes: e.target.value})} className="w-full p-2 border rounded text-sm h-24 text-gray-600 text-xs leading-relaxed"/>
                </div>
            </div>
        </div>

        {/* Certificate Preview */}
        <div className="flex-1 bg-gray-200 p-8 overflow-auto flex justify-center items-start print:p-0 print:bg-white print:overflow-visible print:block">
            <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] relative flex flex-col p-0 print:shadow-none print:w-full print:h-auto print:m-0">
                
                {/* Decorative Border Layer */}
                <div className="absolute inset-4 border-4 border-double border-gold-500 pointer-events-none z-20 rounded-sm"></div>
                <div className="absolute inset-5 border border-gold-300 pointer-events-none z-20 rounded-sm opacity-50"></div>
                
                {/* Corner Ornaments (CSS Shapes) */}
                <div className="absolute top-4 left-4 w-16 h-16 border-t-4 border-l-4 border-gold-600 z-20"></div>
                <div className="absolute top-4 right-4 w-16 h-16 border-t-4 border-r-4 border-gold-600 z-20"></div>
                <div className="absolute bottom-4 left-4 w-16 h-16 border-b-4 border-l-4 border-gold-600 z-20"></div>
                <div className="absolute bottom-4 right-4 w-16 h-16 border-b-4 border-r-4 border-gold-600 z-20"></div>

                {/* Content Container */}
                <div className="flex-1 p-12 flex flex-col relative z-10">
                    
                    {/* Header */}
                    <div className="text-center mb-12">
                        {config.logo && <img src={config.logo} alt="Logo" className="h-28 mx-auto mb-4 object-contain" />}
                        <h1 className="text-4xl font-black text-jilco-900 tracking-wider mb-2 font-serif">شهادة ضمان</h1>
                        <p className="text-gold-600 text-lg font-serif uppercase tracking-[0.3em]">Warranty Certificate</p>
                        {config.vatNumber && <p className="text-gray-500 text-xs mt-2">رقم الضريبة: {config.vatNumber}</p>}
                    </div>

                    {/* Certificate Body */}
                    <div className="text-center space-y-8 flex-1">
                        
                        <p className="text-gray-600 text-sm">
                            رقم الشهادة: <span className="font-mono font-bold text-black">{currentWarranty.certificateNumber}</span>
                        </p>

                        <div className="text-lg leading-loose text-gray-800">
                            تشهد شركة <span className="font-bold text-jilco-900 text-xl">{config.headerTitle}</span> بأن العميل:
                            <br/>
                            <div className="text-2xl font-bold text-black my-2 border-b border-dotted border-gray-400 inline-block px-8 pb-1">
                                {currentWarranty.customerName || '...........................................'}
                            </div>
                            <br/>
                            يتمتع بضمان شامل للمصعد الذي تم تركيبه في المشروع:
                            <br/>
                            <span className="font-bold text-jilco-800">{currentWarranty.projectName} - {currentWarranty.location}</span>
                        </div>

                        {/* Technical Details Grid */}
                        <div className="mx-auto max-w-2xl bg-gray-50 border border-gray-200 rounded-lg p-6 mt-8 shadow-sm">
                            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-right">
                                <div className="border-b border-gray-200 pb-2">
                                    <span className="text-gray-500 text-xs block mb-1">نوع المصعد</span>
                                    <span className="font-bold text-jilco-900">{currentWarranty.elevatorType}</span>
                                </div>
                                <div className="border-b border-gray-200 pb-2">
                                    <span className="text-gray-500 text-xs block mb-1">رقم الماكينة / التسلسلي</span>
                                    <span className="font-bold font-mono text-jilco-900">{currentWarranty.machineNumber || 'N/A'}</span>
                                </div>
                                <div className="border-b border-gray-200 pb-2">
                                    <span className="text-gray-500 text-xs block mb-1">الحمولة</span>
                                    <span className="font-bold text-jilco-900">{currentWarranty.capacity}</span>
                                </div>
                                <div className="border-b border-gray-200 pb-2">
                                    <span className="text-gray-500 text-xs block mb-1">عدد الوقفات</span>
                                    <span className="font-bold text-jilco-900">{currentWarranty.stops}</span>
                                </div>
                            </div>
                        </div>

                        {/* Warranty Period */}
                        <div className="my-8 py-4 bg-gold-50 border-y border-gold-200">
                            <p className="text-gray-600 mb-2">فترة الضمان سارية لمدة <span className="font-bold text-black">{currentWarranty.periodYears} سنة</span></p>
                            <div className="flex justify-center items-center gap-8 font-bold text-lg text-jilco-900">
                                <div>
                                    <span className="text-xs text-gray-500 block font-normal">من تاريخ</span>
                                    <span className="font-mono">{currentWarranty.warrantyStartDate}</span>
                                </div>
                                <div className="text-gray-400">←</div>
                                <div>
                                    <span className="text-xs text-gray-500 block font-normal">إلى تاريخ</span>
                                    <span className="font-mono">{currentWarranty.warrantyEndDate}</span>
                                </div>
                            </div>
                        </div>

                        {/* Terms */}
                        <div className="text-right text-xs text-gray-500 max-w-2xl mx-auto leading-relaxed">
                            <p className="font-bold mb-1">الشروط والأحكام:</p>
                            <p>{currentWarranty.notes}</p>
                        </div>

                    </div>

                    {/* Footer / Signatures */}
                    <div className="mt-16 flex justify-between items-end px-8">
                        <div className="text-center">
                            <p className="font-bold text-jilco-900 mb-8">إدارة الصيانة والضمان</p>
                            <div className="w-40 border-b-2 border-gray-800"></div>
                        </div>
                        
                        <div className="text-center relative">
                            {config.stamp && (
                                <img src={config.stamp} alt="Stamp" className="w-32 opacity-90 rotate-[-5deg] mix-blend-multiply" />
                            )}
                            {!config.stamp && <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center text-gray-400">الختم</div>}
                        </div>

                        <div className="text-center">
                            <p className="font-bold text-jilco-900 mb-8">المدير العام</p>
                            <div className="w-40 border-b-2 border-gray-800"></div>
                        </div>
                    </div>

                    {/* Watermark Big */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0 overflow-hidden">
                        <ShieldCheck size={400} />
                    </div>

                </div>
                
                {/* Footer Info */}
                <div className="bg-jilco-900 text-white text-center py-2 text-xs relative z-30">
                    <span dir="ltr">{config.contactPhone} | {config.contactEmail}</span>
                </div>
            </div>
        </div>
    </div>
  );
};
