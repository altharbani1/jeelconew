-- Keep maintenance contracts, tickets, visits, and appointments tenant-scoped.
-- The legacy store remains useful for compatibility, but these collections
-- must never be visible across companies.

drop policy if exists maintenance_realtime_tenant_guard on public.jilco_realtime_data;
create policy maintenance_realtime_tenant_guard
on public.jilco_realtime_data as restrictive for all to authenticated
using (
  collection not in (
    'jilco_maintenance_contracts',
    'jilco_maintenance_tickets',
    'jilco_maintenance_visits',
    'jilco_maintenance_appointments',
    'jilco_maintenance_ticket_events'
  )
  or (
    company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
  )
)
with check (
  collection in (
    'jilco_maintenance_contracts',
    'jilco_maintenance_tickets',
    'jilco_maintenance_visits',
    'jilco_maintenance_appointments',
    'jilco_maintenance_ticket_events'
  )
  and company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
  or collection not in (
    'jilco_maintenance_contracts',
    'jilco_maintenance_tickets',
    'jilco_maintenance_visits',
    'jilco_maintenance_appointments',
    'jilco_maintenance_ticket_events'
  )
);

create index if not exists jilco_realtime_maintenance_tenant_idx
  on public.jilco_realtime_data (company_id, collection, updated_at desc)
  where collection in (
    'jilco_maintenance_contracts',
    'jilco_maintenance_tickets',
    'jilco_maintenance_visits',
    'jilco_maintenance_appointments',
    'jilco_maintenance_ticket_events'
  );
