create table public.subcontract_record_archives (
 company_id uuid not null references public.companies(id),
 record_type text not null check(record_type in ('contract','certificate')),
 record_id text not null,
 archived boolean not null default true,
 changed_by uuid not null,
 changed_at timestamptz not null default now(),
 primary key(company_id,record_type,record_id)
);
alter table public.subcontract_record_archives enable row level security;
revoke all on public.subcontract_record_archives from public,anon;
grant select,insert,update on public.subcontract_record_archives to authenticated;
create policy archive_read on public.subcontract_record_archives for select to authenticated using(company_id=(select company_id from public.app_users where id=auth.uid()));
create policy archive_write on public.subcontract_record_archives for insert to authenticated with check(company_id=(select company_id from public.app_users where id=auth.uid()) and exists(select 1 from public.app_users where id=auth.uid() and role in ('admin','manager')) and changed_by=auth.uid());
create policy archive_update on public.subcontract_record_archives for update to authenticated using(company_id=(select company_id from public.app_users where id=auth.uid()) and exists(select 1 from public.app_users where id=auth.uid() and role in ('admin','manager'))) with check(company_id=(select company_id from public.app_users where id=auth.uid()) and changed_by=auth.uid());
create or replace function public.set_subcontract_archive(p_type text,p_id text,p_archived boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare tenant uuid;
begin
 select company_id into tenant from public.app_users where id=auth.uid() and role in ('admin','manager');
 if tenant is null then raise exception 'Management permission required'; end if;
 if p_type='contract' then
  if not exists(select 1 from public.subcontracts where id=p_id and company_id=tenant) then raise exception 'Contract not found'; end if;
 elsif p_type='certificate' then
  if not exists(select 1 from public.subcontract_certificates where id=p_id and company_id=tenant) then raise exception 'Certificate not found'; end if;
 else raise exception 'Invalid record type'; end if;
 insert into public.subcontract_record_archives(company_id,record_type,record_id,archived,changed_by)
 values(tenant,p_type,p_id,p_archived,auth.uid())
 on conflict(company_id,record_type,record_id) do update set archived=excluded.archived,changed_by=excluded.changed_by,changed_at=now();
end $$;
revoke all on function public.set_subcontract_archive(text,text,boolean) from public,anon;
grant execute on function public.set_subcontract_archive(text,text,boolean) to authenticated;
