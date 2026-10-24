-- Reserve invoice numbers under a global per-year lock so concurrent companies
-- and clients cannot receive the same legacy_id.
create table if not exists public.invoice_number_reservations (
  invoice_number text primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  invoice_year integer not null check (invoice_year between 2000 and 9999),
  sequence_number bigint not null check (sequence_number > 0),
  reserved_by uuid not null,
  reserved_at timestamptz not null default now(),
  consumed_at timestamptz,
  unique (invoice_year, sequence_number)
);

alter table public.invoice_number_reservations
  add column if not exists consumed_at timestamptz;

-- Preserve already-issued standard invoice sequences before the reservation
-- trigger is installed. When legacy width variants share one numeric
-- sequence, the lexicographically smallest number wins deterministically;
-- the unique sequence tombstone still prevents reuse of every variant.
-- The nil UUID below marks a system-created historical reservation; reserved_by
-- intentionally has no auth.users foreign key.
update public.invoice_number_reservations as reservation
set consumed_at = coalesce(reservation.consumed_at, now())
from public.invoices as invoice
where invoice.company_id = reservation.company_id
  and invoice.number = reservation.invoice_number
  and reservation.consumed_at is null;

with parsed_invoices as (
  select invoice.id as invoice_id,
         invoice.company_id,
         invoice.number as invoice_number,
         invoice.created_at,
         parts.captures[1]::integer as invoice_year,
         case when length(parts.captures[2]) <= 19
              then parts.captures[2]::numeric
              else null end as sequence_numeric
  from public.invoices as invoice
  cross join lateral (
    select pg_catalog.regexp_match(invoice.number, '^INV-([0-9]{4})-([0-9]{3,})$') as captures
  ) as parts
  where invoice.company_id is not null
    and parts.captures is not null
), ranked_invoices as (
  select parsed.*,
         row_number() over (
           partition by parsed.invoice_year, parsed.sequence_numeric
           order by parsed.invoice_number collate "C", parsed.company_id::text, parsed.invoice_id::text
         ) as sequence_rank
  from parsed_invoices as parsed
  where parsed.invoice_year between 2000 and 9999
    and parsed.sequence_numeric between 1 and 9223372036854775807
)
insert into public.invoice_number_reservations (
  invoice_number, company_id, invoice_year, sequence_number, reserved_by, reserved_at, consumed_at
)
select ranked.invoice_number,
       ranked.company_id,
       ranked.invoice_year,
       ranked.sequence_numeric::bigint,
       '00000000-0000-0000-0000-000000000000'::uuid,
       coalesce(ranked.created_at, now()),
       now()
from ranked_invoices as ranked
where ranked.sequence_rank = 1
  and not exists (
    select 1 from public.invoice_number_reservations as reservation
    where reservation.invoice_number = ranked.invoice_number
       or (reservation.invoice_year = ranked.invoice_year
           and reservation.sequence_number = ranked.sequence_numeric::bigint)
  )
on conflict do nothing;

alter table public.invoice_number_reservations enable row level security;
revoke all on public.invoice_number_reservations from public, anon, authenticated;

create or replace function public.reserve_invoice_number(p_year integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_user_id uuid;
  v_role text;
  v_prefix text;
  v_max_sequence bigint;
  v_sequence bigint;
  v_candidate text;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_year is null or p_year not between 2000 and 9999 then
    raise exception 'Invalid invoice year' using errcode = '22023';
  end if;

  select user_row.company_id, user_row.role
    into v_company_id, v_role
  from public.app_users as user_row
  where user_row.id = v_user_id;
  if v_company_id is null then
    raise exception 'Authenticated user has no company' using errcode = '42501';
  end if;
  if coalesce(v_role, '') not in ('admin', 'manager', 'accountant') then
    raise exception 'Invoice number reservation requires finance permission' using errcode = '42501';
  end if;

  -- Numbers also become invoice legacy IDs, which are globally unique. Lock
  -- by year globally (not by company) to protect both the reservation table
  -- and that shared legacy-ID namespace.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('invoice-number:' || p_year::text, 0)
  );

  v_prefix := 'INV-' || p_year::text || '-';
  with invoice_values as (
    select invoice.number as value
    from public.invoices as invoice
    where invoice.number like v_prefix || '%'
    union all
    select invoice.legacy_id as value
    from public.invoices as invoice
    where invoice.legacy_id like v_prefix || '%'
    union all
    select legacy.record_id as value
    from public.jilco_realtime_data as legacy
    where legacy.collection = 'jilco_invoices_archive'
      and legacy.record_id like v_prefix || '%'
    union all
    select coalesce(nullif(legacy.data->>'number', ''), nullif(legacy.data->'data'->>'number', '')) as value
    from public.jilco_realtime_data as legacy
    where legacy.collection = 'jilco_invoices_archive'
  ), parsed_invoice_values as (
    select pg_catalog.regexp_match(value, '^INV-' || p_year::text || '-([0-9]+)$') as captures
    from invoice_values
  ), numeric_sequences as (
    select case when length(captures[1]) <= 19 then captures[1]::numeric else null end as value
    from parsed_invoice_values
    where captures is not null
    union all
    select reservation.sequence_number::numeric
    from public.invoice_number_reservations as reservation
    where reservation.invoice_year = p_year
  )
  select max(value)::bigint
    into v_max_sequence
  from numeric_sequences
  where value between 1 and 9223372036854775807;

  if v_max_sequence = 9223372036854775807 then
    raise exception 'Invoice number sequence exhausted for year %', p_year using errcode = '22003';
  end if;
  v_sequence := coalesce(v_max_sequence, 0) + 1;

  loop
    v_candidate := v_prefix || lpad(v_sequence::text, greatest(3, length(v_sequence::text)), '0');

    if exists (
      select 1 from public.invoices as invoice
      where invoice.number = v_candidate or invoice.legacy_id = v_candidate
    ) or exists (
      select 1 from public.invoice_number_reservations as reservation
      where reservation.invoice_number = v_candidate
    ) then
      if v_sequence = 9223372036854775807 then
        raise exception 'Invoice number sequence exhausted for year %', p_year using errcode = '22003';
      end if;
      v_sequence := v_sequence + 1;
      continue;
    end if;

    begin
      insert into public.invoice_number_reservations (
        invoice_number, company_id, invoice_year, sequence_number, reserved_by
      ) values (
        v_candidate, v_company_id, p_year, v_sequence, v_user_id
      );
      return v_candidate;
    exception when unique_violation then
      -- A row inserted outside this function may still win the shared key.
      if v_sequence = 9223372036854775807 then
        raise exception 'Invoice number sequence exhausted for year %', p_year using errcode = '22003';
      end if;
      v_sequence := v_sequence + 1;
    end;
  end loop;
