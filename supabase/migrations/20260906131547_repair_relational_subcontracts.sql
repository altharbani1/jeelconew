-- The production relational tables already exist. Do not create a second JSON API.
-- Authorization data must never be writable by an ordinary authenticated client.
revoke insert, update, delete, truncate, references, trigger on public.app_users from authenticated, anon;
create policy app_users_self_guard on public.app_users as restrictive for select to authenticated
using (id = (select auth.uid()));

-- Scope the legacy records used by project costs. Preserve unambiguous ownership.
do $$ declare tenant uuid; begin
  if exists(select 1 from public.jilco_realtime_data where company_id is null
    and collection in ('subcontractors','subcontracts','jilco_projects','jilco_expenses_archive')) then
    if (select count(distinct company_id) from public.app_users) <> 1 then
      raise exception 'Resolve legacy record ownership before migration';
    end if;
    select company_id into tenant from public.app_users where company_id is not null limit 1;
    update public.jilco_realtime_data set company_id=tenant where company_id is null
      and collection in ('subcontractors','subcontracts','jilco_projects','jilco_expenses_archive');
  end if;
end $$;
create policy subcontract_legacy_tenant_guard on public.jilco_realtime_data as restrictive for all to authenticated
using (collection not in ('subcontractors','subcontracts','jilco_projects','jilco_expenses_archive') or
 company_id=(select company_id from public.app_users where id=(select auth.uid())))
with check (collection not in ('subcontractors','subcontracts','jilco_projects','jilco_expenses_archive') or
 company_id=(select company_id from public.app_users where id=(select auth.uid())));

-- Preserve historical embedded payments without inventing historical approvals.
-- Existing relational rows win; mismatching identities stop the migration.
do $$ declare r record; p jsonb; cert public.subcontract_certificates%rowtype; begin
  for r in select * from public.jilco_realtime_data where collection='subcontracts' loop
    if not exists(select 1 from public.subcontracts where id=r.record_id and company_id=r.company_id) then
      raise exception 'Legacy contract % has not been reconciled', r.record_id;
    end if;
    for p in select value from jsonb_array_elements(coalesce(r.data->'payments','[]')) loop
      select * into cert from public.subcontract_certificates where id=p->>'id';
      if found then
        if cert.company_id<>r.company_id or cert.subcontract_id<>r.record_id or cert.net_payable<>(p->>'amount')::numeric or cert.status<>p->>'status' then
          raise exception 'Conflicting historical certificate %', p->>'id';
        end if;
        continue;
      end if;
      insert into public.subcontract_certificates(id,company_id,subcontract_id,certificate_number,description,due_date,
        gross_work_value,net_payable,status,payment_method,payment_date,reference_number,notes)
      values(p->>'id',r.company_id,r.record_id,p->>'id',p->>'description',(p->>'dueDate')::date,
        (p->>'amount')::numeric,(p->>'amount')::numeric,p->>'status',p->>'paymentMethod',nullif(p->>'paymentDate','')::date,
        p->>'referenceNumber','Imported from legacy subcontract record; historical approval evidence unavailable');
      if p->>'status'='paid' then
        insert into public.subcontract_payments(id,company_id,certificate_id,subcontract_id,amount,payment_method,payment_date,reference_number,expense_record_id)
        values('SUB-'||(p->>'id'),r.company_id,p->>'id',r.record_id,(p->>'amount')::numeric,p->>'paymentMethod',
          (p->>'paymentDate')::date,p->>'referenceNumber','SUB-'||(p->>'id'));
        -- Restore the missing accounting record for an already-recorded payment.
        insert into public.jilco_realtime_data(collection,record_id,company_id,data)
        values('jilco_expenses_archive','SUB-'||(p->>'id'),r.company_id,jsonb_build_object(
          'id','SUB-'||(p->>'id'),'number','PV-SUB-'||(p->>'id'),'date',p->>'paymentDate',
          'amount',(p->>'amount')::numeric,'paidTo',r.data->>'subcontractorName','description',p->>'description',
          'paymentMethod',p->>'paymentMethod','referenceNumber',coalesce(p->>'referenceNumber',''),
          'projectId',r.data->>'projectId','projectName',r.data->>'projectName','categoryId','subcontract_payment',
          'categoryName','عقود باطن','sourceType','subcontract_certificate','sourceId',p->>'id','readOnly',true,
          'reconciledFromLegacy',true,'attachments','[]'::jsonb)) on conflict(collection,record_id) do nothing;
      end if;
    end loop;
  end loop;
end $$;

