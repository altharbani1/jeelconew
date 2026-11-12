create unique index if not exists hr_one_paid_payroll_per_month
  on public.jilco_realtime_data (company_id, (data->>'employeeId'), (data->>'month'))
  where collection = 'jilco_hr_payrolls' and data->>'status' = 'paid';

create unique index if not exists hr_one_payroll_rule_per_effective_month
  on public.jilco_realtime_data (company_id, (data->>'effectiveMonth'))
  where collection = 'jilco_hr_payroll_rules';

create or replace function public.get_hr_payroll_rules(p_month text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_company uuid;
  v_rules jsonb;
begin
  select company_id into v_company from public.app_users
   where id = auth.uid() and role in ('admin', 'manager', 'accountant');
  if v_company is null then
    raise exception 'HR permission required' using errcode = '42501';
  end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Invalid payroll month' using errcode = '22023';
  end if;
  select data into v_rules from public.jilco_realtime_data
   where company_id = v_company and collection = 'jilco_hr_payroll_rules'
     and data->>'effectiveMonth' <= p_month
   order by data->>'effectiveMonth' desc
   limit 1;
  -- Compatibility fallback for periods without an explicitly configured rule.
  return coalesce(v_rules, jsonb_build_object('gosiRate', 0.0975, 'daysPerMonth', 30, 'hoursPerDay', 8));
end
$$;

revoke all on function public.get_hr_payroll_rules(text) from public, anon;
grant execute on function public.get_hr_payroll_rules(text) to authenticated;

create or replace function public.resolve_hr_leave(p_leave_id text, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_leave jsonb;
  v_employee jsonb;
  v_employee_id text;
  v_start date;
  v_end date;
  v_days integer;
  v_balance numeric;
begin
  select company_id into v_company from public.app_users
   where id = auth.uid() and role in ('admin', 'manager');
  if v_company is null then
    raise exception 'HR permission required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('approved', 'rejected') then
    raise exception 'Invalid leave decision' using errcode = '22023';
  end if;
  select data into v_leave from public.jilco_realtime_data
   where company_id = v_company and collection = 'jilco_hr_leaves' and record_id = p_leave_id
   for update;
  if not found or v_leave->>'status' is distinct from 'pending' then
    raise exception 'Leave is no longer pending' using errcode = '22023';
  end if;
  v_employee_id := v_leave->>'employeeId';
  select data into v_employee from public.jilco_realtime_data
   where company_id = v_company and collection = 'jilco_hr_employees' and record_id = v_employee_id
   for update;
  if not found then
    raise exception 'Employee not found' using errcode = '22023';
  end if;
  if p_status = 'approved' then
    v_start := (v_leave->>'startDate')::date;
    v_end := (v_leave->>'endDate')::date;
    v_days := v_end - v_start + 1;
    if coalesce(v_days, 0) < 1 or exists (
      select 1 from public.jilco_realtime_data
       where company_id = v_company and collection = 'jilco_hr_leaves'
         and data->>'employeeId' = v_employee_id and data->>'status' = 'approved'
         and (data->>'startDate')::date <= v_end and (data->>'endDate')::date >= v_start
    ) then
      raise exception 'Invalid or overlapping leave dates' using errcode = '22023';
    end if;
    if v_leave->>'type' = 'annual' then
      v_balance := coalesce((v_employee->>'annualLeaveBalance')::numeric, 0);
      if v_balance < v_days then
        raise exception 'Insufficient annual leave balance' using errcode = '22023';
      end if;
      v_employee := jsonb_set(v_employee, '{annualLeaveBalance}', to_jsonb(v_balance - v_days));
      update public.jilco_realtime_data set data = v_employee, updated_at = now()
       where company_id = v_company and collection = 'jilco_hr_employees' and record_id = v_employee_id;
      if not found then raise exception 'Employee update failed' using errcode = '42501'; end if;
    end if;
  end if;
  v_leave := jsonb_set(v_leave, '{status}', to_jsonb(p_status));
  update public.jilco_realtime_data set data = v_leave, updated_at = now()
   where company_id = v_company and collection = 'jilco_hr_leaves' and record_id = p_leave_id;
  if not found then raise exception 'Leave update failed' using errcode = '42501'; end if;
  return jsonb_build_object('leave', v_leave, 'employee', v_employee);
end
$$;

revoke all on function public.resolve_hr_leave(text, text) from public, anon;
grant execute on function public.resolve_hr_leave(text, text) to authenticated;

create or replace function public.validate_hr_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_amount numeric;
  v_remaining numeric;
  v_installment numeric;
  v_count numeric;
  v_days numeric;
  v_hours numeric;
begin
  if tg_op = 'DELETE' then
    if old.collection = 'jilco_hr_employees' then
      raise exception 'Archive the employee instead of deleting their record' using errcode = '23503';
    end if;
    if old.collection = 'jilco_hr_leaves' and old.data->>'status' = 'approved' then
      raise exception 'Approved leave cannot be deleted' using errcode = '23503';
    end if;
    if old.collection in ('jilco_hr_payrolls', 'jilco_hr_payments') then
      raise exception 'Approved payroll records cannot be deleted' using errcode = '23503';
    end if;
    return old;
  end if;
  if current_user in ('authenticated', 'anon') and (
    new.collection in ('jilco_hr_payrolls', 'jilco_hr_payments')
    or (new.collection = 'jilco_hr_leaves' and (
      new.data->>'status' is distinct from 'pending'
      or (tg_op = 'UPDATE' and old.data->>'status' is distinct from 'pending')
    ))
  ) then
    raise exception 'Use the HR approval procedure' using errcode = '42501';
  end if;
  -- Serialize new payroll inputs with approval before an upsert locks its row.
  if tg_op = 'INSERT' and new.collection in (
    'jilco_hr_commissions', 'jilco_hr_loans', 'jilco_hr_attendance', 'jilco_hr_payroll_rules'
  ) then
    perform pg_advisory_xact_lock(hashtextextended(new.company_id::text || ':hr-payroll', 0));
  end if;
  if new.collection in ('jilco_hr_loans', 'jilco_hr_attendance') then
    if not exists (
      select 1 from public.jilco_realtime_data r
       where r.company_id = new.company_id and r.collection = 'jilco_hr_employees'
         and r.record_id = new.data->>'employeeId'
    ) then
      raise exception 'Employee not found for HR record' using errcode = '23503';
    end if;
  end if;
  if new.collection = 'jilco_hr_loans' then
    v_amount := (new.data->>'amount')::numeric;
    v_remaining := (new.data->>'remainingAmount')::numeric;
    v_installment := (new.data->>'monthlyInstallment')::numeric;
    v_count := (new.data->>'installmentsCount')::numeric;
    if not coalesce(v_amount > 0 and v_amount < 'Infinity'::numeric
      and v_remaining between 0 and v_amount and v_installment > 0
      and v_installment < 'Infinity'::numeric and v_count >= 1
      and v_count < 'Infinity'::numeric and trunc(v_count) = v_count
      and new.data->>'startDate' ~ '^[0-9]{4}-(0[1-9]|1[0-2])$', false) then
      raise exception 'Invalid employee loan' using errcode = '22023';
    end if;
  elsif new.collection = 'jilco_hr_attendance' then
    v_days := (new.data->>'absenceDays')::numeric;
    v_hours := (new.data->>'delayHours')::numeric;
    if not coalesce(v_days between 0 and 31 and trunc(v_days * 2) = v_days * 2
      and v_hours between 0 and 744
      and new.data->>'month' ~ '^[0-9]{4}-(0[1-9]|1[0-2])$', false) then
      raise exception 'Invalid attendance record' using errcode = '22023';
    end if;
  elsif new.collection = 'jilco_hr_payroll_rules' then
    if not coalesce(
      new.data->>'effectiveMonth' ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
      and (new.data->>'gosiRate')::numeric between 0 and 1
      and (new.data->>'daysPerMonth')::numeric between 1 and 31
      and (new.data->>'hoursPerDay')::numeric between 1 and 24, false
    ) then
      raise exception 'Invalid payroll rules' using errcode = '22023';
    end if;
  end if;
  return new;
end
$$;

create trigger validate_hr_record_before_write
before insert or update or delete on public.jilco_realtime_data
for each row execute function public.validate_hr_record();
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
       and left(data->>'approvalDate', 7) = v_month;
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
    v_gosi := case when (v_item->>'applyGosiDeduction')::boolean and v_employee->>'nationalIdType' = 'saudi'
      then (coalesce((v_employee->>'basicSalary')::numeric, 0) + coalesce((v_employee->>'housingAllowance')::numeric, 0))
        * (v_rules->>'gosiRate')::numeric
      else 0 end;
    v_expected := round(v_salary + v_commission + (v_item->>'bonuses')::numeric
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
      'commissions', v_commission, 'gosiDeduction', v_gosi, 'loanDeduction', v_loan,
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
       set data = r.data || jsonb_build_object('status', 'paid', 'paymentDate', current_date), updated_at = now()
     where r.company_id = v_company_id and r.collection = 'jilco_hr_commissions'
       and r.data->>'status' = 'approved' and left(r.data->>'approvalDate', 7) = v_month
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

