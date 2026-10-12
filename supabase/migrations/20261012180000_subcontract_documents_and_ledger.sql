-- Operational documents for subcontracting: work orders, receiving notes,
-- payment vouchers, and an auditable account ledger source.
create table if not exists public.subcontract_work_orders (
  id text primary key,
  company_id uuid not null references public.companies(id),
  subcontract_id text not null,
  subcontractor_id text not null,
  number text not null,
  title text not null,
  scope_of_work text not null,
  status text not null default 'draft' check (status in ('draft','issued','in_progress','completed','cancelled')),
  issue_date date not null default current_date,
  due_date date,
  assigned_to text,
  estimated_amount numeric(14,2) not null default 0 check (estimated_amount >= 0),
  actual_amount numeric(14,2) check (actual_amount is null or actual_amount >= 0),
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, number),
  foreign key(company_id, subcontract_id) references public.subcontracts(company_id, id),
  foreign key(company_id, subcontractor_id) references public.subcontractors(company_id, id)
);

create table if not exists public.subcontract_receipts (
  id text primary key,
  company_id uuid not null references public.companies(id),
  subcontract_id text not null,
  work_order_id text,
  number text not null,
  type text not null default 'work' check (type in ('material','work','partial','final')),
  status text not null default 'draft' check (status in ('draft','submitted','accepted','rejected')),
  receipt_date date not null default current_date,
  description text not null,
  quantity numeric(14,3) check (quantity is null or quantity >= 0),
  amount numeric(14,2) check (amount is null or amount >= 0),
  received_by uuid,
  accepted_by uuid,
  accepted_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, number),
  foreign key(company_id, subcontract_id) references public.subcontracts(company_id, id),
  foreign key(company_id, work_order_id) references public.subcontract_work_orders(company_id, id)
);

create table if not exists public.subcontract_vouchers (
  id text primary key,
  company_id uuid not null references public.companies(id),
  subcontract_id text not null,
  certificate_id text,
  number text not null,
  type text not null default 'payment' check (type in ('payment','advance','retention_release','deduction')),
  status text not null default 'draft' check (status in ('draft','approved','paid','cancelled')),
  amount numeric(14,2) not null check (amount > 0),
  voucher_date date not null default current_date,
  payment_method text check (payment_method is null or payment_method in ('cash','transfer','check')),
  reference_number text,
  description text not null,
  approved_by uuid,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, number),
  foreign key(company_id, subcontract_id) references public.subcontracts(company_id, id),
  foreign key(company_id, certificate_id, subcontract_id) references public.subcontract_certificates(company_id, id, subcontract_id)
);

create index if not exists subcontract_work_orders_contract_idx on public.subcontract_work_orders(company_id, subcontract_id, status, issue_date desc);
create index if not exists subcontract_receipts_contract_idx on public.subcontract_receipts(company_id, subcontract_id, status, receipt_date desc);
create index if not exists subcontract_vouchers_contract_idx on public.subcontract_vouchers(company_id, subcontract_id, status, voucher_date desc);

alter table public.subcontract_work_orders enable row level security;
alter table public.subcontract_receipts enable row level security;
alter table public.subcontract_vouchers enable row level security;
revoke all on public.subcontract_work_orders, public.subcontract_receipts, public.subcontract_vouchers from anon;
grant select, insert, update, delete on public.subcontract_work_orders, public.subcontract_receipts, public.subcontract_vouchers to authenticated;

-- Every policy is tenant-scoped. Management controls financial and master data;
-- engineering can operate work orders and submit/accept receiving notes.
create policy subcontract_work_orders_select on public.subcontract_work_orders for select to authenticated
using (company_id=(select company_id from public.app_users where id=(select auth.uid())));
create policy subcontract_work_orders_insert on public.subcontract_work_orders for insert to authenticated
with check (company_id=(select company_id from public.app_users where id=(select auth.uid())) and
  exists(select 1 from public.app_users where id=(select auth.uid()) and role in ('admin','manager','technician')));
create policy subcontract_work_orders_update on public.subcontract_work_orders for update to authenticated
using (company_id=(select company_id from public.app_users where id=(select auth.uid())) and
  exists(select 1 from public.app_users where id=(select auth.uid()) and role in ('admin','manager','technician')))
with check (company_id=(select company_id from public.app_users where id=(select auth.uid())));
create policy subcontract_work_orders_delete on public.subcontract_work_orders for delete to authenticated
using (company_id=(select company_id from public.app_users where id=(select auth.uid())) and
  exists(select 1 from public.app_users where id=(select auth.uid()) and role in ('admin','manager')));

