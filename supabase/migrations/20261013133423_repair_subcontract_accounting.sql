-- Financial mutation guard and immutable posted journals.
create or replace function public.guard_subcontract_accounting() returns trigger
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare tenant uuid; role_name text; parent_status text;
begin
  tenant := case when TG_OP='DELETE' then old.company_id else new.company_id end;
  select role into role_name from public.app_users where id=auth.uid() and company_id=tenant;
  if coalesce(role_name,'') not in ('admin','manager','accountant') then raise exception 'Finance permission required' using errcode='42501'; end if;
  if TG_OP='UPDATE' and (new.id<>old.id or new.company_id<>old.company_id) then raise exception 'Identity is immutable'; end if;
  if TG_TABLE_NAME='accounting_journals' and TG_OP<>'INSERT' then
    if old.status<>'draft' then raise exception 'Posted journal is immutable'; end if;
  elsif TG_TABLE_NAME='accounting_entry_lines' then
    if TG_OP<>'INSERT' then
      select status into parent_status from public.accounting_journals where id=old.journal_id and company_id=old.company_id for update;
      if parent_status is distinct from 'draft' then raise exception 'Posted journal lines are immutable'; end if;
    end if;
    if TG_OP<>'DELETE' then
      select status into parent_status from public.accounting_journals where id=new.journal_id and company_id=new.company_id for update;
      if parent_status is distinct from 'draft' then raise exception 'Posted journal lines are immutable'; end if;
    end if;
  elsif TG_TABLE_NAME='subcontract_ledger_entries' and TG_OP<>'INSERT' then
    raise exception 'Ledger entries are immutable';
  end if;
  if TG_OP='DELETE' then return old; end if; return new;
end $$;
revoke all on function public.guard_subcontract_accounting() from public,anon,authenticated;
do $$ declare t text; begin
foreach t in array array['accounting_periods','chart_of_accounts','cost_centers','accounting_journals','accounting_entry_lines','subcontract_ledger_entries'] loop
 execute format('create trigger accounting_write_guard before insert or update or delete on public.%I for each row execute function public.guard_subcontract_accounting()',t);
end loop; end $$;

create or replace function public.guard_posted_subcontract_voucher() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.accounting_journals where company_id=old.company_id and source_type='subcontract_voucher' and source_id=old.id)
 then raise exception 'Posted voucher is immutable'; end if;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
revoke all on function public.guard_posted_subcontract_voucher() from public,anon,authenticated;
create trigger posted_voucher_guard before update or delete on public.subcontract_vouchers for each row execute function public.guard_posted_subcontract_voucher();

create or replace function public.post_subcontract_voucher(p_voucher_id text)
returns text
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare
  v record; p record; existing_id text; journal_id text; journal_number text;
  debit_account text; credit_account text; entry_type text;
begin
  if not exists(select 1 from public.app_users where id=auth.uid() and role in ('admin','manager','accountant')) then raise exception 'Finance permission required' using errcode='42501'; end if;
  select doc.* into v from public.subcontract_vouchers doc
  where doc.id=p_voucher_id
    and doc.company_id=(select company_id from public.app_users where id=(select auth.uid())) for update;
  if not found then raise exception 'Voucher not found or access denied'; end if;
  if (v.type='deduction' and v.status not in ('approved','paid')) or (v.type<>'deduction' and v.status<>'paid') then raise exception 'Voucher must be approved before posting'; end if;
  select id into existing_id from public.accounting_journals where company_id=v.company_id and source_type='subcontract_voucher' and source_id=v.id;
  if existing_id is not null then return existing_id; end if;
  select * into p from public.accounting_periods where company_id=v.company_id and v.voucher_date between period_start and period_end and status='open' limit 1;
  if not found then raise exception 'No open accounting period for voucher date'; end if;

  if v.certificate_id is not null then raise exception 'Linked certificate must be paid through certificate payment'; end if;
  if v.type='advance' then
    debit_account := '1300'; entry_type := 'advance';
  elsif v.type='deduction' then
    debit_account := '2100'; entry_type := 'deduction';
  else
    debit_account := case when v.type='retention_release' then '2120' else '2100' end; entry_type := case when v.type='retention_release' then 'retention' else 'voucher' end;
  end if;
  if v.type='deduction' then
    credit_account := '5100';
  elsif v.status='paid' then
    credit_account := case when v.payment_method='cash' then '1100' else '1110' end;
  else
    credit_account := '2110';
  end if;
  journal_id := 'jv-'||v.id; journal_number := 'JV-'||v.number;
  insert into public.accounting_journals (id,company_id,period_id,number,journal_date,description,source_type,source_id,status,posted_at,posted_by)
  values (journal_id,v.company_id,p.id,journal_number,v.voucher_date,v.description,'subcontract_voucher',v.id,'draft',null,(select auth.uid()));
  insert into public.accounting_entry_lines (id,company_id,journal_id,account_id,subcontract_id,description,debit,credit)
  values ('line-'||journal_id||'-d',v.company_id,journal_id,(select id from public.chart_of_accounts where company_id=v.company_id and code=debit_account),v.subcontract_id,v.description,v.amount,0),
         ('line-'||journal_id||'-c',v.company_id,journal_id,(select id from public.chart_of_accounts where company_id=v.company_id and code=credit_account),v.subcontract_id,v.description,0,v.amount);
  update public.accounting_journals set status='posted', posted_at=now(), posted_by=(select auth.uid()) where id=journal_id and company_id=v.company_id;
  insert into public.subcontract_ledger_entries (id,company_id,subcontract_id,journal_id,entry_date,entry_type,reference_number,description,debit,credit,created_by)
  values ('ledger-'||v.id,v.company_id,v.subcontract_id,journal_id,v.voucher_date,entry_type,v.number,v.description,0,v.amount,(select auth.uid()))
  on conflict do nothing;
  return journal_id;
