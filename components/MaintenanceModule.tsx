import React, { useState } from 'react';
import { Wrench, Calendar, FileText, AlertTriangle, Plus, Search, Filter, CheckCircle2, Factory, Trash2, Edit, Printer } from 'lucide-react';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useSales } from '../contexts/SalesContext';
import { useHR } from '../contexts/HRContext';
import { MaintenanceContract, MaintenanceTicket, TicketStatus, TicketPriority, TicketType } from '../types';

export const MaintenanceModule: React.FC = () => {
    const { contracts, tickets, addContract, updateContract, deleteContract, addTicket, updateTicket, deleteTicket } = useMaintenance();
    const { customers = [] } = useSales();
    const { hrEmployees: employees = [] } = useHR();

    const [activeTab, setActiveTab] = useState<'dashboard' | 'contracts' | 'tickets'>('dashboard');
    const [searchTerm, setSearchTerm] = useState('');
    const [printingContract, setPrintingContract] = useState<MaintenanceContract | null>(null);

    // --- Contract State ---
    const [showContractCreator, setShowContractCreator] = useState(false);
    const [currentContract, setCurrentContract] = useState<Partial<MaintenanceContract>>({
        number: `MC-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(3, '0')}`,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
        visitsPerYear: 12,
        amount: 0,
        status: 'active'
    });

    // --- Ticket State ---
    const [showTicketCreator, setShowTicketCreator] = useState(false);
    const [currentTicket, setCurrentTicket] = useState<Partial<MaintenanceTicket>>({
        number: `TKT-${new Date().getFullYear()}-${String(tickets.length + 1).padStart(3, '0')}`,
        type: 'routine',
        priority: 'medium',
        status: 'open',
        reportedDate: new Date().toISOString().split('T')[0],
    });

    // Technicians for Assignment
    const technicians = employees.filter(emp => emp.department === 'الصيانة والتركيب');

    const handleSaveContract = () => {
        if (!currentContract.customerId || !currentContract.amount) return alert('يرجى تعبئة العميل والتكلفة');
        if (currentContract.id) {
            updateContract(currentContract.id, currentContract);
        } else {
            addContract({ ...currentContract as MaintenanceContract, id: Date.now().toString() });
        }
        setShowContractCreator(false);
    };

    const handleSaveTicket = () => {
        if (!currentTicket.customerId || !currentTicket.description || !currentTicket.elevatorLocation) return alert('يرجى تعبئة العميل، الوصف، والموقع');
        if (currentTicket.id) {
            updateTicket(currentTicket.id, currentTicket);
        } else {
            addTicket({ ...currentTicket as MaintenanceTicket, id: Date.now().toString() });
        }
        setShowTicketCreator(false);
    };

    const getCustomerName = (id: string) => customers.find(c => c.id === id)?.fullName || 'عميل غير معروف';
    const getTechName = (id?: string) => technicians.find(t => t.id === id)?.name || 'غير مُعيّن';

    const renderDashboard = () => {
        const activeContractsCount = contracts.filter(c => c.status === 'active').length;
        const openTicketsCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
        const resolvedTicketsCount = tickets.filter(t => t.status === 'resolved').length;

        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-gray-500 mb-1">عقود صيانة نشطة</p>
                        <p className="text-3xl font-black text-jilco-900">{activeContractsCount}</p>
                    </div>
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600"><FileText size={28} /></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-gray-500 mb-1">تذاكر مفتوحة</p>
                        <p className="text-3xl font-black text-red-600">{openTicketsCount}</p>
                    </div>
                    <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-500"><AlertTriangle size={28} /></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-gray-500 mb-1">تم إنجازها</p>
                        <p className="text-3xl font-black text-green-600">{resolvedTicketsCount}</p>
                    </div>
                    <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-500"><CheckCircle2 size={28} /></div>
                </div>
            </div>
        );
    };

    const renderContracts = () => (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="relative w-64">
                    <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                    <input title="بحث باسم العميل او رقم العقد" type="text" placeholder="بحث باسم العميل او رقم العقد..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-jilco-500 outline-none" />
                </div>
                <button onClick={() => { setCurrentContract({ number: `MC-${new Date().getFullYear()}-${String(contracts.length + 1).padStart(3, '0')}`, startDate: new Date().toISOString().split('T')[0], endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], visitsPerYear: 12, amount: 0, status: 'active' }); setShowContractCreator(true); }} className="bg-jilco-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-jilco-700 flex items-center gap-2"><Plus size={16} /> إضافة عقد صيانة</button>
            </div>

            <table className="w-full text-sm text-right">
                <thead className="bg-gray-100 text-gray-600">
                    <tr><th className="p-4">رقم العقد</th><th className="p-4">العميل</th><th className="p-4">من - إلى</th><th className="p-4">عدد الزيارات</th><th className="p-4">القيمة (ر.س)</th><th className="p-4">الحالة</th><th className="p-4 text-center">الإجراءات</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {contracts.filter(c => c.number.includes(searchTerm) || getCustomerName(c.customerId).includes(searchTerm)).map(contract => (
                        <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 font-mono font-bold">{contract.number}</td>
                            <td className="p-4 font-bold">{getCustomerName(contract.customerId)}</td>
                            <td className="p-4 text-xs font-mono">{contract.startDate} / {contract.endDate}</td>
                            <td className="p-4 text-center font-bold">{contract.visitsPerYear}</td>
                            <td className="p-4 font-black text-green-700">{contract.amount.toLocaleString()}</td>
                            <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold ${contract.status === 'active' ? 'bg-green-100 text-green-700' : contract.status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{contract.status === 'active' ? 'ساري' : contract.status === 'expired' ? 'منتهي' : 'ملغي'}</span></td>
                            <td className="p-4 flex gap-2 justify-center">
                                <button onClick={() => { setPrintingContract(contract as MaintenanceContract); setTimeout(() => window.print(), 300); }} className="p-1.5 text-gray-600 hover:bg-gray-50 rounded" title="طباعة العقد"><Printer size={16} /></button>
                                <button onClick={() => { setCurrentContract(contract); setShowContractCreator(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="تعديل"><Edit size={16} /></button>
                                <button onClick={() => { if (window.confirm('هل أنت متأكد من حذف العقد؟')) deleteContract(contract.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="حذف"><Trash2 size={16} /></button>
                            </td>
                        </tr>
                    ))}
                    {contracts.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-400">لا توجد عقود صيانة مسجلة حالياً</td></tr>}
                </tbody>
            </table>
        </div>
    );

    const renderTickets = () => (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="relative w-64">
                    <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                    <input title="بحث التذاكر" type="text" placeholder="بحث التذاكر..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-jilco-500 outline-none" />
                </div>
                <button onClick={() => { setCurrentTicket({ number: `TKT-${new Date().getFullYear()}-${String(tickets.length + 1).padStart(3, '0')}`, type: 'routine', priority: 'medium', status: 'open', reportedDate: new Date().toISOString().split('T')[0] }); setShowTicketCreator(true); }} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-700 flex items-center gap-2"><Plus size={16} /> تذكرة صيانة/عطل</button>
            </div>

            <table className="w-full text-sm text-right">
                <thead className="bg-gray-100 text-gray-600">
                    <tr><th className="p-4 w-12 text-center">#</th><th className="p-4">رقم التذكرة</th><th className="p-4">العميل والموقع</th><th className="p-4">النوع / الأولوية</th><th className="p-4">الوصف</th><th className="p-4">الفني المُسند</th><th className="p-4 text-center">الحالة</th><th className="p-4 text-center">إجراءات</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {tickets.filter(t => t.number.includes(searchTerm) || getCustomerName(t.customerId).includes(searchTerm)).map((ticket, idx) => (
                        <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4 text-center text-gray-400 font-bold">{idx + 1}</td>
                            <td className="p-4 font-mono font-bold text-gray-700">{ticket.number}</td>
                            <td className="p-4">
                                <p className="font-bold text-black">{getCustomerName(ticket.customerId)}</p>
                                <p className="text-[10px] text-gray-500">{ticket.elevatorLocation}</p>
                            </td>
                            <td className="p-4">
                                <div className="flex flex-col gap-1 items-start">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ticket.type === 'emergency' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{ticket.type === 'emergency' ? 'عطل طارئ' : ticket.type === 'routine' ? 'صيانة دورية' : 'تركيبات'}</span>
                                    <span className={`text-[10px] uppercase font-bold ${ticket.priority === 'critical' ? 'text-red-600' : ticket.priority === 'high' ? 'text-orange-500' : 'text-gray-500'}`}>{ticket.priority === 'critical' ? 'حرج' : ticket.priority === 'high' ? 'مرتفع' : ticket.priority === 'medium' ? 'متوسط' : 'منخفض'}</span>
                                </div>
                            </td>
                            <td className="p-4 text-xs text-gray-600 max-w-[200px] truncate" title={ticket.description}>{ticket.description}</td>
                            <td className="p-4 font-bold text-jilco-800">{getTechName(ticket.technicianId)}</td>
                            <td className="p-4 text-center">
                                <select
                                    title="تحديث حالة التذكرة"
                                    value={ticket.status}
                                    onChange={(e) => updateTicket(ticket.id, { status: e.target.value as TicketStatus, resolvedDate: e.target.value === 'resolved' ? new Date().toISOString().split('T')[0] : undefined })}
                                    className={`text-xs font-bold border-none outline-none rounded p-1 cursor-pointer
                                        ${ticket.status === 'open' ? 'bg-amber-100 text-amber-700' :
                                            ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                                                ticket.status === 'resolved' ? 'bg-green-100 text-green-700' :
                                                    'bg-gray-100 text-gray-700'}`
                                    }
                                >
                                    <option value="open">مفتوحة</option>
                                    <option value="in_progress">جاري العمل</option>
                                    <option value="resolved">تم الحل</option>
                                    <option value="cancelled">ملغاة</option>
                                </select>
                            </td>
                            <td className="p-4 flex gap-2 justify-center">
                                <button title="تعديل" onClick={() => { setCurrentTicket(ticket); setShowTicketCreator(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16} /></button>
                                <button title="حذف" onClick={() => { if (window.confirm('حذف التذكرة؟')) deleteTicket(ticket.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                            </td>
                        </tr>
                    ))}
                    {tickets.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-gray-400">لا توجد تذاكر صيانة أو أعطال</td></tr>}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="flex-1 bg-gray-100 p-8 h-full overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h1 className="text-3xl font-black text-jilco-900 flex items-center gap-3">
                            <Wrench className="text-jilco-600" size={32} /> صيانة المصاعد والأعطال
                        </h1>
                        <p className="text-gray-500 text-sm mt-2">إدارة عقود الصيانة الدورية وتذاكر الأعطال للعملاء</p>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex gap-2 border-b border-gray-200 pb-4">
                    <button onClick={() => setActiveTab('dashboard')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-jilco-900 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}><Factory size={18} /> لوحة المتابعة</button>
                    <button onClick={() => setActiveTab('contracts')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'contracts' ? 'bg-jilco-900 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}><FileText size={18} /> عقود الصيانة</button>
                    <button onClick={() => setActiveTab('tickets')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'tickets' ? 'bg-jilco-900 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}><AlertTriangle size={18} /> تذاكر الأعطال</button>
                </div>

                {/* Tab Content */}
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'contracts' && renderContracts()}
                {activeTab === 'tickets' && renderTickets()}
            </div>

            {/* Contract Modal */}
            {showContractCreator && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="bg-jilco-900 p-6 flex justify-between items-center text-white">
                            <h2 className="text-xl font-bold flex items-center gap-2"><FileText /> {currentContract.id ? 'تعديل عقد' : 'إنشاء عقد صيانة جديد'}</h2>
                            <button title="إغلاق" onClick={() => setShowContractCreator(false)} className="hover:bg-white/10 p-2 rounded-full"><Plus className="rotate-45" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">العميل</label>
                                <select title="العميل" value={currentContract.customerId || ''} onChange={(e) => setCurrentContract({ ...currentContract, customerId: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-jilco-500">
                                    <option value="">-- اختر عميلاً مسجلاً --</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">رقم العقد</label><input title="رقم العقد" type="text" placeholder="رقم العقد" value={currentContract.number} onChange={e => setCurrentContract({ ...currentContract, number: e.target.value })} className="w-full p-3 border rounded-xl font-mono text-sm" /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">حالة العقد</label><select title="حالة العقد" value={currentContract.status} onChange={e => setCurrentContract({ ...currentContract, status: e.target.value as any })} className="w-full p-3 border rounded-xl text-sm font-bold"><option value="active">ساري</option><option value="expired">منتهي</option><option value="cancelled">ملغي</option></select></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">تاريخ البداية</label><input title="تاريخ البداية" type="date" placeholder="تاريخ البداية" value={currentContract.startDate} onChange={e => setCurrentContract({ ...currentContract, startDate: e.target.value })} className="w-full p-3 border rounded-xl text-sm" /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">تاريخ الانتهاء</label><input title="تاريخ الانتهاء" type="date" placeholder="تاريخ الانتهاء" value={currentContract.endDate} onChange={e => setCurrentContract({ ...currentContract, endDate: e.target.value })} className="w-full p-3 border rounded-xl text-sm" /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">عدد الزيارات السنوية (روتينية)</label><input title="عدد الزيارات السنوية" type="number" placeholder="عدد الزيارات" min="1" value={currentContract.visitsPerYear} onChange={e => setCurrentContract({ ...currentContract, visitsPerYear: parseInt(e.target.value) || 0 })} className="w-full p-3 border rounded-xl text-sm font-bold" /></div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">قيمة العقد (﷼)</label><input title="قيمة العقد" type="number" placeholder="قيمة العقد" value={currentContract.amount} onChange={e => setCurrentContract({ ...currentContract, amount: parseFloat(e.target.value) || 0 })} className="w-full p-3 border rounded-xl font-black text-green-700 text-lg" /></div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">ملاحظات العقد</label>
                                <textarea title="ملاحظات العقد" value={currentContract.notes || ''} onChange={e => setCurrentContract({ ...currentContract, notes: e.target.value })} className="w-full p-3 border rounded-xl text-sm h-24 resize-none" placeholder="اكتب أي ملاحظات أو شروط خاصة..."></textarea>
                            </div>
                            <button onClick={handleSaveContract} className="w-full bg-jilco-600 hover:bg-jilco-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95">حفظ بيانات العقد</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ticket Modal */}
            {showTicketCreator && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="bg-red-600 p-6 flex justify-between items-center text-white">
                            <h2 className="text-xl font-bold flex items-center gap-2"><AlertTriangle /> {currentTicket.id ? 'تعديل التذكرة' : 'إنشاء تذكرة صيانة/عطل'}</h2>
                            <button title="إغلاق" onClick={() => setShowTicketCreator(false)} className="hover:bg-white/10 p-2 rounded-full"><Plus className="rotate-45" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">العميل المُبلغ</label>
                                    <select title="العميل المُبلغ" value={currentTicket.customerId || ''} onChange={(e) => setCurrentTicket({ ...currentTicket, customerId: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-red-500">
                                        <option value="">-- اختر العميل --</option>
                                        {customers.map(c => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                                    </select>
                                </div>
                                <div><label className="block text-xs font-bold text-gray-700 mb-1">رقم التذكرة</label><input title="رقم التذكرة" placeholder="رقم التذكرة" type="text" value={currentTicket.number} readOnly className="w-full p-3 border bg-gray-50 rounded-xl font-mono text-sm text-gray-500" /></div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">موقع المصعد / الوحدة</label>
                                <input title="موقع المصعد / الوحدة" type="text" value={currentTicket.elevatorLocation || ''} onChange={e => setCurrentTicket({ ...currentTicket, elevatorLocation: e.target.value })} placeholder="مثال: فلة رقم 4، حي الياسمين، الرياض" className="w-full p-3 border rounded-xl text-sm font-bold" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">نوع الاستدعاء</label>
                                    <select title="نوع الاستدعاء" value={currentTicket.type} onChange={e => setCurrentTicket({ ...currentTicket, type: e.target.value as any })} className="w-full p-3 border rounded-xl font-bold text-sm">
                                        <option value="routine">صيانة دورية</option>
                                        <option value="emergency">عطل طارئ</option>
                                        <option value="installation">تركيب</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">الأولوية</label>
                                    <select title="الأولوية" value={currentTicket.priority} onChange={e => setCurrentTicket({ ...currentTicket, priority: e.target.value as any })} className="w-full p-3 border rounded-xl font-bold text-sm">
                                        <option value="low">منخفض</option>
                                        <option value="medium">متوسط</option>
                                        <option value="high">مرتفع</option>
                                        <option value="critical">حرج (محتجز في كابينة!)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">وصف العطل أو الطلب</label>
                                <textarea title="وصف العطل أو الطلب" value={currentTicket.description || ''} onChange={e => setCurrentTicket({ ...currentTicket, description: e.target.value })} className="w-full p-3 border rounded-xl text-sm h-20 resize-none font-bold" placeholder="اشرح المشكلة..."></textarea>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">إسناد إلى فني / فريق الصيانة (من الموارد البشرية)</label>
                                <select title="إسناد إلى فني معدات" value={currentTicket.technicianId || ''} onChange={e => setCurrentTicket({ ...currentTicket, technicianId: e.target.value })} className="w-full p-3 border rounded-xl font-bold text-sm bg-blue-50">
                                    <option value="">-- قيد الانتظار (لم يتم التعيين) --</option>
                                    {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>

                            <button onClick={handleSaveTicket} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95">تأكيد تذكرة الصيانة</button>
                        </div>
                    </div>
                </div>
            )}

            {/* قـالـب طـبـاعـة عـقـد الـصـيـانـة */}
            {printingContract && (
                <div className="hidden print:block fixed inset-0 bg-white z-[99999] overflow-visible print:static print:h-auto">
                    <div className="max-w-[210mm] min-h-[297mm] mx-auto p-12 bg-white text-right print:shadow-none print:m-0 print:w-full" dir="rtl">
                        <div className="border-b-4 border-jilco-900 pb-6 mb-8 flex justify-between items-start">
                            <div>
                                <h1 className="text-4xl font-black text-jilco-900 tracking-tight">عقد صـيـانـة مـصـاعـد</h1>
                                <p className="text-xl text-gray-600 font-bold mt-2">Maintenance Contract</p>
                            </div>
                            <div className="text-left">
                                <h2 className="text-2xl font-black text-jilco-900">شركة جيلكو للمصاعد</h2>
                                <p className="text-gray-600 font-bold mt-1">الرقم الضريبي: 311029107900003</p>
                                <p className="text-gray-500 text-sm mt-1">www.jilco.com.sa</p>
                            </div>
                        </div>

                        <div className="mb-8 grid grid-cols-2 gap-8 bg-gray-50 p-6 rounded-2xl border border-gray-200">
                            <div>
                                <p className="text-sm text-gray-500 font-bold mb-1">بيانات العقد</p>
                                <p className="font-bold text-lg text-jilco-900">رقم العقد: {printingContract.number}</p>
                                <p className="font-bold">تاريخ البداية: {printingContract.startDate}</p>
                                <p className="font-bold text-red-600">تاريخ الانتهاء: {printingContract.endDate}</p>
                                <p className="font-bold">عدد الزيارات الدورية: {printingContract.visitsPerYear} زيارات/سنوياً</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-bold mb-1">بيانات العميل (الطرف الثاني)</p>
                                <p className="font-bold text-lg text-jilco-900">{getCustomerName(printingContract.customerId)}</p>
                                {customers.find(c => c.id === printingContract.customerId)?.phone && <p className="font-bold text-right" dir="ltr">{customers.find(c => c.id === printingContract.customerId)?.phone}</p>}
                                <p className="font-bold text-gray-600">{customers.find(c => c.id === printingContract.customerId)?.address}</p>
                            </div>
                        </div>

                        <div className="space-y-6 mb-12">
                            <h3 className="text-xl font-black text-jilco-900 border-b-2 border-gray-100 pb-2">بنود وشروط العقد:</h3>
                            <div className="text-sm leading-8 text-gray-800 font-bold space-y-4">
                                <p>1. يلتزم الطرف الأول (شركة جيلكو للمصاعد) بإجراء الصيانة الوقائية الدورية للمصعد التابع للطرف الثاني حسب عدد الزيارات المحددة أعلاه.</p>
                                <p>2. تشمل هذه الصيانة الفحص الظاهري والميكانيكي والكهربائي وتزييت وتشحيم وتنظيف الأجزاء اللازمة.</p>
                                <p>3. يلتزم الطرف الأول بتلبية استدعاءات الأعطال الطارئة في أسرع وقت ممكن خلال أوقات الدوام الرسمي، وتغطية الحالات الحرجة فوراً.</p>
                                <p>4. هذا العقد <span className="font-black text-red-600 uppercase">لا يشمل</span> قيمة قطع الغيار التالفة أو التي تحتاج للاستبدال، ويتم إصدار فاتورة مستقلة بأسعارها للطرف الثاني للموافقة عليها قبل التركيب.</p>
                                <p>5. قيمة العقد الإجمالية المتفق عليها هي: <span className="font-black text-xl bg-yellow-100 px-2 rounded">{printingContract.amount.toLocaleString()} ريال سعودي</span> (غير شاملة ضريبة القيمة المضافة إن وجدت).</p>
                                {printingContract.notes && (
                                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                        <p className="font-black text-blue-900 mb-2">شروط إضافية خاصة:</p>
                                        <p className="whitespace-pre-wrap">{printingContract.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-16 mt-20 print:break-inside-avoid">
                            <div className="text-center">
                                <p className="font-black text-lg text-jilco-900 mb-12">الطرف الأول (الشركة)</p>
                                <div className="border-b-2 border-dashed border-gray-300 w-48 mx-auto mb-2"></div>
                                <p className="text-sm text-gray-500 font-bold">التوقيع والختم</p>
                            </div>
                            <div className="text-center">
                                <p className="font-black text-lg text-jilco-900 mb-12">الطرف الثاني (العميل)</p>
                                <div className="border-b-2 border-dashed border-gray-300 w-48 mx-auto mb-2"></div>
                                <p className="text-sm text-gray-500 font-bold">{getCustomerName(printingContract.customerId)}</p>
                            </div>
                        </div>

                        <div className="mt-20 text-center border-t border-gray-200 pt-6 text-sm text-gray-500 font-bold flex justify-between">
                            <span>طُبع بواسطة نظام جيلكو الإلكتروني</span>
                            <span>التاريخ: {new Date().toLocaleDateString('ar-SA')}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
