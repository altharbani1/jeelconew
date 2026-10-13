import React from 'react';
import { ChevronDown, FileText, FolderOpen } from 'lucide-react';
import { Subcontract } from '../types';

const statuses = {
  draft: { label: 'مسودة', style: 'bg-slate-100 text-slate-600 border-slate-200' },
  active: { label: 'قيد التنفيذ', style: 'bg-blue-50 text-blue-700 border-blue-100' },
  completed: { label: 'مكتمل', style: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  cancelled: { label: 'ملغي', style: 'bg-red-50 text-red-700 border-red-100' }
};
export function SubcontractRegister({ contracts, selectedId, onSelect }: {
  contracts: Subcontract[]; selectedId: string | null; onSelect: (id: string | null) => void;
}) {
  const money = (value: number) => Number(value || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 });
  const paid = (c: Subcontract) => (c.payments || []).filter(p => p.status === 'paid').reduce((sum,p) => sum + Number(p.amount),0);
  return <section className="rounded-xl border border-slate-200 bg-white overflow-hidden" aria-label="جدول عقود الباطن">
    <div className="flex flex-wrap justify-between items-center gap-2 px-5 py-4 border-b border-slate-100">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><FileText size={17} /> العقود والالتزامات</div>
      <span className="text-xs text-slate-500">القيم بالريال السعودي · افتح العقد لإدارة المستخلصات والمرفقات</span>
    </div>
    <div className="hidden md:block overflow-x-auto"><table className="w-full min-w-[980px] text-sm text-right">
      <thead className="bg-slate-50 text-xs text-slate-500"><tr>{['العقد / المشروع','المقاول','الحالة','قيمة العقد','مستخلصات مسددة','الإنجاز','نهاية العقد','التفاصيل'].map(h => <th key={h} className="p-4 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{contracts.map(c => {
        const status = statuses[c.status] || statuses.draft;
        const progress = Math.min(100,Math.max(0,Number(c.progressPercentage || 0)));
        return <tr key={c.id} className={selectedId === c.id ? 'bg-blue-50/50' : 'hover:bg-slate-50'}>
          <td className="p-4"><span className="block font-semibold text-jilco-900" dir="ltr">{c.number}</span><span className="block text-xs text-slate-500 mt-1">{c.projectName || '—'}</span></td>
          <td className="p-4 font-medium text-slate-700">{c.subcontractorName}</td>
          <td className="p-4"><span className={'border rounded-md px-2 py-1 text-xs whitespace-nowrap '+status.style}>{status.label}</span></td>
          <td className="p-4 tabular-nums font-semibold whitespace-nowrap">{money(c.totalAmount)}</td>
          <td className="p-4 tabular-nums text-slate-600 whitespace-nowrap">{money(paid(c))}</td>
          <td className="p-4 min-w-[110px]"><div className="text-xs tabular-nums mb-1">{progress}%</div><div role="progressbar" aria-label={'إنجاز العقد '+c.number} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-jilco-700" style={{width:progress+'%'}} /></div></td>
          <td className="p-4 text-xs tabular-nums whitespace-nowrap" dir="ltr">{c.endDate || '—'}</td>
          <td className="p-4"><button aria-expanded={selectedId === c.id} aria-controls="subcontract-detail" onClick={() => onSelect(selectedId === c.id ? null : c.id)} className="inline-flex gap-1 items-center border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-jilco-900 hover:bg-white focus-visible:ring-2 focus-visible:ring-jilco-500">{selectedId === c.id ? 'إغلاق' : 'فتح العقد'}<ChevronDown size={14}/></button></td>
        </tr>;
      })}</tbody>
    </table></div>
    <div className="md:hidden divide-y divide-slate-100">{contracts.map(c => <div key={c.id} className="p-4 space-y-3">
      <div className="flex justify-between gap-3"><span className="font-semibold text-jilco-900" dir="ltr">{c.number}</span><span className={'border rounded-md px-2 py-1 text-xs '+(statuses[c.status] || statuses.draft).style}>{(statuses[c.status] || statuses.draft).label}</span></div>
      <p className="text-sm">{c.subcontractorName} <span className="text-slate-500">· {c.projectName}</span></p>
      <div className="flex justify-between text-xs text-slate-500"><span>القيمة <b className="text-slate-800">{money(c.totalAmount)}</b></span><span>الإنجاز {Math.min(100,Math.max(0,c.progressPercentage || 0))}%</span></div>
      <button aria-expanded={selectedId === c.id} onClick={() => onSelect(selectedId === c.id ? null : c.id)} className="w-full border rounded-lg py-2 text-sm text-jilco-900">{selectedId === c.id ? 'إغلاق التفاصيل' : 'فتح تفاصيل العقد'}</button>
    </div>)}</div>
    {!contracts.length && <div className="py-12 text-center"><FolderOpen size={32} className="mx-auto text-slate-300 mb-3"/><p className="font-semibold text-slate-600">لا توجد عقود مطابقة</p><p className="mt-1 text-xs text-slate-500">غيّر البحث أو حالة العقد لعرض النتائج.</p></div>}
    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">{contracts.length} عقد · إجمالي قيمة العقود الظاهرة: <span className="font-semibold text-slate-700">{money(contracts.reduce((sum,c) => sum+Number(c.totalAmount || 0),0))}</span> ر.س</div>
  </section>;
}
