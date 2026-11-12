create or replace function public.validate_hr_variable_pay()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hours numeric;
  v_rate numeric;
  v_value numeric;
  v_percentage numeric;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.collection = 'jilco_hr_commissions'
     and old.data->>'status' = 'paid' then
    raise exception 'Paid commission cannot be changed' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.collection = 'jilco_hr_attendance' then
    v_hours := coalesce((new.data->>'overtimeHours')::numeric, 0);
    v_rate := coalesce((new.data->>'overtimeRate')::numeric, 0);
    if not (v_hours between 0 and extract(day from (new.data->>'month' || '-01')::date
      + interval '1 month - 1 day') * 24 and v_rate >= 0 and v_rate < 'Infinity'::numeric
      and (v_hours = 0 or v_rate > 0)) then
      raise exception 'Invalid overtime hours or rate' using errcode = '23514';
    end if;
  elsif new.collection = 'jilco_hr_commissions' and current_user in ('authenticated', 'anon') then
    if new.data->>'status' is null or new.data->>'status' not in ('pending', 'approved') then
      raise exception 'Commissions are paid through payroll' using errcode = '23514';
    end if;
    v_value := (new.data->>'contractValue')::numeric;
    v_percentage := (new.data->>'commissionPercentage')::numeric;
    if not coalesce(v_value > 0 and v_value < 'Infinity'::numeric and v_percentage between 0 and 100
        and new.data->>'date' ~ '^\d{4}-\d{2}-\d{2}$', false)
        or (new.data->>'date')::date is null then
      raise exception 'Invalid commission value, rate or due date' using errcode = '23514';
    end if;
    new.data := new.data || jsonb_build_object('commissionAmount', round(v_value * v_percentage / 100, 2));
  end if;
  return new;
end
$$;

create trigger validate_hr_variable_pay
before insert or update or delete on public.jilco_realtime_data
for each row execute function public.validate_hr_variable_pay();

