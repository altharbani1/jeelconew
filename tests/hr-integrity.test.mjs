import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = new URL('../supabase/migrations/20261112163000_hr_integrity.sql', import.meta.url);
const company = '10000000-0000-0000-0000-00000000000a';
const user = '00000000-0000-0000-0000-00000000000a';
const add = (collection, id, data) => db.query(
  'insert into public.jilco_realtime_data values ($1,$2,$3,$4,now())',
  [company, 'jilco_hr_' + collection, id, JSON.stringify({ id, ...data })],
);
const get = async (collection, id) => (await db.query(
  'select data from public.jilco_realtime_data where collection=$1 and record_id=$2',
  ['jilco_hr_' + collection, id],
)).rows[0]?.data;

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    create table public.app_users (id uuid primary key, company_id uuid, role text);
    grant select on public.app_users to authenticated;
    create table public.jilco_realtime_data (
      company_id uuid not null, collection text not null, record_id text not null,
      data jsonb not null, updated_at timestamptz not null, primary key (collection, record_id)
    );
    grant select, insert, update, delete on public.jilco_realtime_data to authenticated;
  `);
  await db.exec(readFileSync(migration, 'utf8'));
  await db.query("insert into public.app_users values ($1,$2,'manager')", [user, company]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec('set role authenticated');
  await add('employees', 'E-1', { name: 'Employee', status: 'active', basicSalary: 1000, annualLeaveBalance: 4 });
  await add('payroll_rules', 'R-1', { effectiveMonth: '2026-12', gosiRate: 0.1, daysPerMonth: 22, hoursPerDay: 7.5 });
  const rulesFor = async month => (await db.query('select public.get_hr_payroll_rules($1) as rules', [month])).rows[0].rules;
  assert.equal((await rulesFor('2026-11')).daysPerMonth, 30);
  assert.equal((await rulesFor('2027-01')).daysPerMonth, 22);
  await assert.rejects(add('loans', 'bad', { employeeId: 'E-1', amount: -1 }), /Invalid employee loan/);
  await assert.rejects(add('attendance', 'bad', { employeeId: 'E-1', month: '2026-11', absenceDays: 32, delayHours: 0 }), /Invalid attendance record/);
  await add('loans', 'L-1', { employeeId: 'E-1', amount: 100, remainingAmount: 100, monthlyInstallment: 50, installmentsCount: 2, startDate: '2026-11', status: 'active' });
  await add('commissions', 'C-1', { employeeId: 'E-1', commissionAmount: 20, status: 'approved', approvalDate: '2026-11-15' });
  await add('leaves', 'LE-1', { employeeId: 'E-1', status: 'pending', type: 'annual', startDate: '2026-11-01', endDate: '2026-11-03' });
  await add('leaves', 'LE-2', { employeeId: 'E-1', status: 'pending', type: 'annual', startDate: '2026-11-03', endDate: '2026-11-04' });
  await assert.rejects(db.query("select public.resolve_hr_leave('LE-2','invalid')"), /Invalid leave decision/);
  await db.query("select public.resolve_hr_leave('LE-1','approved')");
  await assert.rejects(db.query("select public.resolve_hr_leave('LE-2','approved')"), /overlapping leave/);
  await assert.rejects(db.query("select public.resolve_hr_leave('LE-1','approved')"), /no longer pending/);
  assert.equal((await get('employees', 'E-1')).annualLeaveBalance, 1);
  assert.equal((await get('leaves', 'LE-2')).status, 'pending');
  await assert.rejects(db.query("delete from public.jilco_realtime_data where record_id = 'E-1'"), /Archive the employee/);

  const payroll = { id: 'PR-1', employeeId: 'E-1', status: 'paid', month: '2026-11', bonuses: 0, otherDeductions: 0, netSalary: 970 };
  const payment = { id: 'EP-2026-11-E-1', employeeId: 'E-1', payrollId: 'PR-1', status: 'completed', amount: 970 };
  const approve = async (record, voucher) => (await db.query(
    'select public.approve_hr_payroll_batch($1,$2) as result',
    [JSON.stringify([record]), JSON.stringify([voucher])],
  )).rows[0].result;

  await assert.rejects(approve({ ...payroll, netSalary: 970.01 }, payment), /net salary is invalid/);
  await assert.rejects(approve(payroll, { ...payment, amount: 969.99 }), /Invalid employee payment/);
  assert.equal(await get('payrolls', payroll.id), undefined);
  await assert.rejects(add('payrolls', 'direct', payroll), /Use the HR approval procedure/);
  const result = await approve(payroll, payment);
  assert.equal(result.payrolls[0].netSalary, 970);
  assert.equal(result.payments[0].amount, 970);
  assert.equal(result.commissionUpdates[0].status, 'paid');
  assert.equal(result.loanUpdates[0].remainingAmount, 50);
  await assert.rejects(approve({ ...payroll, id: 'PR-2' }, { ...payment, payrollId: 'PR-2' }));
  assert.equal((await get('loans', 'L-1')).remainingAmount, 50);

  console.log('PASS: atomic leave approval, validated HR records, canonical payroll and payment, linked adjustments, and duplicate prevention');
} finally {
  await db.close();
}
