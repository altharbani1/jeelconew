-- Requires the existing legacy store and app_users.role used by the HR migrations.
-- Stop instead of guessing ownership when more than one company has legacy data.
do $$
declare c uuid;
begin
  if exists (select 1 from public.jilco_realtime_data where collection in
    ('subcontractors','subcontracts','jilco_projects','jilco_expenses_archive') and company_id is null) then
    if (select count(distinct company_id) from public.app_users where company_id is not null) <> 1 then
      raise exception 'Assign company_id to legacy subcontract/project/expense records before migration';
    end if;
    select company_id into c from public.app_users where company_id is not null limit 1;
    update public.jilco_realtime_data set company_id=c where collection in
      ('subcontractors','subcontracts','jilco_projects','jilco_expenses_archive') and company_id is null;
  end if;
end $$;

alter table public.jilco_realtime_data enable row level security;
-- Restrictive policies also constrain older permissive policies.
create policy subcontract_tenant_guard on public.jilco_realtime_data as restrictive for all to public
using (collection not in ('subcontractors','subcontracts','jilco_projects','jilco_expenses_archive') or
  (auth.uid() is not null and company_id=(select company_id from public.app_users where id=auth.uid())))
with check (collection not in ('subcontractors','subcontracts','jilco_projects','jilco_expenses_archive') or
  (auth.uid() is not null and company_id=(select company_id from public.app_users where id=auth.uid())));

create index if not exists subcontract_company_idx on public.jilco_realtime_data(company_id,collection);
create unique index subcontract_number_idx on public.jilco_realtime_data(company_id,(data->>'number')) where collection='subcontracts';

-- All entry points, including legacy direct REST writes, obey these invariants.
create function public.guard_subcontract_record() returns trigger language plpgsql security invoker set search_path='' as $$
declare
  d jsonb; previous jsonb; p jsonb; old_p jsonb; ids text[] := '{}'; total numeric := 0;
  company uuid; role_name text; contractor jsonb; project jsonb; contract_doc jsonb;