end $$;
revoke all on function public.post_subcontract_voucher(text) from public, anon;
grant execute on function public.post_subcontract_voucher(text) to authenticated;


create or replace function public.post_subcontract_certificate(p_certificate_id text)
returns text
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare c record; p record; existing_id text; journal_id text; total_debit numeric := 0; total_credit numeric := 0;
begin
  if not exists(select 1 from public.app_users where id=auth.uid() and role in ('admin','manager','accountant')) then raise exception 'Finance permission required' using errcode='42501'; end if;
  select doc.* into c from public.subcontract_certificates doc
  where doc.id=p_certificate_id and doc.company_id=(select company_id from public.app_users where id=(select auth.uid()));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('certificate-'||p_certificate_id,0));
  if not found then raise exception 'Certificate not found or access denied'; end if;
  if c.finance_approved_at is null then raise exception 'Certificate must be finance approved before posting'; end if;
  select id into existing_id from public.accounting_journals where company_id=c.company_id and source_type='subcontract_certificate' and source_id=c.id;
  if existing_id is not null then return existing_id; end if;
  select * into p from public.accounting_periods where company_id=c.company_id and c.due_date between period_start and period_end and status='open' limit 1;
  if not found then raise exception 'No open accounting period for certificate date'; end if;
  journal_id := 'jc-'||c.id;
  insert into public.accounting_journals (id,company_id,period_id,number,journal_date,description,source_type,source_id,status,created_by)
  values (journal_id,c.company_id,p.id,'JC-'||c.certificate_number,c.due_date,c.description,'subcontract_certificate',c.id,'draft',(select auth.uid()));
  if c.gross_work_value > 0 then
    insert into public.accounting_entry_lines (id,company_id,journal_id,account_id,subcontract_id,description,debit,credit)
    values ('line-'||journal_id||'-gross',c.company_id,journal_id,(select id from public.chart_of_accounts where company_id=c.company_id and code='5100'),c.subcontract_id,c.description,c.gross_work_value,0); total_debit:=total_debit+c.gross_work_value;
  end if;
  if c.vat_amount > 0 then
    insert into public.accounting_entry_lines (id,company_id,journal_id,account_id,subcontract_id,description,debit,credit)
    values ('line-'||journal_id||'-vat',c.company_id,journal_id,(select id from public.chart_of_accounts where company_id=c.company_id and code='1400'),c.subcontract_id,'ضريبة مستخلص المقاول',c.vat_amount,0); total_debit:=total_debit+c.vat_amount;
  end if;
  if c.net_payable > 0 then
    insert into public.accounting_entry_lines (id,company_id,journal_id,account_id,subcontract_id,description,debit,credit)
    values ('line-'||journal_id||'-payable',c.company_id,journal_id,(select id from public.chart_of_accounts where company_id=c.company_id and code='2100'),c.subcontract_id,'ذمم المقاول',0,c.net_payable); total_credit:=total_credit+c.net_payable;
  end if;
  if c.retention_amount > 0 then
    insert into public.accounting_entry_lines (id,company_id,journal_id,account_id,subcontract_id,description,debit,credit)
    values ('line-'||journal_id||'-retention',c.company_id,journal_id,(select id from public.chart_of_accounts where company_id=c.company_id and code='2120'),c.subcontract_id,'استبقاء',0,c.retention_amount); total_credit:=total_credit+c.retention_amount;
  end if;
  if c.advance_recovery_amount > 0 then
    insert into public.accounting_entry_lines (id,company_id,journal_id,account_id,subcontract_id,description,debit,credit)
    values ('line-'||journal_id||'-advance',c.company_id,journal_id,(select id from public.chart_of_accounts where company_id=c.company_id and code='1300'),c.subcontract_id,'استرداد دفعة مقدمة',0,c.advance_recovery_amount); total_credit:=total_credit+c.advance_recovery_amount;
  end if;
  if c.deductions_amount > 0 then
    insert into public.accounting_entry_lines (id,company_id,journal_id,account_id,subcontract_id,description,debit,credit)
    values ('line-'||journal_id||'-deductions',c.company_id,journal_id,(select id from public.chart_of_accounts where company_id=c.company_id and code='5100'),c.subcontract_id,'خصومات وغرامات',0,c.deductions_amount); total_credit:=total_credit+c.deductions_amount;
  end if;
  if total_debit <= 0 or total_debit <> total_credit then raise exception 'Certificate accounting lines are not balanced'; end if;
  update public.accounting_journals set status='posted',posted_at=now(),posted_by=(select auth.uid()) where id=journal_id;
  insert into public.subcontract_ledger_entries (id,company_id,subcontract_id,journal_id,entry_date,entry_type,reference_number,description,debit,credit,created_by)
  values ('ledger-'||c.id,c.company_id,c.subcontract_id,journal_id,c.due_date,'certificate',c.certificate_number,c.description,c.net_payable,0,(select auth.uid())) on conflict do nothing;
  return journal_id;
