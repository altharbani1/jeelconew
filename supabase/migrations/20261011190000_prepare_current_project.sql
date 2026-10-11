-- Prepare the empty replacement project for the currently deployed application.
-- This migration is additive and preserves the original normalized schema.

alter table public.app_users
  add column if not exists role text not null default 'staff';

-- Legacy JSON document store still used by modules without dedicated tables.
create table if not exists public.jilco_realtime_data (
  collection text not null,
  record_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  company_id uuid references public.companies(id) on delete cascade,
  primary key (collection, record_id)
);

alter table public.jilco_realtime_data enable row level security;

create or replace function public.assign_current_company()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.company_id is null then
    select company_id into new.company_id
    from public.app_users
    where id = (select auth.uid());
  end if;
  if new.company_id is null then
    raise exception 'User has no company' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists assign_jilco_realtime_company on public.jilco_realtime_data;
create trigger assign_jilco_realtime_company
before insert or update on public.jilco_realtime_data
for each row execute function public.assign_current_company();

drop policy if exists jilco_realtime_company_access on public.jilco_realtime_data;
create policy jilco_realtime_company_access
on public.jilco_realtime_data for all to authenticated
using (company_id = (select company_id from public.app_users where id = (select auth.uid())))
with check (company_id = (select company_id from public.app_users where id = (select auth.uid())));

grant select, insert, update, delete on public.jilco_realtime_data to authenticated;
revoke all on public.jilco_realtime_data from anon;