create policy subcontract_receipts_select on public.subcontract_receipts for select to authenticated
using (company_id=(select company_id from public.app_users where id=(select auth.uid())));
create policy subcontract_receipts_insert on public.subcontract_receipts for insert to authenticated
with check (company_id=(select company_id from public.app_users where id=(select auth.uid())) and
  exists(select 1 from public.app_users where id=(select auth.uid()) and role in ('admin','manager','technician')));
create policy subcontract_receipts_update on public.subcontract_receipts for update to authenticated
using (company_id=(select company_id from public.app_users where id=(select auth.uid())) and
  exists(select 1 from public.app_users where id=(select auth.uid()) and role in ('admin','manager','technician')))
with check (company_id=(select company_id from public.app_users where id=(select auth.uid())));
create policy subcontract_receipts_delete on public.subcontract_receipts for delete to authenticated
using (company_id=(select company_id from public.app_users where id=(select auth.uid())) and
  exists(select 1 from public.app_users where id=(select auth.uid()) and role in ('admin','manager')));

create policy subcontract_vouchers_select on public.subcontract_vouchers for select to authenticated
using (company_id=(select company_id from public.app_users where id=(select auth.uid())));
create policy subcontract_vouchers_insert on public.subcontract_vouchers for insert to authenticated
with check (company_id=(select company_id from public.app_users where id=(select auth.uid())) and
  exists(select 1 from public.app_users where id=(select auth.uid()) and role in ('admin','manager','accountant')));
create policy subcontract_vouchers_update on public.subcontract_vouchers for update to authenticated
using (company_id=(select company_id from public.app_users where id=(select auth.uid())) and
  exists(select 1 from public.app_users where id=(select auth.uid()) and role in ('admin','manager','accountant')))
with check (company_id=(select company_id from public.app_users where id=(select auth.uid())));
create policy subcontract_vouchers_delete on public.subcontract_vouchers for delete to authenticated
using (company_id=(select company_id from public.app_users where id=(select auth.uid())) and
  exists(select 1 from public.app_users where id=(select auth.uid()) and role in ('admin','manager')));

create or replace function public.validate_subcontract_documents() returns trigger
language plpgsql security invoker set search_path='' as $$
declare role_name text;
begin
  select role into role_name from public.app_users where id=auth.uid() and company_id=coalesce(new.company_id,old.company_id);
  if TG_TABLE_NAME='subcontract_work_orders' then
    if nullif(trim(new.number),'') is null or nullif(trim(new.title),'') is null or nullif(trim(new.scope_of_work),'') is null then raise exception 'Work order number, title and scope are required'; end if;
    if new.due_date is not null and new.due_date<new.issue_date then raise exception 'Work order due date cannot precede issue date'; end if;
    if TG_OP='UPDATE' and old.status in ('completed','cancelled') and new.status<>old.status then raise exception 'Closed work order cannot be reopened'; end if;
  elsif TG_TABLE_NAME='subcontract_receipts' then
    if nullif(trim(new.number),'') is null or nullif(trim(new.description),'') is null then raise exception 'Receipt number and description are required'; end if;
    if new.status='accepted' and new.accepted_at is null then new.accepted_at:=now(); end if;
    if new.status='rejected' and nullif(trim(coalesce(new.rejection_reason,'')),'') is null then raise exception 'Rejection reason is required'; end if;
  elsif TG_TABLE_NAME='subcontract_vouchers' then
    if nullif(trim(new.number),'') is null or nullif(trim(new.description),'') is null or new.amount<=0 then raise exception 'Voucher number, description and positive amount are required'; end if;
    if new.status in ('approved','paid') and role_name not in ('admin','manager','accountant') then raise exception 'Finance permission required' using errcode='42501'; end if;
    if new.status='paid' and (new.payment_method is null or new.paid_at is null) then raise exception 'Paid voucher requires payment method and paid date'; end if;
  end if;
  new.updated_at:=now();
  return new;
end $$;
revoke all on function public.validate_subcontract_documents() from public, anon, authenticated;
create trigger subcontract_work_orders_validation before insert or update on public.subcontract_work_orders for each row execute function public.validate_subcontract_documents();
create trigger subcontract_receipts_validation before insert or update on public.subcontract_receipts for each row execute function public.validate_subcontract_documents();
create trigger subcontract_vouchers_validation before insert or update on public.subcontract_vouchers for each row execute function public.validate_subcontract_documents();

comment on table public.subcontract_work_orders is 'Issued and trackable work orders for subcontractors';
comment on table public.subcontract_receipts is 'Material/work receiving and acceptance documents';
comment on table public.subcontract_vouchers is 'Controlled payment/financial vouchers for subcontractors';
