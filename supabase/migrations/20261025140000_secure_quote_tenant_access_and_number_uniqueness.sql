-- Make quotation data private to the authenticated user's company.
-- Legacy rows with a NULL company_id are intentionally left untouched and
-- become inaccessible until their ownership can be established safely.
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_specs enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('quotes', 'quote_items', 'quote_specs')
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

create policy quotes_tenant_access on public.quotes
  for all to authenticated
  using (company_id = (select company_id from public.app_users where id = (select auth.uid())))
  with check (company_id = (select company_id from public.app_users where id = (select auth.uid())));

create policy quote_items_tenant_access on public.quote_items
  for all to authenticated
  using (quote_id in (
    select id from public.quotes
    where company_id = (select company_id from public.app_users where id = (select auth.uid()))
  ))
  with check (quote_id in (
    select id from public.quotes
    where company_id = (select company_id from public.app_users where id = (select auth.uid()))
  ));

create policy quote_specs_tenant_access on public.quote_specs
  for all to authenticated
  using (quote_id in (
    select id from public.quotes
    where company_id = (select company_id from public.app_users where id = (select auth.uid()))
  ))
  with check (quote_id in (
    select id from public.quotes
    where company_id = (select company_id from public.app_users where id = (select auth.uid()))
  ));

revoke all on public.quotes, public.quote_items, public.quote_specs from public, anon;
grant select, insert, update, delete on public.quotes, public.quote_items, public.quote_specs to authenticated;
grant all on public.quotes, public.quote_items, public.quote_specs to service_role;

-- Enforce unique, non-empty commercial quote numbers within each company.
-- Existing duplicate numbers, if any, must be reviewed before this migration
-- can be applied; no historical records are renamed automatically.
create unique index if not exists quotes_company_number_key
  on public.quotes (company_id, btrim(number))
  where company_id is not null and number is not null and btrim(number) <> '';
