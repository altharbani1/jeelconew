import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, FileText, Printer, Search, X } from 'lucide-react';
import { Subcontract, SubcontractAccountEntry, Subcontractor } from '../types';
import { subcontractService } from '../services/subcontractService';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';

type Bucket = 'payable' | 'advance' | 'retention';
const buckets: Bucket[] = ['payable', 'advance', 'retention'];
const bucketLabels: Record<Bucket, string> = { payable: 'ذمم مستحقة للمقاول', advance: 'دفعات مقدمة غير مستردة', retention: 'استبقاء محتجز' };
const rowLabels: Record<SubcontractAccountEntry['type'], string> = { certificate: 'مستخلص', payment: 'سداد', voucher: 'سند صرف', deduction: 'خصم', contract: 'عقد' };

export function SubcontractStatement({ contractor, contracts, onClose }: { contractor: Subcontractor; contracts: Subcontract[]; onClose: () => void }) {
  const { user } = useSupabaseAuth();
  const [rows, setRows] = useState<SubcontractAccountEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    const linkedContracts = contracts.filter(contract => contract.subcontractorId === contractor.id);
    if (!user?.company_id) { setLoading(false); setError('لا توجد شركة مرتبطة بالمستخدم الحالي.'); return; }
    setLoading(true); setError('');
    void Promise.all(linkedContracts.map(async contract => {
      const entries = await subcontractService.accountStatement(user.company_id!, contract.id);
      return entries.map(entry => ({ ...entry, contractNumber: contract.number, projectName: contract.projectName || '—' }));
    })).then(results => {
      if (cancelled) return;
      setRows(results.flat().sort((a, b) => a.date.localeCompare(b.date) || a.contractNumber!.localeCompare(b.contractNumber!) || a.number.localeCompare(b.number)));
    }).catch(e => { if (!cancelled) setError(e.message || 'تعذر تحميل كشف الحساب'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contractor.id, contracts, user?.company_id]);

  const format = (value: number) => Number(value || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateLabel = (date: string) => date ? new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium', timeZone: 'Asia/Riyadh' }).format(new Date(`${date}T12:00:00`)) : '—';
  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate);

  const statement = useMemo(() => {
    const balance = (): Record<Bucket, number> => ({ payable: 0, advance: 0, retention: 0 });
    const opening = balance();
    const inRange = rows.filter(row => {
      if (fromDate && row.date < fromDate) { opening[row.bucket || 'payable'] += row.debit - row.credit; return false; }
      return (!fromDate || row.date >= fromDate) && (!toDate || row.date <= toDate);
    });
    const running = { ...opening };
    const periodRows = inRange.map(row => {
      const bucket = row.bucket || 'payable';
      running[bucket] += row.debit - row.credit;
      return { ...row, bucket, balance: running[bucket] };
    });
    const closing = { ...running };
    const search = query.trim().toLocaleLowerCase('ar');
    const visibleRows = search ? periodRows.filter(row => [row.contractNumber, row.projectName, row.number, row.description, rowLabels[row.type], bucketLabels[row.bucket]].some(value => value?.toLocaleLowerCase('ar').includes(search))) : periodRows;
    return { opening, closing, periodRows, visibleRows };
  }, [rows, fromDate, toDate, query]);

  const printStatement = () => { if (!loading && !error && !invalidRange) window.print(); };
  return <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/60 p-2 sm:p-5 print:static print:overflow-visible print:bg-white print:p-0" dir="rtl">
    <style>{`@page { size: A4 landscape; margin: 11mm; } @media print { body { background: #fff !important; } .statement-screen { max-width: none !important; margin: 0 !important; } .statement-paper { box-shadow: none !important; border: 0 !important; border-radius: 0 !important; padding: 0 !important; } .statement-table { min-width: 0 !important; } .statement-table thead { display: table-header-group; } .statement-table tr { break-inside: avoid; } .statement-footer { break-inside: avoid; } }`}</style>
    <div className="statement-screen mx-auto max-w-7xl space-y-4">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white p-4 shadow-xl sm:p-5">
        <div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-xl bg-jilco-900 text-white"><FileText size={23} /></div><div><p className="text-xs font-bold text-jilco-700">جيلكو للمصاعد · الحسابات</p><h2 className="text-lg font-black text-slate-950 sm:text-xl">كشف حساب مقاول الباطن</h2><p className="text-xs text-slate-500">مراجعة الذمم والدفعات المقدمة والاستبقاء حسب فترة محددة</p></div></div>
        <div className="flex gap-2"><button onClick={printStatement} disabled={loading || !!error || invalidRange} className="inline-flex items-center gap-2 rounded-xl bg-jilco-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-jilco-800 disabled:cursor-not-allowed disabled:opacity-50"><Printer size={17} /> طباعة كشف A4</button><button onClick={onClose} aria-label="إغلاق" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"><X size={19} /></button></div>
      </div>

      <section className="statement-paper rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-jilco-900 pb-5">
          <div className="flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-jilco-900 text-xl font-black text-white">J</div><div><h1 className="text-2xl font-black tracking-tight text-jilco-950">جيلكو للمصاعد</h1><p className="mt-1 text-xs font-bold text-slate-500">إدارة عقود ومقاولي الباطن · كشف حساب تفصيلي</p></div></div>
          <div className="min-w-52 text-left"><div className="inline-flex items-center gap-2 rounded-lg bg-jilco-50 px-3 py-1.5 text-xs font-black text-jilco-900"><FileText size={15} /> بيان مالي</div><p className="mt-2 text-xs text-slate-500">تاريخ الإصدار: {new Intl.DateTimeFormat('ar-SA', { dateStyle: 'full', timeZone: 'Asia/Riyadh' }).format(new Date())}</p><p className="mt-1 font-mono text-xs text-slate-500">{fromDate || toDate ? `${dateLabel(fromDate)} — ${dateLabel(toDate)}` : 'كافة الحركات المسجلة'}</p></div>
        </header>

        <div className="my-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-[11px] font-bold text-slate-500">اسم المقاول</p><p className="mt-1 text-base font-black text-slate-950">{contractor.name}</p></div>
          <div><p className="text-[11px] font-bold text-slate-500">الهاتف</p><p className="mt-1 font-bold text-slate-800" dir="ltr">{contractor.phone || '—'}</p></div>
          <div><p className="text-[11px] font-bold text-slate-500">الرقم الضريبي / الهوية</p><p className="mt-1 font-mono font-bold text-slate-800">{contractor.vatNumber || '—'}</p></div>
          <div><p className="text-[11px] font-bold text-slate-500">العقود المرتبطة</p><p className="mt-1 font-bold text-slate-800">{contracts.filter(contract => contract.subcontractorId === contractor.id).length} عقد</p></div>
        </div>

        <div className="print:hidden mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-3 sm:p-4">
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-bold text-slate-600"><span className="inline-flex items-center gap-1"><CalendarDays size={14} /> من تاريخ</span><input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900" /></label>
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-bold text-slate-600"><span className="inline-flex items-center gap-1"><CalendarDays size={14} /> إلى تاريخ</span><input type="date" value={toDate} onChange={event => setToDate(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900" /></label>
          <label className="relative min-w-52 flex-[2] text-xs font-bold text-slate-600"><span className="mb-1 block">بحث في الحركة</span><Search size={16} className="absolute right-3 top-9 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="رقم المستخلص، العقد، المشروع أو البيان" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-9 pl-3 text-sm text-slate-900" /></label>
          <button onClick={() => { setFromDate(''); setToDate(''); setQuery(''); }} className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">إعادة ضبط</button>
          {invalidRange && <p role="alert" className="w-full text-xs font-bold text-red-700">تاريخ البداية يجب أن يسبق تاريخ النهاية.</p>}
        </div>

        {loading ? <div className="rounded-xl bg-slate-50 p-12 text-center font-bold text-slate-500">جارٍ تحميل كشف الحساب…</div> : error ? <div role="alert" className="rounded-xl bg-red-50 p-5 font-bold text-red-700">{error}</div> : <>
          <div className="mb-2 flex items-center justify-between"><h3 className="font-black text-slate-900">ملخص الأرصدة</h3><span className="text-xs text-slate-500">{statement.periodRows.length} حركة ضمن الفترة</span></div>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {buckets.map(bucket => <article key={bucket} className={`rounded-xl border p-4 ${bucket === 'payable' ? 'border-rose-200 bg-rose-50/70' : bucket === 'advance' ? 'border-blue-200 bg-blue-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
              <p className="text-xs font-bold text-slate-600">{bucketLabels[bucket]}</p><p className="mt-2 text-2xl font-black tabular-nums text-slate-950">{format(statement.closing[bucket])} <span className="text-xs">ر.س</span></p><p className="mt-1 text-[11px] text-slate-500">رصيد ختامي · افتتاحي {format(statement.opening[bucket])} ر.س</p>
            </article>)}
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-slate-900">تفاصيل الحركات</h3><p className="text-[11px] text-slate-500">الأرصدة محسوبة لكل حساب فرعي على حدة</p></div>
          <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="statement-table w-full min-w-[1050px] border-collapse text-right text-xs sm:text-sm">
            <thead className="bg-jilco-900 text-white"><tr>{['التاريخ','رقم العقد / المشروع','المرجع','البيان والتفاصيل','الحساب','مدين','دائن','الرصيد'].map(label => <th key={label} className="whitespace-nowrap border-b border-jilco-700 px-3 py-3 font-black">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {statement.visibleRows.map(row => <tr key={`${row.type}-${row.referenceId}`} className="align-top odd:bg-white even:bg-slate-50/70">
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">{dateLabel(row.date)}</td>
                <td className="px-3 py-3"><b className="block font-mono text-jilco-900">{row.contractNumber || '—'}</b><span className="mt-1 block max-w-44 text-[10px] text-slate-500">{row.projectName || '—'}</span></td>
                <td className="px-3 py-3 font-mono font-bold text-slate-700">{row.number}</td>
                <td className="min-w-64 px-3 py-3"><b className="block text-slate-800">{row.description}</b>{row.certificateBreakdown && <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-slate-100 p-2 text-[10px] text-slate-600"><span>أعمال: {format(row.certificateBreakdown.grossWorkValue)}</span><span>ضريبة: {format(row.certificateBreakdown.vatAmount)}</span><span>استبقاء: {format(row.certificateBreakdown.retentionAmount)}</span><span>استرداد مقدّم: {format(row.certificateBreakdown.advanceRecoveryAmount)}</span><span>خصومات: {format(row.certificateBreakdown.deductionsAmount)}</span><span className="font-black text-jilco-900">الصافي: {format(row.debit)} ر.س</span></div>}</td>
                <td className="whitespace-nowrap px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${row.bucket === 'payable' ? 'bg-rose-100 text-rose-800' : row.bucket === 'advance' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{bucketLabels[row.bucket]}</span><span className="mt-2 block text-[10px] text-slate-500">{rowLabels[row.type]}</span></td>
                <td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{row.debit ? format(row.debit) : '—'}</td><td className="whitespace-nowrap px-3 py-3 font-mono tabular-nums">{row.credit ? format(row.credit) : '—'}</td><td className="whitespace-nowrap px-3 py-3 font-mono font-black tabular-nums text-slate-900">{format(row.balance)}</td>
              </tr>)}
              {!statement.visibleRows.length && <tr><td colSpan={8} className="p-10 text-center font-bold text-slate-400">{statement.periodRows.length ? 'لا توجد حركات تطابق البحث.' : 'لا توجد حركات مالية معتمدة ضمن الفترة المحددة.'}</td></tr>}
            </tbody>
          </table></div>

          <div className="statement-footer mt-8 grid grid-cols-3 gap-5 border-t border-slate-200 pt-6 text-center text-xs font-bold text-slate-600"><div><p>إعداد الحسابات</p><div className="mx-auto mt-10 w-36 border-b border-slate-400" /></div><div><p>مراجعة الإدارة المالية</p><div className="mx-auto mt-10 w-36 border-b border-slate-400" /></div><div><p>مصادقة المقاول</p><div className="mx-auto mt-10 w-36 border-b border-slate-400" /></div></div>
          <p className="mt-5 text-center text-[10px] text-slate-400">كشف مستخرج آليًا من الحركات المعتمدة في نظام جيلكو للمصاعد · القيم بالريال السعودي</p>
        </>}
      </section>
    </div>
  </div>;
}
