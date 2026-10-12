-- Foundation for contractor accounting: chart of accounts, cost centers,
-- double-entry journals, accounting periods and contractor ledger entries.
create table if not exists public.accounting_periods (
  id text primary key,
  company_id uuid not null references public.companies(id),
  period_start date not null,
  period_end date not null,
  status text not null default 'open' check (status in ('open','closed')),
  closed_at timestamptz,
  closed_by uuid,
  created_at timestamptz not null default now(),
  unique(company_id, period_start, period_end),
  unique(company_id, id),
  check (period_end >= period_start)
);

create table if not exists public.chart_of_accounts (
  id text primary key,
  company_id uuid not null references public.companies(id),
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('asset','liability','equity','revenue','expense')),
  parent_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, code),
  unique(company_id, id),
  foreign key(company_id, parent_id) references public.chart_of_accounts(company_id, id)
);

create table if not exists public.cost_centers (
  id text primary key,
  company_id uuid not null references public.companies(id),
  code text not null,
  name text not null,
  project_id text,
  parent_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id, code),
  unique(company_id, id),
  foreign key(company_id, parent_id) references public.cost_centers(company_id, id)
);

create table if not exists public.accounting_journals (
  id text primary key,
  company_id uuid not null references public.companies(id),
  period_id text not null,
  number text not null,
  journal_date date not null default current_date,
  description text not null,
  source_type text not null check (source_type in ('subcontract_certificate','subcontract_voucher','manual','reversal')),
  source_id text,
  status text not null default 'draft' check (status in ('draft','posted','reversed')),
  posted_at timestamptz,
  posted_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(company_id, number),
  unique(company_id, id),
  unique(company_id, source_type, source_id),
  foreign key(company_id, period_id) references public.accounting_periods(company_id, id)
);

create table if not exists public.accounting_entry_lines (
  id text primary key,
  company_id uuid not null references public.companies(id),
  journal_id text not null,
  account_id text not null,
  cost_center_id text,
  subcontract_id text,
  description text,
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  created_at timestamptz not null default now(),
  check ((debit = 0) <> (credit = 0)),
  foreign key(company_id, journal_id) references public.accounting_journals(company_id, id) on delete cascade,
  foreign key(company_id, account_id) references public.chart_of_accounts(company_id, id),
  foreign key(company_id, cost_center_id) references public.cost_centers(company_id, id)
);

create table if not exists public.subcontract_ledger_entries (
  id text primary key,
  company_id uuid not null references public.companies(id),
  subcontract_id text not null,
  journal_id text,
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('contract','certificate','voucher','payment','retention','advance','deduction','reversal')),
  reference_number text not null,
  description text not null,
  debit numeric(14,2) not null default 0 check (debit >= 0),
  credit numeric(14,2) not null default 0 check (credit >= 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(company_id, subcontract_id, entry_type, reference_number),
  foreign key(company_id, journal_id) references public.accounting_journals(company_id, id)
);

create unique index if not exists chart_of_accounts_company_id_idx on public.chart_of_accounts(company_id, id);
create unique index if not exists cost_centers_company_id_idx on public.cost_centers(company_id, id);
create unique index if not exists accounting_periods_company_id_idx on public.accounting_periods(company_id, id);
create unique index if not exists accounting_journals_company_id_idx on public.accounting_journals(company_id, id);

alter table public.accounting_periods enable row level security;
alter table public.chart_of_accounts enable row level security;
alter table public.cost_centers enable row level security;
alter table public.accounting_journals enable row level security;
alter table public.accounting_entry_lines enable row level security;
alter table public.subcontract_ledger_entries enable row level security;

revoke all on public.accounting_periods, public.chart_of_accounts, public.cost_centers, public.accounting_journals, public.accounting_entry_lines, public.subcontract_ledger_entries from anon;
grant select, insert, update, delete on public.accounting_periods, public.chart_of_accounts, public.cost_centers, public.accounting_journals, public.accounting_entry_lines, public.subcontract_ledger_entries to authenticated;

do $$ declare t text; begin
  foreach t in array array['accounting_periods','chart_of_accounts','cost_centers','accounting_journals','accounting_entry_lines','subcontract_ledger_entries'] loop
    execute format('create policy %I on public.%I for all to authenticated using (company_id=(select company_id from public.app_users where id=(select auth.uid()))) with check (company_id=(select company_id from public.app_users where id=(select auth.uid())))', t || '_tenant_access', t);
  end loop;
end $$;

create or replace function public.validate_accounting_journal() returns trigger
language plpgsql security invoker set search_path='' as $$
declare total_debit numeric; total_credit numeric; period_status text;
begin
  if new.status = 'posted' then
    select status into period_status from public.accounting_periods where company_id=new.company_id and id=new.period_id;
    if period_status <> 'open' then raise exception 'Cannot post into a closed accounting period'; end if;
    select coalesce(sum(debit),0), coalesce(sum(credit),0) into total_debit,total_credit from public.accounting_entry_lines where company_id=new.company_id and journal_id=new.id;
    if total_debit <= 0 or total_debit <> total_credit then raise exception 'Journal must be balanced before posting'; end if;
    new.posted_at := coalesce(new.posted_at, now());
  end if;
  return new;
end $$;
revoke all on function public.validate_accounting_journal() from public, anon, authenticated;
create trigger accounting_journal_validation before insert or update on public.accounting_journals for each row execute function public.validate_accounting_journal();

comment on table public.accounting_journals is 'Immutable double-entry journals; posted journals must be balanced';
comment on table public.subcontract_ledger_entries is 'Contractor subledger entries linked to accounting journals';
