-- Contract identities are independent of editable content and commercial numbers.
create schema if not exists contract_private;
revoke all on schema contract_private from public, anon;
grant usage on schema contract_private to authenticated;

create table if not exists contract_private.number_reservations (
  company_id uuid not null references public.companies(id) on delete cascade,
  number text not null,
  reserved_by uuid not null,
  reserved_at timestamptz not null default now(),
  consumed_by text,
  primary key (company_id, number)
);
alter table contract_private.number_reservations enable row level security;
revoke all on contract_private.number_reservations from public, anon, authenticated;

-- Freeze import evidence once. Later writes to the old, client-writable store
-- must never grant permission to mint an arbitrary historical contract number.
do $$
begin
  if to_regclass('contract_private.import_evidence') is null then
    create table contract_private.import_evidence (
      company_id uuid not null references public.companies(id) on delete cascade,
      legacy_id text not null,
      number text not null,
      primary key (company_id,legacy_id,number)
    );
    insert into contract_private.import_evidence(company_id,legacy_id,number)
    select distinct company_id,
      btrim(coalesce(data->>'id',data->'data'->>'id',record_id)),
      btrim(coalesce(data->'data'->>'number',data->>'number'))
    from public.jilco_realtime_data
    where collection='jilco_contracts_archive' and company_id is not null
      and nullif(btrim(coalesce(data->>'id',data->'data'->>'id',record_id)),'') is not null
      and nullif(btrim(coalesce(data->'data'->>'number',data->>'number')),'') is not null;
  end if;
end;
$$;
alter table contract_private.import_evidence enable row level security;
revoke all on contract_private.import_evidence from public,anon,authenticated;

create or replace function contract_private.authorized_company()
returns uuid language plpgsql stable security invoker set search_path = '' as $$
declare company uuid;
begin
  select user_row.company_id into company from public.app_users as user_row
  where user_row.id = (select auth.uid())
    and user_row.role in ('admin', 'manager', 'sales', 'accountant');
  if company is null then
    raise exception 'Contract permission required' using errcode = '42501';
  end if;
  return company;
end;
$$;

create or replace function contract_private.reserve_number(p_year integer)
returns text language plpgsql security definer set search_path = '' as $$
declare company uuid; prefix text; sequence bigint; candidate text;
begin
  company := contract_private.authorized_company();
  if p_year is null or p_year not between 2000 and 9999 then
    raise exception 'Invalid contract year' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('contracts:' || company::text, 0));
  prefix := 'FA-' || p_year::text || '-';
  select coalesce(max(sequence_value), 0)::bigint + 1 into sequence
  from (
    select substring(number from length(prefix) + 1)::numeric as sequence_value
    from contract_private.number_reservations
    where company_id = company and number ~ ('^' || prefix || '[0-9]{3,18}$')
    union all
    select substring(number from length(prefix) + 1)::numeric
    from public.contracts where company_id = company and number ~ ('^' || prefix || '[0-9]{3,18}$')
    union all
    select substring(number from length(prefix) + 1)::numeric
    from contract_private.import_evidence where company_id = company and number ~ ('^' || prefix || '[0-9]{3,18}$')
  ) as existing_numbers;
  candidate := prefix || lpad(sequence::text, greatest(3, length(sequence::text)), '0');
  insert into contract_private.number_reservations(company_id,number,reserved_by)
  values(company,candidate,(select auth.uid()));
  return candidate;
end;
$$;

create or replace function contract_private.reserve_existing(p_legacy_id text, p_number text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare company uuid; reservation record;
begin
  company := contract_private.authorized_company();
  if nullif(btrim(p_legacy_id),'') is null or nullif(btrim(p_number),'') is null then
    raise exception 'Contract identity and number are required' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('contracts:' || company::text, 0));
  if exists (select 1 from public.contracts where company_id=company and legacy_id=p_legacy_id and number=p_number) then
    return true;
  end if;
  if not exists (
    select 1 from contract_private.import_evidence as legacy
    where legacy.company_id=company and legacy.legacy_id=p_legacy_id and legacy.number=p_number
  ) then
    raise exception 'No owned legacy contract proves this number' using errcode = '42501';
  end if;
  if exists (select 1 from public.contracts where company_id=company and number=p_number) then
    raise exception 'Contract number already exists' using errcode = '23505';
  end if;
  select * into reservation from contract_private.number_reservations
  where company_id=company and number=p_number for update;
  if found and (reservation.consumed_by is not null or reservation.reserved_by <> (select auth.uid())) then
    raise exception 'Contract number has already been reserved or used' using errcode='23505';
  end if;
  insert into contract_private.number_reservations(company_id,number,reserved_by)
  values(company,p_number,(select auth.uid())) on conflict do nothing;
  return true;