end;
$$;

revoke all on function public.reserve_invoice_number(integer) from public, anon;
grant execute on function public.reserve_invoice_number(integer) to authenticated;

create or replace function public.reserve_existing_invoice_number(p_legacy_id text, p_number text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_company_id uuid;
  v_role text;
  v_parts text[];
  v_year integer;
  v_sequence bigint;
  v_existing_id uuid;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if nullif(btrim(p_legacy_id), '') is null or nullif(btrim(p_number), '') is null then
    raise exception 'Invoice identity and number are required' using errcode = '22023';
  end if;

  select user_row.company_id, user_row.role
    into v_company_id, v_role
  from public.app_users as user_row
  where user_row.id = v_user_id;
  if v_company_id is null or coalesce(v_role, '') not in ('admin', 'manager', 'accountant') then
    raise exception 'Legacy invoice import requires finance permission' using errcode = '42501';
  end if;

  select invoice.id
    into v_existing_id
  from public.invoices as invoice
  where invoice.company_id = v_company_id
    and invoice.legacy_id = btrim(p_legacy_id)
  for update;
  if v_existing_id is not null and exists (
    select 1 from public.invoices as invoice
    where invoice.number = btrim(p_number) and invoice.id <> v_existing_id
  ) then
    raise exception 'Invoice number already belongs to another invoice' using errcode = '23505';
  end if;
  if v_existing_id is not null and exists (
    select 1 from public.invoices as invoice
    where invoice.id = v_existing_id and invoice.number = btrim(p_number)
  ) then
    return false;
  end if;

  v_parts := pg_catalog.regexp_match(btrim(p_number), '^INV-([0-9]{4})-([0-9]{3,})$');
  if v_parts is null then
    raise exception 'Legacy invoice number must use INV-YYYY-NNN format' using errcode = '22023';
  end if;
  v_year := v_parts[1]::integer;
  v_sequence := v_parts[2]::bigint;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('invoice-number:' || v_year::text, 0)
  );

  -- Recheck after taking the allocator lock in case another importer reserved
  -- or committed this number while the initial identity lookup was running.
  select invoice.id
    into v_existing_id
  from public.invoices as invoice
  where invoice.company_id = v_company_id
    and invoice.legacy_id = btrim(p_legacy_id)
  for update;
  if v_existing_id is not null and exists (
    select 1 from public.invoices as invoice
    where invoice.number = btrim(p_number) and invoice.id <> v_existing_id
  ) then
    raise exception 'Invoice number already belongs to another invoice' using errcode = '23505';
  end if;
  if v_existing_id is not null and exists (
    select 1 from public.invoices as invoice
    where invoice.id = v_existing_id and invoice.number = btrim(p_number)
  ) then
    return false;
  end if;

  if exists (
    select 1 from public.invoices as invoice
    where invoice.number = btrim(p_number) or invoice.legacy_id = btrim(p_number)
  ) then
    raise exception 'Invoice number is already in use' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.invoice_number_reservations as reservation
    where reservation.invoice_number = btrim(p_number)
      and reservation.company_id = v_company_id
      and reservation.reserved_by = v_user_id
      and reservation.consumed_at is null
  ) then
    return true;
  end if;
  if exists (
    select 1 from public.invoice_number_reservations as reservation
    where reservation.invoice_number = btrim(p_number)
      and reservation.consumed_at is not null
  ) then
    raise exception 'Invoice number was already issued and cannot be reused' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.invoice_number_reservations as reservation
    where reservation.invoice_year = v_year
      and reservation.sequence_number = v_sequence
      and reservation.consumed_at is not null
  ) then
    raise exception 'Invoice numeric sequence was already issued and cannot be reused' using errcode = '23505';
  end if;
  if exists (
    select 1 from public.invoice_number_reservations as reservation
    where reservation.invoice_number = btrim(p_number)
  ) then
    raise exception 'Invoice number is already reserved' using errcode = '23505';
  end if;

  insert into public.invoice_number_reservations (
    invoice_number, company_id, invoice_year, sequence_number, reserved_by
  ) values (
    btrim(p_number), v_company_id, v_year, v_sequence, v_user_id
  );
  return true;
