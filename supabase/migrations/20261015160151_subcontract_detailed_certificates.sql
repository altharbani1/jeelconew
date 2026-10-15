-- Allow the certificate UI to persist the detailed accounting components already
-- supported by the certificate table and posting routine.
create or replace function subcontract_private.certificate_action(p_action text,p_id text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u public.app_users%rowtype; c public.subcontracts%rowtype; v public.subcontract_certificates%rowtype;
  gross numeric; vat numeric; retention numeric; advance_recovery numeric; deductions numeric; net numeric;
  method text; pay_date date; ref text; voucher jsonb; expense_id text;
begin
  select * into u from public.app_users where id=auth.uid();
  if u.id is null or u.company_id is null then raise exception 'Authentication and company required' using errcode='42501'; end if;
  if p_action not in ('create','update','delete','engineer','finance','pay') or p_action is null then raise exception 'Invalid action'; end if;
  if p_action in ('create','update','delete') and u.role not in ('admin','manager') then raise exception 'Management permission required' using errcode='42501'; end if;
  if p_action='engineer' and u.role not in ('admin','manager','technician') then raise exception 'Engineering permission required' using errcode='42501'; end if;
  if p_action in ('finance','pay') and u.role not in ('admin','manager','accountant') then raise exception 'Finance permission required' using errcode='42501'; end if;
  if p_action='create' then
    select * into c from public.subcontracts where id=p_data->>'subcontractId' and company_id=u.company_id for update;
  else
    select * into v from public.subcontract_certificates where id=p_id and company_id=u.company_id;
    if v.id is null then raise exception 'Certificate not found'; end if;
    select * into c from public.subcontracts where id=v.subcontract_id and company_id=u.company_id for update;
    select * into v from public.subcontract_certificates where id=p_id and company_id=u.company_id for update;
  end if;
  if c.id is null then raise exception 'Contract not found'; end if;
  if p_action='pay' and v.status='paid' then
    if v.payment_method is distinct from p_data->>'paymentMethod' or v.payment_date is distinct from (p_data->>'paymentDate')::date
      or coalesce(v.reference_number,'')<>coalesce(p_data->>'referenceNumber','') then raise exception 'Paid certificate is immutable'; end if;
    return jsonb_build_object('certificateId',v.id,'expenseId','SUB-'||v.id,'amount',v.net_payable);
  end if;
  if p_action<>'delete' and c.status not in ('active','completed') then raise exception 'Activate the contract first'; end if;
  if p_action in ('create','update') then
    if p_action='create' and c.status='completed' then raise exception 'Cannot add a certificate to a closed contract'; end if;
    if p_action='update' and (v.status<>'pending' or v.engineer_approved_at is not null) then raise exception 'Approved certificates are immutable'; end if;
    if p_action='update' and v.updated_at is distinct from (p_data->>'updatedAt')::timestamptz then raise exception 'Certificate changed; refresh before editing' using errcode='40001'; end if;
    gross:=coalesce(nullif(p_data->>'grossWorkValue','')::numeric,nullif(p_data->>'amount','')::numeric);
    vat:=coalesce(nullif(p_data->>'vatAmount','')::numeric,0);
    retention:=coalesce(nullif(p_data->>'retentionAmount','')::numeric,0);
    advance_recovery:=coalesce(nullif(p_data->>'advanceRecoveryAmount','')::numeric,0);
    deductions:=coalesce(nullif(p_data->>'deductionsAmount','')::numeric,0);
    net:=gross+vat-retention-advance_recovery-deductions;
    if gross is null or gross<=0 or least(vat,retention,advance_recovery,deductions)<0
      or gross<>round(gross,2) or vat<>round(vat,2) or retention<>round(retention,2)
      or advance_recovery<>round(advance_recovery,2) or deductions<>round(deductions,2)
      or net<=0 or nullif(trim(p_data->>'description'),'') is null or nullif(p_data->>'dueDate','') is null
      or (nullif(p_data->>'progressPercentage','') is not null and ((p_data->>'progressPercentage')::numeric<0 or (p_data->>'progressPercentage')::numeric>100)) then
      raise exception 'Valid positive certificate amounts, description and due date required';
    end if;
    if gross + (select coalesce(sum(gross_work_value),0) from public.subcontract_certificates where subcontract_id=c.id and id<>p_id) >
      c.total_amount + (select coalesce(sum(sv.amount),0) from public.subcontract_variations sv where sv.subcontract_id=c.id and sv.status='approved') then raise exception 'Certificates exceed contract value'; end if;
    if p_action='create' then
      insert into public.subcontract_certificates(id,company_id,subcontract_id,certificate_number,description,due_date,gross_work_value,vat_amount,retention_amount,advance_recovery_amount,deductions_amount,net_payable,progress_percentage,notes)
      values(p_id,u.company_id,c.id,p_id,trim(p_data->>'description'),(p_data->>'dueDate')::date,gross,vat,retention,advance_recovery,deductions,net,nullif(p_data->>'progressPercentage','')::numeric,nullif(trim(p_data->>'notes'),''));
    else
      update public.subcontract_certificates set description=trim(p_data->>'description'),due_date=(p_data->>'dueDate')::date,
        gross_work_value=gross,vat_amount=vat,retention_amount=retention,advance_recovery_amount=advance_recovery,
        deductions_amount=deductions,net_payable=net,progress_percentage=nullif(p_data->>'progressPercentage','')::numeric,
        notes=nullif(trim(p_data->>'notes'),'') where id=v.id;
    end if;
  elsif p_action='delete' then
    if v.status<>'pending' or v.engineer_approved_at is not null then raise exception 'Cannot delete an approved or paid certificate'; end if;
    delete from public.subcontract_certificates where id=v.id;
  elsif p_action in ('engineer','finance') then
    if v.status='paid' then raise exception 'Certificate already paid'; end if;
    if p_action='finance' and v.engineer_approved_at is null then raise exception 'Engineering approval required first'; end if;
    if (p_action='engineer' and v.engineer_approved_at is not null) or (p_action='finance' and v.finance_approved_at is not null) then return to_jsonb(v); end if;
    update public.subcontract_certificates set
      engineer_approved_at=case when p_action='engineer' then now() else engineer_approved_at end,
      engineer_approved_by=case when p_action='engineer' then u.id::text else engineer_approved_by end,
      finance_approved_at=case when p_action='finance' then now() else finance_approved_at end,
      finance_approved_by=case when p_action='finance' then u.id::text else finance_approved_by end,
      status=case when p_action='finance' then 'approved' else status end where id=v.id;
    insert into public.subcontract_approvals(company_id,certificate_id,stage,decision,approved_by,approved_by_name,notes)
    values(u.company_id,v.id,p_action,'approved',u.id,coalesce(u.full_name,u.email),p_data->>'notes');
  elsif p_action='pay' then
    if v.status<>'approved' or v.finance_approved_at is null or v.engineer_approved_at is null then raise exception 'Engineering and finance approvals required'; end if;
    method:=p_data->>'paymentMethod'; pay_date:=(p_data->>'paymentDate')::date; ref:=nullif(p_data->>'referenceNumber','');
    if method is null or method not in ('cash','transfer','check') or pay_date is null or v.net_payable<=0 then raise exception 'Valid payment method, date and amount required'; end if;
    expense_id:='SUB-'||v.id;
    voucher:=jsonb_build_object('id',expense_id,'number','PV-'||extract(year from pay_date)::text||'-'||expense_id,
      'date',pay_date,'amount',v.net_payable,'paidTo',(select name from public.subcontractors where id=c.subcontractor_id),
      'description',v.description,'paymentMethod',method,'referenceNumber',coalesce(ref,''),'projectId',c.project_legacy_id,
      'projectName',c.project_name,'categoryId','subcontract_payment','categoryName','عقود باطن',
      'sourceType','subcontract_certificate','sourceId',v.id,'readOnly',true,'attachments','[]'::jsonb);
    update public.subcontract_certificates set status='paid',payment_method=method,payment_date=pay_date,reference_number=ref where id=v.id;
    insert into public.subcontract_payments(id,company_id,certificate_id,subcontract_id,amount,payment_method,payment_date,reference_number,expense_record_id,created_by)
    values(expense_id,u.company_id,v.id,c.id,v.net_payable,method,pay_date,ref,expense_id,u.id);
    insert into public.jilco_realtime_data(collection,record_id,company_id,data)
    values('jilco_expenses_archive',expense_id,u.company_id,voucher);
    return jsonb_build_object('certificateId',v.id,'expenseId',expense_id,'amount',v.net_payable);
  end if;
  return jsonb_build_object('success',true,'certificateId',p_id);
end $$;

revoke all on function subcontract_private.certificate_action(text,text,jsonb) from public,anon;
grant execute on function subcontract_private.certificate_action(text,text,jsonb) to authenticated;