create or replace function public.approve_hr_payroll_batch(
  p_payrolls jsonb,
  p_payments jsonb,
  p_commission_updates jsonb default '[]'::jsonb,
  p_loan_updates jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_role text;
  v_item jsonb;
  v_id text;
  v_rows integer;
  v_employee jsonb;
  v_payroll jsonb;
  v_original jsonb;
  v_month text;
  v_expected numeric;
  v_salary numeric;
  v_loan numeric;
  v_commission numeric;
  v_overtime numeric;
  v_absence numeric;
  v_gosi numeric;
  v_rules jsonb;
  v_saved_payrolls jsonb := '[]'::jsonb;
  v_saved_payments jsonb := '[]'::jsonb;
  v_saved_commissions jsonb;
  v_saved_loans jsonb := '[]'::jsonb;
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

  if jsonb_typeof(p_payrolls) is distinct from 'array'
     or jsonb_typeof(p_payments) is distinct from 'array'
     or jsonb_typeof(p_commission_updates) is distinct from 'array'
     or jsonb_typeof(p_loan_updates) is distinct from 'array' then
    raise exception 'All payroll batch arguments must be JSON arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(p_payrolls) = 0
     or jsonb_array_length(p_payrolls) > 500
     or jsonb_array_length(p_payments) > 500
     or jsonb_array_length(p_commission_updates) > 2000
     or jsonb_array_length(p_loan_updates) > 2000 then
    raise exception 'Invalid payroll batch size' using errcode = '22023';
  end if;

  if jsonb_array_length(p_payments) <> jsonb_array_length(p_payrolls)
     or (select count(distinct value->>'payrollId') from jsonb_array_elements(p_payments)) <> jsonb_array_length(p_payrolls) then
    raise exception 'A unique payment is required for each payroll record' using errcode = '22023';
  end if;
  v_month := p_payrolls->0->>'month';
  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text || ':hr-payroll', 0));
  v_rules := public.get_hr_payroll_rules(v_month);
  -- Keep the input snapshot stable until commissions and loan balances are updated.
  perform 1 from public.jilco_realtime_data r
   where r.company_id = v_company_id
     and r.collection in ('jilco_hr_commissions', 'jilco_hr_loans', 'jilco_hr_attendance')
     and exists (select 1 from jsonb_array_elements(p_payrolls) x
                  where x->>'employeeId' = r.data->>'employeeId')
   order by r.collection, r.record_id
   for update of r;

  for v_item in select value from jsonb_array_elements(p_payrolls) loop
    v_id := nullif(v_item->>'id', '');
    if v_id is null
       or nullif(v_item->>'employeeId', '') is null
       or coalesce(v_item->>'status', '') <> 'paid'
       or coalesce(v_item->>'month', '') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
      raise exception 'Invalid payroll record' using errcode = '22023';
    end if;

    if v_item->>'month' is distinct from v_month then
      raise exception 'Payroll batch must cover one month' using errcode = '22023';
    end if;
    select data into v_employee from public.jilco_realtime_data
     where company_id = v_company_id and collection = 'jilco_hr_employees'
       and record_id = v_item->>'employeeId'
     for update;
    if not found or v_employee->>'status' is distinct from 'active' then
      raise exception 'Payroll employee is not active' using errcode = '22023';
    end if;
    v_salary := coalesce((v_employee->>'basicSalary')::numeric, 0)
      + coalesce((v_employee->>'housingAllowance')::numeric, 0)
      + coalesce((v_employee->>'transportAllowance')::numeric, 0)
      + coalesce((v_employee->>'otherAllowances')::numeric, 0);
    select coalesce(sum((data->>'commissionAmount')::numeric), 0) into v_commission
      from public.jilco_realtime_data where company_id = v_company_id and collection = 'jilco_hr_commissions'
       and data->>'employeeId' = v_item->>'employeeId' and data->>'status' = 'approved'
       and left(coalesce(nullif(data->>'date', ''), data->>'approvalDate'), 7) <= v_month;
    select coalesce(sum(least((data->>'monthlyInstallment')::numeric, (data->>'remainingAmount')::numeric)), 0)
      into v_loan from public.jilco_realtime_data
     where company_id = v_company_id and collection = 'jilco_hr_loans'
       and data->>'employeeId' = v_item->>'employeeId' and data->>'status' = 'active'
       and data->>'startDate' <= v_month and (data->>'remainingAmount')::numeric > 0;
    select coalesce(sum(((data->>'absenceDays')::numeric
      + (data->>'delayHours')::numeric / (v_rules->>'hoursPerDay')::numeric)
      * v_salary / (v_rules->>'daysPerMonth')::numeric), 0)
      into v_absence from public.jilco_realtime_data
     where company_id = v_company_id and collection = 'jilco_hr_attendance'
       and data->>'employeeId' = v_item->>'employeeId' and data->>'month' = v_month;
    select round(coalesce(sum(coalesce((data->>'overtimeHours')::numeric, 0)
      * coalesce((data->>'overtimeRate')::numeric, 0)), 0), 2) into v_overtime
      from public.jilco_realtime_data
     where company_id = v_company_id and collection = 'jilco_hr_attendance'
       and data->>'employeeId' = v_item->>'employeeId' and data->>'month' = v_month;
    v_gosi := case when (v_item->>'applyGosiDeduction')::boolean and v_employee->>'nationalIdType' = 'saudi'
      then (coalesce((v_employee->>'basicSalary')::numeric, 0) + coalesce((v_employee->>'housingAllowance')::numeric, 0))
        * (v_rules->>'gosiRate')::numeric
      else 0 end;
    v_expected := round(v_salary + v_commission + v_overtime + (v_item->>'bonuses')::numeric
      - v_gosi - v_loan - v_absence - (v_item->>'otherDeductions')::numeric, 2);
    if not coalesce(v_expected >= 0 and v_expected < 'Infinity'::numeric
      and (v_item->>'bonuses')::numeric >= 0 and (v_item->>'otherDeductions')::numeric >= 0
      and round((v_item->>'netSalary')::numeric, 2) = v_expected, false) then
      raise exception 'Payroll inputs changed or the net salary is invalid' using errcode = '22023';
    end if;
    v_item := v_item || jsonb_build_object(
      'employeeName', v_employee->>'name',
      'basicSalary', coalesce((v_employee->>'basicSalary')::numeric, 0),
      'housingAllowance', coalesce((v_employee->>'housingAllowance')::numeric, 0),
      'transportAllowance', coalesce((v_employee->>'transportAllowance')::numeric, 0),
      'otherAllowances', coalesce((v_employee->>'otherAllowances')::numeric, 0),
      'commissions', v_commission, 'overtimeAmount', v_overtime, 'gosiDeduction', v_gosi, 'loanDeduction', v_loan,
      'absenceDeduction', v_absence, 'netSalary', v_expected, 'payrollRules', v_rules
    );

    if exists (
      select 1 from public.jilco_realtime_data r
       where r.company_id = v_company_id
         and r.collection = 'jilco_hr_payrolls'
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
      where public.jilco_realtime_data.company_id = excluded.company_id
        and public.jilco_realtime_data.data->>'status' = 'pending'
        and public.jilco_realtime_data.data->>'employeeId' = excluded.data->>'employeeId'
        and public.jilco_realtime_data.data->>'month' = excluded.data->>'month';
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'Payroll record id % conflicts with an existing record', v_id using errcode = '23505';
    end if;
    v_saved_payrolls := v_saved_payrolls || jsonb_build_array(v_item);
  end loop;

  for v_item in select value from jsonb_array_elements(p_payments) loop
    v_id := nullif(v_item->>'id', '');
    select data into v_payroll from public.jilco_realtime_data
     where company_id = v_company_id and collection = 'jilco_hr_payrolls'
       and record_id = v_item->>'payrollId';
    if v_id is null
       or v_payroll is null
       or not exists (select 1 from jsonb_array_elements(p_payrolls) x where x->>'id' = v_item->>'payrollId')
       or v_item->>'employeeId' is distinct from v_payroll->>'employeeId'
       or (v_item->>'amount')::numeric is distinct from (v_payroll->>'netSalary')::numeric
       or v_id <> 'EP-' || v_month || '-' || (v_payroll->>'employeeId')
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
    on conflict (collection, record_id) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'Payment record id % belongs to another company', v_id using errcode = '23505';
    end if;
    v_saved_payments := v_saved_payments || jsonb_build_array(v_item);
  end loop;

  with updated as (
    update public.jilco_realtime_data r
       set data = r.data || jsonb_build_object('status', 'paid', 'paymentDate', current_date, 'payrollId', (select x->>'id' from jsonb_array_elements(p_payrolls) x where x->>'employeeId' = r.data->>'employeeId')), updated_at = now()
     where r.company_id = v_company_id and r.collection = 'jilco_hr_commissions'
       and r.data->>'status' = 'approved' and left(coalesce(nullif(r.data->>'date', ''), r.data->>'approvalDate'), 7) <= v_month
       and exists (select 1 from jsonb_array_elements(p_payrolls) x where x->>'employeeId' = r.data->>'employeeId')
    returning r.data
  )
  select coalesce(jsonb_agg(data), '[]'::jsonb) into v_saved_commissions from updated;

  for v_original in
    select r.data || jsonb_build_object('recordId', r.record_id) from public.jilco_realtime_data r
     where r.company_id = v_company_id and r.collection = 'jilco_hr_loans'
       and r.data->>'status' = 'active' and r.data->>'startDate' <= v_month
       and (r.data->>'remainingAmount')::numeric > 0
       and exists (select 1 from jsonb_array_elements(p_payrolls) x where x->>'employeeId' = r.data->>'employeeId')
     for update
  loop
    v_expected := greatest(0, (v_original->>'remainingAmount')::numeric - (v_original->>'monthlyInstallment')::numeric);
    update public.jilco_realtime_data
       set data = data || jsonb_build_object('remainingAmount', v_expected,
         'status', case when v_expected = 0 then 'paid' else 'active' end), updated_at = now()
     where company_id = v_company_id and collection = 'jilco_hr_loans' and record_id = v_original->>'recordId'
     returning data into v_item;
    v_saved_loans := v_saved_loans || jsonb_build_array(v_item);
  end loop;
  return jsonb_build_object(
    'success', true,
    'payrollCount', jsonb_array_length(p_payrolls),
    'paymentCount', jsonb_array_length(p_payments),
    'commissionCount', jsonb_array_length(v_saved_commissions),
    'loanCount', jsonb_array_length(v_saved_loans),
    'payrolls', v_saved_payrolls,
    'payments', v_saved_payments,
    'commissionUpdates', v_saved_commissions,
    'loanUpdates', v_saved_loans
  );
end
$$;

revoke all on function public.approve_hr_payroll_batch(jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.approve_hr_payroll_batch(jsonb, jsonb, jsonb, jsonb) from anon;
grant execute on function public.approve_hr_payroll_batch(jsonb, jsonb, jsonb, jsonb) to authenticated;

