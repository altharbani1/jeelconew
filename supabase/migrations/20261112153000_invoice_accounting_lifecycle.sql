-- Keep historical payments separate from receipts and preserve issued documents.
alter table public.invoices
  add column opening_paid_amount numeric not null default 0,
  add column voided_at timestamptz,
  add column void_reason text;

with balances as (
  select i.id, coalesce(sum(round(r.amount, 2)), 0) as receipts
  from public.invoices i left join public.receipts r
    on r.company_id = i.company_id and r.invoice_number = i.number
  group by i.id
)
update public.invoices i
set opening_paid_amount = greatest(0, round(i.paid_amount, 2) - b.receipts),
    paid_amount = greatest(round(i.paid_amount, 2), b.receipts),
    status = case when greatest(round(i.paid_amount, 2), b.receipts) >= round(i.total, 2) then 'paid'
                  when greatest(round(i.paid_amount, 2), b.receipts) > 0 then 'partial' else 'pending' end
from balances b where b.id = i.id and i.total is not null and i.total >= 0;

create or replace function public.enforce_receipt_invoice_balance()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  linked public.invoices%rowtype;
  prior numeric;
  previous_number text;
begin
  if tg_op <> 'INSERT' then previous_number := old.invoice_number; end if;
  if tg_op = 'DELETE' then
    perform id from public.invoices
    where company_id = old.company_id and number = previous_number
    order by number, id for update;
    return old;
  end if;
  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'Receipt company cannot change';
  end if;
  perform id from public.invoices
  where company_id = new.company_id and number in (previous_number, new.invoice_number)
  order by number, id for update;
  if new.amount is null or new.amount::text in ('NaN', 'Infinity', '-Infinity')
     or round(new.amount, 2) <= 0 then
    raise exception 'Receipt amount must be positive in halalas' using errcode = '22023';
  end if;
  new.amount := round(new.amount, 2);
  if new.invoice_number is null then return new; end if;

  select * into strict linked from public.invoices
  where company_id = new.company_id and number = new.invoice_number for update;
  if linked.voided_at is not null then
    raise exception 'Cancelled invoices cannot receive payments' using errcode = '22023';
  end if;
  if nullif(btrim(new.customer_legacy_id), '') is not null
     and new.customer_legacy_id is distinct from linked.customer_legacy_id then
    raise exception 'Receipt customer must match the invoice customer' using errcode = '22023';
  end if;
  new.customer_legacy_id := linked.customer_legacy_id;

  select coalesce(sum(round(amount, 2)), 0) into prior from public.receipts
  where company_id = new.company_id and invoice_number = new.invoice_number
    and legacy_id is distinct from new.legacy_id;
  if linked.opening_paid_amount + prior + new.amount > round(linked.total, 2) then
    raise exception 'Receipt amount exceeds the remaining invoice balance' using errcode = '22023';
  end if;
  return new;
exception
  when no_data_found or too_many_rows then
    raise exception 'Linked invoice was not found uniquely in the current company' using errcode = '22023';
end;
$$;

drop trigger receipts_enforce_invoice_balance on public.receipts;
create trigger receipts_enforce_invoice_balance
before insert or update or delete on public.receipts
for each row execute function public.enforce_receipt_invoice_balance();