end;
$$;

create or replace function contract_private.consume_number(p_company uuid,p_legacy_id text,p_number text)
returns void language plpgsql security definer set search_path = '' as $$
declare company uuid;
begin
  company := contract_private.authorized_company();
  if company <> p_company then raise exception 'Contract company mismatch' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('contracts:' || company::text, 0));
  update contract_private.number_reservations set consumed_by=p_legacy_id
  where company_id=company and number=p_number and reserved_by=(select auth.uid()) and consumed_by is null;
  if not found then raise exception 'A fresh contract number reservation is required' using errcode='42501'; end if;
end;
$$;

revoke all on function contract_private.authorized_company(), contract_private.reserve_number(integer),
  contract_private.reserve_existing(text,text), contract_private.consume_number(uuid,text,text) from public,anon;
grant execute on function contract_private.authorized_company(), contract_private.reserve_number(integer),
  contract_private.reserve_existing(text,text), contract_private.consume_number(uuid,text,text) to authenticated;

create or replace function public.reserve_contract_number(p_year integer)
returns text language sql security invoker set search_path='' as $$ select contract_private.reserve_number(p_year); $$;
create or replace function public.reserve_existing_contract_number(p_legacy_id text,p_number text)
returns boolean language sql security invoker set search_path='' as $$ select contract_private.reserve_existing(p_legacy_id,p_number); $$;
revoke all on function public.reserve_contract_number(integer), public.reserve_existing_contract_number(text,text) from public,anon;
grant execute on function public.reserve_contract_number(integer), public.reserve_existing_contract_number(text,text) to authenticated;

-- Restrictive policies also constrain any historical permissive policies.
alter table public.contracts enable row level security;
drop policy if exists contracts_role_guard on public.contracts;
create policy contracts_role_guard on public.contracts as restrictive for all to authenticated
using (company_id = (select contract_private.authorized_company()))
with check (company_id = (select contract_private.authorized_company()));
drop policy if exists contracts_delete_role_guard on public.contracts;
create policy contracts_delete_role_guard on public.contracts as restrictive for delete to authenticated
using (exists (select 1 from public.app_users where id=(select auth.uid()) and company_id=contracts.company_id and role in ('admin','manager')));
grant select,insert,update,delete on public.contracts to authenticated;
revoke all on public.contracts from anon;

create or replace function public.validate_contract_record()
returns trigger language plpgsql security invoker set search_path='' as $$
declare term jsonb; percentage numeric; total_percentage numeric := 0;
begin
  new.number := nullif(btrim(new.number),'');
  new.legacy_id := nullif(btrim(new.legacy_id),'');
  if new.number is null or new.legacy_id is null or new.date is null
     or nullif(btrim(new.first_party_name),'') is null or nullif(btrim(new.second_party_name),'') is null then
    raise exception 'Contract identity, date and both parties are required' using errcode='22023';
  end if;
  if new.total_value is null or new.total_value<=0 or round(new.total_value,2)<=0
     or new.total_value::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Contract value must be finite and positive' using errcode='22023';
  end if;
  if coalesce(new.elevator_count,0)<=0 or coalesce(new.stops,0)<=0 or coalesce(new.duration_months,0)<=0
     or coalesce(new.internal_doors_count,0)<=0 or coalesce(new.external_doors_count,0)<=0 then
    raise exception 'Contract counts and duration must be positive integers' using errcode='22023';
  end if;
  if jsonb_typeof(new.payment_terms) is distinct from 'array' or jsonb_array_length(new.payment_terms)=0
     or jsonb_typeof(new.technical_specs) is distinct from 'object' then
    raise exception 'Contract payment terms and technical specifications are required' using errcode='22023';
  end if;
  for term in select value from jsonb_array_elements(new.payment_terms) loop
    percentage := (term->>'percentage')::numeric;
    if nullif(btrim(term->>'name'),'') is null or percentage is null or percentage<=0 or percentage>100
       or percentage::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Invalid contract payment term' using errcode='22023';
    end if;
    total_percentage := total_percentage + percentage;
  end loop;
  if abs(total_percentage-100)>0.000001 then raise exception 'Contract payment percentages must total 100' using errcode='22023'; end if;
  if nullif(btrim(new.second_party_id),'') is not null and not exists (
    select 1 from public.customers where company_id=new.company_id and coalesce(legacy_id,id::text)=new.second_party_id
  ) then raise exception 'Contract customer is not in this company' using errcode='22023'; end if;
  if tg_op='INSERT' then
    perform contract_private.consume_number(new.company_id,new.legacy_id,new.number);
  elsif new.number is distinct from old.number or new.legacy_id is distinct from old.legacy_id or new.company_id is distinct from old.company_id then
    raise exception 'Saved contract identity, company and number cannot be changed' using errcode='22023';
  end if;
  new.total_value := round(new.total_value,2);
  new.value := new.total_value;
  new.title := new.number;
  new.signed_at := new.date;
  return new;
