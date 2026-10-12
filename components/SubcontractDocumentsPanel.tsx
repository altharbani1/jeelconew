import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, FileCheck2, FileText, Plus, Printer, Receipt, Search, X } from 'lucide-react';
import { Subcontract, Subcontractor } from '../types';
import { useSubcontract } from '../contexts/SubcontractContext';

type DocumentType = 'statement' | 'voucher' | 'work_order' | 'receiving';
type DocumentStatus = 'draft' | 'issued' | 'approved' | 'cancelled';
type DocumentRecord = {
  id: string; number: string; type: DocumentType; status: DocumentStatus;
  subcontractId?: string; subcontractorId?: string; title: string; date: string;
  amount?: number; description: string; notes?: string;
};

const labels: Record<DocumentType, string> = { statement: 'كشف حساب', voucher: 'سند صرف', work_order: 'أمر عمل', receiving: 'أمر استلام' };
const icons: Record<DocumentType, React.ReactNode> = { statement: <FileText size={17} />, voucher: <Receipt size={17} />, work_order: <ClipboardCheck size={17} />, receiving: <FileCheck2 size={17} /> };
const statusLabels: Record<DocumentStatus, string> = { draft: 'مسودة', issued: 'صادر', approved: 'معتمد', cancelled: 'ملغي' };