create or replace function public.enforce_invoice_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  quantity numeric;
  price numeric;
  line_total numeric;
  subtotal numeric := 0;
  net numeric;
  receipt_total numeric;
  normalized_items jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(new.items) is distinct from 'array' or jsonb_array_length(new.items) = 0 then
    raise exception 'Invoice must contain at least one item' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(new.items) loop
    quantity := (item->>'quantity')::numeric;
    price := (item->>'unitPrice')::numeric;
    if quantity is null or price is null or quantity <= 0 or price < 0
       or quantity::text in ('NaN', 'Infinity', '-Infinity')
       or price::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'Invoice quantities and prices must be finite and non-negative, with positive quantities' using errcode = '22023';
    end if;
    line_total := round(quantity * price, 2);
    subtotal := subtotal + line_total;
    normalized_items := normalized_items || jsonb_build_array(item || jsonb_build_object(
      'quantity', quantity, 'unitPrice', price, 'total', line_total
    ));
  end loop;
  if new.discount_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'Invalid invoice discount' using errcode = '22023';
  end if;
  new.items := normalized_items;
  new.discount_amount := round(least(subtotal, greatest(0, coalesce(new.discount_amount, 0))), 2);
  net := greatest(0, subtotal - new.discount_amount);
  new.total := case when new.is_tax_inclusive is false then net + round(net * 0.15, 2) else net end;

  select coalesce(sum(round(receipt.amount, 2)), 0) into receipt_total
  from public.receipts as receipt
  where receipt.company_id = new.company_id and receipt.invoice_number = new.number;
  if tg_op = 'INSERT' then
    new.opening_paid_amount := greatest(0, round(coalesce(new.paid_amount, 0), 2) - receipt_total);
  end if;
  new.paid_amount := new.opening_paid_amount + receipt_total;
  if new.paid_amount > new.total then
    raise exception 'Invoice total cannot be less than recorded payments' using errcode = '22023';
  end if;
  new.status := case when coalesce(new.paid_amount, 0) >= new.total then 'paid'
                     when coalesce(new.paid_amount, 0) > 0 then 'partial' else 'pending' end;

  new.customer_legacy_id := nullif(btrim(new.customer_legacy_id), '');
  if new.customer_legacy_id is not null then
    select customer.id into new.customer_id
    from public.customers as customer
    where customer.company_id = new.company_id
      and coalesce(customer.legacy_id, customer.id::text) = new.customer_legacy_id;
    if not found then
      raise exception 'Invoice customer does not belong to this company' using errcode = '22023';
    end if;
  else
    new.customer_id := null;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_invoice_integrity() from public, anon, authenticated;
drop trigger if exists invoices_enforce_integrity on public.invoices;
create trigger invoices_enforce_integrity
  before insert or update of items, total, discount_amount, is_tax_inclusive, customer_legacy_id
  on public.invoices for each row execute function public.enforce_invoice_integrity();


