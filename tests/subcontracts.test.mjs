import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';
import vm from 'node:vm';

const js = ts.transpileModule(fs.readFileSync(new URL('../lib/subcontractValidation.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;
const exports = {};
vm.runInNewContext(js, { exports });
test('reject invalid amounts and distinguish approved due payments', () => {
    for (const amount of [-1, 0, NaN, Infinity, 0.001]) assert.throws(() => exports.validatePayment({ amount, description: 'work', dueDate: '2026-09-05' }));
    const stats = exports.subcontractStats([
        { status: 'draft', totalAmount: 900, payments: [] },
        { status: 'cancelled', totalAmount: 100, payments: [] },
        { status: 'active', totalAmount: 100, payments: [
            { status: 'pending', amount: 10, dueDate: '2026-09-01' },
            { status: 'approved', amount: 20, dueDate: '2026-09-01' },
            { status: 'approved', amount: 30, dueDate: '2026-10-01' },
            { status: 'paid', amount: 40, dueDate: '2026-09-01' }
        ] }
    ], '2026-09-05');
    assert.equal(stats.totalCommitted, 100); assert.equal(stats.totalPending, 20); assert.equal(stats.totalPaid, 40);
});

test('Postgres subcontract invariants and RLS', async t => {
    const db = new PGlite();
    const company = '11111111-1111-4111-8111-111111111111';
    const other = '22222222-2222-4222-8222-222222222222';
    const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const otherUser = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const staff = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    try {
        await db.exec(`
            create role authenticated; create role anon;
            create schema auth; create schema storage;
            create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
            create table public.app_users(id uuid primary key, company_id uuid, role text);
            insert into public.app_users values('${user}','${company}','manager'),('${otherUser}','${other}','manager'),('${staff}','${company}','staff');
            create table public.jilco_realtime_data(collection text,record_id text,company_id uuid,data jsonb,updated_at timestamptz,primary key(collection,record_id));
            alter table public.jilco_realtime_data enable row level security;
            create policy legacy_open on public.jilco_realtime_data for all to authenticated using(true) with check(true);
            create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
            create table storage.objects(bucket_id text,name text);
            alter table storage.objects enable row level security;
            create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
            grant usage on schema public,auth,storage to authenticated,anon;
            grant select on public.app_users to authenticated,anon;
            grant select,insert,update,delete on public.jilco_realtime_data,storage.objects to authenticated,anon;
        `);
        const sql = fs.readFileSync(new URL('../supabase/migrations/20260905165441_secure_subcontracts.sql', import.meta.url), 'utf8');
        await db.exec(sql);
        const login = async id => { await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${id}';`); };
        await login(user);
        await db.query(`insert into public.jilco_realtime_data values('jilco_projects','project',$1,$2,now())`, [company, { id: 'project', name: 'Project' }]);
        const mutate = async (collection, id, data, revision=0) => (await db.query('select public.mutate_subcontract_record($1,$2,$3::jsonb,$4) as result', [collection,id,data,revision])).rows[0].result;
        await mutate('subcontractors','contractor',{ id:'contractor',name:'Contractor',specialty:'Install',status:'active' });
        let contract = { id:'contract',number:'SC-1',subcontractorId:'contractor',projectId:'project',subcontractorName:'Contractor',projectName:'Project',status:'active',totalAmount:100,progressPercentage:0,date:'2026-09-05',startDate:'2026-09-05',endDate:'2026-12-01',payments:[] };
        contract = await mutate('subcontracts','contract',contract);
        const pending = { id:'payment',subcontractId:'contract',amount:50,description:'Install',dueDate:'2026-09-05',status:'pending' };
        await t.test('reject negative, over-contract and bad dates', async () => {
            await assert.rejects(mutate('subcontracts','contract',{...contract,payments:[{...pending,amount:-1}]},contract.revision));
            await assert.rejects(mutate('subcontracts','contract',{...contract,payments:[{...pending,amount:101}]},contract.revision));
            await assert.rejects(mutate('subcontracts','contract',{...contract,endDate:'2020-01-01'},contract.revision));
            await assert.rejects(mutate('subcontracts','contract',{...contract,progressPercentage:101},contract.revision));
        });
        const stale = contract;
        contract = await mutate('subcontracts','contract',{...contract,payments:[pending]},contract.revision);
        await t.test('stale session cannot overwrite a newly added payment', async () => {
            await assert.rejects(mutate('subcontracts','contract',{...stale,number:'SC-stale'},stale.revision), /حدّث|جلسة/);
        });
        await t.test('prevent deleting linked contractor or contract', async () => {
            await assert.rejects(mutate('subcontractors','contractor',null,1), /مرتبط/);
            await assert.rejects(mutate('subcontracts','contract',null,contract.revision), /دفعات/);
            await assert.rejects(db.query(`delete from public.jilco_realtime_data where collection='jilco_projects' and record_id='project'`), /مرتبط/);
        });
        await t.test('cannot skip approval', async () => {
            await assert.rejects(mutate('subcontracts','contract',{...contract,payments:[{...pending,status:'paid',paymentDate:'2026-09-05',paymentMethod:'cash'}]},contract.revision), /اعتمد/);
        });
        contract = await mutate('subcontracts','contract',{...contract,payments:[{...pending,status:'approved'}]},contract.revision);
        const paidData = {...contract,payments:[{...pending,status:'paid',paymentDate:'2026-09-05',paymentMethod:'cash'}]};
        await t.test('voucher failure rolls payment back', async () => {
            await db.exec(`reset role; alter table public.jilco_realtime_data add constraint simulate_voucher_failure check (collection<>'jilco_expenses_archive');`);
            await login(user);
            await assert.rejects(mutate('subcontracts','contract',paidData,contract.revision), /simulate_voucher_failure/);
            const record=(await db.query(`select data from public.jilco_realtime_data where record_id='contract'`)).rows[0].data;
            assert.equal(record.payments[0].status,'approved');
            await db.exec(`reset role; alter table public.jilco_realtime_data drop constraint simulate_voucher_failure;`);
            await login(user);
        });
        contract = await mutate('subcontracts','contract',paidData,contract.revision);
        await t.test('lost-response retry is idempotent', async () => {
            await mutate('subcontracts','contract',paidData,paidData.revision);
            assert.equal((await db.query(`select count(*)::int n from public.jilco_realtime_data where collection='jilco_expenses_archive'`)).rows[0].n,1);
        });
        await t.test('paid records and vouchers cannot be changed or removed', async () => {
            await assert.rejects(mutate('subcontracts','contract',{...contract,payments:[]},contract.revision));
            await assert.rejects(mutate('subcontracts','contract',{...contract,payments:[{...contract.payments[0],amount:40}]},contract.revision));
            await assert.rejects(db.query(`delete from public.jilco_realtime_data where record_id='SUB-payment'`), /deleted/);
            await assert.rejects(db.query(`update public.jilco_realtime_data set data=jsonb_set(data,'{amount}','40') where record_id='SUB-payment'`), /immutable/);
        });
        await t.test('staff cannot mutate contracts', async () => {
            await login(staff);
            await assert.rejects(mutate('subcontracts','contract',{...contract,number:'bad'},contract.revision), /مدير/);
        });
        await t.test('RLS hides other-company rows and rejects forged ownership', async () => {
            await login(otherUser);
            assert.equal((await db.query('select * from public.jilco_realtime_data')).rows.length,0);
            await assert.rejects(db.query(`insert into public.jilco_realtime_data values('jilco_projects','forged',$1,'{}',now())`,[company]), /row-level security/);
            await assert.rejects(mutate('subcontracts','contract',{...contract,number:'takeover'},0));
            await login(user);
            await assert.rejects(db.query(`update public.jilco_realtime_data set company_id=$1 where record_id='contract'`,[other]), /company/);
        });
        await t.test('private attachments are isolated by company', async () => {
            await db.query(`insert into storage.objects values('subcontract-files',$1)`,[`${company}/contract/file`]);
            await login(otherUser);
            assert.equal((await db.query('select * from storage.objects')).rows.length,0);
            await assert.rejects(db.query(`insert into storage.objects values('subcontract-files',$1)`,[`${company}/contract/forged`]), /row-level security/);
        });
        await login(user);
        await t.test('attachment must exist under its contract and survives a reload', async () => {
            await assert.rejects(mutate('subcontracts','contract',{...contract,attachments:[{id:'file',storagePath:`${other}/contract/file`}]},contract.revision), /المرفق/);
            const attachment={id:'file',name:'file.pdf',type:'pdf',storagePath:`${company}/contract/file`,url:'',date:'2026-09-05'};
            contract=await mutate('subcontracts','contract',{...contract,attachments:[attachment]},contract.revision);
            const reloaded=(await db.query(`select data from public.jilco_realtime_data where record_id='contract'`)).rows[0].data;
            assert.equal(reloaded.attachments[0].storagePath,attachment.storagePath);
        });
        await t.test('contract completion and cancelled state rules', async () => {
            await assert.rejects(mutate('subcontracts','contract',{...contract,status:'completed'},contract.revision));
            await assert.rejects(mutate('subcontracts','contract',{...contract,status:'cancelled'},contract.revision));
            contract=await mutate('subcontracts','contract',{...contract,status:'completed',progressPercentage:100},contract.revision);
            await assert.rejects(mutate('subcontracts','contract',{...contract,status:'active'},contract.revision), /مغلق/);
        });
    } finally { await db.close(); }
});