begin
  if TG_OP='UPDATE' and (old.collection in ('subcontractors','subcontracts','jilco_projects','jilco_expenses_archive') or new.collection in ('subcontractors','subcontracts','jilco_projects','jilco_expenses_archive')) and
    (old.collection<>new.collection or old.record_id<>new.record_id or old.company_id is distinct from new.company_id) then
    raise exception 'Record identity and company cannot change';
  end if;
  d := case when TG_OP='DELETE' then old.data else new.data end;
  company := case when TG_OP='DELETE' then old.company_id else new.company_id end;
  if TG_OP='DELETE' and old.collection='jilco_projects' and exists(select 1 from public.jilco_realtime_data where collection='subcontracts' and company_id=company and data->>'projectId'=old.record_id) then
    raise exception 'لا يمكن حذف مشروع مرتبط بعقود باطن';
  end if;
  if (case when TG_OP='DELETE' then old.collection else new.collection end) not in ('subcontractors','subcontracts','jilco_expenses_archive') then
    if TG_OP='DELETE' then return old; else return new; end if;
  end if;
  if (case when TG_OP='DELETE' then old.collection else new.collection end)='jilco_expenses_archive' then
    if TG_OP='UPDATE' and (new.record_id like 'SUB-%' or new.data->>'categoryId'='subcontract_payment') and old.data is distinct from new.data then
      raise exception 'Paid subcontract vouchers are immutable';
    end if;
    if TG_OP='UPDATE' and (old.record_id like 'SUB-%' or old.data->>'categoryId'='subcontract_payment') then
      if old.data is distinct from new.data then raise exception 'Paid subcontract vouchers are immutable'; end if;
    elsif TG_OP='DELETE' and (old.record_id like 'SUB-%' or d->>'categoryId'='subcontract_payment') then
      raise exception 'Paid subcontract vouchers cannot be deleted';
    elsif TG_OP='INSERT' and (new.record_id like 'SUB-%' or d->>'categoryId'='subcontract_payment') then
      select data into contract_doc from public.jilco_realtime_data where collection='subcontracts'
        and record_id=d->>'subcontractId' and company_id=company;
      select value into p from jsonb_array_elements(coalesce(contract_doc->'payments','[]')) where value->>'id'=d->>'paymentId';
      if p is null or p->>'status'<>'paid' or new.record_id <> 'SUB-'||(p->>'id') or
        (d->>'amount')::numeric is distinct from (p->>'amount')::numeric or d->>'projectId' is distinct from contract_doc->>'projectId' then
        raise exception 'Invalid linked subcontract voucher';
      end if;
    end if;
    if TG_OP='DELETE' then return old; else return new; end if;
  end if;
  select au.role::text into role_name from public.app_users au where au.id=auth.uid() and au.company_id=company;
  if coalesce(role_name,'') not in ('admin','manager') then raise exception 'إدارة عقود الباطن تتطلب مديرًا مخولًا' using errcode='42501'; end if;
  if TG_OP='DELETE' then
    if old.collection='subcontractors' and exists(select 1 from public.jilco_realtime_data where collection='subcontracts' and company_id=company and data->>'subcontractorId'=old.record_id) then
      raise exception 'لا يمكن حذف مقاول مرتبط بعقود؛ عطّل المقاول بدلاً من حذفه';
    end if;
    if old.collection='subcontracts' and (jsonb_array_length(coalesce(d->'payments','[]'))>0 or jsonb_array_length(coalesce(d->'attachments','[]'))>0) then
      raise exception 'لا يمكن حذف عقد له دفعات أو مرفقات';
    end if;
    return old;
  end if;
  if d->>'id' is distinct from new.record_id then raise exception 'Invalid record id'; end if;
  if TG_OP='UPDATE' then
    previous:=old.data;
    if (d->>'revision')::integer is distinct from coalesce((previous->>'revision')::integer,0)+1 then
      raise exception 'تم تعديل السجل من جلسة أخرى؛ حدّث البيانات وأعد المحاولة' using errcode='40001';
    end if;
  else
    if coalesce((d->>'revision')::integer,0)<>1 then raise exception 'Invalid initial revision'; end if;
  end if;
  if new.collection='subcontractors' then
    if coalesce(trim(d->>'name'),'')='' or coalesce(trim(d->>'specialty'),'')='' or coalesce(d->>'status','') not in ('active','inactive') then raise exception 'بيانات المقاول غير مكتملة'; end if;
    return new;
  end if;
  if coalesce(d->>'status','') not in ('draft','active','completed','cancelled') or
    coalesce(d->>'totalAmount','') !~ '^[0-9]+(\.[0-9]{1,2})?$' or (d->>'totalAmount')::numeric<=0 or
    coalesce(d->>'progressPercentage','') !~ '^[0-9]+(\.[0-9]+)?$' or (d->>'progressPercentage')::numeric>100 or
    coalesce(trim(d->>'number'),'')='' then raise exception 'قيمة العقد أو حالته أو نسبة إنجازه غير صحيحة'; end if;
  if coalesce(d->>'date','')='' or coalesce(d->>'startDate','')='' or coalesce(d->>'endDate','')='' or
    (d->>'endDate')::date<(d->>'startDate')::date then raise exception 'تواريخ العقد غير صحيحة'; end if;
  perform (d->>'date')::date;
  if d->>'status'='completed' and (d->>'progressPercentage')::numeric<>100 then raise exception 'إكمال العقد يتطلب إنجاز 100%%'; end if;
  if previous->>'status' in ('completed','cancelled') and d->>'status' is distinct from previous->>'status' then raise exception 'لا يمكن إعادة فتح عقد مغلق'; end if;
  if previous->>'status'='active' and d->>'status'='draft' then raise exception 'لا يمكن إعادة العقد النشط إلى مسودة'; end if;
  select data into contractor from public.jilco_realtime_data where collection='subcontractors' and record_id=d->>'subcontractorId' and company_id=company for update;
  if contractor is null then raise exception 'المقاول غير موجود في الشركة'; end if;
  if contractor->>'status'<>'active' and (TG_OP='INSERT' or previous->>'subcontractorId' is distinct from d->>'subcontractorId') then raise exception 'المقاول غير نشط'; end if;
  select data into project from public.jilco_realtime_data where collection='jilco_projects' and record_id=d->>'projectId' and company_id=company for update;
  if project is null then raise exception 'المشروع غير موجود في الشركة'; end if;
  if exists(select 1 from public.jilco_realtime_data where company_id=company and collection='subcontracts' and record_id<>new.record_id and data->>'number'=d->>'number') then raise exception 'رقم العقد مستخدم'; end if;
  if jsonb_typeof(d->'payments') is distinct from 'array' then raise exception 'Invalid payments'; end if;
  if d ? 'attachments' and jsonb_typeof(d->'attachments') is distinct from 'array' then raise exception 'Invalid attachments'; end if;
  for p in select value from jsonb_array_elements(coalesce(d->'attachments','[]')) loop
    -- Keep legacy metadata unchanged so old temporary links can be removed/re-uploaded.
    if exists(select 1 from jsonb_array_elements(coalesce(previous->'attachments','[]')) a where a=p) then continue; end if;
    if split_part(coalesce(p->>'storagePath',''), '/', 1) <> company::text or
      split_part(coalesce(p->>'storagePath',''), '/', 2) <> new.record_id or
      not exists(select 1 from storage.objects where bucket_id='subcontract-files' and name=p->>'storagePath') then
      raise exception 'المرفق غير موجود في تخزين هذا العقد';
    end if;
  end loop;
  for old_p in select value from jsonb_array_elements(coalesce(previous->'payments','[]')) loop
    if old_p->>'status' in ('approved','paid') then
      select value into p from jsonb_array_elements(d->'payments') where value->>'id'=old_p->>'id';
      if p is null then raise exception 'لا يمكن حذف دفعة معتمدة أو مصروفة'; end if;
      if old_p->>'status'='paid' and p is distinct from old_p then raise exception 'لا يمكن تعديل دفعة مصروفة'; end if;
      if old_p->>'status'='approved' and (p->>'status' not in ('approved','paid') or
        (p - array['status','paymentDate','paymentMethod','referenceNumber']) is distinct from (old_p - array['status','paymentDate','paymentMethod','referenceNumber'])) then raise exception 'لا يمكن تعديل بيانات دفعة معتمدة'; end if;
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(coalesce(previous->'payments','[]')) x where x->>'status'='paid') and
    (d->>'projectId' is distinct from previous->>'projectId' or d->>'subcontractorId' is distinct from previous->>'subcontractorId' or d->>'status'='cancelled') then raise exception 'لا يمكن تغيير أطراف عقد مصروف أو إلغاؤه'; end if;
  for p in select value from jsonb_array_elements(d->'payments') loop
    if coalesce(p->>'id','')='' or p->>'id'=any(ids) or p->>'subcontractId' is distinct from new.record_id or
      coalesce(p->>'amount','') !~ '^[0-9]+(\.[0-9]{1,2})?$' or (p->>'amount')::numeric<=0 or
      coalesce(trim(p->>'description'),'')='' or coalesce(p->>'dueDate','')='' or coalesce(p->>'status','') not in ('pending','approved','paid') then raise exception 'بيانات الدفعة غير صحيحة'; end if;
    perform (p->>'dueDate')::date;
    if p->>'progressPercentage' is not null and ((p->>'progressPercentage')::numeric<0 or (p->>'progressPercentage')::numeric>100) then raise exception 'نسبة الإنجاز بين 0 و100'; end if;
    ids:=array_append(ids,p->>'id'); total:=total+(p->>'amount')::numeric;
    select value into old_p from jsonb_array_elements(coalesce(previous->'payments','[]')) where value->>'id'=p->>'id';
    if old_p is null and d->>'status' in ('completed','cancelled') then raise exception 'لا يمكن إضافة دفعة إلى عقد مغلق'; end if;
    if old_p is null and p->>'status'<>'pending' then raise exception 'الدفعة الجديدة تبدأ قيد الانتظار'; end if;
    if p->>'status' is distinct from old_p->>'status' and p->>'status' in ('approved','paid') then
      if d->>'status' not in ('active','completed') then raise exception 'اعتماد وصرف الدفعات يتطلب عقدًا فعالًا'; end if;
      if p->>'status'='paid' and old_p->>'status' is distinct from 'approved' then raise exception 'اعتمد الدفعة قبل صرفها'; end if;
    end if;
    if p->>'status'='paid' and (coalesce(p->>'paymentMethod','') not in ('cash','transfer','check') or coalesce(p->>'paymentDate','')='') then raise exception 'طريقة وتاريخ الصرف مطلوبان'; end if;
    if p->>'status'='paid' then perform (p->>'paymentDate')::date; end if;
  end loop;
  if total>(d->>'totalAmount')::numeric then raise exception 'إجمالي الدفعات يتجاوز قيمة العقد'; end if;
  if d->>'status'='cancelled' and jsonb_array_length(d->'payments')>0 then raise exception 'أزل الدفعات غير المعتمدة قبل إلغاء العقد'; end if;
  new.data:=d || jsonb_build_object('subcontractorName',contractor->>'name','projectName',project->>'name');
  return new;
