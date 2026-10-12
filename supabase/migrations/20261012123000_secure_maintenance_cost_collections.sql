-- Tenant isolation for maintenance history and cost records stored in the
-- shared realtime collection table.
drop policy if exists maintenance_realtime_tenant_guard on public.jilco_realtime_data;
create policy maintenance_realtime_tenant_guard
on public.jilco_realtime_data as restrictive for all to authenticated
using (
  collection not in (
    'jilco_maintenance_contracts', 'jilco_maintenance_tickets',
    'jilco_maintenance_ticket_events', 'jilco_maintenance_visits',
    'jilco_maintenance_appointments', 'jilco_maintenance_part_usages'
  )
  or company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
)
with check (
  collection not in (
    'jilco_maintenance_contracts', 'jilco_maintenance_tickets',
    'jilco_maintenance_ticket_events', 'jilco_maintenance_visits',
    'jilco_maintenance_appointments', 'jilco_maintenance_part_usages'
  )
  or company_id = (select au.company_id from public.app_users au where au.id = (select auth.uid()))
);

create index if not exists jilco_realtime_maintenance_cost_tenant_idx
  on public.jilco_realtime_data (company_id, collection, updated_at desc)
  where collection in ('jilco_maintenance_ticket_events', 'jilco_maintenance_part_usages');
