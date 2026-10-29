import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const companyA = '10000000-0000-0000-0000-000000000001';
const companyB = '10000000-0000-0000-0000-000000000002';
const admin = '20000000-0000-0000-0000-000000000001';
const sales = '20000000-0000-0000-0000-000000000002';
const other = '20000000-0000-0000-0000-000000000003';
const denied = '20000000-0000-0000-0000-000000000004';
const asUser = async id => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
};
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const reserve = () => scalar('select public.reserve_contract_number(2026)');
const save = value => scalar('select public.save_contract_record($1::jsonb)', [JSON.stringify(value)]);
const contract = (legacy_id, number, overrides = {}) => ({
  legacy_id, number, date: '2026-10-29', first_party_name: 'Company', second_party_name: 'Customer',
  total_value: 1000.125, stops: 4, elevator_count: 1, internal_doors_count: 1,
  external_doors_count: 4, duration_months: 6,
  payment_terms: [{ name: 'Deposit', percentage: 60 }, { name: 'Delivery', percentage: 40 }],
  technical_specs: {}, ...overrides,
});

try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table public.companies(id uuid primary key);
    create table public.app_users(id uuid primary key,company_id uuid,role text);
    grant select on public.app_users to authenticated;
    alter table public.app_users enable row level security;
    create policy self_read on public.app_users for select to authenticated using(id=auth.uid());
    create table public.customers(id uuid primary key default gen_random_uuid(),company_id uuid,legacy_id text);
    create table public.jilco_realtime_data(company_id uuid,collection text,record_id text,data jsonb);
    create table public.contracts(
      id uuid primary key default gen_random_uuid(),company_id uuid references public.companies,
      legacy_id text unique,number text,date date,first_party_name text,second_party_name text,
      second_party_id text,location text,total_value numeric,value numeric,title text,signed_at date,
      elevator_type text,stops integer,elevator_count integer,internal_doors_count integer,
      external_doors_count integer,access_control text,duration_months integer,
      first_party_obligations text,second_party_obligations text,handover_and_warranty text,
      works_duration text,payment_terms jsonb,technical_specs jsonb
    );
    create policy historical_access on public.contracts for all to authenticated using(true) with check(true);
    insert into public.companies values('${companyA}'),('${companyB}');
    insert into public.app_users values
      ('${admin}','${companyA}','admin'),('${sales}','${companyA}','sales'),
      ('${other}','${companyB}','manager'),('${denied}','${companyA}','technician');
    insert into public.customers(company_id,legacy_id) values('${companyA}','customer-a'),('${companyB}','customer-b');
    insert into public.jilco_realtime_data values
      ('${companyA}','jilco_contracts_archive','old-row','{"id":"legacy-a","data":{"number":"OLD-123"}}'),
      ('${companyA}','jilco_contracts_archive','numeric-old','{"id":"legacy-numeric","data":{"number":"FA-2025-009"}}'),
      ('${companyB}','jilco_contracts_archive','foreign-row','{"id":"legacy-b","data":{"number":"OTHER-123"}}');
  `);
  const migration = readFileSync(new URL('../supabase/migrations/20261028162111_secure_contract_numbers_and_persistence.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  // Even a privileged write to the client-writable historical store after
  // installation must not be accepted as frozen import evidence on rerun.
  await db.exec(`insert into public.jilco_realtime_data values
    ('${companyA}','jilco_contracts_archive','late-row','{"id":"forged-later","data":{"number":"FORGED-900"}}')`);
  await db.exec(migration); // Reapplication must be harmless.
  await asUser(admin);
  assert.equal(await scalar('select public.reserve_contract_number(2025)'), 'FA-2025-010', 'allocator must skip frozen historical numbers before import');
  const first = await reserve();
  assert.equal(first, 'FA-2026-001');
  assert.equal(await reserve(), 'FA-2026-002');
  assert.equal(await save(contract('contract-a', first, { company_id: companyB, second_party_id: 'customer-a' })), true);
  assert.equal(await scalar("select company_id::text from public.contracts where legacy_id='contract-a'"), companyA);
  assert.equal(Number(await scalar("select total_value from public.contracts where legacy_id='contract-a'")), 1000.13);
  assert.equal(await save(contract('contract-a', first, { total_value: 1200 })), true);
  assert.equal(Number(await scalar('select count(*) from public.contracts')), 1);
  await assert.rejects(save(contract('contract-a', 'CHANGED')), /cannot be changed/);
  await assert.rejects(save(contract('unreserved', 'FA-2026-999')), /fresh contract number/);
  await assert.rejects(save(contract('duplicate', first)), /fresh contract number/);
  await assert.rejects(db.exec("update public.contracts set total_value=1"), /permission denied/);
  await assert.rejects(db.exec("delete from public.contracts"), /permission denied/);
  await assert.rejects(db.exec("insert into public.contracts(legacy_id) values('bypass')"), /permission denied/);
  const invalidNumber = await reserve();
  for (const change of [
    { total_value: 0 }, { total_value: 0.001 }, { total_value: 'NaN' }, { first_party_name: ' ' },
    { stops: 0 }, { elevator_count: 1.5 }, { technical_specs: [] },
    { payment_terms: [] }, { payment_terms: [{ name: 'Part', percentage: 99 }] },
    { payment_terms: [{ name: '', percentage: 100 }] },
    { second_party_id: 'customer-b' },
  ]) await assert.rejects(save(contract('invalid', invalidNumber, change)));
  assert.equal(await save(contract('valid-after-errors', invalidNumber)), true, 'invalid writes must roll back reservation consumption');
  await assert.rejects(scalar('select public.reserve_contract_number(1999)'), /Invalid contract year/);
  await assert.rejects(scalar("select public.reserve_existing_contract_number('forged','FA-2026-900')"), /No owned legacy/);
  await assert.rejects(scalar("select public.reserve_existing_contract_number('forged-later','FORGED-900')"), /No owned legacy/);
  await assert.rejects(db.exec('select * from contract_private.import_evidence'), /permission denied/);
  await assert.rejects(db.exec("insert into contract_private.import_evidence values('10000000-0000-0000-0000-000000000001','fake','FAKE')"), /permission denied/);
  await assert.rejects(scalar("select public.reserve_existing_contract_number('legacy-b','OTHER-123')"), /No owned legacy/);
  assert.equal(await scalar("select public.reserve_existing_contract_number('legacy-a','OLD-123')"), true);
  assert.equal(await save(contract('legacy-a', 'OLD-123')), true);
  assert.equal(await scalar("select public.reserve_existing_contract_number('legacy-a','OLD-123')"), true, 'retry import is idempotent');
  await asUser(sales);
  await assert.rejects(scalar("select public.delete_contract_record('contract-a')"), /delete permission/);
  const salesNumber = await reserve();
  await asUser(admin);
  await assert.rejects(save(contract('stolen-reservation', salesNumber)), /fresh contract number/);
  assert.equal(await scalar("select public.delete_contract_record('contract-a')"), true);
  await assert.rejects(save(contract('reuse-deleted', first)), /fresh contract number/);
  assert.equal(await scalar("select public.delete_contract_record('missing')"), false);
  assert.notEqual(await reserve(), first, 'deleted numbers remain reserved');
  await asUser(other);
  assert.equal(Number(await scalar('select count(*) from public.contracts')), 0, 'restrictive RLS overrides permissive historical policy');
  assert.equal(await scalar("select public.delete_contract_record('legacy-a')"), false);
  const otherNumber = await reserve();
  assert.equal(otherNumber, first, 'number sequences are scoped to companies');
  assert.equal(await save(contract('other-contract', otherNumber)), true);
  await asUser(denied);
  await assert.rejects(reserve(), /Contract permission/);
  await assert.rejects(save(contract('denied', 'DENIED')), /Contract permission/);
  await db.exec('reset role; set role anon');
  await assert.rejects(reserve(), /permission denied/);
  await assert.rejects(save(contract('anonymous', 'ANON')), /permission denied/);
  console.log('Contract migration regressions passed: reservation ownership, stable identity, validation, tenant/RBAC isolation, legacy imports and deletion tombstones.');
} finally {
  await db.close();
}