end $$;

create trigger guard_subcontracts before insert or update or delete on public.jilco_realtime_data
for each row execute function public.guard_subcontract_record();

-- Runs in the SAME transaction as the contract change. A voucher failure rolls everything back.
create function public.post_subcontract_vouchers() returns trigger language plpgsql security invoker set search_path='' as $$
declare p jsonb; old_p jsonb; voucher jsonb;
begin
  if new.collection<>'subcontracts' then return new; end if;
  for p in select value from jsonb_array_elements(new.data->'payments') where value->>'status'='paid' loop
    old_p:=null;
    if TG_OP='UPDATE' then select value into old_p from jsonb_array_elements(coalesce(old.data->'payments','[]')) where value->>'id'=p->>'id'; end if;
    if old_p->>'status'='paid' then continue; end if;
    voucher:=jsonb_build_object('id','SUB-'||(p->>'id'),'number','PV-SUB-'||(p->>'id'),
      'date',p->>'paymentDate','categoryId','subcontract_payment','categoryName','عقود باطن',
      'paidTo',new.data->>'subcontractorName','description',p->>'description','amount',p->'amount',
      'paymentMethod',p->>'paymentMethod','referenceNumber',coalesce(p->>'referenceNumber',''),
      'projectId',new.data->>'projectId','projectName',new.data->>'projectName',
      'subcontractId',new.record_id,'paymentId',p->>'id','attachments','[]'::jsonb);
    insert into public.jilco_realtime_data(collection,record_id,company_id,data,updated_at)
      values('jilco_expenses_archive',voucher->>'id',new.company_id,voucher,now());
  end loop;
  return new;
