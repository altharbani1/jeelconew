create or replace function public.post_subcontract_voucher(p_voucher_id text)
returns text
language plpgsql security invoker set search_path='' as $$
declare
  v record; p record; existing_id text; journal_id text; journal_number text;
  debit_account text; credit_account text; entry_type text;
begin
  select v.* into v from public.subcontract_vouchers v
  where v.id=p_voucher_id
    and v.company_id=(select company_id from public.app_users where id=(select auth.uid()));
  if not found then raise exception 'Voucher not found or access denied'; end if;
  if v.status not in ('approved','paid') then raise exception 'Voucher must be approved before posting'; end if;
  select id into existing_id from public.accounting_journals where company_id=v.company_id and source_type='subcontract_voucher' and source_id=v.id;
  if existing_id is not null then return existing_id; end if;
  select * into p from public.accounting_periods where company_id=v.company_id and v.voucher_date between period_start and period_end and status='open' limit 1;
  if not found then raise exception 'No open accounting period for voucher date'; end if;

  if v.type='advance' then
    debit_account := '1300'; entry_type := 'advance';
  elsif v.type='deduction' then
    debit_account := '2100'; entry_type := 'deduction';
  else
    debit_account := '2100'; entry_type := case when v.type='retention_release' then 'retention' else 'voucher' end;
  end if;
  if v.status='paid' then
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
  values ('ledger-'||v.id,v.company_id,v.subcontract_id,journal_id,v.voucher_date,entry_type,v.number,v.description,v.amount,0,(select auth.uid()))
  on conflict (company_id,subcontract_id,entry_type,reference_number) do nothing;
  return journal_id;
end $$;
revoke all on function public.post_subcontract_voucher(text) from public, anon;
grant execute on function public.post_subcontract_voucher(text) to authenticated;
