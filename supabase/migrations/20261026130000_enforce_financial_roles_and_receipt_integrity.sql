-- Enforce application roles at the database boundary and preserve financial integrity.

-- Quotes are available to administrators, managers, and sales users only.
drop policy if exists quotes_tenant_access on public.quotes;
create policy quotes_role_access on public.quotes
  for all to authenticated
  using (
    company_id = (select user_row.company_id from public.app_users as user_row where user_row.id = (select auth.uid()))
    and exists (
      select 1 from public.app_users as user_row
      where user_row.id = (select auth.uid()) and user_row.role in ('admin', 'manager', 'sales')
    )
  )
  with check (
    company_id = (select user_row.company_id from public.app_users as user_row where user_row.id = (select auth.uid()))
    and exists (
      select 1 from public.app_users as user_row
      where user_row.id = (select auth.uid()) and user_row.role in ('admin', 'manager', 'sales')
    )
  );

drop policy if exists quote_items_tenant_access on public.quote_items;
create policy quote_items_role_access on public.quote_items
  for all to authenticated
  using (
    exists (
      select 1 from public.quotes as quote
      join public.app_users as user_row on user_row.company_id = quote.company_id
      where quote.id = quote_items.quote_id and user_row.id = (select auth.uid())
        and user_row.role in ('admin', 'manager', 'sales')
    )
  )
  with check (
    exists (
      select 1 from public.quotes as quote
      join public.app_users as user_row on user_row.company_id = quote.company_id
      where quote.id = quote_items.quote_id and user_row.id = (select auth.uid())
        and user_row.role in ('admin', 'manager', 'sales')
    )
  );

drop policy if exists quote_specs_tenant_access on public.quote_specs;
create policy quote_specs_role_access on public.quote_specs
  for all to authenticated
  using (
    exists (
      select 1 from public.quotes as quote
      join public.app_users as user_row on user_row.company_id = quote.company_id
      where quote.id = quote_specs.quote_id and user_row.id = (select auth.uid())
        and user_row.role in ('admin', 'manager', 'sales')
    )
  )
  with check (
    exists (
      select 1 from public.quotes as quote
      join public.app_users as user_row on user_row.company_id = quote.company_id
      where quote.id = quote_specs.quote_id and user_row.id = (select auth.uid())
        and user_row.role in ('admin', 'manager', 'sales')
    )
  );

-- Financial records are restricted to finance-capable roles.
drop policy if exists "Users can access their company data" on public.receipts;
drop policy if exists receipts_tenant_access on public.receipts;
drop policy if exists receipts_company_access on public.receipts;
create policy receipts_finance_access on public.receipts
  for all to authenticated
  using (
    company_id = (select user_row.company_id from public.app_users as user_row where user_row.id = (select auth.uid()))
    and exists (
      select 1 from public.app_users as user_row
      where user_row.id = (select auth.uid()) and user_row.role in ('admin', 'manager', 'accountant')
    )
  )
  with check (
    company_id = (select user_row.company_id from public.app_users as user_row where user_row.id = (select auth.uid()))
    and exists (
      select 1 from public.app_users as user_row
      where user_row.id = (select auth.uid()) and user_row.role in ('admin', 'manager', 'accountant')
    )
  );

-- Block direct invoice deletion if any receipt is linked, even when the RPC is bypassed.
drop policy if exists invoices_no_receipt_delete on public.invoices;
create policy invoices_no_receipt_delete on public.invoices as restrictive
  for delete to authenticated
  using (
    not exists (
      select 1 from public.receipts as receipt
      where receipt.company_id = invoices.company_id
        and receipt.invoice_number = invoices.number
    )
  );

-- Do not allow receipt numbers to collide within a company.
create unique index if not exists receipts_company_number_key
  on public.receipts (company_id, btrim(number))
  where company_id is not null and number is not null and btrim(number) <> '';

-- Enforce the invoice balance in the database, including concurrent receipt writes.
create or replace function public.enforce_receipt_invoice_balance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_invoice_total numeric;
  v_prior_paid numeric;
begin
  if new.invoice_number is null then
    return new;
  end if;

  select invoice.total into v_invoice_total
  from public.invoices as invoice
  where invoice.company_id = new.company_id and invoice.number = new.invoice_number
  for update;

  if not found then
    raise exception 'Linked invoice was not found in the current company' using errcode = '22023';
  end if;

  select coalesce(sum(receipt.amount), 0) into v_prior_paid
  from public.receipts as receipt
  where receipt.company_id = new.company_id
    and receipt.invoice_number = new.invoice_number
    and receipt.legacy_id is distinct from new.legacy_id;

  if coalesce(v_invoice_total, 0) > 0 and v_prior_paid + new.amount > v_invoice_total + 0.01 then
    raise exception 'Receipt amount exceeds the remaining invoice balance' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists receipts_enforce_invoice_balance on public.receipts;
create trigger receipts_enforce_invoice_balance
  before insert or update of company_id, invoice_number, amount on public.receipts
  for each row execute function public.enforce_receipt_invoice_balance();