end;
$$;
revoke all on function public.validate_contract_record() from public,anon,authenticated;
drop trigger if exists contracts_validate_record on public.contracts;
create trigger contracts_validate_record before insert or update on public.contracts for each row execute function public.validate_contract_record();

create or replace function contract_private.save_record(p_contract jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare company uuid; existing_id uuid; payload public.contracts%rowtype;
begin
  company := contract_private.authorized_company();
  if nullif(btrim(p_contract->>'legacy_id'),'') is null then raise exception 'Contract identity required' using errcode='22023'; end if;
  -- Serialize edits and new insert attempts with this identity in the company.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('contract:' || company::text || ':' || (p_contract->>'legacy_id'),0));
  select * into payload from jsonb_populate_record(null::public.contracts,p_contract);
  select id into existing_id from public.contracts where company_id=company and legacy_id=payload.legacy_id for update;
  if existing_id is null then
    insert into public.contracts(company_id,legacy_id,number,date,first_party_name,second_party_name,second_party_id,
      location,total_value,elevator_type,stops,elevator_count,internal_doors_count,external_doors_count,access_control,
      duration_months,first_party_obligations,second_party_obligations,handover_and_warranty,works_duration,payment_terms,technical_specs)
    values(company,payload.legacy_id,payload.number,payload.date,payload.first_party_name,payload.second_party_name,payload.second_party_id,
      payload.location,payload.total_value,payload.elevator_type,payload.stops,payload.elevator_count,payload.internal_doors_count,payload.external_doors_count,payload.access_control,
      payload.duration_months,payload.first_party_obligations,payload.second_party_obligations,payload.handover_and_warranty,payload.works_duration,payload.payment_terms,payload.technical_specs);
  else
    update public.contracts set number=payload.number,date=payload.date,first_party_name=payload.first_party_name,
      second_party_name=payload.second_party_name,second_party_id=payload.second_party_id,location=payload.location,total_value=payload.total_value,
      elevator_type=payload.elevator_type,stops=payload.stops,elevator_count=payload.elevator_count,internal_doors_count=payload.internal_doors_count,
      external_doors_count=payload.external_doors_count,access_control=payload.access_control,duration_months=payload.duration_months,
      first_party_obligations=payload.first_party_obligations,second_party_obligations=payload.second_party_obligations,handover_and_warranty=payload.handover_and_warranty,
      works_duration=payload.works_duration,payment_terms=payload.payment_terms,technical_specs=payload.technical_specs
    where id=existing_id and company_id=company;
    if not found then raise exception 'Contract could not be updated' using errcode='P0002'; end if;
  end if;
  return true;
end;
$$;
create or replace function public.save_contract_record(p_contract jsonb)
returns boolean language sql security invoker set search_path='' as $$ select contract_private.save_record(p_contract); $$;

create or replace function contract_private.delete_record(p_legacy_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare company uuid;
begin
  select company_id into company from public.app_users where id=(select auth.uid()) and role in ('admin','manager');
  if company is null then raise exception 'Contract delete permission required' using errcode='42501'; end if;
  delete from public.contracts where company_id=company and legacy_id=p_legacy_id;
  return found;
end;
$$;
create or replace function public.delete_contract_record(p_legacy_id text)
returns boolean language sql security invoker set search_path='' as $$ select contract_private.delete_record(p_legacy_id); $$;
revoke all on function contract_private.save_record(jsonb), contract_private.delete_record(text),
  public.save_contract_record(jsonb), public.delete_contract_record(text) from public,anon;
grant execute on function contract_private.save_record(jsonb), contract_private.delete_record(text),
  public.save_contract_record(jsonb), public.delete_contract_record(text) to authenticated;
-- Stale clients cannot bypass reservation/identity protection with direct upserts.
revoke insert,update,delete on public.contracts from public,anon,authenticated;
notify pgrst, 'reload schema';
