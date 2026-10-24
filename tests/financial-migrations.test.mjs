import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const root = new URL('../', import.meta.url);
const migration = name => readFileSync(new URL(`supabase/migrations/${name}`, root), 'utf8');
const userA = '00000000-0000-0000-0000-00000000000a';
const userB = '00000000-0000-0000-0000-00000000000b';
const companyA = '10000000-0000-0000-0000-00000000000a';
const companyB = '10000000-0000-0000-0000-00000000000b';

async function asUser(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
}

async function resetRole() {
  await db.exec('reset role');
}

const count = async (sql, params = []) => Number((await db.query(sql, params)).rows[0].n);

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;

    create table public.companies (id uuid primary key, name text not null);
    create table public.app_users (
      id uuid primary key,
      company_id uuid not null references public.companies(id),
      role text not null
    );
    alter table public.app_users enable row level security;
    create policy app_users_self on public.app_users for select to authenticated
      using (id = (select auth.uid()));
    grant select on public.app_users to authenticated;

    create table public.jilco_realtime_data (
      collection text not null,
      record_id text not null,
      data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now(),
      company_id uuid references public.companies(id),
      primary key(collection, record_id)
    );
    alter table public.jilco_realtime_data enable row level security;
    create policy legacy_tenant_access on public.jilco_realtime_data for all to authenticated
      using (company_id = (select company_id from public.app_users where id = (select auth.uid())))
      with check (company_id = (select company_id from public.app_users where id = (select auth.uid())));
    grant select, insert, update, delete on public.jilco_realtime_data to authenticated;

    create table public.quotes (
      id uuid primary key default gen_random_uuid(),
      company_id uuid not null references public.companies(id),
      legacy_id text unique,
      number text,
      date date,
      customer_name text,
      customer_address text,
      project_name text,
      validity text,
      tax_rate numeric not null default 0,
      warranty_installation text,
      warranty_motor text,
      payment_terms jsonb not null default '[]'::jsonb,
      terms_and_conditions text,
      features jsonb not null default '[]'::jsonb,
      handover_and_warranty text,
      first_party_obligations text,
      second_party_obligations text,
      works_duration text,
      show_gallery boolean not null default false,
      gallery_images jsonb not null default '{}'::jsonb,
      total numeric not null default 0
    );
    create table public.quote_items (
      id uuid primary key default gen_random_uuid(),
      legacy_id text,
      quote_id uuid not null references public.quotes(id) on delete cascade,
      quote_legacy_id text,
      description text,
      details text,
      quantity integer,
      unit_price numeric,
      total numeric
    );
    create table public.quote_specs (
      id uuid primary key default gen_random_uuid(),
      quote_id uuid not null references public.quotes(id) on delete cascade,
      quote_legacy_id text,
      elevator_type text,
      capacity text,
      speed text,
      stops text,
      drive_type text,
      control_system text,
      power_supply text,
      cabin text,
      doors text,
      external_doors text,
      machine_room text,
      rails text,
      ropes text,
      safety text,
      emergency text
    );

    create table public.invoices (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      company_id uuid not null references public.companies(id),
      legacy_id text,
      number text,
      date date,
      due_date date,
      customer_name text,
      customer_vat_number text,
      items jsonb not null default '[]'::jsonb,
      total numeric,
      status text,
      discount_amount numeric not null default 0,
      is_tax_inclusive boolean not null default true
    );
    create unique index invoices_legacy_id_key on public.invoices(legacy_id);

    create table public.receipts (
      id uuid primary key default gen_random_uuid(),
      company_id uuid not null references public.companies(id),
      legacy_id text,
      number text,
      date date,
      received_at date,
      received_from text,
      amount numeric,
      amount_in_words text,
      payment_method text,
      bank_name text,
      check_number text,
      for_reason text,
      attachments jsonb not null default '[]'::jsonb
    );
    create unique index receipts_legacy_id_key on public.receipts(legacy_id);

    alter table public.quotes enable row level security;
    alter table public.quote_items enable row level security;
    alter table public.quote_specs enable row level security;
    alter table public.invoices enable row level security;
    alter table public.receipts enable row level security;
    create policy quotes_tenant_access on public.quotes for all to authenticated
      using (company_id = (select company_id from public.app_users where id = (select auth.uid())))
      with check (company_id = (select company_id from public.app_users where id = (select auth.uid())));
    create policy quote_items_tenant_access on public.quote_items for all to authenticated
      using (quote_id in (select id from public.quotes where company_id = (select company_id from public.app_users where id = (select auth.uid()))))
      with check (quote_id in (select id from public.quotes where company_id = (select company_id from public.app_users where id = (select auth.uid()))));
    create policy quote_specs_tenant_access on public.quote_specs for all to authenticated
      using (quote_id in (select id from public.quotes where company_id = (select company_id from public.app_users where id = (select auth.uid()))))
      with check (quote_id in (select id from public.quotes where company_id = (select company_id from public.app_users where id = (select auth.uid()))));
    create policy invoices_tenant_access on public.invoices for all to authenticated
      using (company_id = (select company_id from public.app_users where id = (select auth.uid())))
      with check (company_id = (select company_id from public.app_users where id = (select auth.uid())));
    create policy receipts_tenant_access on public.receipts for all to authenticated
      using (company_id = (select company_id from public.app_users where id = (select auth.uid())))
      with check (company_id = (select company_id from public.app_users where id = (select auth.uid())));
    grant select, insert, update, delete on public.quotes, public.quote_items, public.quote_specs,
      public.invoices, public.receipts to authenticated;
  `);

  await db.query('insert into public.companies(id,name) values ($1,$2),($3,$4)', [companyA, 'A', companyB, 'B']);
  await db.query('insert into public.app_users(id,company_id,role) values ($1,$2,$3),($4,$5,$6),($7,$8,$9)', [
    userA, companyA, 'admin', userB, companyB, 'accountant',
    '00000000-0000-0000-0000-00000000000c', companyA, 'staff'
  ]);

  await resetRole();
  await db.query(`insert into public.invoices(id,company_id,legacy_id,number,date,total,status,items)
    values ($1,$2,'legacy-paid','INV-2026-101','2026-01-01',100,'paid','[]'),
           ($3,$2,'legacy-no-amount','INV-2026-102','2026-01-01',75,'paid','[]'),
           ($4,$2,'legacy-partial','INV-2026-103','2026-01-01',90,'partial','[]'),
           ('20000000-0000-0000-0000-000000000004',$2,'legacy-deleted-issued','INV-2027-009','2027-01-01',50,'paid','[]'),
           ('20000000-0000-0000-0000-000000000005',$2,'legacy-foreign-lookalike','INV-2032-001','2032-01-01',90,'partial','[]')`, [
    '20000000-0000-0000-0000-000000000001', companyA,
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003'
  ]);
  await db.query(`insert into public.jilco_realtime_data(collection,record_id,company_id,data) values
    ('jilco_invoices_archive','legacy-paid',$1,'{"paidAmount":40}'),
    ('jilco_invoices_archive','INV-2026-102',$1,'{}'),
    ('jilco_invoices_archive','INV-2032-001',$2,'{"paidAmount":90}'),
    ('jilco_receipts_archive','RV-legacy',$1,'{"data":{"invoiceId":"INV-2026-101","customerId":"cust-1"}}'),
    ('jilco_receipts_archive','RV-foreign-match',$2,'{"invoiceId":"INV-2026-101","customerId":"wrong-customer"}')`, [companyA, companyB]);
  await db.query(`insert into public.receipts(company_id,legacy_id,number,amount) values
    ($1,'receipt-legacy','RV-legacy',10),
    ($1,'receipt-foreign-lookalike','RV-foreign-match',10)`, [companyA]);

  await db.exec(migration('20261024120000_hr_role_authorization.sql'));
  await db.exec(migration('20261024124500_persist_invoice_payments_and_receipt_links.sql'));

  assert.equal((await db.query("select paid_amount::int n from public.invoices where legacy_id='legacy-paid'")).rows[0].n, 40);
  assert.equal((await db.query("select paid_amount::int n from public.invoices where legacy_id='legacy-no-amount'")).rows[0].n, 75);
  assert.equal((await db.query("select paid_amount::int n from public.invoices where legacy_id='legacy-partial'")).rows[0].n, 0);
  assert.equal((await db.query("select paid_amount::int n from public.invoices where legacy_id='legacy-foreign-lookalike'")).rows[0].n, 0);
  assert.deepEqual((await db.query("select invoice_number,customer_legacy_id from public.receipts where legacy_id='receipt-legacy'")).rows[0], {
    invoice_number: 'INV-2026-101', customer_legacy_id: 'cust-1'
  });
  assert.deepEqual((await db.query("select invoice_number,customer_legacy_id from public.receipts where legacy_id='receipt-foreign-lookalike'")).rows[0], {
    invoice_number: null, customer_legacy_id: null
  });

  const hrRecord = { collection: 'jilco_hr_employees', record_id: 'employee-1', company_id: companyA, data: '{"id":"employee-1"}' };
  await db.query('insert into public.jilco_realtime_data(collection,record_id,company_id,data) values($1,$2,$3,$4::jsonb)', [
    hrRecord.collection, hrRecord.record_id, hrRecord.company_id, hrRecord.data
  ]);
  await asUser(userA);
  assert.equal(await count("select count(*)::int n from public.jilco_realtime_data where collection like 'jilco_hr_%'"), 1);
  await resetRole();
  await asUser('00000000-0000-0000-0000-00000000000c');
  assert.equal(await count("select count(*)::int n from public.jilco_realtime_data where collection like 'jilco_hr_%'"), 0);
  await assert.rejects(
    db.query("insert into public.jilco_realtime_data(collection,record_id,company_id,data) values('jilco_hr_employees','staff-write',$1,'{}')", [companyA]),
    /row-level security|violates.*policy/i
  );
  await asUser(userB);
  assert.equal(await count("select count(*)::int n from public.jilco_realtime_data where collection like 'jilco_hr_%'"), 0);

  await resetRole();
  await db.exec(migration('20261024131500_save_quote_with_items_atomically.sql'));
  await asUser(userA);
  const quote = {
    legacy_id: 'quote-1', number: 'Q-1', date: '2026-10-01', customer_name: 'Customer',
    total: 20, payment_terms: [], features: [], gallery_images: {}
  };
  const items = [{ legacy_id: 'item-1', quote_legacy_id: 'quote-1', description: 'First', quantity: 1, unit_price: 10, total: 10 }];
  const specs = { quote_legacy_id: 'quote-1', elevator_type: 'Passenger' };
  const savedQuoteId = (await db.query('select public.save_quote_with_items($1::jsonb,$2::jsonb,$3::jsonb) id', [
    JSON.stringify(quote), JSON.stringify(items), JSON.stringify(specs)
  ])).rows[0].id;
  assert.equal(await count('select count(*)::int n from public.quote_items where quote_id=$1', [savedQuoteId]), 1);
  const previousQuoteTotal = Number((await db.query('select total from public.quotes where id=$1', [savedQuoteId])).rows[0].total);
  await assert.rejects(db.query('select public.save_quote_with_items($1::jsonb,$2::jsonb,$3::jsonb)', [
    JSON.stringify({ ...quote, total: 999 }),
    JSON.stringify([{ legacy_id: 'bad-item', quantity: 'not-an-integer' }]),
    JSON.stringify({ ...specs, elevator_type: 'Changed' })
  ]), /invalid input syntax|integer/i);
  assert.equal(Number((await db.query('select total from public.quotes where id=$1', [savedQuoteId])).rows[0].total), previousQuoteTotal);
  assert.deepEqual((await db.query('select legacy_id from public.quote_items where quote_id=$1', [savedQuoteId])).rows.map(row => row.legacy_id), ['item-1']);
  assert.equal((await db.query('select elevator_type from public.quote_specs where quote_id=$1', [savedQuoteId])).rows[0].elevator_type, 'Passenger');

  await asUser(userB);
  await assert.rejects(db.query('select public.save_quote_with_items($1::jsonb,$2::jsonb,$3::jsonb)', [
    JSON.stringify({ ...quote, total: 777 }), JSON.stringify(items), null
  ]), /row-level security|violates.*policy|duplicate key/i);
  assert.equal(await count("select count(*)::int n from public.quotes where legacy_id='quote-1'"), 0);
  await resetRole();
  assert.equal(Number((await db.query("select total from public.quotes where legacy_id='quote-1'", [])).rows[0].total), previousQuoteTotal);

  const invoice1 = '30000000-0000-0000-0000-000000000001';
  const invoice2 = '30000000-0000-0000-0000-000000000002';
  await db.query(`insert into public.invoices(id,company_id,legacy_id,number,total,status,items,discount_amount,is_tax_inclusive)
    values ($1,$2,'invoice-a','INV-A',100,'pending','[]',0,true),
           ($3,$2,'invoice-b','INV-B',100,'pending','[]',0,true),
           ('30000000-0000-0000-0000-000000000003',$4,'invoice-other','INV-OTHER',100,'pending','[]',0,true)`, [
    invoice1, companyA, invoice2, companyB
  ]);
  await db.exec(migration('20261024143000_atomic_receipt_invoice_payment_cycle.sql'));
  await asUser(userA);
  const saveReceipt = (legacyId, number, amount, invoiceNumber) => db.query(
    'select public.save_receipt_with_invoice_recalculation($1::jsonb) updates',
    [JSON.stringify({ legacy_id: legacyId, number, amount, date: '2026-10-24', received_from: 'Customer', invoice_number: invoiceNumber })]
  );
  const invoiceState = async number => (await db.query('select paid_amount::int paid,status from public.invoices where number=$1', [number])).rows[0];
  await saveReceipt('receipt-a', 'RV-A', 40, 'INV-A');
  assert.deepEqual(await invoiceState('INV-A'), { paid: 40, status: 'partial' });
  await saveReceipt('receipt-b', 'RV-B', 60, 'INV-A');
  assert.deepEqual(await invoiceState('INV-A'), { paid: 100, status: 'paid' });
  await saveReceipt('receipt-a', 'RV-A', 40, 'INV-B');
  assert.deepEqual(await invoiceState('INV-A'), { paid: 60, status: 'partial' });
  assert.deepEqual(await invoiceState('INV-B'), { paid: 40, status: 'partial' });
  await saveReceipt('receipt-a', 'RV-A', 40, null);
  assert.deepEqual(await invoiceState('INV-B'), { paid: 0, status: 'pending' });

  await resetRole();
  await db.exec(`create function public.fail_invoice_update() returns trigger language plpgsql as $$
    begin
      if current_setting('test.fail_invoice_update', true) = 'on' then
        raise exception 'injected invoice update failure';
      end if;
      return new;
    end $$;
    create trigger fail_invoice_update before update on public.invoices
      for each row execute function public.fail_invoice_update();`);
  await asUser(userA);
  await db.query("select set_config('test.fail_invoice_update','on',false)");
  await assert.rejects(saveReceipt('receipt-fail', 'RV-FAIL', 25, 'INV-A'), /injected invoice update failure/);
  assert.equal(await count("select count(*)::int n from public.receipts where legacy_id='receipt-fail'"), 0);
  assert.deepEqual(await invoiceState('INV-A'), { paid: 60, status: 'partial' });
  await db.query("select set_config('test.fail_invoice_update','off',false)");

  await db.query('select public.delete_receipt_with_invoice_recalculation($1)', ['RV-B']);
  assert.deepEqual(await invoiceState('INV-A'), { paid: 0, status: 'pending' });
  await saveReceipt('receipt-delete-fail', 'RV-DELETE-FAIL', 10, 'INV-A');
  await db.query("select set_config('test.fail_invoice_update','on',false)");
  await assert.rejects(db.query('select public.delete_receipt_with_invoice_recalculation($1)', ['RV-DELETE-FAIL']), /injected invoice update failure/);
  assert.equal(await count("select count(*)::int n from public.receipts where legacy_id='receipt-delete-fail'"), 1);
  assert.deepEqual(await invoiceState('INV-A'), { paid: 10, status: 'partial' });
  await db.query("select set_config('test.fail_invoice_update','off',false)");
  await assert.rejects(saveReceipt('cross-tenant-receipt', 'RV-X', 10, 'INV-OTHER'), /not found uniquely/i);
  assert.equal(await count("select count(*)::int n from public.receipts where legacy_id='cross-tenant-receipt'"), 0);
  await resetRole();
  await db.query(`insert into public.invoices(company_id,legacy_id,number,total,status,items)
    values ($1,'legacy-wide-zero-pad','INV-2028-000000002',1,'pending','[]'),
           ($1,'legacy-overflow-suffix','INV-2028-999999999999999999999',1,'pending','[]'),
           ($1,'legacy-999','INV-2029-999',1,'pending','[]')`, [companyA]);
  await db.exec(migration('20261024150000_reserve_invoice_numbers.sql'));
  await db.query("delete from public.invoices where legacy_id='legacy-deleted-issued'");
  await asUser(userA);
  assert.equal((await db.query('select public.reserve_invoice_number(2027) number')).rows[0].number, 'INV-2027-010');

  await resetRole();
  await db.query(`insert into public.jilco_realtime_data(collection,record_id,company_id,data) values
    ('jilco_invoices_archive','import-unwrapped',$1,'{"paidAmount":35}'),
    ('jilco_invoices_archive','import-wrapped',$1,'{"data":{"paidAmount":25}}'),
    ('jilco_invoices_archive','import-status-paid',$1,'{"status":"paid"}'),
    ('jilco_invoices_archive','import-other-company',$2,'{"paidAmount":90}')`, [companyA, companyB]);
  await asUser(userA);
  const importNumbers = [];
  for (let i = 0; i < 4; i++) {
    importNumbers.push((await db.query('select public.reserve_invoice_number(2030) number')).rows[0].number);
  }
  const saveImported = async (legacyId, number) => (await db.query(
    'select public.save_invoice_record($1::jsonb) invoice',
    [JSON.stringify({ legacy_id: legacyId, number, total: 100, items: [] })]
  )).rows[0].invoice;
  assert.deepEqual(await saveImported('import-unwrapped', importNumbers[0]), {
    id: 'import-unwrapped', number: importNumbers[0], paidAmount: 35, status: 'partial'
  });
  assert.deepEqual(await saveImported('import-wrapped', importNumbers[1]), {
    id: 'import-wrapped', number: importNumbers[1], paidAmount: 25, status: 'partial'
  });
  assert.deepEqual(await saveImported('import-status-paid', importNumbers[2]), {
    id: 'import-status-paid', number: importNumbers[2], paidAmount: 100, status: 'paid'
  });
  assert.deepEqual(await saveImported('import-other-company', importNumbers[3]), {
    id: 'import-other-company', number: importNumbers[3], paidAmount: 0, status: 'pending'
  });

  await asUser(userA);
  assert.equal((await db.query('select public.reserve_invoice_number(2028) number')).rows[0].number, 'INV-2028-003');
  assert.equal((await db.query('select public.reserve_invoice_number(2029) number')).rows[0].number, 'INV-2029-1000');
  await resetRole();
  assert.equal(await count("select count(*)::int n from public.invoice_number_reservations where invoice_number='INV-2028-000000002' and consumed_at is not null"), 1);
  await asUser(userA);
  const reserved1 = (await db.query('select public.reserve_invoice_number(2026) number')).rows[0].number;
  assert.equal(reserved1, 'INV-2026-104');
  await asUser(userB);
  const reserved2 = (await db.query('select public.reserve_invoice_number(2026) number')).rows[0].number;
  assert.equal(reserved2, 'INV-2026-105');
  await asUser('00000000-0000-0000-0000-00000000000c');
  await assert.rejects(db.query('select public.reserve_invoice_number(2026)'), /finance permission/i);

  await asUser(userA);
  const reservation = (await db.query("select public.save_invoice_record($1::jsonb) invoice", [JSON.stringify({
    legacy_id: reserved1, number: reserved1, date: '2026-10-24', due_date: '2026-11-24',
    customer_name: 'New customer', items: [{ total: 100 }], total: 100, is_tax_inclusive: true
  })])).rows[0].invoice;
  assert.deepEqual(reservation, { id: reserved1, number: reserved1, paidAmount: 0, status: 'pending' });
  await resetRole();
  assert.equal(await count('select count(*)::int n from public.invoice_number_reservations where invoice_number=$1 and consumed_at is not null', [reserved1]), 1);
  await asUser(userA);
  await assert.rejects(db.query('select public.save_invoice_record($1::jsonb)', [JSON.stringify({
    legacy_id: 'other-legacy', number: reserved1, total: 1, items: []
  })]), /already exists|already in use/i);
  await assert.rejects(db.query('select public.reserve_existing_invoice_number($1,$2)', ['legacy-import', reserved1]), /already belongs|already in use|already issued/i);
  const reserved3 = (await db.query('select public.reserve_invoice_number(2026) number')).rows[0].number;
  assert.equal(reserved3, 'INV-2026-106');
  await asUser(userB);
  await assert.rejects(db.query('select public.save_invoice_record($1::jsonb)', [JSON.stringify({
    legacy_id: 'cross-tenant', number: reserved3, total: 1, items: []
  })]), /reservation|reserved|permission|company/i);
  await resetRole();
  assert.equal(await count('select count(*)::int n from public.invoices where number=$1', [reserved3]), 0);

  console.log('PASS: 20261024 migrations cover HR RLS, payment backfills, atomic quote/receipt cycles, and invoice reservation guards');
} finally {
  await db.close();
}
