
alter table public.subcontract_vouchers add column if not exists payment_date date;

create or replace function public.assert_subcontract_journal(p_id text,p_company uuid,p_source text,p_source_id text,p_contract text,p_amount numeric,p_date date)
returns void language plpgsql security invoker set search_path='' as $$
declare j record; d numeric; c numeric; n integer; doc record; debit_code text; credit_code text;
begin
 select * into j from public.accounting_journals where id=p_id and company_id=p_company;
 if not found or j.status<>'posted' or j.source_type<>p_source or j.source_id is distinct from p_source_id or j.journal_date<>p_date then
   raise exception 'Journal does not match source document'; end if;
 select coalesce(sum(debit),0),coalesce(sum(credit),0),count(*) into d,c,n from public.accounting_entry_lines where journal_id=p_id and company_id=p_company;
 if n<2 or d<>p_amount or c<>p_amount or exists(select 1 from public.accounting_entry_lines where journal_id=p_id and company_id=p_company and subcontract_id is distinct from p_contract) then raise exception 'Journal does not match source amount'; end if;
 if p_source='subcontract_voucher' then
  select * into doc from public.subcontract_vouchers where id=p_source_id and company_id=p_company;
  debit_code:=case doc.type when 'advance' then '1300' when 'retention_release' then '2120' else '2100' end;
  credit_code:=case when doc.type='deduction' then '5100' when doc.payment_method='cash' then '1100' else '1110' end;
  if n<>2 or (select coalesce(sum(l.debit),0) from public.accounting_entry_lines l join public.chart_of_accounts a on a.id=l.account_id and a.company_id=l.company_id where l.journal_id=p_id and l.company_id=p_company and a.code=debit_code)<>p_amount
  or (select coalesce(sum(l.credit),0) from public.accounting_entry_lines l join public.chart_of_accounts a on a.id=l.account_id and a.company_id=l.company_id where l.journal_id=p_id and l.company_id=p_company and a.code=credit_code)<>p_amount then raise exception 'Journal accounts do not match voucher'; end if;
 elsif p_source='subcontract_certificate' then
  select * into doc from public.subcontract_certificates where id=p_source_id and company_id=p_company;
  if exists(
    select 1 from (values ('5100',doc.gross_work_value,doc.deductions_amount),('1400',doc.vat_amount,0::numeric),('2100',0::numeric,doc.net_payable),('2120',0::numeric,doc.retention_amount),('1300',0::numeric,doc.advance_recovery_amount)) expected(code,debit,credit)
    where expected.debit<>(select coalesce(sum(l.debit),0) from public.accounting_entry_lines l join public.chart_of_accounts a on a.id=l.account_id and a.company_id=l.company_id where l.journal_id=p_id and l.company_id=p_company and a.code=expected.code)
    or expected.credit<>(select coalesce(sum(l.credit),0) from public.accounting_entry_lines l join public.chart_of_accounts a on a.id=l.account_id and a.company_id=l.company_id where l.journal_id=p_id and l.company_id=p_company and a.code=expected.code)
  ) then raise exception 'Journal accounts do not match certificate'; end if;
 end if;

end $$;

alter table public.subcontracts add constraint subcontract_advance_budget_valid check (advance_payment_amount >= 0 and advance_payment_amount <= total_amount) not valid;
revoke all on function public.assert_subcontract_journal(text,uuid,text,text,text,numeric,date) from public,anon;
grant execute on function public.assert_subcontract_journal(text,uuid,text,text,text,numeric,date) to authenticated;