export const SubcontractDocumentsPanel: React.FC<{ subcontracts: Subcontract[]; subcontractors: Subcontractor[]; canManage: boolean }> = ({ subcontracts, subcontractors, canManage }) => {
  const { workOrders, receipts, vouchers, saveWorkOrder, saveReceipt, saveVoucher, getAccountStatement } = useSubcontract();
  const [records, setRecords] = useState<DocumentRecord[]>([]);
  const [typeFilter, setTypeFilter] = useState<DocumentType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [printing, setPrinting] = useState<DocumentRecord | null>(null);
  const [draft, setDraft] = useState<Partial<DocumentRecord>>({ type: 'work_order', status: 'draft', date: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    const load = async () => {
      const statementRows = (await Promise.all(subcontracts.map(async (contract) => {
        try {
          const entries = await getAccountStatement(contract.id);
          const total = entries.reduce((sum, entry) => sum + entry.debit - entry.credit, 0);
          return { id: `statement-${contract.id}`, number: `ST-${contract.number}`, type: 'statement' as const, status: 'approved' as const, subcontractId: contract.id, subcontractorId: contract.subcontractorId, title: 'كشف حساب مقاول', date: contract.date, amount: total, description: entries.map(entry => `${entry.date} — ${entry.description}: ${entry.debit - entry.credit} ر.س`).join('\n') || 'لا توجد حركة مالية بعد' };
        } catch { return null; }
      }))).filter(Boolean) as DocumentRecord[];
      const fromBackend: DocumentRecord[] = [
      ...statementRows,
      ...workOrders.map((r: any) => ({ id: r.id, number: r.number, type: 'work_order' as const, status: r.status === 'issued' ? 'issued' as const : r.status === 'cancelled' ? 'cancelled' as const : 'draft' as const, subcontractId: r.subcontractId, subcontractorId: r.subcontractorId, title: r.title, date: r.issueDate, amount: Number(r.estimatedAmount || 0), description: r.scopeOfWork, notes: r.notes })),
      ...receipts.map((r: any) => ({ id: r.id, number: r.number, type: 'receiving' as const, status: r.status === 'accepted' ? 'approved' as const : r.status === 'rejected' ? 'cancelled' as const : 'draft' as const, subcontractId: r.subcontractId, title: 'محضر استلام', date: r.receiptDate, amount: Number(r.amount || 0), description: r.description, notes: r.notes })),
      ...vouchers.map((r: any) => ({ id: r.id, number: r.number, type: 'voucher' as const, status: r.status === 'approved' || r.status === 'paid' ? 'approved' as const : r.status === 'cancelled' ? 'cancelled' as const : 'draft' as const, subcontractId: r.subcontractId, title: 'سند صرف', date: r.voucherDate, amount: Number(r.amount || 0), description: r.description }))
      ];
      setRecords(fromBackend);
    };
    void load();
  }, [workOrders, receipts, vouchers, subcontracts, getAccountStatement]);
  const selectedContract = subcontracts.find(c => c.id === draft.subcontractId);
  const filtered = useMemo(() => records.filter(r => (typeFilter === 'all' || r.type === typeFilter) && `${r.number} ${r.title} ${r.description}`.toLowerCase().includes(query.toLowerCase())), [records, typeFilter, query]);
  const createDocument = () => {
    if (!draft.title?.trim() || !draft.description?.trim()) return alert('أدخل عنوان المستند ووصفه قبل الحفظ');
    const type = (draft.type || 'work_order') as DocumentType;
    const prefix = type === 'voucher' ? 'PV' : type === 'work_order' ? 'WO' : type === 'receiving' ? 'GRN' : 'ST';
    const id = crypto.randomUUID();
    const number = `${prefix}-${new Date().getFullYear()}-${String(records.length + 1).padStart(4, '0')}`;
    const date = draft.date || new Date().toISOString().slice(0, 10);
    const common = { id, number, subcontractId: draft.subcontractId || '', subcontractorId: selectedContract?.subcontractorId || '', notes: draft.notes?.trim() };
    const action = type === 'work_order'
      ? saveWorkOrder({ ...common, title: draft.title.trim(), scopeOfWork: draft.description.trim(), status: draft.status === 'issued' ? 'issued' : 'draft', issueDate: date, estimatedAmount: Number(draft.amount || 0) })
      : type === 'receiving'
        ? saveReceipt({ ...common, receiptDate: date, description: draft.description.trim(), amount: Number(draft.amount || 0), status: draft.status === 'approved' ? 'accepted' : 'draft', type: 'work' })
        : type === 'voucher'
          ? saveVoucher({ ...common, voucherDate: date, description: draft.description.trim(), amount: Number(draft.amount || 0), status: draft.status === 'approved' ? 'approved' : 'draft', type: 'payment' })
          : Promise.resolve(true);
    void action.then(ok => { if (ok !== false) { setShowForm(false); setDraft({ type: 'work_order', status: 'draft', date: new Date().toISOString().slice(0, 10) }); } });
  };
  const contractorName = (r: DocumentRecord) => subcontractors.find(s => s.id === r.subcontractorId)?.name || subcontracts.find(c => c.id === r.subcontractId)?.subcontractorName || 'غير محدد';
  return <section className="animate-fade-in space-y-4" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
      <div><h2 className="text-lg font-black text-jilco-900">مستندات مقاول الباطن</h2><p className="text-xs text-gray-500 font-bold mt-1">كشف حساب، سندات، أوامر عمل ومحاضر استلام</p></div>
      <button disabled={!canManage} onClick={() => setShowForm(true)} className="bg-jilco-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"><Plus size={17} /> مستند جديد</button>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{(Object.keys(labels) as DocumentType[]).map(t => <button key={t} onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)} className={`bg-white p-4 rounded-xl border text-right ${typeFilter === t ? 'border-jilco-600 ring-2 ring-jilco-100' : 'border-gray-200'}`}><div className="flex items-center gap-2 text-jilco-700 font-bold">{icons[t]} {labels[t]}</div><div className="text-2xl font-black mt-2">{records.filter(r => r.type === t).length}</div></button>)}</div>
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden"><div className="p-3 border-b flex gap-2"><div className="relative flex-1"><Search size={16} className="absolute right-3 top-3 text-gray-400" /><input className="w-full border rounded-lg py-2 pr-9 pl-3 text-sm" placeholder="بحث برقم المستند أو العنوان" value={query} onChange={e => setQuery(e.target.value)} /></div><select className="border rounded-lg px-3 text-sm font-bold" value={typeFilter} onChange={e => setTypeFilter(e.target.value as DocumentType | 'all')}><option value="all">كل المستندات</option>{(Object.keys(labels) as DocumentType[]).map(t => <option key={t} value={t}>{labels[t]}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-gray-500"><tr><th className="p-3 text-right">رقم المستند</th><th className="p-3 text-right">النوع</th><th className="p-3 text-right">المقاول</th><th className="p-3 text-right">التاريخ</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-center">إجراء</th></tr></thead><tbody className="divide-y">{filtered.map(r => <tr key={r.id} className="font-bold"><td className="p-3 font-mono">{r.number}</td><td className="p-3"><span className="inline-flex items-center gap-1">{icons[r.type]} {labels[r.type]}</span></td><td className="p-3">{contractorName(r)}</td><td className="p-3 font-mono">{r.date}</td><td className="p-3"><span className={`px-2 py-1 rounded text-xs ${r.status === 'approved' ? 'bg-green-100 text-green-700' : r.status === 'issued' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{statusLabels[r.status]}</span></td><td className="p-3 text-center"><button title="طباعة" onClick={() => setPrinting(r)} className="p-2 text-jilco-700 hover:bg-jilco-50 rounded"><Printer size={17} /></button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="p-10 text-center text-gray-400 font-bold">لا توجد مستندات مسجلة</div>}</div>
    </div>
    {showForm && <div className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" dir="rtl"><div className="flex justify-between items-center border-b pb-3 mb-4"><h3 className="font-black text-lg">إصدار مستند جديد</h3><button onClick={() => setShowForm(false)}><X /></button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label className="font-bold text-sm">نوع المستند<select className="mt-1 w-full border rounded p-2" value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as DocumentType })}>{(Object.keys(labels) as DocumentType[]).map(t => <option key={t} value={t}>{labels[t]}</option>)}</select></label><label className="font-bold text-sm">العقد المرتبط<select className="mt-1 w-full border rounded p-2" value={draft.subcontractId || ''} onChange={e => setDraft({ ...draft, subcontractId: e.target.value })}><option value="">بدون عقد</option>{subcontracts.map(c => <option key={c.id} value={c.id}>{c.number} - {c.subcontractorName}</option>)}</select></label><label className="font-bold text-sm">عنوان المستند<input className="mt-1 w-full border rounded p-2" value={draft.title || ''} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="مثال: أمر عمل تركيب" /></label><label className="font-bold text-sm">التاريخ<input type="date" className="mt-1 w-full border rounded p-2" value={draft.date || ''} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label><label className="font-bold text-sm">القيمة (ر.س)<input type="number" min="0" className="mt-1 w-full border rounded p-2" value={draft.amount || ''} onChange={e => setDraft({ ...draft, amount: Number(e.target.value) })} /></label><label className="font-bold text-sm">الحالة<select className="mt-1 w-full border rounded p-2" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as DocumentStatus })}>{(Object.keys(statusLabels) as DocumentStatus[]).map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label><label className="font-bold text-sm md:col-span-2">الوصف<textarea className="mt-1 w-full border rounded p-2 min-h-24" value={draft.description || ''} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="تفاصيل الأعمال أو المواد المستلمة أو سبب الصرف" /></label><label className="font-bold text-sm md:col-span-2">ملاحظات<textarea className="mt-1 w-full border rounded p-2" value={draft.notes || ''} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></label></div><div className="flex justify-end gap-2 mt-5"><button onClick={() => setShowForm(false)} className="px-4 py-2 rounded border font-bold">إلغاء</button><button onClick={createDocument} className="px-5 py-2 rounded bg-jilco-900 text-white font-bold">حفظ المستند</button></div></div></div>}
    {printing && <div className="fixed inset-0 z-[1100] bg-white overflow-y-auto print:!absolute print:!inset-0"><div className="max-w-[210mm] min-h-[297mm] mx-auto p-12 relative bg-white print:p-10"><div className="flex justify-between border-b-2 border-jilco-900 pb-4 mb-8"><div><h1 className="text-2xl font-black text-jilco-900">جيلكو للمصاعد</h1><p className="text-xs font-bold text-gray-500">إدارة عقود ومقاولي الباطن</p></div><div className="text-left"><h2 className="text-xl font-black">{labels[printing.type]}</h2><p className="font-mono">{printing.number}</p></div></div><div className="grid grid-cols-2 gap-4 border rounded-lg p-5 mb-6"><div><b>المقاول:</b> {contractorName(printing)}</div><div><b>التاريخ:</b> {printing.date}</div><div><b>الحالة:</b> {statusLabels[printing.status]}</div><div><b>القيمة:</b> {Number(printing.amount || 0).toLocaleString('ar-SA')} ر.س</div></div><h3 className="font-black text-lg border-b pb-2 mb-3">{printing.title}</h3><div className="min-h-48 whitespace-pre-wrap leading-8 border rounded-lg p-5">{printing.description}</div>{printing.notes && <div className="mt-5 border rounded p-4"><b>ملاحظات:</b><p className="mt-2 whitespace-pre-wrap">{printing.notes}</p></div>}<div className="grid grid-cols-3 gap-8 text-center mt-28"><div className="border-t pt-2">إعداد</div><div className="border-t pt-2">اعتماد الإدارة</div><div className="border-t pt-2">توقيع المقاول</div></div><div className="print:hidden fixed top-4 left-4 flex gap-2"><button onClick={() => window.print()} className="bg-jilco-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Printer size={17} /> طباعة A4</button><button onClick={() => setPrinting(null)} className="bg-gray-100 p-2 rounded-lg"><X /></button></div></div></div>}
  </section>;
};