end $$;
create trigger post_subcontract_vouchers after insert or update on public.jilco_realtime_data
for each row execute function public.post_subcontract_vouchers();

create function public.mutate_subcontract_record(p_collection text,p_id text,p_data jsonb,p_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare company uuid; previous jsonb; result jsonb;
begin
  if auth.uid() is null or p_collection not in ('subcontractors','subcontracts') then raise exception 'Unauthorized' using errcode='42501'; end if;
  select company_id into company from public.app_users where id=auth.uid();
  if company is null then raise exception 'Company required'; end if;
  -- Serialize reference checks, numbers and edits for this company.
  perform pg_advisory_xact_lock(hashtextextended(company::text,0));
  select data into previous from public.jilco_realtime_data where collection=p_collection and record_id=p_id and company_id=company for update;
  -- A retry after a lost response returns the already committed record, never another voucher.
  if previous is not null and (previous-'revision')=(p_data-'revision') then return previous; end if;
  if p_revision is null or p_revision<>coalesce((previous->>'revision')::integer,0) then raise exception 'تم تعديل السجل؛ حدّث البيانات وأعد المحاولة' using errcode='40001'; end if;
  if p_data is null then
    if previous is null then raise exception 'السجل غير موجود'; end if;
    delete from public.jilco_realtime_data where collection=p_collection and record_id=p_id and company_id=company;
    return null;
  end if;
  result:=p_data || jsonb_build_object('id',p_id,'revision',p_revision+1);
  if previous is null then
    insert into public.jilco_realtime_data(collection,record_id,company_id,data,updated_at) values(p_collection,p_id,company,result,now()) returning data into result;
  else
    update public.jilco_realtime_data set data=result,updated_at=now() where collection=p_collection and record_id=p_id and company_id=company returning data into result;
  end if;
  return result;
end $$;
revoke all on function public.mutate_subcontract_record(text,text,jsonb,integer) from public,anon;
grant execute on function public.mutate_subcontract_record(text,text,jsonb,integer) to authenticated;
revoke all on function public.guard_subcontract_record(), public.post_subcontract_vouchers() from public,anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('subcontract-files','subcontract-files',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create policy subcontract_files_read on storage.objects for select to authenticated using
  (bucket_id='subcontract-files' and (storage.foldername(name))[1]=(select company_id::text from public.app_users where id=auth.uid()));
create policy subcontract_files_insert on storage.objects for insert to authenticated with check
  (bucket_id='subcontract-files' and (storage.foldername(name))[1]=(select company_id::text from public.app_users where id=auth.uid() and role in ('admin','manager')));
-- Prevent unrelated permissive storage policies from exposing this bucket.
create policy subcontract_files_guard on storage.objects as restrictive for all to public
using(bucket_id<>'subcontract-files' or (auth.uid() is not null and (storage.foldername(name))[1]=(select company_id::text from public.app_users where id=auth.uid())))
with check(bucket_id<>'subcontract-files' or (auth.uid() is not null and (storage.foldername(name))[1]=(select company_id::text from public.app_users where id=auth.uid() and role in ('admin','manager'))));
create policy subcontract_files_no_update on storage.objects as restrictive for update to public
using(bucket_id<>'subcontract-files') with check(bucket_id<>'subcontract-files');
create policy subcontract_files_no_delete on storage.objects as restrictive for delete to public
using(bucket_id<>'subcontract-files');
