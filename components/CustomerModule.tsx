
import React, { useState, useEffect, useMemo } from 'react';
// Added 'X' to the lucide-react import list
import { Users, Search, Plus, Phone, Mail, MapPin, Calendar, Edit, Trash2, Save, ArrowLeft, Clock, MessageSquare, UserCheck, Building, MoreVertical, PhoneCall, Filter, CheckCircle2, XCircle, FileText, PieChart, Printer, DollarSign, Wallet, FileCheck, X } from 'lucide-react';
import { Customer, CustomerStatus, CustomerNote, InvoiceData, ReceiptData, CompanyConfig } from '../types';

const STATUS_LABELS: Record<CustomerStatus, { label: string, color: string }> = {
  new: { label: 'عميل جديد', color: 'bg-blue-100 text-blue-700' },
  contacted: { label: 'تم التواصل', color: 'bg-purple-100 text-purple-700' },
  meeting_scheduled: { label: 'موعد معاينة', color: 'bg-amber-100 text-amber-700' },
  proposal_sent: { label: 'تم إرسال عرض', color: 'bg-indigo-100 text-indigo-700' },
  negotiation: { label: 'مفاوضات', color: 'bg-orange-100 text-orange-700' },
  contracted: { label: 'تم التعاقد', color: 'bg-green-100 text-green-700' },
  lost: { label: 'لم يتم الاتفاق', color: 'bg-gray-100 text-gray-500' },
};

interface Transaction {
    date: string;
    type: 'invoice' | 'receipt';
    number: string;
    description: string;
    debit: number;  // المبلغ المستحق (الفواتير)
    credit: number; // المبلغ المقبوض (السندات)
}

