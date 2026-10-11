-- Harden the role catalog, tenant role assignments, and public function surface.
-- Application access remains available to authenticated users and service_role.
begin;

alter table public.roles enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists "Authenticated users can read role catalog" on public.roles;
create policy "Authenticated users can read role catalog"
  on public.roles for select to authenticated
  using (true);

drop policy if exists "Users can read company role assignments" on public.user_roles;
create policy "Users can read company role assignments"
  on public.user_roles for select to authenticated
  using (
    user_id = (select auth.uid())
    or company_id = (
      select au.company_id from public.app_users au
      where au.id = (select auth.uid())
    )
  );

drop policy if exists "Company admins can add role assignments" on public.user_roles;
create policy "Company admins can add role assignments"
  on public.user_roles for insert to authenticated
  with check (
    company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
    and exists (
      select 1 from public.app_users au
      where au.id = (select auth.uid()) and au.role = 'admin'
    )
  );

drop policy if exists "Company admins can update role assignments" on public.user_roles;
create policy "Company admins can update role assignments"
  on public.user_roles for update to authenticated
  using (
    company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
    and exists (
      select 1 from public.app_users au
      where au.id = (select auth.uid()) and au.role = 'admin'
    )
  )
  with check (
    company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
    and exists (
      select 1 from public.app_users au
      where au.id = (select auth.uid()) and au.role = 'admin'
    )
  );

drop policy if exists "Company admins can delete role assignments" on public.user_roles;
create policy "Company admins can delete role assignments"
  on public.user_roles for delete to authenticated
  using (
    company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
    and exists (
      select 1 from public.app_users au
      where au.id = (select auth.uid()) and au.role = 'admin'
    )
  );

-- The browser only needs authenticated access.  Anonymous clients must not
-- enumerate role metadata or assignments through PostgREST/GraphQL.
revoke all on table public.roles, public.user_roles from anon;
grant select on table public.roles, public.user_roles to authenticated;
grant all on table public.roles, public.user_roles to service_role;

-- This event-trigger helper is not an API endpoint.  Keep it callable by the
-- database event trigger, but remove inherited PUBLIC/anonymous execution.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- New public objects should be opt-in, rather than automatically exposed.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger on tables from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;

commit;
