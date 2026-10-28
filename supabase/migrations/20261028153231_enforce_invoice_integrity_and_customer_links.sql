-- Preserve stable customer ownership and enforce totals for RPC and direct writes.
alter table public.invoices
  add column if not exists customer_legacy_id text,
  add column if not exists customer_id uuid references public.customers(id);
create index if not exists invoices_company_customer_legacy_idx
  on public.invoices(company_id, customer_legacy_id);

-- Recover explicit identifiers only. Names are not reliable identifiers.
update public.invoices as invoice
set customer_legacy_id = coalesce(customer.legacy_id, customer.id::text)
from public.customers as customer
where invoice.customer_legacy_id is null
  and invoice.customer_id = customer.id and invoice.company_id = customer.company_id;

update public.invoices as invoice
set customer_legacy_id = coalesce(customer.legacy_id, customer.id::text),
    customer_id = customer.id
from public.jilco_realtime_data as legacy, public.customers as customer
where invoice.customer_legacy_id is null
  and legacy.collection = 'jilco_invoices_archive'
  and legacy.company_id = invoice.company_id
  and legacy.record_id = invoice.legacy_id
  and customer.company_id = invoice.company_id
  and coalesce(legacy.data->>'customerId', legacy.data->'data'->>'customerId')
      = coalesce(customer.legacy_id, customer.id::text);

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

  select coalesce(sum(receipt.amount), 0) into receipt_total
  from public.receipts as receipt
  where receipt.company_id = new.company_id and receipt.invoice_number = new.number;
  if greatest(coalesce(new.paid_amount, 0), receipt_total) > new.total + 0.01 then
    raise exception 'Invoice total cannot be less than recorded payments' using errcode = '22023';
  end if;
  new.status := case when coalesce(new.paid_amount, 0) >= new.total - 0.01 then 'paid'
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

