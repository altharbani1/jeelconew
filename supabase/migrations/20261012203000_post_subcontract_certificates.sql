create or replace function public.post_subcontract_certificate(p_certificate_id text)
returns text
language plpgsql security invoker set search_path='' as $$
declare c record; p record; existing_id text; journal_id text; total_debit numeric := 0; total_credit numeric := 0;
begin
  select c.* into c from public.subcontract_certificates c
  where c.id=p_certificate_id and c.company_id=(select company_id from public.app_users where id=(select auth.uid()));
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
    values ('line-'||journal_id||'-deductions',c.company_id,journal_id,(select id from public.chart_of_accounts where company_id=c.company_id and code='6400'),c.subcontract_id,'خصومات وغرامات',0,c.deductions_amount); total_credit:=total_credit+c.deductions_amount;
  end if;
  if total_debit <= 0 or total_debit <> total_credit then raise exception 'Certificate accounting lines are not balanced'; end if;
  update public.accounting_journals set status='posted',posted_at=now(),posted_by=(select auth.uid()) where id=journal_id;
  insert into public.subcontract_ledger_entries (id,company_id,subcontract_id,journal_id,entry_date,entry_type,reference_number,description,debit,credit,created_by)
  values ('ledger-'||c.id,c.company_id,c.subcontract_id,journal_id,c.due_date,'certificate',c.certificate_number,c.description,c.net_payable,0,(select auth.uid())) on conflict do nothing;
  return journal_id;
end $$;
revoke all on function public.post_subcontract_certificate(text) from public, anon;
grant execute on function public.post_subcontract_certificate(text) to authenticated;