-- Derive each financial line's cost center from the contract project.
create or replace function public.assign_subcontract_cost_center() returns trigger
language plpgsql security invoker set search_path='' as $$
declare project text; center text; project_label text;
begin
 if new.subcontract_id is null then return new; end if;
 select project_legacy_id,project_name into project,project_label from public.subcontracts where id=new.subcontract_id and company_id=new.company_id;
 if project is null then raise exception 'Contract project required for accounting'; end if;
 center:='project-'||new.company_id::text||'-'||project;
 insert into public.cost_centers(id,company_id,code,name,project_id)
 values(center,new.company_id,'PRJ-'||project,coalesce(project_label,project),project) on conflict(company_id,code) do nothing;
 new.cost_center_id := (select id from public.cost_centers where company_id=new.company_id and code='PRJ-'||project);
 return new;
end $$;
revoke all on function public.assign_subcontract_cost_center() from public,anon,authenticated;
create trigger assign_subcontract_cost_center before insert on public.accounting_entry_lines for each row execute function public.assign_subcontract_cost_center();

create or replace function public.guard_subcontract_payment_limit() returns trigger
language plpgsql security invoker set search_path='' as $$
declare contract_row record; earned numeric; spent numeric; available numeric; voucher_type text;
begin
 if TG_TABLE_NAME='subcontract_vouchers' then
   voucher_type:=new.type;
   if new.status<>'paid' and not(new.type='deduction' and new.status='approved') then return new; end if;
   if TG_OP='UPDATE' and old.status=new.status and old.amount=new.amount then return new; end if;
 end if;
 select * into contract_row from public.subcontracts where id=new.subcontract_id and company_id=new.company_id for update;
 if not found then raise exception 'Contract not found'; end if;
 if voucher_type='advance' then
   select coalesce(sum(amount),0) into spent from public.subcontract_vouchers where company_id=new.company_id and subcontract_id=new.subcontract_id and type='advance' and status='paid' and id<>new.id;
   available:=contract_row.advance_payment_amount-spent;
 elsif voucher_type='retention_release' then
   select coalesce(sum(retention_amount),0) into earned from public.subcontract_certificates where company_id=new.company_id and subcontract_id=new.subcontract_id and finance_approved_at is not null;
   select coalesce(sum(amount),0) into spent from public.subcontract_vouchers where company_id=new.company_id and subcontract_id=new.subcontract_id and type='retention_release' and status='paid' and id<>new.id;
   available:=earned-spent;
 else
   select coalesce(sum(net_payable),0) into earned from public.subcontract_certificates where company_id=new.company_id and subcontract_id=new.subcontract_id and finance_approved_at is not null;
   select coalesce(sum(amount),0) into spent from public.subcontract_payments where company_id=new.company_id and subcontract_id=new.subcontract_id and id<>new.id;
   select earned-spent-coalesce(sum(amount),0) into available from public.subcontract_vouchers where company_id=new.company_id and subcontract_id=new.subcontract_id and id<>new.id and ((type='payment' and status='paid') or (type='deduction' and status in ('approved','paid')));
 end if;
 if new.amount>greatest(available,0) then raise exception 'Amount exceeds available subcontract balance'; end if;
 if TG_TABLE_NAME='subcontract_vouchers' then
  if new.status='paid' then
   new.payment_date:=coalesce(new.payment_date,(new.paid_at at time zone 'Asia/Riyadh')::date);
   if new.payment_date<new.voucher_date then raise exception 'Payment date precedes voucher date'; end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_subcontract_payment_limit() from public,anon,authenticated;