create or replace function public.save_invoice_record(p_invoice jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_company_id uuid;
  v_legacy_id text;
  v_number text;
  v_invoice_id uuid;
  v_paid numeric;
  v_total numeric;
  v_status text;
  v_legacy_data jsonb;
  v_legacy_paid text;
  v_legacy_status text;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select user_row.company_id
    into v_company_id
  from public.app_users as user_row
  where user_row.id = v_user_id;
  if v_company_id is null then
    raise exception 'Authenticated user has no company' using errcode = '42501';
  end if;

  v_number := nullif(btrim(p_invoice->>'number'), '');
  v_legacy_id := nullif(btrim(p_invoice->>'legacy_id'), '');
  if v_number is null or v_legacy_id is null then
    raise exception 'Invoice number and legacy id are required' using errcode = '22023';
  end if;
  v_total := greatest(0, coalesce((p_invoice->>'total')::numeric, 0));

  select invoice.id, invoice.paid_amount
    into v_invoice_id, v_paid
  from public.invoices as invoice
  where invoice.company_id = v_company_id
    and invoice.legacy_id = v_legacy_id
  for update;

  if v_invoice_id is null then
    select legacy.data
      into v_legacy_data
    from public.jilco_realtime_data as legacy
    where legacy.collection = 'jilco_invoices_archive'
      and legacy.company_id = v_company_id
      and legacy.record_id in (v_legacy_id, v_number)
    order by (legacy.record_id = v_legacy_id) desc
    limit 1;

    v_paid := 0;
    v_legacy_paid := v_legacy_data->>'paidAmount';
    if coalesce(v_legacy_paid, '') ~ '^[0-9]+(\.[0-9]+)?$' then
      v_paid := v_legacy_paid::numeric;
    else
      v_legacy_paid := v_legacy_data->'data'->>'paidAmount';
      if coalesce(v_legacy_paid, '') ~ '^[0-9]+(\.[0-9]+)?$' then
        v_paid := v_legacy_paid::numeric;
      else
        v_legacy_status := lower(coalesce(
          nullif(v_legacy_data->>'status', ''),
          nullif(v_legacy_data->'data'->>'status', ''),
          ''
        ));
        if v_legacy_status = 'paid' then
          v_paid := v_total;
        end if;
      end if;
    end if;
  else
    -- Once relational, paid_amount is authoritative and must not be replaced
    -- by an older copy from the legacy JSON store.
    v_paid := coalesce(v_paid, 0);
  end if;

  if v_paid >= v_total - 0.01 then
    v_status := 'paid';
  elsif v_paid > 0 then
    v_status := 'partial';
  else
    v_status := 'pending';
  end if;

  if v_invoice_id is null then
    insert into public.invoices (
      company_id, legacy_id, number, date, due_date, customer_name,
      customer_vat_number, customer_legacy_id, items, total, paid_amount, status,
      discount_amount, is_tax_inclusive
    ) values (
      v_company_id, v_legacy_id, v_number,
      nullif(p_invoice->>'date', '')::date,
      nullif(p_invoice->>'due_date', '')::date,
      coalesce(p_invoice->>'customer_name', ''),
      nullif(p_invoice->>'customer_vat_number', ''), nullif(p_invoice->>'customer_legacy_id', ''),
      case when jsonb_typeof(p_invoice->'items') = 'array' then p_invoice->'items' else '[]'::jsonb end,
      v_total, v_paid, v_status,
      greatest(0, coalesce((p_invoice->>'discount_amount')::numeric, 0)),
      coalesce((p_invoice->>'is_tax_inclusive')::boolean, true)
    ) returning id into v_invoice_id;
  else
    update public.invoices as invoice
    set number = v_number,
        date = nullif(p_invoice->>'date', '')::date,
        due_date = nullif(p_invoice->>'due_date', '')::date,
        customer_name = coalesce(p_invoice->>'customer_name', ''),
        customer_vat_number = nullif(p_invoice->>'customer_vat_number', ''),
        customer_legacy_id = nullif(p_invoice->>'customer_legacy_id', ''),
        items = case when jsonb_typeof(p_invoice->'items') = 'array' then p_invoice->'items' else '[]'::jsonb end,
        total = v_total,
        status = v_status,
        discount_amount = greatest(0, coalesce((p_invoice->>'discount_amount')::numeric, 0)),
        is_tax_inclusive = coalesce((p_invoice->>'is_tax_inclusive')::boolean, true)
    where invoice.id = v_invoice_id and invoice.company_id = v_company_id;
    if not found then
      raise exception 'Invoice could not be updated in the current company' using errcode = 'P0002';
    end if;
  end if;

  return (select jsonb_build_object(
    'id', invoice.legacy_id, 'number', invoice.number,
    'paidAmount', invoice.paid_amount, 'status', invoice.status,
    'items', invoice.items, 'discountAmount', invoice.discount_amount,
    'grandTotal', invoice.total, 'customerId', invoice.customer_legacy_id
  ) from public.invoices as invoice where invoice.id = v_invoice_id and invoice.company_id = v_company_id);
end;
$$;

revoke all on function public.save_invoice_record(jsonb) from public, anon;
grant execute on function public.save_invoice_record(jsonb) to authenticated;

create or replace function public.delete_invoice_without_receipts(p_legacy_id text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_invoice_id uuid;
  v_invoice_number text;
begin
  select user_row.company_id
    into v_company_id
  from public.app_users as user_row
  where user_row.id = (select auth.uid());

  if v_company_id is null then
    raise exception 'Authenticated user has no company' using errcode = '42501';
  end if;

  select invoice.id, invoice.number
    into v_invoice_id, v_invoice_number
  from public.invoices as invoice
  where invoice.company_id = v_company_id
    and (invoice.legacy_id = nullif(btrim(p_legacy_id), '')
      or (invoice.number = nullif(btrim(p_legacy_id), '') and
          (select count(*) from public.invoices as candidate
           where candidate.company_id = v_company_id and candidate.number = nullif(btrim(p_legacy_id), '')) = 1))
  order by (invoice.legacy_id = nullif(btrim(p_legacy_id), '')) desc
  limit 1
  for update;

  if not found then
    return false;
  end if;

  if exists (
    select 1
    from public.receipts as receipt
    where receipt.company_id = v_company_id
      and receipt.invoice_number = v_invoice_number
  ) then
    return false;
  end if;

  delete from public.invoices as invoice
  where invoice.id = v_invoice_id
    and invoice.company_id = v_company_id;

  return found;
end;
$$;

revoke all on function public.delete_invoice_without_receipts(text) from public, anon;
grant execute on function public.delete_invoice_without_receipts(text) to authenticated;
