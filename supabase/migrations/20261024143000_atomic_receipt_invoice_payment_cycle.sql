-- Keep receipt writes/deletes and every affected invoice balance in one transaction.
create index if not exists invoices_company_number_idx
  on public.invoices(company_id, number);
create index if not exists receipts_company_invoice_number_idx
  on public.receipts(company_id, invoice_number)
  where invoice_number is not null;

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
  v_paid numeric;
  v_invoice_total numeric;
  v_items_total numeric;
  v_status text;
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
    select invoice.id, invoice.legacy_id, invoice.number, invoice.total,
           invoice.items, invoice.discount_amount, invoice.is_tax_inclusive
    from public.invoices as invoice
    where invoice.company_id = v_company_id
      and invoice.number in (v_old_invoice_number, v_new_invoice_number)
    order by invoice.number, invoice.id
    for update
  loop
    select coalesce(sum(receipt.amount), 0)
      into v_paid
    from public.receipts as receipt
    where receipt.company_id = v_company_id
      and receipt.invoice_number = v_invoice.number;

    if coalesce(v_invoice.total, 0) > 0 then
      v_invoice_total := v_invoice.total;
    else
      select coalesce(sum(case
        when coalesce(item.value->>'total', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (item.value->>'total')::numeric
        else 0
      end), 0)
      into v_items_total
      from jsonb_array_elements(case
        when jsonb_typeof(v_invoice.items) = 'array' then v_invoice.items
        else '[]'::jsonb
      end) as item(value);
      v_invoice_total := greatest(0, v_items_total - coalesce(v_invoice.discount_amount, 0));
      if v_invoice.is_tax_inclusive is false then
        v_invoice_total := v_invoice_total * 1.15;
      end if;
    end if;

    if v_paid >= v_invoice_total - 0.01 then
      v_status := 'paid';
    elsif v_paid > 0 then
      v_status := 'partial';
    else
      v_status := 'pending';
    end if;

    update public.invoices
    set paid_amount = v_paid, status = v_status
    where id = v_invoice.id and company_id = v_company_id;

    v_updates := v_updates || jsonb_build_array(jsonb_build_object(
      'id', coalesce(v_invoice.legacy_id, v_invoice.number),
      'number', v_invoice.number,
      'paidAmount', v_paid,
      'status', v_status
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
  v_paid numeric;
  v_invoice_total numeric;
  v_items_total numeric;
  v_status text;
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
    select invoice.id, invoice.legacy_id, invoice.number, invoice.total,
           invoice.items, invoice.discount_amount, invoice.is_tax_inclusive
    from public.invoices as invoice
    where invoice.company_id = v_company_id
      and invoice.number = v_invoice_number
    order by invoice.id
    for update
  loop
    select coalesce(sum(receipt.amount), 0)
      into v_paid
    from public.receipts as receipt
    where receipt.company_id = v_company_id
      and receipt.invoice_number = v_invoice.number;

    if coalesce(v_invoice.total, 0) > 0 then
      v_invoice_total := v_invoice.total;
    else
      select coalesce(sum(case
        when coalesce(item.value->>'total', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (item.value->>'total')::numeric
        else 0
      end), 0)
      into v_items_total
      from jsonb_array_elements(case
        when jsonb_typeof(v_invoice.items) = 'array' then v_invoice.items
        else '[]'::jsonb
      end) as item(value);
      v_invoice_total := greatest(0, v_items_total - coalesce(v_invoice.discount_amount, 0));
      if v_invoice.is_tax_inclusive is false then
        v_invoice_total := v_invoice_total * 1.15;
      end if;
    end if;

    if v_paid >= v_invoice_total - 0.01 then
      v_status := 'paid';
    elsif v_paid > 0 then
      v_status := 'partial';
    else
      v_status := 'pending';
    end if;

    update public.invoices
    set paid_amount = v_paid, status = v_status
    where id = v_invoice.id and company_id = v_company_id;

    v_updates := v_updates || jsonb_build_array(jsonb_build_object(
      'id', coalesce(v_invoice.legacy_id, v_invoice.number),
      'number', v_invoice.number,
      'paidAmount', v_paid,
      'status', v_status
    ));
  end loop;

  return v_updates;
end;
$$;

revoke all on function public.save_receipt_with_invoice_recalculation(jsonb) from public, anon;
revoke all on function public.delete_receipt_with_invoice_recalculation(text) from public, anon;
grant execute on function public.save_receipt_with_invoice_recalculation(jsonb) to authenticated;
grant execute on function public.delete_receipt_with_invoice_recalculation(text) to authenticated;
