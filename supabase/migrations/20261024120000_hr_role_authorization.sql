-- Restrict HR records by application role as well as tenant.
-- Managers/admins can manage HR; accountants retain the view_hr access
-- configured in types.ts. Other authenticated company roles cannot read HR.

drop policy if exists hr_realtime_role_select on public.jilco_realtime_data;
create policy hr_realtime_role_select
on public.jilco_realtime_data as restrictive for select to authenticated
using (
  collection not like 'jilco\_hr\_%' escape '\'
  or (
    company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
    and exists (
      select 1 from public.app_users au
      where au.id = (select auth.uid())
        and au.role in ('admin', 'manager', 'accountant')
    )
  )
);

drop policy if exists hr_realtime_role_insert on public.jilco_realtime_data;
create policy hr_realtime_role_insert
on public.jilco_realtime_data as restrictive for insert to authenticated
with check (
  collection not like 'jilco\_hr\_%' escape '\'
  or (
    company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
    and exists (
      select 1 from public.app_users au
      where au.id = (select auth.uid())
        and au.role in ('admin', 'manager')
    )
  )
);

drop policy if exists hr_realtime_role_update on public.jilco_realtime_data;
create policy hr_realtime_role_update
on public.jilco_realtime_data as restrictive for update to authenticated
using (
  collection not like 'jilco\_hr\_%' escape '\'
  or (
    company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
    and exists (
      select 1 from public.app_users au
      where au.id = (select auth.uid())
        and au.role in ('admin', 'manager')
    )
  )
)
with check (
  collection not like 'jilco\_hr\_%' escape '\'
  or (
    company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
    and exists (
      select 1 from public.app_users au
      where au.id = (select auth.uid())
        and au.role in ('admin', 'manager')
    )
  )
);

drop policy if exists hr_realtime_role_delete on public.jilco_realtime_data;
create policy hr_realtime_role_delete
on public.jilco_realtime_data as restrictive for delete to authenticated
using (
  collection not like 'jilco\_hr\_%' escape '\'
  or (
    company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
    and exists (
      select 1 from public.app_users au
      where au.id = (select auth.uid())
        and au.role in ('admin', 'manager')
    )
  )
);
