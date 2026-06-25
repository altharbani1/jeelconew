import React, { useState } from 'react';
import { Wrench, Calendar, FileText, AlertTriangle, Plus, Search, Filter, CheckCircle2, Factory, Trash2, Edit, Printer } from 'lucide-react';
import { useMaintenance } from '../contexts/MaintenanceContext';
import { useSales } from '../contexts/SalesContext';
import { useHR } from '../contexts/HRContext';
import { MaintenanceContract, MaintenanceTicket, TicketStatus, TicketPriority, TicketType } from '../types';

export const MaintenanceModule: React.FC = () => {
    const { contracts, tickets, visits, addContract, updateContract, deleteContract, addTicket, updateTicket, deleteTicket, updateVisit } = useMaintenance();
    const { customers = [] } = useSales();
    const { hrEmployees: employees = [] } = useHR();

    const [activeTab, setActiveTab] = useState<'dashboard' | 'contracts' | 'tickets'>('dashboard');
    const [searchTerm, setSearchTerm] = useState('');
    const handlePrintContract = (contract: MaintenanceContract) => {
        const customer = customers.find(c => c.id === contract.customerId);
        const customerName = customer?.fullName || 'عميل غير معروف';
        const customerPhone = customer?.phone || '';
        const customerAddress = customer?.address || '';
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (!printWindow) return alert('يرجى السماح بالنوافذ المنبثقة لإتمام الطباعة');
        const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>عقد صيانة - ${contract.number}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; background: #fff; color: #111; direction: rtl; }
    .page { max-width: 210mm; min-height: 297mm; margin: 0 auto; padding: 40px 50px; }
    .header { border-bottom: 4px solid #1a3c5e; padding-bottom: 24px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-start; }
    .header h1 { font-size: 32px; font-weight: 900; color: #1a3c5e; }
    .header .subtitle { font-size: 18px; color: #555; font-weight: 700; margin-top: 6px; }
    .company-info { text-align: left; }
    .company-info h2 { font-size: 22px; font-weight: 900; color: #1a3c5e; }
    .company-info p { color: #555; font-weight: 700; margin-top: 4px; font-size: 13px; }
    .info-box { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; background: #f7f8fa; padding: 24px; border-radius: 12px; border: 1px solid #e2e6ea; margin-bottom: 32px; }
    .info-box .label { font-size: 12px; color: #888; font-weight: 700; margin-bottom: 6px; }
    .info-box p { font-weight: 700; font-size: 14px; margin-bottom: 4px; }
    .info-box .contract-num { font-size: 18px; color: #1a3c5e; font-weight: 900; }
    .info-box .end-date { color: #c0392b; }
    .info-box .cust-name { font-size: 18px; color: #1a3c5e; font-weight: 900; }
    h3.section-title { font-size: 18px; font-weight: 900; color: #1a3c5e; border-bottom: 2px solid #e8eaed; padding-bottom: 8px; margin-bottom: 16px; }
    .terms p { font-size: 13px; line-height: 2; font-weight: 700; color: #333; margin-bottom: 8px; }
    .terms .highlight { font-weight: 900; font-size: 17px; background: #fef3c7; padding: 2px 6px; border-radius: 4px; }
    .terms .no-include { font-weight: 900; color: #c0392b; text-transform: uppercase; }
    .notes-box { margin-top: 16px; padding: 16px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; }
    .notes-box .notes-title { font-weight: 900; color: #1e3a8a; margin-bottom: 8px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; margin-top: 80px; page-break-inside: avoid; }
    .sig-block { text-align: center; }
    .sig-block .sig-title { font-weight: 900; font-size: 16px; color: #1a3c5e; margin-bottom: 48px; }
    .sig-line { border-bottom: 2px dashed #bbb; width: 180px; margin: 0 auto 8px; }
    .sig-block .sig-name { font-size: 12px; color: #777; font-weight: 700; }
    .footer { margin-top: 60px; border-top: 1px solid #ddd; padding-top: 16px; display: flex; justify-content: space-between; font-size: 12px; color: #999; font-weight: 700; }
    .sig-line-container { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px; }
    .official-stamp { position: absolute; top: -60px; left: 50%; transform: translateX(-50%); opacity: 0.85; pointer-events: none; mix-blend-mode: multiply; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { margin: 0; padding: 30px 40px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <h1>عقد صـيـانـة مـصـاعـد</h1>
      <p class="subtitle">Maintenance Contract</p>
    </div>
    <div class="company-info">
      <h2>شركة جيلكو للمصاعد</h2>
      <p>الرقم الضريبي: 311029107900003</p>
      <p>www.jilco.com.sa</p>
    </div>
  </div>

  <div class="info-box">
    <div>
      <p class="label">بيانات العقد</p>
      <p class="contract-num">رقم العقد: ${contract.number}</p>
      <p>تاريخ البداية: ${contract.startDate}</p>
      <p class="end-date">تاريخ الانتهاء: ${contract.endDate}</p>
      <p>عدد الزيارات الدورية: ${contract.visitsPerYear} زيارات/سنوياً</p>
    </div>
    <div>
      <p class="label">بيانات العميل (الطرف الثاني)</p>
      <p class="cust-name">${customerName}</p>
      ${customerPhone ? `<p dir="ltr" style="text-align:right">${customerPhone}</p>` : ''}
      <p style="color:#555">${customerAddress}</p>
    </div>
  </div>

  <h3 class="section-title">بنود وشروط العقد:</h3>
  <div class="terms">
    <p>1. يلتزم الطرف الأول (شركة جيلكو للمصاعد) بإجراء الصيانة الوقائية الدورية للمصعد التابع للطرف الثاني حسب عدد الزيارات المحددة أعلاه.</p>
    <p>2. تشمل هذه الصيانة الفحص الظاهري والميكانيكي والكهربائي وتزييت وتشحيم وتنظيف الأجزاء اللازمة.</p>
    <p>3. يلتزم الطرف الأول بتلبية استدعاءات الأعطال الطارئة في أسرع وقت ممكن خلال أوقات الدوام الرسمي، وتغطية الحالات الحرجة فوراً.</p>
    <p>4. هذا العقد <span class="no-include">لا يشمل</span> قيمة قطع الغيار التالفة أو التي تحتاج للاستبدال، ويتم إصدار فاتورة مستقلة بأسعارها للطرف الثاني للموافقة عليها قبل التركيب.</p>
    <p>5. قيمة العقد الإجمالية المتفق عليها هي: <span class="highlight">${contract.amount.toLocaleString('ar-SA')} ريال سعودي</span> (غير شاملة ضريبة القيمة المضافة إن وجدت).</p>
    ${contract.notes ? `
    <div class="notes-box">
      <p class="notes-title">شروط إضافية خاصة:</p>
      <p style="white-space: pre-wrap; font-size:13px;">${contract.notes}</p>
    </div>` : ''}
  </div>

  <div class="signatures">
    <div class="sig-block">
      <p class="sig-title">الطرف الأول (الشركة)</p>
      <div class="sig-line-container">
        <!-- SVG Stamp -->
        <svg class="official-stamp" width="120" height="120" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r="65" stroke="#1a3c5e" stroke-width="3" fill="none" />
          <circle cx="70" cy="70" r="55" stroke="#1a3c5e" stroke-width="1" fill="none" stroke-dasharray="4 4" />
          <path id="curve" d="M 20 70 A 50 50 0 0 1 120 70" fill="transparent" />
          <text>
            <textPath href="#curve" startOffset="50%" text-anchor="middle" font-family="Cairo" font-weight="900" font-size="14" fill="#1a3c5e">شركة جيلكو للمصاعد</textPath>
          </text>
          <path id="curve-bottom" d="M 120 70 A 50 50 0 0 1 20 70" fill="transparent" />
          <text>
            <textPath href="#curve-bottom" startOffset="50%" text-anchor="middle" font-family="Cairo" font-weight="700" font-size="12" fill="#1a3c5e">JILCO ELEVATORS</textPath>
          </text>
          <rect x="25" y="60" width="90" height="20" fill="none" stroke="#c0392b" stroke-width="2" transform="rotate(-15 70 70)"/>
          <text x="70" y="75" font-family="Cairo" font-weight="900" font-size="14" fill="#c0392b" text-anchor="middle" transform="rotate(-15 70 70)">مُعتمد - APPROVED</text>
        </svg>
        <div class="sig-line"></div>
      </div>
      <p class="sig-name">التوقيع والختم</p>
    </div>
    <div class="sig-block">
      <p class="sig-title">الطرف الثاني (العميل)</p>
      <div class="sig-line-container">
        <div class="sig-line"></div>
      </div>
      <p class="sig-name">${customerName}</p>
    </div>
  </div>

  <div class="footer">
    <span>طُبع بواسطة نظام جيلكو الإلكتروني</span>
    <span>التاريخ: ${new Date().toLocaleDateString('ar-SA')}</span>
  </div>
</div>
<script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    // --- Contract State ---
    const [showContractCreator, setShowContractCreator] = useState(false);
    const [selectedContractForVisits, setSelectedContractForVisits] = useState<string | null>(null);
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
                                <button onClick={() => setSelectedContractForVisits(contract.id)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="جدول الزيارات"><Calendar size={16} /></button>
                                <button onClick={() => handlePrintContract(contract as MaintenanceContract)} className="p-1.5 text-gray-600 hover:bg-gray-50 rounded" title="طباعة العقد"><Printer size={16} /></button>
                                <button onClick={() => { setCurrentContract(contract); setShowContractCreator(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="تعديل"><Edit size={16} /></button>
                                <button onClick={() => { if (window.confirm('هل أنت متأكد من حذف العقد وجميع زياراته؟')) deleteContract(contract.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="حذف"><Trash2 size={16} /></button>
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
        <div className="flex-1 bg-gray-100 p-8 h-full overflow-auto print:block print:bg-white print:p-0 print:overflow-visible print:absolute print:inset-0 print:z-50 print:h-auto">
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

            {/* Visits Schedule Modal */}
            {selectedContractForVisits && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                        <div className="bg-purple-700 p-6 flex justify-between items-center text-white shrink-0">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2"><Calendar /> جدول الزيارات الدورية</h2>
                                <p className="text-purple-200 text-sm mt-1">عقد رقم: {contracts.find(c => c.id === selectedContractForVisits)?.number}</p>
                            </div>
                            <button title="إغلاق" onClick={() => setSelectedContractForVisits(null)} className="hover:bg-white/10 p-2 rounded-full"><Plus className="rotate-45" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                            {visits.filter(v => v.contractId === selectedContractForVisits).length === 0 ? (
                                <div className="text-center py-12 text-gray-400 font-bold">لا توجد زيارات مجدولة لهذا العقد. (تم إنشاء العقد قبل تحديث النظام)</div>
                            ) : (
                                <div className="space-y-4">
                                    {visits.filter(v => v.contractId === selectedContractForVisits).sort((a,b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()).map((visit, index) => (
                                        <div key={visit.id} className={`bg-white p-4 rounded-xl border flex items-center gap-4 shadow-sm transition-all ${visit.status === 'completed' ? 'border-green-200 opacity-70' : visit.status === 'missed' ? 'border-red-200 bg-red-50' : 'border-gray-200 hover:border-purple-300'}`}>
                                            <div className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-black text-lg ${visit.status === 'completed' ? 'bg-green-100 text-green-600' : visit.status === 'missed' ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'}`}>
                                                {index + 1}
                                            </div>
                                            <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                                                <div>
                                                    <p className="text-xs text-gray-500 font-bold mb-1">تاريخ الزيارة المجدول</p>
                                                    <p className="font-mono font-bold text-jilco-900">{visit.scheduledDate}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 font-bold mb-1">الفني</p>
                                                    <select title="الفني" value={visit.technicianId || ''} onChange={e => updateVisit(visit.id, { technicianId: e.target.value })} className="w-full text-xs font-bold border-gray-200 rounded p-1 outline-none">
                                                        <option value="">-- لم يعين --</option>
                                                        {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 font-bold mb-1">تاريخ التنفيذ</p>
                                                    <input title="تاريخ التنفيذ الفعلي" type="date" value={visit.completedDate || ''} onChange={e => updateVisit(visit.id, { completedDate: e.target.value })} className="w-full text-xs font-bold border-gray-200 rounded p-1 outline-none" disabled={visit.status !== 'completed'} />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 font-bold mb-1">الحالة</p>
                                                    <select title="الحالة" value={visit.status} onChange={e => updateVisit(visit.id, { status: e.target.value as any, completedDate: e.target.value === 'completed' ? new Date().toISOString().split('T')[0] : visit.completedDate })} className={`w-full text-xs font-bold border-none outline-none rounded p-1 cursor-pointer ${visit.status === 'completed' ? 'bg-green-100 text-green-700' : visit.status === 'missed' ? 'bg-red-100 text-red-700' : visit.status === 'rescheduled' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
                                                        <option value="pending">مجدولة</option>
                                                        <option value="completed">مكتملة</option>
                                                        <option value="missed">فائتة</option>
                                                        <option value="rescheduled">مؤجلة</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="w-48 shrink-0">
                                                <input title="ملاحظات" type="text" placeholder="ملاحظات الزيارة..." value={visit.notes || ''} onChange={e => updateVisit(visit.id, { notes: e.target.value })} className="w-full text-xs border border-gray-200 rounded-lg p-2 outline-none focus:border-purple-400" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