-- Relational foreign keys must carry company identity, including the certificate/contract pairing.
alter table public.subcontractors add constraint subcontractors_company_id_id_key unique(company_id,id);
alter table public.subcontracts add constraint subcontracts_company_id_id_key unique(company_id,id);
alter table public.subcontract_certificates add constraint certificates_company_id_id_contract_key unique(company_id,id,subcontract_id);
alter table public.subcontract_certificates add constraint certificates_company_id_id_key unique(company_id,id);
alter table public.subcontracts add constraint subcontracts_tenant_contractor_fk foreign key(company_id,subcontractor_id) references public.subcontractors(company_id,id);
alter table public.subcontract_certificates add constraint certificates_tenant_contract_fk foreign key(company_id,subcontract_id) references public.subcontracts(company_id,id);
alter table public.subcontract_payments add constraint payments_tenant_certificate_fk foreign key(company_id,certificate_id,subcontract_id) references public.subcontract_certificates(company_id,id,subcontract_id);
alter table public.subcontract_approvals add constraint approvals_tenant_certificate_fk foreign key(company_id,certificate_id) references public.subcontract_certificates(company_id,id);
alter table public.subcontract_variations add constraint variations_tenant_contract_fk foreign key(company_id,subcontract_id) references public.subcontracts(company_id,id);
alter table public.subcontract_attachments add constraint attachments_tenant_contract_fk foreign key(company_id,subcontract_id) references public.subcontracts(company_id,id);
alter table public.subcontract_attachments add constraint attachments_tenant_contractor_fk foreign key(company_id,subcontractor_id) references public.subcontractors(company_id,id);

-- A private, audited mutation boundary: callers cannot write financial tables directly.
create schema if not exists subcontract_private;
revoke all on schema subcontract_private from public, anon;
grant usage on schema subcontract_private to authenticated;
revoke insert,update,delete,truncate,references,trigger on public.subcontract_certificates, public.subcontract_payments, public.subcontract_approvals from authenticated,anon;
revoke truncate,trigger,references on public.subcontracts,public.subcontractors,public.subcontract_variations,public.subcontract_attachments,public.jilco_realtime_data from authenticated,anon;

