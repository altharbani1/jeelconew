-- Tenant isolation for HR records kept in the legacy JSONB store, plus one
-- transactional entry point for payroll approval. Non-HR collections retain
-- their legacy authenticated-user behaviour until they are migrated.

alter table public.jilco_realtime_data
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

-- Production had one application user when this migration was prepared. Only
-- backfill automatically when the owner company is unambiguous.
do $$
declare
  v_company_id uuid;
begin
  if (select count(*) from public.app_users where company_id is not null) = 1 then
    select company_id into v_company_id
    from public.app_users
    where company_id is not null;

    update public.jilco_realtime_data
       set company_id = v_company_id
     where collection like 'jilco\_hr\_%' escape '\'
       and company_id is null;
  elsif exists (
    select 1 from public.jilco_realtime_data
    where collection like 'jilco\_hr\_%' escape '\' and company_id is null
  ) then
    raise exception 'Cannot safely infer the company for existing HR records';
  end if;
end
$$;

create index if not exists jilco_realtime_data_hr_company_collection_idx
  on public.jilco_realtime_data (company_id, collection, updated_at desc)
  where collection like 'jilco\_hr\_%' escape '\';

drop policy if exists single_company_authenticated_access on public.jilco_realtime_data;
drop policy if exists jilco_realtime_data_select on public.jilco_realtime_data;
drop policy if exists jilco_realtime_data_insert on public.jilco_realtime_data;
drop policy if exists jilco_realtime_data_update on public.jilco_realtime_data;
drop policy if exists jilco_realtime_data_delete on public.jilco_realtime_data;

create policy jilco_realtime_data_select
on public.jilco_realtime_data for select to authenticated
using (
  collection not like 'jilco\_hr\_%' escape '\'
  or company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
);

create policy jilco_realtime_data_insert
on public.jilco_realtime_data for insert to authenticated
with check (
  collection not like 'jilco\_hr\_%' escape '\'
  or (
    company_id is not null
    and company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
  )
);

create policy jilco_realtime_data_update
on public.jilco_realtime_data for update to authenticated
using (
  collection not like 'jilco\_hr\_%' escape '\'
  or company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
)
with check (
  collection not like 'jilco\_hr\_%' escape '\'
  or (
    company_id is not null
    and company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
  )
);

create policy jilco_realtime_data_delete
on public.jilco_realtime_data for delete to authenticated
using (
  collection not like 'jilco\_hr\_%' escape '\'
  or company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
);

create or replace function public.approve_hr_payroll_batch(
  p_payrolls jsonb,
  p_payments jsonb,
  p_commission_updates jsonb default '[]'::jsonb,
  p_loan_updates jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_role text;
  v_item jsonb;
  v_id text;
  v_rows integer;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select au.company_id, au.role
    into v_company_id, v_role
    from public.app_users au
   where au.id = v_uid;

  if v_company_id is null then
    raise exception 'The current user is not assigned to a company' using errcode = '42501';
  end if;
  if coalesce(v_role, '') not in ('admin', 'manager') then
    raise exception 'Payroll approval requires admin or manager role' using errcode = '42501';
  end if;

  if jsonb_typeof(p_payrolls) <> 'array'
     or jsonb_typeof(p_payments) <> 'array'
     or jsonb_typeof(p_commission_updates) <> 'array'
     or jsonb_typeof(p_loan_updates) <> 'array' then
    raise exception 'All payroll batch arguments must be JSON arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(p_payrolls) = 0
     or jsonb_array_length(p_payrolls) > 500
     or jsonb_array_length(p_payments) > 500
     or jsonb_array_length(p_commission_updates) > 2000
     or jsonb_array_length(p_loan_updates) > 2000 then
    raise exception 'Invalid payroll batch size' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_payrolls) loop
    v_id := nullif(v_item->>'id', '');
    if v_id is null
       or nullif(v_item->>'employeeId', '') is null
       or coalesce(v_item->>'status', '') <> 'paid'
       or coalesce(v_item->>'month', '') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
      raise exception 'Invalid payroll record' using errcode = '22023';
    end if;

    if exists (
      select 1 from public.jilco_realtime_data r
       where r.company_id = v_company_id
         and r.collection = 'jilco_hr_payrolls'
         and r.record_id <> v_id
         and r.data->>'employeeId' = v_item->>'employeeId'
         and r.data->>'month' = v_item->>'month'
         and r.data->>'status' = 'paid'
    ) then
      raise exception 'Payroll is already paid for employee % in %', v_item->>'employeeId', v_item->>'month'
        using errcode = '23505';
    end if;

    insert into public.jilco_realtime_data (company_id, collection, record_id, data, updated_at)
    values (v_company_id, 'jilco_hr_payrolls', v_id, v_item, now())
    on conflict (collection, record_id) do update
      set data = excluded.data, updated_at = excluded.updated_at
      where public.jilco_realtime_data.company_id = excluded.company_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'Payroll record id % belongs to another company', v_id using errcode = '23505';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_payments) loop
    v_id := nullif(v_item->>'id', '');
    if v_id is null
       or nullif(v_item->>'employeeId', '') is null
       or nullif(v_item->>'payrollId', '') is null
       or coalesce(v_item->>'status', '') <> 'completed'
       or not exists (
         select 1 from public.jilco_realtime_data r
          where r.company_id = v_company_id
            and r.collection = 'jilco_hr_payrolls'
            and r.record_id = v_item->>'payrollId'
       ) then
      raise exception 'Invalid employee payment record' using errcode = '22023';
    end if;

    insert into public.jilco_realtime_data (company_id, collection, record_id, data, updated_at)
    values (v_company_id, 'jilco_hr_payments', v_id, v_item, now())
    on conflict (collection, record_id) do update
      set data = excluded.data, updated_at = excluded.updated_at
      where public.jilco_realtime_data.company_id = excluded.company_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'Payment record id % belongs to another company', v_id using errcode = '23505';
    end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_commission_updates) loop
    v_id := nullif(v_item->>'id', '');
    if v_id is null or coalesce(v_item->>'status', '') <> 'paid' then
      raise exception 'Invalid commission update' using errcode = '22023';
    end if;
    update public.jilco_realtime_data
       set data = v_item, updated_at = now()
     where company_id = v_company_id
       and collection = 'jilco_hr_commissions'
       and record_id = v_id;
    if not found then raise exception 'Commission % was not found', v_id using errcode = 'P0002'; end if;
  end loop;

  for v_item in select value from jsonb_array_elements(p_loan_updates) loop
    v_id := nullif(v_item->>'id', '');
    if v_id is null
       or coalesce((v_item->>'remainingAmount')::numeric, -1) < 0
       or coalesce(v_item->>'status', '') not in ('active', 'paid') then
      raise exception 'Invalid loan update' using errcode = '22023';
    end if;
    update public.jilco_realtime_data
       set data = v_item, updated_at = now()
     where company_id = v_company_id
       and collection = 'jilco_hr_loans'
       and record_id = v_id;
    if not found then raise exception 'Loan % was not found', v_id using errcode = 'P0002'; end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'payrollCount', jsonb_array_length(p_payrolls),
    'paymentCount', jsonb_array_length(p_payments),
    'commissionCount', jsonb_array_length(p_commission_updates),
    'loanCount', jsonb_array_length(p_loan_updates)
  );
end
$$;

revoke all on function public.approve_hr_payroll_batch(jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.approve_hr_payroll_batch(jsonb, jsonb, jsonb, jsonb) from anon;
grant execute on function public.approve_hr_payroll_batch(jsonb, jsonb, jsonb, jsonb) to authenticated;
