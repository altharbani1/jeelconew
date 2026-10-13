import React, { useEffect, useState } from 'react';
import { Subcontract, SubcontractAccountEntry, Subcontractor } from '../types';
import { subcontractService } from '../services/subcontractService';
import { useSupabaseAuth } from '../contexts/SupabaseAuthContext';

export function SubcontractStatement({ contractor, contracts, onClose }: { contractor: Subcontractor; contracts: Subcontract[]; onClose: () => void }) {
  const { user } = useSupabaseAuth();
  const [rows, setRows] = useState<SubcontractAccountEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    if (!user?.company_id) return;
    void Promise.all(contracts.filter(c => c.subcontractorId === contractor.id).map(c => subcontractService.accountStatement(user.company_id!, c.id)))
      .then(results => {
        if (cancelled) return;
        const balances = { payable: 0, advance: 0, retention: 0 };
        setRows(results.flat().sort((a,b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number)).map(row => { const bucket = row.bucket || 'payable'; return {...row, bucket, balance: balances[bucket] += row.debit - row.credit}; }));
      }).catch(e => { if (!cancelled) setError(e.message || 'تعذر تحميل الكشف'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contractor.id, contracts, user?.company_id]);
  const format = (n: number) => n.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <div className="fixed inset-0 z-[9999] overflow-auto bg-slate-100 p-4 print:absolute print:bg-white print:p-0" dir="rtl">
    <div className="mx-auto max-w-4xl">
      <div className="print:hidden flex justify-between gap-3 mb-4"><button onClick={onClose} className="rounded bg-white p-3">إغلاق</button><button disabled={loading || !!error} onClick={() => window.print()} className="rounded bg-jilco-900 p-3 text-white disabled:opacity-50">طباعة الكشف</button></div>
      <section className="print-document subcontract-print-document bg-white rounded-xl p-6">
        <h1 className="text-2xl font-black text-jilco-900">جيلكو للمصاعد</h1><h2 className="text-xl mt-3">كشف حساب: {contractor.name}</h2>
        <p className="text-sm text-slate-500 my-3">المستخلصات المعتمدة والسداد والخصومات • ر.س</p>
        {loading ? <p>جارٍ تحميل الحركات…</p> : error ? <p role="alert" className="text-red-700">{error}</p> : <>
          <div className="grid grid-cols-3 gap-3 my-4">{(['payable', 'advance', 'retention'] as const).map(bucket => <p key={bucket} className="font-bold border rounded p-3">{bucket === 'payable' ? 'الذمم المستحقة' : bucket === 'advance' ? 'المقدم غير المسترد' : 'الاستبقاء المحتجز'}: {format(rows.filter(r => (r.bucket || 'payable') === bucket).reduce((sum,r) => sum+r.debit-r.credit,0))}</p>)}</div>
          <div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead><tr>{['التاريخ','المرجع','البيان','استحقاق','سداد / خصم','الرصيد'].map(h => <th key={h} className="border p-2">{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.type+'-'+r.referenceId}><td className="border p-2">{r.date}</td><td className="border p-2">{r.number}</td><td className="border p-2"><span className="block text-xs text-slate-500">{r.bucket === 'advance' ? 'دفعات مقدمة' : r.bucket === 'retention' ? 'استبقاء' : 'ذمم'}</span>{r.description}</td><td className="border p-2">{format(r.debit)}</td><td className="border p-2">{format(r.credit)}</td><td className="border p-2">{format(r.balance)}</td></tr>)}</tbody></table></div>
          {!rows.length && <p className="p-6 text-center">لا توجد حركات معتمدة بعد</p>}
        </>}
      </section>
    </div>
  </div>;
}