end;
$$;

revoke all on function public.reserve_existing_invoice_number(text, text) from public, anon;
grant execute on function public.reserve_existing_invoice_number(text, text) to authenticated;

-- Keep existing company-scoped invoice reads, but restrict mutations to finance roles.
drop policy if exists invoices_finance_insert on public.invoices;
create policy invoices_finance_insert
  on public.invoices as restrictive for insert to authenticated
  with check (
    exists (
      select 1 from public.app_users as user_row
      where user_row.id = (select auth.uid())
        and user_row.company_id = invoices.company_id
        and user_row.role in ('admin', 'manager', 'accountant')
    )
  );

drop policy if exists invoices_finance_update on public.invoices;
create policy invoices_finance_update
  on public.invoices as restrictive for update to authenticated
  using (
    exists (
      select 1 from public.app_users as user_row
      where user_row.id = (select auth.uid())
        and user_row.company_id = invoices.company_id
        and user_row.role in ('admin', 'manager', 'accountant')
    )
  )
  with check (
    exists (
      select 1 from public.app_users as user_row
      where user_row.id = (select auth.uid())
        and user_row.company_id = invoices.company_id
        and user_row.role in ('admin', 'manager', 'accountant')
    )
  );

drop policy if exists invoices_finance_delete on public.invoices;
create policy invoices_finance_delete
  on public.invoices as restrictive for delete to authenticated
  using (
    exists (
      select 1 from public.app_users as user_row
      where user_row.id = (select auth.uid())
        and user_row.company_id = invoices.company_id
        and user_row.role in ('admin', 'manager', 'accountant')
    )
  );

create or replace function public.require_invoice_number_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_company_id uuid;
  v_role text;
  v_reserved_number text;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Authentication required to create or renumber an invoice' using errcode = '42501';
  end if;

  select user_row.company_id, user_row.role
    into v_company_id, v_role
  from public.app_users as user_row
  where user_row.id = v_user_id;
  if v_company_id is null or new.company_id <> v_company_id then
    raise exception 'Invoice company does not match the authenticated user' using errcode = '42501';
  end if;
  if coalesce(v_role, '') not in ('admin', 'manager', 'accountant') then
    raise exception 'Invoice number reservation requires finance permission' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and new.number is not distinct from old.number then
    return new;
  end if;

  if new.number is null or btrim(new.number) = '' then
    raise exception 'Invoice number is required' using errcode = '22023';
  end if;

  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.invoices as invoice where invoice.number = new.number
    ) then
      raise exception 'Invoice number already exists' using errcode = '23505';
    end if;
  else
    if exists (
      select 1 from public.invoices as invoice
      where invoice.number = new.number and invoice.id <> old.id
    ) then
      raise exception 'Invoice number already exists' using errcode = '23505';
    end if;
  end if;

  select reservation.invoice_number
    into v_reserved_number
  from public.invoice_number_reservations as reservation
  where reservation.invoice_number = new.number
    and reservation.company_id = v_company_id
    and reservation.reserved_by = v_user_id
    and reservation.consumed_at is null
  for update;
  if v_reserved_number is null then
    raise exception 'Invoice number must be reserved by the current user' using errcode = '42501';
  end if;

  update public.invoice_number_reservations as reservation
  set consumed_at = now()
  where reservation.invoice_number = v_reserved_number
    and reservation.consumed_at is null;
  if not found then
    raise exception 'Invoice number reservation is no longer available' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function public.require_invoice_number_reservation() from public, anon, authenticated;
drop trigger if exists invoices_require_number_reservation on public.invoices;
create trigger invoices_require_number_reservation
  before insert or update of number on public.invoices
  for each row execute function public.require_invoice_number_reservation();

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
      customer_vat_number, items, total, paid_amount, status,
      discount_amount, is_tax_inclusive
    ) values (
      v_company_id, v_legacy_id, v_number,
      nullif(p_invoice->>'date', '')::date,
      nullif(p_invoice->>'due_date', '')::date,
      coalesce(p_invoice->>'customer_name', ''),
      nullif(p_invoice->>'customer_vat_number', ''),
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

  return jsonb_build_object(
    'id', v_legacy_id,
    'number', v_number,
    'paidAmount', v_paid,
    'status', v_status
  );
end;
$$;

revoke all on function public.save_invoice_record(jsonb) from public, anon;
grant execute on function public.save_invoice_record(jsonb) to authenticated;
