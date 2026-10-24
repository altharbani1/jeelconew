-- Preserve invoice payment totals and receipt associations in the relational store.
-- Backfill values from the legacy JSON store when those rows are still available.

alter table public.invoices
  add column if not exists paid_amount numeric;

update public.invoices as invoice
set paid_amount = coalesce((
  select greatest(0, case
    when coalesce(legacy.data->>'paidAmount', legacy.data->'data'->>'paidAmount', '') ~ '^[0-9]+(\.[0-9]+)?$'
      then coalesce(legacy.data->>'paidAmount', legacy.data->'data'->>'paidAmount')::numeric
    when lower(coalesce(invoice.status, '')) = 'paid' then coalesce(invoice.total, 0)
    else 0
  end)
  from public.jilco_realtime_data as legacy
  where legacy.collection = 'jilco_invoices_archive'
    and legacy.company_id = invoice.company_id
    and legacy.record_id in (invoice.legacy_id, invoice.number)
  order by (legacy.record_id = invoice.legacy_id) desc
  limit 1
), case
  when lower(coalesce(invoice.status, '')) = 'paid' then greatest(coalesce(invoice.total, 0), 0)
  else 0
end)
where invoice.paid_amount is null;

alter table public.invoices
  alter column paid_amount set default 0,
  alter column paid_amount set not null;

alter table public.receipts
  add column if not exists invoice_number text,
  add column if not exists customer_legacy_id text;

update public.receipts as receipt
set invoice_number = coalesce(receipt.invoice_number, (
      select coalesce(
        nullif(btrim(legacy.data->>'invoiceId'), ''),
        nullif(btrim(legacy.data->'data'->>'invoiceId'), '')
      )
      from public.jilco_realtime_data as legacy
      where legacy.collection = 'jilco_receipts_archive'
        and legacy.company_id = receipt.company_id
        and legacy.record_id in (receipt.legacy_id, receipt.number)
      order by (legacy.record_id = receipt.legacy_id) desc
      limit 1
    )),
    customer_legacy_id = coalesce(receipt.customer_legacy_id, (
      select coalesce(
        nullif(btrim(legacy.data->>'customerId'), ''),
        nullif(btrim(legacy.data->'data'->>'customerId'), '')
      )
      from public.jilco_realtime_data as legacy
      where legacy.collection = 'jilco_receipts_archive'
        and legacy.company_id = receipt.company_id
        and legacy.record_id in (receipt.legacy_id, receipt.number)
      order by (legacy.record_id = receipt.legacy_id) desc
      limit 1
    ))
where receipt.invoice_number is null or receipt.customer_legacy_id is null;
