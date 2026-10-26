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
    and invoice.legacy_id = nullif(btrim(p_legacy_id), '')
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