export const CustomerModule: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'form' | 'details' | 'statement'>('list');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'all'>('all');
  const [config, setConfig] = useState<CompanyConfig | null>(null);
  
  // Archival Data for Statement
  const [allInvoices, setAllInvoices] = useState<InvoiceData[]>([]);
  const [allReceipts, setAllReceipts] = useState<ReceiptData[]>([]);

  // Form State
  const [formData, setFormData] = useState<Customer>({
    id: '', fullName: '', phone: '', email: '', address: '', type: 'individual', status: 'new',
    vatNumber: '', nationalId: '', createdAt: '', lastContactDate: '', notes: []
  });

  // Note State
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<'note' | 'call' | 'meeting'>('note');

  // Load Data
  useEffect(() => {
    const saved = localStorage.getItem('jilco_customers');
    if (saved) try { setCustomers(JSON.parse(saved)); } catch (e) { console.error(e); }

    const savedInvoices = localStorage.getItem('jilco_invoices_archive');
    if (savedInvoices) try { setAllInvoices(JSON.parse(savedInvoices)); } catch(e) {}

    const savedReceipts = localStorage.getItem('jilco_receipts_archive');
    if (savedReceipts) try { setAllReceipts(JSON.parse(savedReceipts)); } catch(e) {}

    const savedGlobal = localStorage.getItem('jilco_quote_data');
    if (savedGlobal) try { 
        const parsed = JSON.parse(savedGlobal);
        if (parsed.config) setConfig(parsed.config);
    } catch(e) {}
  }, []);

  // Save Customers
  useEffect(() => {
    if (customers.length > 0) {
      localStorage.setItem('jilco_customers', JSON.stringify(customers));
    }
  }, [customers]);

  // --- Actions ---

  const handleCreateNew = () => {
    setFormData({
      id: `C-${Date.now()}`, fullName: '', phone: '', email: '', address: '', type: 'individual', status: 'new',
      vatNumber: '', nationalId: '', createdAt: new Date().toISOString().split('T')[0],
      lastContactDate: new Date().toISOString().split('T')[0], notes: []
    });
    setSelectedCustomer(null);
    setViewMode('form');
  };

  // Added handleViewDetails to resolve 'Cannot find name' error
  const handleViewDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setViewMode('details');
  };

  // Added handleEdit to resolve 'Cannot find name' error
  const handleEdit = (customer: Customer) => {
    setFormData(customer);
    setSelectedCustomer(customer);
    setViewMode('form');
  };

  const handleSaveCustomer = () => {
    if (!formData.fullName || !formData.phone) return alert('الاسم ورقم الهاتف حقول إلزامية');
    const finalData = { ...formData };
    if (!selectedCustomer && finalData.notes.length === 0) {
        finalData.notes.push({ id: Date.now().toString(), date: new Date().toISOString().split('T')[0], content: 'تم إنشاء ملف العميل', type: 'note' });
    }
    if (selectedCustomer) {
      setCustomers(customers.map(c => c.id === formData.id ? finalData : c));
    } else {
      setCustomers([finalData, ...customers]);
    }
    setViewMode('list');
    setSelectedCustomer(null);
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !selectedCustomer) return;
    const note: CustomerNote = { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], content: newNote, type: noteType };
    const updatedCustomer = { ...selectedCustomer, lastContactDate: new Date().toISOString().split('T')[0], notes: [note, ...selectedCustomer.notes] };
    setCustomers(customers.map(c => c.id === selectedCustomer.id ? updatedCustomer : c));
    setSelectedCustomer(updatedCustomer);
    setNewNote('');
  };

  const handleUpdateStatus = (newStatus: CustomerStatus) => {
    if (!selectedCustomer) return;
    const note: CustomerNote = { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], content: `تم تغيير الحالة من ${STATUS_LABELS[selectedCustomer.status].label} إلى ${STATUS_LABELS[newStatus].label}`, type: 'note' };
    const updatedCustomer = { ...selectedCustomer, status: newStatus, lastContactDate: new Date().toISOString().split('T')[0], notes: [note, ...selectedCustomer.notes] };
    setCustomers(customers.map(c => c.id === selectedCustomer.id ? updatedCustomer : c));
    setSelectedCustomer(updatedCustomer);
  };

  // --- Statement Generation ---
  const customerStatement = useMemo(() => {
      if (!selectedCustomer) return { transactions: [], totalDebit: 0, totalCredit: 0, balance: 0 };
      
      const invoices = allInvoices.filter(i => i.customerName === selectedCustomer.fullName).map(i => ({
          date: i.date, type: 'invoice' as const, number: i.number, description: 'فاتورة ضريبية',
          debit: i.items.reduce((s, it) => s + it.total, 0) * 1.15, credit: 0
      }));

      const receipts = allReceipts.filter(r => r.receivedFrom === selectedCustomer.fullName).map(r => ({
          date: r.date, type: 'receipt' as const, number: r.number, description: r.forReason || 'سند قبض',
          debit: 0, credit: r.amount
      }));

      const transactions: Transaction[] = [...invoices, ...receipts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const totalDebit = transactions.reduce((s, t) => s + t.debit, 0);
      const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);
      const balance = totalDebit - totalCredit;

      return { transactions, totalDebit, totalCredit, balance };
  }, [selectedCustomer, allInvoices, allReceipts]);

  // --- Views ---

  if (viewMode === 'statement' && selectedCustomer) {
      return (
          <div className="flex-1 bg-gray-200 p-8 overflow-auto flex flex-col items-center print:bg-white print:p-0 print:block">
              <div className="mb-6 flex justify-between w-[210mm] print:hidden">
                  <button onClick={() => setViewMode('details')} className="bg-white px-4 py-2 rounded-lg font-bold border border-gray-300 flex items-center gap-2"><ArrowLeft size={18}/> رجوع</button>
                  <button onClick={() => window.print()} className="bg-jilco-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Printer size={18}/> طباعة الكشف</button>
              </div>

              <div id="printable-area" className="bg-white shadow-2xl w-[210mm] min-h-[297mm] relative flex flex-col p-0 print:shadow-none print:w-full print:m-0">
                  <div className="absolute inset-3 border-[6px] border-jilco-900 pointer-events-none z-0"></div>
                  <div className="relative z-10 flex flex-col flex-1 m-[28px] bg-white">
                      <header className="px-10 py-6 border-b-2 border-jilco-100 flex justify-between items-center bg-white h-[140px] shrink-0">
                          <div className="w-1/3 text-right">
                              <h1 className="text-2xl font-black text-jilco-900 mb-0.5">{config?.headerTitle || 'جيلكو للمصاعد'}</h1>
                              <p className="text-[10px] font-bold text-gray-500">{config?.headerSubtitle || 'JILCO ELEVATORS'}</p>
                          </div>
                          <div className="w-1/3 flex justify-center">
                              {config?.logo && <img src={config.logo} className="h-28 w-auto object-contain" />}
                          </div>
                          <div className="w-1/3 text-left">
                              <h2 className="text-xl font-black text-jilco-900 border-2 border-jilco-900 px-4 py-1 inline-block rounded-lg uppercase">كشف حساب عميل</h2>
                              <p className="text-[10px] text-gray-400 font-bold mt-1">Customer Statement</p>
                          </div>
                      </header>

                      <div className="px-10 py-6 flex-1 flex flex-col">
                          <div className="grid grid-cols-2 gap-6 mb-6 bg-gray-50 p-5 rounded-xl border border-gray-200">
                              <div>
                                  <p className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-widest">بيانات العميل</p>
                                  <h3 className="text-xl font-black text-black mb-1">{selectedCustomer.fullName}</h3>
                                  <p className="text-xs font-bold text-gray-600">{selectedCustomer.phone}</p>
                                  <p className="text-xs text-gray-500 mt-1">{selectedCustomer.address}</p>
                              </div>
                              <div className="text-left flex flex-col items-end justify-center">
                                  <div className="bg-white px-6 py-3 rounded-2xl border-4 border-jilco-900 text-center shadow-lg">
                                      <p className="text-[10px] font-black text-gray-400 uppercase mb-1">الرصيد المستحق / Balance</p>
                                      <span className="text-2xl font-black text-jilco-900 font-mono">{customerStatement.balance.toLocaleString()}</span>
                                      <p className="text-[8px] text-gold-600 font-black">SAR ريال سعودي</p>
                                  </div>
                              </div>
                          </div>

                          <table className="w-full text-xs text-right border-collapse mb-8 flex-1">
                              <thead>
                                  <tr className="bg-jilco-900 text-white font-black uppercase">
                                      <th className="p-2 border border-jilco-900 w-24">التاريخ</th>
                                      <th className="p-2 border border-jilco-900 w-24">رقم المرجع</th>
                                      <th className="p-2 border border-jilco-900">البيان / الوصف</th>
                                      <th className="p-2 border border-jilco-900 w-24 text-center">مدين (+)</th>
                                      <th className="p-2 border border-jilco-900 w-24 text-center">دائن (-)</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {customerStatement.transactions.map((t, idx) => (
                                      <tr key={idx} className="border-b border-gray-200 h-10">
                                          <td className="p-2 border border-gray-100 font-mono text-gray-500">{t.date}</td>
                                          <td className="p-2 border border-gray-100 font-mono font-bold text-jilco-900">{t.number}</td>
                                          <td className="p-2 border border-gray-100 font-bold text-gray-800">{t.description}</td>
                                          <td className="p-2 border border-gray-100 text-center font-mono font-black text-red-600">{t.debit > 0 ? t.debit.toLocaleString() : '-'}</td>
                                          <td className="p-2 border border-gray-100 text-center font-mono font-black text-green-700">{t.credit > 0 ? t.credit.toLocaleString() : '-'}</td>
                                      </tr>
                                  ))}
                                  {customerStatement.transactions.length === 0 && <tr><td colSpan={5} className="p-12 text-center text-gray-300 font-bold italic">لا توجد عمليات مسجلة لهذا العميل</td></tr>}
                              </tbody>
                              <tfoot className="bg-gray-50 font-black text-sm">
                                  <tr>
                                      <td colSpan={3} className="p-3 border text-left pl-4">الإجماليات:</td>
                                      <td className="p-3 border text-center font-mono text-red-600">{customerStatement.totalDebit.toLocaleString()}</td>
                                      <td className="p-3 border text-center font-mono text-green-700">{customerStatement.totalCredit.toLocaleString()}</td>
                                  </tr>
                              </tfoot>
                          </table>
                      </div>

                      <footer className="w-full bg-jilco-900 text-white py-3 px-10 flex justify-between items-center text-[10px] font-bold h-[45px]">
                          <span>{config?.footerText || 'جيلكو للمصاعد - الإدارة المالية'}</span>
                          <span dir="ltr">www.jilco-elevators.com</span>
                      </footer>
                  </div>
              </div>
          </div>
      );
  }

  if (viewMode === 'list') {
    const filteredCustomers = customers.filter(c => {
      const matchesSearch = c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return (
      <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2"><Users className="text-gold-500" /> إدارة العملاء</h1>
              <p className="text-gray-500 text-sm mt-1">قاعدة بيانات العملاء ومتابعة الحالات</p>
            </div>
            <button onClick={handleCreateNew} className="bg-jilco-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-md"><Plus size={20} /> عميل جديد</button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center bg-gray-50">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                <input type="text" placeholder="بحث بالاسم أو رقم الهاتف..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pr-10 pl-4 py-2 border border-gray-400 rounded-lg text-sm outline-none bg-white text-black font-bold" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="p-2 border border-gray-400 rounded-lg text-sm outline-none bg-white text-black font-bold w-48">
                <option value="all">جميع الحالات</option>
                {Object.entries(STATUS_LABELS).map(([key, val]) => <option key={key} value={key}>{val.label}</option>)}
              </select>
            </div>

            <table className="w-full text-sm text-right">
              <thead className="bg-white text-gray-500 font-medium border-b border-gray-200">
                <tr><th className="p-4">الاسم</th><th className="p-4">معلومات الاتصال</th><th className="p-4">الحالة</th><th className="p-4 text-center">إجراءات</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 group transition-colors">
                    <td className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-jilco-100 text-jilco-700 flex items-center justify-center font-bold text-xs">{customer.fullName.charAt(0)}</div>
                            <div>
                                <p className="font-bold text-gray-900 cursor-pointer hover:text-jilco-600" onClick={() => handleViewDetails(customer)}>{customer.fullName}</p>
                                <p className="text-[10px] text-gray-400">{customer.type === 'individual' ? 'فرد' : 'شركة'}</p>
                            </div>
                        </div>
                    </td>
                    <td className="p-4 text-xs">
                        <p className="flex items-center gap-1 text-gray-600 font-bold"><Phone size={12}/> <span dir="ltr">{customer.phone}</span></p>
                        {customer.email && <p className="flex items-center gap-1 text-gray-500 font-bold"><Mail size={12}/> {customer.email}</p>}
                    </td>
                    <td className="p-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${STATUS_LABELS[customer.status].color}`}>{STATUS_LABELS[customer.status].label}</span></td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleViewDetails(customer)} className="p-2 text-jilco-600 hover:bg-jilco-50 rounded-full" title="عرض التفاصيل"><UserCheck size={16} /></button>
                        <button onClick={() => { setSelectedCustomer(customer); setViewMode('statement'); }} className="p-2 text-gold-600 hover:bg-gold-50 rounded-full" title="كشف الحساب"><PieChart size={16}/></button>
                        <button onClick={() => handleEdit(customer)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full"><Edit size={16} /></button>
                        <button onClick={() => { if(window.confirm('حذف العميل؟')) setCustomers(customers.filter(c => c.id !== customer.id)) }} className="p-2 text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                      </div>
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

  if (viewMode === 'details' && selectedCustomer) {
      return (
        <div className="flex-1 bg-gray-100 p-6 h-full flex flex-col animate-fade-in overflow-hidden">
            <div className="mb-6 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                     <button onClick={() => setViewMode('list')} className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 text-gray-600"><ArrowLeft size={20}/></button>
                     <div><h1 className="text-2xl font-bold text-jilco-900">{selectedCustomer.fullName}</h1><p className="text-sm text-gray-500">{selectedCustomer.phone}</p></div>
                 </div>
                 <button onClick={() => setViewMode('statement')} className="bg-jilco-900 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-black shadow-lg"><PieChart size={20}/> عرض كشف الحساب المالي</button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden pb-8">
                <div className="space-y-6 overflow-y-auto pr-1">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><DollarSign size={18} className="text-gold-600"/> ملخص مالي سريع</h3>
                        <div className="space-y-3">
                            <div className="bg-red-50 p-3 rounded-xl border border-red-100"><p className="text-[10px] text-red-800 font-bold uppercase">إجمالي الفواتير</p><p className="text-xl font-black text-red-700">{customerStatement.totalDebit.toLocaleString()} SAR</p></div>
                            <div className="bg-green-50 p-3 rounded-xl border border-green-100"><p className="text-[10px] text-green-800 font-bold uppercase">إجمالي المحصل</p><p className="text-xl font-black text-green-700">{customerStatement.totalCredit.toLocaleString()} SAR</p></div>
                            <div className="bg-jilco-900 p-3 rounded-xl"><p className="text-[10px] text-blue-100 font-bold uppercase">المتبقي (المديونية)</p><p className="text-xl font-black text-white">{customerStatement.balance.toLocaleString()} SAR</p></div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Calendar size={18} className="text-blue-600"/> حالة العميل</h3>
                        <div className="flex flex-wrap gap-2">
                             {Object.entries(STATUS_LABELS).map(([key, val]) => (
                                 <button key={key} onClick={() => handleUpdateStatus(key as CustomerStatus)} className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${selectedCustomer.status === key ? 'bg-jilco-900 text-white border-jilco-900' : 'bg-white text-gray-400 border-gray-200 hover:border-jilco-300'}`}>{val.label}</button>
                             ))}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><MessageSquare size={18} className="text-jilco-600"/> سجل المتابعة والملاحظات</h3>
                        <span className="text-xs text-gray-400 font-bold">آخر تواصل: {selectedCustomer.lastContactDate}</span>
                    </div>
                    <div className="p-4 border-b flex gap-2">
                        <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="أضف ملاحظة أو نتيجة اتصال جديدة..." className="flex-1 p-2.5 border border-gray-300 rounded-xl text-black bg-white font-bold outline-none focus:ring-2 focus:ring-jilco-500" />
                        <button onClick={handleAddNote} className="bg-jilco-900 text-white px-6 rounded-xl font-bold hover:bg-black transition-colors">إضافة</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {selectedCustomer.notes.map(note => (
                            <div key={note.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] text-gray-400 font-mono">{note.date}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${note.type === 'call' ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>{note.type}</span>
                                </div>
                                <p className="text-sm text-gray-700 font-bold leading-relaxed">{note.content}</p>
                                <button onClick={() => { if(window.confirm('حذف؟')) {
                                    const updated = {...selectedCustomer, notes: selectedCustomer.notes.filter(n => n.id !== note.id)};
                                    setCustomers(customers.map(c => c.id === selectedCustomer.id ? updated : c));
                                    setSelectedCustomer(updated);
                                }}} className="absolute top-2 left-2 text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      );
  }

  // Edit/New Form View
  if (viewMode === 'form') {
      return (
        <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full flex justify-center items-start animate-fade-in">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="p-6 bg-jilco-900 text-white flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2">{formData.id ? <Edit size={20}/> : <Plus size={20}/>} {formData.id ? 'تحديث ملف العميل' : 'تسجيل عميل جديد'}</h2>
                    <button onClick={() => setViewMode('list')} className="text-white/70 hover:text-white"><X size={24}/></button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-black text-gray-500 mb-2 uppercase">الاسم الكامل <span className="text-red-500">*</span></label>
                            <input type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-jilco-500 outline-none font-bold text-black" placeholder="اسم العميل أو الشركة" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 mb-2 uppercase">رقم الجوال <span className="text-red-500">*</span></label>
                            <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-jilco-500 outline-none font-mono font-bold text-black" dir="ltr" placeholder="05xxxxxxxx" />
                        </div>
                        <div>
                            <label className="block text-xs font-black text-gray-500 mb-2 uppercase">البريد الإلكتروني</label>
                            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-jilco-500 outline-none font-bold text-black" dir="ltr" placeholder="mail@example.com" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-black text-gray-500 mb-2 uppercase">العنوان / الموقع</label>
                            <input type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-jilco-500 outline-none font-bold text-black" placeholder="المدينة، الحي" />
                        </div>
                        <div><label className="block text-xs font-black text-gray-500 mb-2 uppercase">رقم الهوية / السجل</label><input type="text" value={formData.nationalId || ''} onChange={e => setFormData({...formData, nationalId: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl font-bold text-black" /></div>
                        <div><label className="block text-xs font-black text-gray-500 mb-2 uppercase">الرقم الضريبي</label><input type="text" value={formData.vatNumber || ''} onChange={e => setFormData({...formData, vatNumber: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl font-bold text-black" placeholder="اختياري" /></div>
                        <div className="md:col-span-2"><label className="block text-xs font-black text-gray-500 mb-2 uppercase">الحالة</label>
                            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full p-3 border border-gray-300 rounded-xl font-bold text-black bg-white outline-none">
                                {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-6 border-t">
                        <button onClick={() => setViewMode('list')} className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100">إلغاء</button>
                        <button onClick={handleSaveCustomer} className="bg-jilco-600 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-jilco-700 shadow-lg"><Save size={20}/> حفظ الملف</button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  return null;
};