create or replace function subcontract_private.certificate_action(p_action text,p_id text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  u public.app_users%rowtype; c public.subcontracts%rowtype; v public.subcontract_certificates%rowtype;
  amount numeric; method text; pay_date date; ref text; voucher jsonb; expense_id text; stage_name text;
begin
  select * into u from public.app_users where id=auth.uid();
  if u.id is null or u.company_id is null then raise exception 'Authentication and company required' using errcode='42501'; end if;
  if p_action not in ('create','update','delete','engineer','finance','pay') or p_action is null then raise exception 'Invalid action'; end if;
  if p_action in ('create','update','delete') and u.role not in ('admin','manager') then raise exception 'Management permission required' using errcode='42501'; end if;
  if p_action='engineer' and u.role not in ('admin','manager','technician') then raise exception 'Engineering permission required' using errcode='42501'; end if;
  if p_action in ('finance','pay') and u.role not in ('admin','manager','accountant') then raise exception 'Finance permission required' using errcode='42501'; end if;
  -- All certificate mutations lock the parent first, preventing concurrent over-commitment.
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
    amount:=(p_data->>'amount')::numeric;
    if amount is null or amount<=0 or amount<>round(amount,2) or nullif(trim(p_data->>'description'),'') is null or nullif(p_data->>'dueDate','') is null then raise exception 'Positive amount, description and due date required'; end if;
    if amount + (select coalesce(sum(gross_work_value),0) from public.subcontract_certificates where subcontract_id=c.id and id<>p_id) >
      c.total_amount + (select coalesce(sum(sv.amount),0) from public.subcontract_variations sv where sv.subcontract_id=c.id and sv.status='approved') then raise exception 'Certificates exceed contract value'; end if;
    if p_action='create' then
      insert into public.subcontract_certificates(id,company_id,subcontract_id,certificate_number,description,due_date,gross_work_value,net_payable,progress_percentage,notes)
      values(p_id,u.company_id,c.id,p_id,p_data->>'description',(p_data->>'dueDate')::date,amount,amount,nullif(p_data->>'progressPercentage','')::numeric,p_data->>'notes');
    else
      -- The compact UI edits simple certificates only; never erase accounting deductions.
      if v.retention_amount+v.advance_recovery_amount+v.deductions_amount+v.vat_amount<>0 then raise exception 'Detailed certificate amounts cannot be edited in the simple payment form'; end if;
      update public.subcontract_certificates set description=p_data->>'description',due_date=(p_data->>'dueDate')::date,
        gross_work_value=amount,net_payable=amount,progress_percentage=nullif(p_data->>'progressPercentage','')::numeric,notes=p_data->>'notes' where id=v.id;
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
create or replace function public.subcontract_certificate_action(p_action text,p_id text,p_data jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select subcontract_private.certificate_action(p_action,p_id,p_data);
$$;
create or replace function public.pay_subcontract_certificate(p_certificate_id text,p_payment_method text,p_payment_date date,p_reference_number text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select subcontract_private.certificate_action('pay',p_certificate_id,jsonb_build_object('paymentMethod',p_payment_method,'paymentDate',p_payment_date,'referenceNumber',p_reference_number));
$$;
revoke all on function public.subcontract_certificate_action(text,text,jsonb),public.pay_subcontract_certificate(text,text,date,text) from public,anon;
grant execute on function public.subcontract_certificate_action(text,text,jsonb),public.pay_subcontract_certificate(text,text,date,text) to authenticated;

create or replace function subcontract_private.guard_management() returns trigger language plpgsql security invoker set search_path='' as $$
declare tenant uuid; role_name text; v_id text;
begin
  tenant:=case when TG_OP='DELETE' then old.company_id else new.company_id end;
  select role into role_name from public.app_users where id=auth.uid() and company_id=tenant;
  if coalesce(role_name,'') not in ('admin','manager') then raise exception 'Management permission required' using errcode='42501'; end if;
  if TG_OP='UPDATE' and (new.id<>old.id or new.company_id<>old.company_id) then raise exception 'Identity is immutable'; end if;
  if TG_TABLE_NAME='subcontracts' then
    v_id:=case when TG_OP='DELETE' then old.id else new.id end;
    if TG_OP='DELETE' then
      if old.status<>'draft' or exists(select 1 from public.subcontract_certificates where subcontract_id=v_id)
        or exists(select 1 from public.subcontract_attachments where subcontract_id=v_id)
        or exists(select 1 from public.subcontract_variations where subcontract_id=v_id) then raise exception 'Only empty draft contracts can be deleted'; end if;
    else
      if new.total_amount<=0 or nullif(trim(new.number),'') is null then raise exception 'Contract number and positive value required'; end if;
      if new.status='completed' and new.progress_percentage<>100 then raise exception 'Completion requires 100 percent progress'; end if;
      if TG_OP='UPDATE' then
        if old.status in ('completed','cancelled') and to_jsonb(new)-'updated_at' is distinct from to_jsonb(old)-'updated_at' then raise exception 'Closed contract is immutable'; end if;
        if old.status='active' and new.status='draft' then raise exception 'Active contract cannot return to draft'; end if;
        if exists(select 1 from public.subcontract_certificates where subcontract_id=v_id) and
          (new.subcontractor_id<>old.subcontractor_id or new.project_legacy_id is distinct from old.project_legacy_id or new.linked_entity_type<>old.linked_entity_type or new.linked_contract_legacy_id is distinct from old.linked_contract_legacy_id or new.status='cancelled') then raise exception 'Contract with certificates cannot change parties or be cancelled'; end if;
      end if;
      if new.total_amount+(select coalesce(sum(amount),0) from public.subcontract_variations where subcontract_id=v_id and status='approved') <
        (select coalesce(sum(gross_work_value),0) from public.subcontract_certificates where subcontract_id=v_id) then raise exception 'Contract value cannot be below certificates'; end if;
      if not exists(select 1 from public.subcontractors where id=new.subcontractor_id and company_id=tenant and status='active') then raise exception 'Active company contractor required'; end if;
      if new.linked_entity_type='project' and not exists(select 1 from public.jilco_realtime_data where collection='jilco_projects' and record_id=new.project_legacy_id and company_id=tenant) then raise exception 'Project not found in company'; end if;
    end if;
  elsif TG_TABLE_NAME='subcontract_variations' then
    if TG_OP<>'INSERT' and old.status='approved' then raise exception 'Approved variations are immutable'; end if;
    if TG_OP<>'DELETE' then
      perform 1 from public.subcontracts where id=new.subcontract_id and company_id=tenant and status='active' for update;
      if not found then raise exception 'Variation requires active contract'; end if;
      if TG_OP='UPDATE' and new.subcontract_id<>old.subcontract_id then raise exception 'Variation contract is immutable'; end if;
      if new.status='approved' then
        if (select total_amount from public.subcontracts where id=new.subcontract_id) + new.amount +
          (select coalesce(sum(amount),0) from public.subcontract_variations where subcontract_id=new.subcontract_id and status='approved' and id<>new.id) <
          (select coalesce(sum(gross_work_value),0) from public.subcontract_certificates where subcontract_id=new.subcontract_id) then raise exception 'Variation would reduce value below certificates'; end if;
        new.approved_at:=now();
      end if;
    end if;
  elsif TG_TABLE_NAME='subcontractors' and TG_OP<>'DELETE' then
    if nullif(trim(new.name),'') is null or nullif(trim(new.specialty),'') is null then raise exception 'Contractor name and specialty required'; end if;
  elsif TG_TABLE_NAME='subcontract_attachments' and TG_OP<>'DELETE' then
    if new.bucket<>'subcontract-documents' or split_part(new.object_path,'/',1)<>tenant::text or
      (new.subcontract_id is not null and split_part(new.object_path,'/',2)<>new.subcontract_id) or
      not exists(select 1 from storage.objects where bucket_id=new.bucket and name=new.object_path) then raise exception 'Uploaded company attachment required'; end if;
  end if;
  if TG_OP='DELETE' then return old; else return new; end if;
end $$;
revoke all on function subcontract_private.guard_management() from public,anon,authenticated;
create trigger subcontract_management_guard before insert or update or delete on public.subcontracts for each row execute function subcontract_private.guard_management();
create trigger subcontractor_management_guard before insert or update or delete on public.subcontractors for each row execute function subcontract_private.guard_management();
create trigger subcontract_attachment_guard before insert or update or delete on public.subcontract_attachments for each row execute function subcontract_private.guard_management();
create trigger subcontract_variation_guard before insert or update or delete on public.subcontract_variations for each row execute function subcontract_private.guard_management();

create or replace function subcontract_private.guard_legacy() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user='authenticated' then
    if TG_OP='UPDATE' and (old.collection in ('subcontractors','subcontracts','jilco_projects','jilco_expenses_archive') or new.collection in ('subcontractors','subcontracts','jilco_projects','jilco_expenses_archive')) and
      (new.collection<>old.collection or new.record_id<>old.record_id or new.company_id is distinct from old.company_id) then raise exception 'Record identity is immutable'; end if;
    if TG_OP='DELETE' and old.collection='jilco_projects' and exists(select 1 from public.subcontracts where project_legacy_id=old.record_id and company_id=old.company_id) then raise exception 'Project has subcontract references'; end if;
    if (TG_OP<>'INSERT' and old.collection in ('subcontractors','subcontracts')) or
       (TG_OP<>'DELETE' and new.collection in ('subcontractors','subcontracts')) then raise exception 'Use the relational subcontract module'; end if;
    if (TG_OP<>'INSERT' and old.collection='jilco_expenses_archive' and (old.record_id like 'SUB-%' or old.data->>'sourceType'='subcontract_certificate')) or
       (TG_OP<>'DELETE' and new.collection='jilco_expenses_archive' and (new.record_id like 'SUB-%' or new.data->>'sourceType'='subcontract_certificate')) then raise exception 'Subcontract vouchers can only be created by certificate payment and cannot be edited or deleted'; end if;
  end if;
  if TG_OP='DELETE' then return old; else return new; end if;
end $$;
revoke all on function subcontract_private.guard_legacy() from public,anon,authenticated;
create trigger subcontract_legacy_guard before insert or update or delete on public.jilco_realtime_data for each row execute function subcontract_private.guard_legacy();
create policy subcontract_storage_tenant_guard on storage.objects as restrictive for all to authenticated
using(bucket_id<>'subcontract-documents' or (storage.foldername(name))[1]=(select company_id::text from public.app_users where id=(select auth.uid())))
with check(bucket_id<>'subcontract-documents' or (storage.foldername(name))[1]=(select company_id::text from public.app_users where id=(select auth.uid()) and role in ('admin','manager')));
create policy subcontract_storage_no_overwrite on storage.objects as restrictive for update to authenticated
using(bucket_id<>'subcontract-documents') with check(bucket_id<>'subcontract-documents');
create policy subcontract_storage_delete_guard on storage.objects as restrictive for delete to authenticated
using(bucket_id<>'subcontract-documents' or (
  (storage.foldername(name))[1]=(select company_id::text from public.app_users where id=(select auth.uid()) and role in ('admin','manager'))
  and not exists(select 1 from public.subcontract_attachments a where a.bucket=objects.bucket_id and a.object_path=objects.name)));
-- First-run setup remains possible only while no company membership exists.
create function subcontract_private.bootstrap_company(p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); tenant uuid;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(914728);
  select company_id into tenant from public.app_users where id=uid;
  if tenant is not null then return tenant; end if;
  if exists(select 1 from public.app_users) then raise exception 'Initial setup is complete. Ask your administrator to provision your account.' using errcode='42501'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Company name required'; end if;
  insert into public.companies(name) values(trim(p_name)) returning id into tenant;
  insert into public.app_users(id,company_id,role) values(uid,tenant,'admin');
  return tenant;
end $$;
revoke all on function subcontract_private.bootstrap_company(text) from public,anon;
grant execute on function subcontract_private.bootstrap_company(text) to authenticated;
create function public.bootstrap_company(p_name text) returns uuid language sql security invoker set search_path='' as $$
  select subcontract_private.bootstrap_company(p_name);
$$;
revoke all on function public.bootstrap_company(text) from public,anon;
grant execute on function public.bootstrap_company(text) to authenticated;
notify pgrst, 'reload schema';
