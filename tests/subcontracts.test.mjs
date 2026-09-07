import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
const schema = JSON.parse(readFileSync(new URL('./fixtures/subcontract-schema.json', import.meta.url)));
await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table storage.objects(bucket_id text,name text); grant usage on schema auth,storage to authenticated;
create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
grant select on storage.objects to authenticated;`);
for (const t of schema) {
  await db.exec(`create table public.${t.table_name} (${t.columns.map(c => `${c.name} ${c.type}${c.default ? ' default '+c.default : ''}${c.nullable === 'NO' ? ' not null' : ''}`).join(',')}, primary key (${t.table_name==='jilco_realtime_data'?'collection,record_id':'id'}));
  grant select,insert,update,delete on public.${t.table_name} to authenticated;
  alter table public.${t.table_name} enable row level security;
  create policy legacy_access on public.${t.table_name} for all to authenticated using(true) with check(true);`);
}
await db.exec(`alter table public.subcontract_payments add unique(certificate_id);
alter table public.subcontract_approvals add unique(certificate_id,stage);`);
const tenant='00000000-0000-0000-0000-000000000001', uid='00000000-0000-0000-0000-000000000002';
await db.query('insert into companies(id,name) values($1,$2)',[tenant,'Test company']);
await db.query('insert into app_users(id,company_id,role) values($1,$2,$3)',[uid,tenant,'admin']);
await db.query("insert into subcontractors(id,company_id,name,specialty) values('contractor',$1,'Test','Civil')",[tenant]);
await db.query("insert into subcontracts(id,company_id,number,subcontractor_id,project_legacy_id,contract_date,total_amount,scope_of_work,start_date,end_date,status) values('contract',$1,'SUB-1','contractor','project','2026-09-01',1000,'Work','2026-09-01','2026-10-01','active')",[tenant]);
await db.query("insert into jilco_realtime_data(collection,record_id,company_id,data) values('jilco_projects','project',$1,'{}')",[tenant]);
await db.query("insert into jilco_realtime_data(collection,record_id,company_id,data) values('subcontracts','contract',$1,$2)", [tenant, JSON.stringify({
  projectId: 'project', subcontractorName: 'Test', payments: [{ id:'historical', description:'Legacy payment', amount:25, status:'paid', dueDate:'2026-09-01', paymentDate:'2026-09-01', paymentMethod:'cash' }]
})]);
await db.exec(readFileSync(new URL('../supabase/migrations/20260906131547_repair_relational_subcontracts.sql',import.meta.url),'utf8'));
assert.equal((await db.query("select net_payable::int n from subcontract_certificates where id='historical'")).rows[0].n,25);
assert.equal((await db.query("select data->>'reconciledFromLegacy' v from jilco_realtime_data where record_id='SUB-historical'")).rows[0].v,'true');
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
await db.exec('set role authenticated');
const action=(name,id,data={})=>db.query('select public.subcontract_certificate_action($1,$2,$3)',[name,id,JSON.stringify(data)]);
const payment={subcontractId:'contract',amount:100,description:'Progress',dueDate:'2026-09-06'};
const pay=()=>db.query("select public.pay_subcontract_certificate('cert','transfer','2026-09-06',null)");
await assert.rejects(db.exec("update app_users set role='accountant'"),/permission denied/);
await assert.rejects(action('create','invalid',{...payment,amount:-1}),/Positive amount/);
await action('create','cert',payment);
await assert.rejects(action('create','excess',{...payment,amount:901}),/exceed/);
await assert.rejects(action('finance','cert'),/Engineering approval/);
await assert.rejects(pay(),/approvals required/);
await action('engineer','cert');
await assert.rejects(action('delete','cert'),/Cannot delete/);
await action('finance','cert');
await pay(); await pay();
assert.equal((await db.query('select count(*)::int n from subcontract_payments')).rows[0].n,2);
assert.equal((await db.query("select count(*)::int n from jilco_realtime_data where collection='jilco_expenses_archive'")).rows[0].n,2);
await assert.rejects(db.query("select public.pay_subcontract_certificate('cert','cash','2026-09-06',null)"),/immutable/);
await assert.rejects(db.exec("update subcontract_certificates set net_payable=999"),/permission denied/);
await assert.rejects(db.exec("delete from jilco_realtime_data where record_id='SUB-cert'"),/cannot be edited/);
await assert.rejects(db.exec("delete from subcontracts where id='contract'"),/empty draft/);
// Prove failure while writing the voucher rolls back both certificate and payment.
await action('create','collision',payment); await action('engineer','collision'); await action('finance','collision');
await db.exec('reset role');
await db.query("insert into jilco_realtime_data(collection,record_id,company_id,data) values('jilco_expenses_archive','SUB-collision',$1,'{}')",[tenant]);
await db.exec('set role authenticated');
await assert.rejects(db.query("select public.pay_subcontract_certificate('collision','cash','2026-09-06',null)"),/duplicate key/);
assert.equal((await db.query("select status from subcontract_certificates where id='collision'")).rows[0].status,'approved');
assert.equal((await db.query("select count(*)::int n from subcontract_payments where certificate_id='collision'")).rows[0].n,0);
await db.exec('reset role');
await db.query("update app_users set role='staff' where id=$1",[uid]); await db.exec('set role authenticated');
await assert.rejects(action('create','staff',payment),/Management permission/);
await assert.rejects(action('finance','collision'),/Finance permission/);
await assert.rejects(db.exec("update subcontracts set total_amount=2000 where id='contract'"),/Management permission/);
console.log('PASS: tenant identity, role guards, approvals, payment idempotency, immutable vouchers, rollback on voucher failure');
await db.close();