create or replace function public.save_receipt_with_invoice_recalculation(p_receipt jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_receipt_legacy_id text;
  v_old_invoice_number text;
  v_new_invoice_number text;
  v_invoice record;

  v_updates jsonb := '[]'::jsonb;
  v_invoice_match_count integer;
begin
  select au.company_id
    into v_company_id
  from public.app_users as au
  where au.id = (select auth.uid());

  if v_company_id is null then
    raise exception 'Authenticated user has no company' using errcode = '42501';
  end if;

  v_receipt_legacy_id := nullif(btrim(p_receipt->>'legacy_id'), '');
  v_new_invoice_number := nullif(btrim(p_receipt->>'invoice_number'), '');
  if v_receipt_legacy_id is null then
    raise exception 'Receipt legacy id is required' using errcode = '22023';
  end if;
  if coalesce((p_receipt->>'amount')::numeric, 0) <= 0 then
    raise exception 'Receipt amount must be positive' using errcode = '22023';
  end if;

  select receipt.invoice_number
    into v_old_invoice_number
  from public.receipts as receipt
  where receipt.legacy_id = v_receipt_legacy_id
    and receipt.company_id = v_company_id
  for update;

  if v_new_invoice_number is not null then
    select count(*) into v_invoice_match_count
    from public.invoices as invoice
    where invoice.company_id = v_company_id
      and invoice.number = v_new_invoice_number;
    if v_invoice_match_count <> 1 then
      raise exception 'Linked invoice was not found uniquely in the current company' using errcode = '22023';
    end if;
  end if;

  -- Lock affected invoices in a stable order before changing the receipt.
  perform invoice.id
  from public.invoices as invoice
  where invoice.company_id = v_company_id
    and invoice.number in (v_old_invoice_number, v_new_invoice_number)
  order by invoice.number, invoice.id
  for update;

  if v_new_invoice_number is not null and not exists (
    select 1 from public.invoices as invoice
    where invoice.company_id = v_company_id
      and invoice.number = v_new_invoice_number
  ) then
    raise exception 'Linked invoice no longer exists in the current company' using errcode = '22023';
  end if;

  insert into public.receipts (
    company_id, legacy_id, number, date, received_from, amount, amount_in_words,
    payment_method, bank_name, check_number, for_reason, attachments,
    invoice_number, customer_legacy_id
  ) values (
    v_company_id,
    v_receipt_legacy_id,
    coalesce(nullif(p_receipt->>'number', ''), v_receipt_legacy_id),
    nullif(p_receipt->>'date', '')::date,
    coalesce(p_receipt->>'received_from', ''),
    (p_receipt->>'amount')::numeric,
    coalesce(p_receipt->>'amount_in_words', ''),
    coalesce(nullif(p_receipt->>'payment_method', ''), 'transfer'),
    p_receipt->>'bank_name',
    p_receipt->>'check_number',
    coalesce(p_receipt->>'for_reason', ''),
    coalesce(p_receipt->'attachments', '[]'::jsonb),
    v_new_invoice_number,
    nullif(btrim(p_receipt->>'customer_legacy_id'), '')
  )
  on conflict (legacy_id) do update set
    number = excluded.number,
    date = excluded.date,
    received_from = excluded.received_from,
    amount = excluded.amount,
    amount_in_words = excluded.amount_in_words,
    payment_method = excluded.payment_method,
    bank_name = excluded.bank_name,
    check_number = excluded.check_number,
    for_reason = excluded.for_reason,
    attachments = excluded.attachments,
    invoice_number = excluded.invoice_number,
    customer_legacy_id = excluded.customer_legacy_id;

  for v_invoice in
    select invoice.id, invoice.legacy_id, invoice.number, invoice.paid_amount, invoice.status
    from public.invoices as invoice
    where invoice.company_id = v_company_id
      and invoice.number in (v_old_invoice_number, v_new_invoice_number)
    order by invoice.number, invoice.id
    for update
  loop
    v_updates := v_updates || jsonb_build_array(jsonb_build_object(
      'id', coalesce(v_invoice.legacy_id, v_invoice.number),
      'number', v_invoice.number,
      'paidAmount', v_invoice.paid_amount,
      'status', v_invoice.status
    ));
  end loop;

  return v_updates;
end;
$$;

create or replace function public.delete_receipt_with_invoice_recalculation(p_receipt_legacy_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_receipt_legacy_id text;
  v_invoice_number text;
  v_invoice record;

  v_updates jsonb := '[]'::jsonb;
begin
  select au.company_id
    into v_company_id
  from public.app_users as au
  where au.id = (select auth.uid());

  if v_company_id is null then
    raise exception 'Authenticated user has no company' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.receipts as receipt
    where receipt.legacy_id = p_receipt_legacy_id
      and receipt.company_id = v_company_id
  ) and (
    select count(*) from public.receipts as receipt
    where receipt.number = p_receipt_legacy_id
      and receipt.company_id = v_company_id
  ) <> 1 then
    raise exception 'Receipt not found uniquely in the current company' using errcode = 'P0002';
  end if;

  select receipt.legacy_id, receipt.invoice_number
    into v_receipt_legacy_id, v_invoice_number
  from public.receipts as receipt
  where (receipt.legacy_id = p_receipt_legacy_id or receipt.number = p_receipt_legacy_id)
    and receipt.company_id = v_company_id
  order by (receipt.legacy_id = p_receipt_legacy_id) desc
  limit 1
  for update;

  if not found then
    raise exception 'Receipt not found in the current company' using errcode = 'P0002';
  end if;

  perform invoice.id
  from public.invoices as invoice
  where invoice.company_id = v_company_id
    and invoice.number = v_invoice_number
  order by invoice.id
  for update;

  delete from public.receipts
  where legacy_id = v_receipt_legacy_id
    and company_id = v_company_id;
  if not found then
    raise exception 'Receipt could not be deleted' using errcode = 'P0002';
  end if;

  for v_invoice in
    select invoice.id, invoice.legacy_id, invoice.number, invoice.paid_amount, invoice.status
    from public.invoices as invoice
    where invoice.company_id = v_company_id
      and invoice.number = v_invoice_number
    order by invoice.id
    for update
  loop
    v_updates := v_updates || jsonb_build_array(jsonb_build_object(
      'id', coalesce(v_invoice.legacy_id, v_invoice.number),
      'number', v_invoice.number,
      'paidAmount', v_invoice.paid_amount,
      'status', v_invoice.status
    ));
  end loop;

  return v_updates;
end;
$$;

revoke all on function public.save_receipt_with_invoice_recalculation(jsonb) from public, anon;
revoke all on function public.delete_receipt_with_invoice_recalculation(text) from public, anon;
grant execute on function public.save_receipt_with_invoice_recalculation(jsonb) to authenticated;
grant execute on function public.delete_receipt_with_invoice_recalculation(text) to authenticated;

-- All saved records are issued. A correction preserves the original and reverses its journal.
create or replace function public.guard_issued_invoice()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  receipts numeric;
begin
  if tg_op = 'DELETE' then
    raise exception 'Issued invoices must be cancelled rather than deleted' using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - array['paid_amount','status','voided_at','void_reason','updated_at'])
         is distinct from (to_jsonb(old) - array['paid_amount','status','voided_at','void_reason','updated_at']) then
      raise exception 'Issued invoice details cannot be changed' using errcode = '22023';
    end if;
    if old.voided_at is not null and row(new.voided_at, new.void_reason) is distinct from row(old.voided_at, old.void_reason) then
      raise exception 'Invoice cancellation is immutable' using errcode = '22023';
    end if;
  end if;

  select coalesce(sum(round(amount, 2)), 0) into receipts from public.receipts
  where company_id = new.company_id and invoice_number = new.number;
  new.paid_amount := new.opening_paid_amount + receipts;
  if new.voided_at is not null then
    if new.paid_amount <> 0 or exists (
      select 1 from public.receipts where company_id = new.company_id and invoice_number = new.number
    ) then
      raise exception 'Reverse linked payments before cancelling an invoice' using errcode = '22023';
    end if;
    new.void_reason := nullif(btrim(new.void_reason), '');
    if new.void_reason is null then
      raise exception 'Invoice cancellation requires a reason' using errcode = '22023';
    end if;
    if tg_op = 'INSERT' then
      raise exception 'A new invoice cannot be cancelled' using errcode = '22023';
    elsif old.voided_at is null then
      new.voided_at := statement_timestamp();
    end if;
    new.status := 'cancelled';
  else
    new.void_reason := null;
    new.status := case when new.paid_amount >= round(new.total, 2) then 'paid'
                       when new.paid_amount > 0 then 'partial' else 'pending' end;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_issued_invoice() from public, anon, authenticated;