create trigger subcontract_voucher_limit before insert or update on public.subcontract_vouchers for each row execute function public.guard_subcontract_payment_limit();
create trigger subcontract_payment_limit before insert on public.subcontract_payments for each row execute function public.guard_subcontract_payment_limit();

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
  if existing_id is not null then
    perform public.assert_subcontract_journal(existing_id,v.company_id,'subcontract_voucher',v.id,v.subcontract_id,v.amount,coalesce(v.payment_date,v.voucher_date));
    return existing_id; end if;
  select * into p from public.accounting_periods where company_id=v.company_id and coalesce(v.payment_date,v.voucher_date) between period_start and period_end and status='open' limit 1;
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
  values (journal_id,v.company_id,p.id,journal_number,coalesce(v.payment_date,v.voucher_date),v.description,'subcontract_voucher',v.id,'draft',null,(select auth.uid()));
  insert into public.accounting_entry_lines (id,company_id,journal_id,account_id,subcontract_id,description,debit,credit)
  values ('line-'||journal_id||'-d',v.company_id,journal_id,(select id from public.chart_of_accounts where company_id=v.company_id and code=debit_account),v.subcontract_id,v.description,v.amount,0),
         ('line-'||journal_id||'-c',v.company_id,journal_id,(select id from public.chart_of_accounts where company_id=v.company_id and code=credit_account),v.subcontract_id,v.description,0,v.amount);
  update public.accounting_journals set status='posted', posted_at=now(), posted_by=(select auth.uid()) where id=journal_id and company_id=v.company_id;
  insert into public.subcontract_ledger_entries (id,company_id,subcontract_id,journal_id,entry_date,entry_type,reference_number,description,debit,credit,created_by)
  values ('ledger-'||v.id,v.company_id,v.subcontract_id,journal_id,coalesce(v.payment_date,v.voucher_date),entry_type,v.number,v.description,0,v.amount,(select auth.uid()))
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
  if not found then raise exception 'Certificate not found or access denied'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('certificate-'||p_certificate_id,0));
  if c.finance_approved_at is null then raise exception 'Certificate must be finance approved before posting'; end if;
  select id into existing_id from public.accounting_journals where company_id=c.company_id and source_type='subcontract_certificate' and source_id=c.id;
  if existing_id is not null then
    perform public.assert_subcontract_journal(existing_id,c.company_id,'subcontract_certificate',c.id,c.subcontract_id,c.gross_work_value+c.vat_amount,c.due_date);
    return existing_id; end if;
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




-- Deferred check runs after the entire request: paid status requires a posted
-- matching journal, including for direct REST writes.
create or replace function public.check_subcontract_voucher_posted() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v record;
begin
 select * into v from public.subcontract_vouchers where id=new.id and company_id=new.company_id;
 if not found then return null; end if;
 if v.status='paid' or (v.type='deduction' and v.status='approved') then
   perform public.assert_subcontract_journal('jv-'||v.id,v.company_id,'subcontract_voucher',v.id,v.subcontract_id,v.amount,coalesce(v.payment_date,v.voucher_date));
 end if;
 return null;
end $$;
revoke all on function public.check_subcontract_voucher_posted() from public,anon,authenticated;
create constraint trigger voucher_posted_integrity after insert or update on public.subcontract_vouchers deferrable initially deferred for each row execute function public.check_subcontract_voucher_posted();
create or replace function public.pay_subcontract_certificate(p_certificate_id text,p_payment_method text,p_payment_date date,p_reference_number text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare result jsonb; v record; period_id text; jid text; company uuid;
begin
 result:=subcontract_private.certificate_action('pay',p_certificate_id,jsonb_build_object('paymentMethod',p_payment_method,'paymentDate',p_payment_date,'referenceNumber',p_reference_number));
 perform public.post_subcontract_certificate(p_certificate_id);
 select company_id into company from public.app_users where id=auth.uid();
 select * into v from public.subcontract_payments where company_id=company and certificate_id=p_certificate_id;
 jid:='jp-'||v.id;
 if exists(select 1 from public.accounting_journals where id=jid and company_id=company) then
 perform public.assert_subcontract_journal(jid,company,'manual','payment-'||v.id,v.subcontract_id,v.amount,p_payment_date);
 if (select coalesce(sum(l.credit),0) from public.accounting_entry_lines l join public.chart_of_accounts a on a.id=l.account_id and a.company_id=l.company_id where l.journal_id=jid and l.company_id=company and a.code=case when p_payment_method='cash' then '1100' else '1110' end)<>v.amount then raise exception 'Payment journal bank account mismatch'; end if;
 return result; end if;
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