end $$;
revoke all on function public.post_subcontract_certificate(text) from public, anon;
grant execute on function public.post_subcontract_certificate(text) to authenticated;



-- Wrap existing audited certificate action in the same database transaction.
create or replace function public.subcontract_certificate_action(p_action text,p_id text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare result jsonb;
begin
 result:=subcontract_private.certificate_action(p_action,p_id,p_data);
 if p_action='finance' then perform public.post_subcontract_certificate(p_id); end if;
 return result;
end $$;
create or replace function public.pay_subcontract_certificate(p_certificate_id text,p_payment_method text,p_payment_date date,p_reference_number text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare result jsonb; v record; period_id text; jid text; company uuid;
begin
 result:=subcontract_private.certificate_action('pay',p_certificate_id,jsonb_build_object('paymentMethod',p_payment_method,'paymentDate',p_payment_date,'referenceNumber',p_reference_number));
 perform public.post_subcontract_certificate(p_certificate_id);
 select company_id into company from public.app_users where id=auth.uid();
 select * into v from public.subcontract_payments where company_id=company and certificate_id=p_certificate_id;
 jid:='jp-'||v.id;
 if exists(select 1 from public.accounting_journals where id=jid and company_id=company) then return result; end if;
 select id into period_id from public.accounting_periods where company_id=company and p_payment_date between period_start and period_end and status='open' limit 1;
 if period_id is null then raise exception 'No open accounting period for payment date'; end if;
 insert into public.accounting_journals(id,company_id,period_id,number,journal_date,description,source_type,source_id,status)
 values(jid,company,period_id,'JP-'||v.id,p_payment_date,'سداد مستخلص مقاول','manual','payment-'||v.id,'draft');
 insert into public.accounting_entry_lines(id,company_id,journal_id,account_id,subcontract_id,debit,credit)
 values(jid||'-d',company,jid,(select id from public.chart_of_accounts where company_id=company and code='2100'),v.subcontract_id,v.amount,0),
 (jid||'-c',company,jid,(select id from public.chart_of_accounts where company_id=company and code=case when p_payment_method='cash' then '1100' else '1110' end),v.subcontract_id,0,v.amount);
 update public.accounting_journals set status='posted',posted_by=auth.uid() where id=jid and company_id=company;
 insert into public.subcontract_ledger_entries(id,company_id,subcontract_id,journal_id,entry_date,entry_type,reference_number,description,debit,credit)
 values(jid,company,v.subcontract_id,jid,p_payment_date,'payment',v.id,'سداد مستخلص مقاول',0,v.amount);
 return result;
end $$;
revoke all on function public.subcontract_certificate_action(text,text,jsonb),public.pay_subcontract_certificate(text,text,date,text) from public,anon;
grant execute on function public.subcontract_certificate_action(text,text,jsonb),public.pay_subcontract_certificate(text,text,date,text) to authenticated;

create or replace function public.subcontract_voucher_action(p_id text,p_action text,p_method text default null)
returns text language plpgsql security invoker set search_path='' as $$
declare v record;
begin
 if not exists(select 1 from public.app_users where id=auth.uid() and role in ('admin','manager','accountant')) then raise exception 'Finance permission required'; end if;
 select * into v from public.subcontract_vouchers where id=p_id and company_id=(select company_id from public.app_users where id=auth.uid()) for update;
 if not found then raise exception 'Voucher not found'; end if;
 if p_action='approve' and v.status='draft' then
   update public.subcontract_vouchers set status='approved',approved_by=auth.uid() where id=v.id;
   if v.type='deduction' then perform public.post_subcontract_voucher(v.id); end if;
 elsif p_action='pay' and v.status='approved' and v.type<>'deduction' then
   if p_method is null or p_method not in ('cash','transfer','check') then raise exception 'Valid payment method required'; end if;
   update public.subcontract_vouchers set status='paid',payment_method=p_method,paid_at=now() where id=v.id;
   perform public.post_subcontract_voucher(v.id);
 else raise exception 'Invalid voucher transition'; end if;
 return v.id;
end $$;
revoke all on function public.subcontract_voucher_action(text,text,text) from public,anon;
grant execute on function public.subcontract_voucher_action(text,text,text) to authenticated;

-- Only the public transactional entry points may call the existing audited
-- private mutator. Identity/role/tenant are verified there from auth.uid().
revoke execute on function subcontract_private.certificate_action(text,text,jsonb) from authenticated;
alter function public.subcontract_certificate_action(text,text,jsonb) security definer;
alter function public.pay_subcontract_certificate(text,text,date,text) security definer;