-- Compressed per-user snapshots used by cloudService.
create table if not exists public.jilco_backups (
  key text primary key,
  data text not null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table public.jilco_backups enable row level security;

drop policy if exists jilco_backups_owner_access on public.jilco_backups;
create policy jilco_backups_owner_access
on public.jilco_backups for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.jilco_backups to authenticated;
revoke all on public.jilco_backups from anon;

-- Columns expected by the deployed compatibility mapping.
alter table public.customers
  add column if not exists legacy_id text,
  add column if not exists full_name text,
  add column if not exists type text default 'individual',
  add column if not exists status text default 'new',
  add column if not exists vat_number text,
  add column if not exists national_id text,
  add column if not exists last_contact_date date,
  add column if not exists notes jsonb not null default '[]'::jsonb;
create unique index if not exists customers_legacy_id_key on public.customers(legacy_id);

alter table public.quotes
  add column if not exists legacy_id text,
  add column if not exists number text,
  add column if not exists date date,
  add column if not exists customer_name text,
  add column if not exists customer_address text,
  add column if not exists project_name text,
  add column if not exists validity text,
  add column if not exists tax_rate numeric not null default 0,
  add column if not exists warranty_installation text,
  add column if not exists warranty_motor text,
  add column if not exists payment_terms jsonb not null default '[]'::jsonb,
  add column if not exists terms_and_conditions text,
  add column if not exists features jsonb not null default '[]'::jsonb,
  add column if not exists handover_and_warranty text,
  add column if not exists first_party_obligations text,
  add column if not exists second_party_obligations text,
  add column if not exists works_duration text,
  add column if not exists show_gallery boolean not null default false,
  add column if not exists gallery_images jsonb not null default '{}'::jsonb;
create unique index if not exists quotes_legacy_id_key on public.quotes(legacy_id);

alter table public.quote_items
  add column if not exists legacy_id text,
  add column if not exists quote_legacy_id text,
  add column if not exists details text;

create table if not exists public.quote_specs (
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
alter table public.quote_specs enable row level security;
drop policy if exists quote_specs_company_access on public.quote_specs;
create policy quote_specs_company_access
on public.quote_specs for all to authenticated
using (quote_id in (select id from public.quotes where company_id = (select company_id from public.app_users where id = (select auth.uid()))))
with check (quote_id in (select id from public.quotes where company_id = (select company_id from public.app_users where id = (select auth.uid()))));
grant select, insert, update, delete on public.quote_specs to authenticated;
revoke all on public.quote_specs from anon;

alter table public.contracts
  add column if not exists legacy_id text,
  add column if not exists number text,
  add column if not exists date date,
  add column if not exists first_party_name text,
  add column if not exists second_party_name text,
  add column if not exists second_party_id text,
  add column if not exists location text,
  add column if not exists total_value numeric,
  add column if not exists elevator_type text,
  add column if not exists stops integer,
  add column if not exists elevator_count integer,
  add column if not exists internal_doors_count integer,
  add column if not exists external_doors_count integer,
  add column if not exists access_control text,
  add column if not exists duration_months integer,
  add column if not exists first_party_obligations text,
  add column if not exists second_party_obligations text,
  add column if not exists handover_and_warranty text,
  add column if not exists works_duration text,
  add column if not exists payment_terms jsonb not null default '[]'::jsonb,
  add column if not exists technical_specs jsonb not null default '{}'::jsonb;
create unique index if not exists contracts_legacy_id_key on public.contracts(legacy_id);

alter table public.invoices
  add column if not exists legacy_id text,
  add column if not exists number text,
  add column if not exists date date,
  add column if not exists customer_name text,
  add column if not exists customer_vat_number text,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists discount_amount numeric not null default 0,
  add column if not exists is_tax_inclusive boolean not null default false;
create unique index if not exists invoices_legacy_id_key on public.invoices(legacy_id);

alter table public.receipts
  add column if not exists legacy_id text,
  add column if not exists number text,
  add column if not exists date date,
  add column if not exists received_from text,
  add column if not exists amount_in_words text,
  add column if not exists payment_method text,
  add column if not exists bank_name text,
  add column if not exists check_number text,
  add column if not exists for_reason text,
  add column if not exists attachments jsonb not null default '[]'::jsonb;
create unique index if not exists receipts_legacy_id_key on public.receipts(legacy_id);

create or replace function public.prepare_legacy_row()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.company_id is null then
    select company_id into new.company_id from public.app_users where id = (select auth.uid());
  end if;
  if tg_table_name = 'customers' then
    new.name := coalesce(nullif(new.full_name, ''), nullif(new.name, ''), 'بدون اسم');
  elsif tg_table_name = 'contracts' then
    new.title := coalesce(nullif(new.number, ''), nullif(new.title, ''), 'عقد');
    new.value := coalesce(new.total_value, new.value, 0);
    new.signed_at := coalesce(new.date, new.signed_at);
  elsif tg_table_name = 'invoices' then
    new.total := coalesce(new.total, 0);
    new.due_date := coalesce(new.due_date, new.date);
  elsif tg_table_name = 'receipts' then
    new.received_at := coalesce(new.received_at, new.date);
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['customers','quotes','contracts','invoices','receipts'] loop
    execute format('drop trigger if exists prepare_legacy_row on public.%I', table_name);
    execute format('create trigger prepare_legacy_row before insert or update on public.%I for each row execute function public.prepare_legacy_row()', table_name);
  end loop;
end;
$$;

-- Relational subcontract foundation required by the current UI and repair migration.
create table if not exists public.subcontractors (
  id text primary key, company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, contact_person text, phone text, email text, specialty text not null,
  national_id text, vat_number text, address text, bank_name text, bank_account_number text,
  notes text, rating smallint, classification text, qualification_status text not null default 'pending',
  commercial_registration_expiry date, insurance_expiry date, iban_verified boolean not null default false,
  safety_rating numeric, status text not null default 'active', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subcontracts (
  id text primary key, company_id uuid not null references public.companies(id) on delete cascade,
  number text not null, subcontractor_id text not null, project_legacy_id text, project_name text,
  contract_date date not null, total_amount numeric not null, scope_of_work text not null,
  start_date date not null, end_date date not null, status text not null default 'draft', notes text,
  progress_percentage numeric not null default 0, planned_progress numeric not null default 0,
  work_package text, site_location text, engineer_in_charge text, retention_percentage numeric not null default 0,
  advance_payment_amount numeric not null default 0, variation_orders_amount numeric not null default 0,
  deductions_amount numeric not null default 0, warranty_period_days integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  linked_entity_type text not null default 'project', linked_contract_legacy_id text, linked_contract_number text
);

create table if not exists public.subcontract_certificates (
  id text primary key, company_id uuid not null references public.companies(id) on delete cascade,
  subcontract_id text not null, certificate_number text not null, description text not null, due_date date not null,
  period_from date, period_to date, progress_percentage numeric, gross_work_value numeric not null default 0,
  retention_amount numeric not null default 0, advance_recovery_amount numeric not null default 0,
  deductions_amount numeric not null default 0, vat_amount numeric not null default 0, net_payable numeric not null default 0,
  status text not null default 'pending', payment_method text, payment_date date, reference_number text, notes text,
  engineer_approved_at timestamptz, engineer_approved_by text, finance_approved_at timestamptz,
  finance_approved_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.subcontract_payments (
  id text primary key, company_id uuid not null references public.companies(id) on delete cascade,
  certificate_id text not null, subcontract_id text not null, amount numeric not null,
  payment_method text not null, payment_date date not null, reference_number text, expense_record_id text,
  created_by uuid, created_at timestamptz not null default now()
);

create table if not exists public.subcontract_approvals (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  certificate_id text not null, stage text not null, decision text not null default 'approved', approved_by uuid,
  approved_by_name text, notes text, approved_at timestamptz not null default now()
);

create table if not exists public.subcontract_variations (
  id text primary key, company_id uuid not null references public.companies(id) on delete cascade,
  subcontract_id text not null, number text not null, description text not null, amount numeric not null,
  status text not null default 'draft', approved_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.subcontract_attachments (
  id text primary key, company_id uuid not null references public.companies(id) on delete cascade,
  subcontract_id text, subcontractor_id text, file_name text not null,
  bucket text not null default 'subcontract-documents', object_path text not null, mime_type text,
  size_bytes bigint, category text, uploaded_by uuid, created_at timestamptz not null default now()
);

do $$
declare table_name text;
begin
  foreach table_name in array array['subcontractors','subcontracts','subcontract_certificates','subcontract_payments','subcontract_approvals','subcontract_variations','subcontract_attachments'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists tenant_access on public.%I', table_name);
    execute format('create policy tenant_access on public.%I for all to authenticated using (company_id=(select company_id from public.app_users where id=(select auth.uid()))) with check (company_id=(select company_id from public.app_users where id=(select auth.uid())))', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end;
$$;

insert into storage.buckets (id, name, public)
values ('jilco-assets', 'jilco-assets', true), ('subcontract-documents', 'subcontract-documents', false)
on conflict (id) do nothing;

drop policy if exists jilco_assets_owner_insert on storage.objects;
create policy jilco_assets_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'jilco-assets' and owner_id::text = (select auth.uid())::text);
drop policy if exists jilco_assets_owner_select on storage.objects;
create policy jilco_assets_owner_select on storage.objects for select to authenticated
using (bucket_id = 'jilco-assets' and owner_id::text = (select auth.uid())::text);
drop policy if exists jilco_assets_owner_update on storage.objects;
create policy jilco_assets_owner_update on storage.objects for update to authenticated
using (bucket_id = 'jilco-assets' and owner_id::text = (select auth.uid())::text)
with check (bucket_id = 'jilco-assets' and owner_id::text = (select auth.uid())::text);

-- Realtime publication for the tables observed by the client.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='jilco_realtime_data') then
    alter publication supabase_realtime add table public.jilco_realtime_data;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='customers') then
    alter publication supabase_realtime add table public.customers;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='quotes') then
    alter publication supabase_realtime add table public.quotes;
  end if;
end;
$$;