create trigger zz_guard_issued_invoice before insert or update or delete on public.invoices
for each row execute function public.guard_issued_invoice();

create or replace function public.void_invoice_record(p_legacy_id text, p_reason text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update public.invoices i
  set voided_at = statement_timestamp(), void_reason = p_reason
  where i.legacy_id = p_legacy_id and i.voided_at is null
    and exists (select 1 from public.app_users u
                where u.id = (select auth.uid()) and u.company_id = i.company_id
                  and u.role in ('admin','manager','accountant'));
  if found then return true; end if;
  return exists (
    select 1 from public.invoices i join public.app_users u on u.company_id = i.company_id
    where i.legacy_id = p_legacy_id and i.voided_at is not null and u.id = (select auth.uid())
      and u.role in ('admin','manager','accountant')
  );
end;
$$;

revoke all on function public.void_invoice_record(text,text) from public, anon;
grant execute on function public.void_invoice_record(text,text) to authenticated;


-- Journal postings share the existing chart of accounts and posted-journal guards.
alter table public.accounting_journals drop constraint accounting_journals_source_type_check;
alter table public.accounting_journals add constraint accounting_journals_source_type_check
  check (source_type in ('subcontract_certificate','subcontract_voucher','manual','reversal','sales_invoice','customer_receipt'));

alter table public.receipts add column ledger_revision uuid;
create schema if not exists invoice_accounting_private;
revoke all on schema invoice_accounting_private from public, anon, authenticated;

create function invoice_accounting_private.require_finance(tenant uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.app_users u where u.id = (select auth.uid())
      and u.company_id = tenant and u.role in ('admin','manager','accountant')
  ) then
    raise exception 'Finance permission required' using errcode = '42501';
  end if;
end;
$$;

create function invoice_accounting_private.open_period(tenant uuid, entry_date date)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  period_row public.accounting_periods%rowtype;
  month_start date := date_trunc('month', entry_date)::date;
  month_end date := (month_start + interval '1 month - 1 day')::date;
begin
  if entry_date is null then raise exception 'Accounting date is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('invoice-accounting:' || tenant::text, 0));

  select * into period_row from public.accounting_periods
  where company_id = tenant and entry_date between period_start and period_end
  order by (status = 'closed') desc, period_start desc, id limit 1 for update;
  if found then
    if period_row.status <> 'open' then raise exception 'Accounting period is closed'; end if;
    return period_row.id;
  end if;
  if exists (
    select 1 from public.accounting_periods where company_id = tenant
      and period_start <= month_end and period_end >= month_start
  ) then raise exception 'No open accounting period for this date'; end if;

  insert into public.accounting_periods (id, company_id, period_start, period_end)
  values ('sales-' || tenant || '-' || month_start, tenant, month_start, month_end)
  returning id into period_row.id;
  return period_row.id;
end;
$$;

create function invoice_accounting_private.post_entry(
  tenant uuid, entry_date date, source_kind text, source_key text, memo text, entries jsonb
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  journal_key text := 'sales-' || source_kind || '-' || source_key;
  period_key text;
  line record;
  account_key text;
begin
  period_key := invoice_accounting_private.open_period(tenant, entry_date);
  insert into public.accounting_journals
    (id, company_id, period_id, number, journal_date, description, source_type, source_id, status, created_by)
  values (journal_key, tenant, period_key, journal_key, entry_date, memo, source_kind, source_key, 'draft', auth.uid())
  on conflict (company_id, source_type, source_id) do nothing;
  if not found then return; end if;

  for line in select * from jsonb_to_recordset(entries)
    as x(code text, name text, kind text, debit numeric, credit numeric)
  loop
    if line.debit = 0 and line.credit = 0 then continue; end if;
    insert into public.chart_of_accounts (id, company_id, code, name, account_type)
    values ('sales-' || tenant || '-' || line.code, tenant, line.code, line.name, line.kind)
    on conflict (company_id, code) do nothing;
    select id into account_key from public.chart_of_accounts
    where company_id = tenant and code = line.code and account_type = line.kind and is_active;
    if not found then raise exception 'Required account % is inactive or misconfigured', line.code; end if;
    insert into public.accounting_entry_lines (id, company_id, journal_id, account_id, description, debit, credit)
    values (journal_key || '-' || line.code, tenant, journal_key, account_key, memo, line.debit, line.credit);
  end loop;
  update public.accounting_journals set status = 'posted', posted_at = now(), posted_by = auth.uid()
  where id = journal_key and company_id = tenant;
end;
$$;

create function invoice_accounting_private.reverse_entry(tenant uuid, source_kind text, source_key text, memo text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  original_key text;
  entries jsonb;
begin
  select id into original_key from public.accounting_journals
  where company_id = tenant and source_type = source_kind and source_id = source_key and status = 'posted';
  if not found then return; end if;
  select jsonb_agg(jsonb_build_object(
    'code', a.code, 'name', a.name, 'kind', a.account_type, 'debit', l.credit, 'credit', l.debit
  )) into entries
  from public.accounting_entry_lines l join public.chart_of_accounts a
    on a.id = l.account_id and a.company_id = l.company_id
  where l.company_id = tenant and l.journal_id = original_key;
  perform invoice_accounting_private.post_entry(tenant, current_date, 'reversal', original_key, memo, entries);
end;
$$;

create function invoice_accounting_private.post_invoice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  taxable_net numeric;
  vat numeric;
begin
  if tg_op = 'UPDATE' then
    if old.voided_at is null and new.voided_at is not null then
      perform invoice_accounting_private.require_finance(new.company_id);
      perform invoice_accounting_private.reverse_entry(new.company_id, 'sales_invoice', new.id::text,
        'Invoice cancellation ' || new.number || ': ' || new.void_reason);
    end if;
    return new;
  end if;
  perform invoice_accounting_private.require_finance(new.company_id);
  if new.total = 0 then return new; end if;
  if new.is_tax_inclusive is false then
    select greatest(0, coalesce(sum((item->>'total')::numeric), 0) - new.discount_amount) into taxable_net
    from jsonb_array_elements(new.items) item;
  else
    taxable_net := new.total - round(new.total * 15 / 115, 2);
  end if;
  vat := new.total - taxable_net;
  perform invoice_accounting_private.post_entry(new.company_id, new.date, 'sales_invoice', new.id::text,
    'Sales invoice ' || new.number,
    jsonb_build_array(
      jsonb_build_object('code','1200','name','Accounts receivable','kind','asset','debit',new.total,'credit',0),
      jsonb_build_object('code','4100','name','Sales revenue','kind','revenue','debit',0,'credit',taxable_net),
      jsonb_build_object('code','2130','name','Output VAT','kind','liability','debit',0,'credit',vat)
    ));
  return new;
end;
$$;

create function invoice_accounting_private.assign_receipt_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.ledger_revision := gen_random_uuid();
  elsif row(new.amount, new.date, new.payment_method, new.invoice_number, new.customer_legacy_id)
      is distinct from row(old.amount, old.date, old.payment_method, old.invoice_number, old.customer_legacy_id) then
    new.ledger_revision := gen_random_uuid();
  else
    new.ledger_revision := old.ledger_revision;
  end if;
  return new;
end;
$$;

create function invoice_accounting_private.post_receipt()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  tenant uuid := case when tg_op = 'DELETE' then old.company_id else new.company_id end;
  previous_invoice text;
  current_invoice text;
  debit_code text;
  debit_name text;
begin
  perform invoice_accounting_private.require_finance(tenant);
  if tg_op = 'UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'Receipt company cannot change';
  end if;
  if tg_op <> 'INSERT' then
    previous_invoice := old.invoice_number;
    if tg_op = 'DELETE' or old.ledger_revision is distinct from new.ledger_revision then
      perform invoice_accounting_private.reverse_entry(tenant, 'customer_receipt', old.ledger_revision::text,
        'Reverse customer receipt ' || old.number);
    end if;
  end if;
  if tg_op <> 'DELETE' then
    current_invoice := new.invoice_number;
    if tg_op = 'INSERT' or old.ledger_revision is distinct from new.ledger_revision then
      debit_code := case new.payment_method when 'cash' then '1100' when 'check' then '1120' else '1110' end;
      debit_name := case new.payment_method when 'cash' then 'Cash' when 'check' then 'Checks receivable' else 'Bank' end;
      perform invoice_accounting_private.post_entry(tenant, new.date, 'customer_receipt', new.ledger_revision::text,
        'Customer receipt ' || new.number,
        jsonb_build_array(
          jsonb_build_object('code',debit_code,'name',debit_name,'kind','asset','debit',new.amount,'credit',0),
          jsonb_build_object('code',case when current_invoice is null then '2140' else '1200' end,
            'name',case when current_invoice is null then 'Unallocated customer receipts' else 'Accounts receivable' end,
            'kind',case when current_invoice is null then 'liability' else 'asset' end,'debit',0,'credit',new.amount)
        ));
    end if;
  end if;
  -- Also derive balances for direct receipt writes. The row guard calculates the exact total.
  update public.invoices set paid_amount = paid_amount
  where company_id = tenant and number in (previous_invoice, current_invoice);
  return null;
end;
$$;

revoke all on all functions in schema invoice_accounting_private from public, anon, authenticated;

create trigger invoice_post_journal after insert or update of voided_at on public.invoices
for each row execute function invoice_accounting_private.post_invoice();

create trigger zz_assign_receipt_revision before insert or update on public.receipts
for each row execute function invoice_accounting_private.assign_receipt_revision();

create trigger receipt_post_journal after insert or update or delete on public.receipts
for each row execute function invoice_accounting_private.post_receipt();


-- A caller can post manual journals, but generated source IDs belong to this workflow.
create function public.guard_sales_journal_source()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and (
    new.source_type in ('sales_invoice','customer_receipt')
    or (new.source_type = 'reversal' and new.source_id ~ '^sales-(sales_invoice|customer_receipt)-')
  ) then
    raise exception 'Invoice and receipt journal sources are system managed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_sales_journal_source() from public, anon, authenticated;
create trigger accounting_sales_source_guard before insert or update on public.accounting_journals
for each row execute function public.guard_sales_journal_source();

