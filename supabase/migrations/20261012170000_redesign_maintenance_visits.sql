-- ERP/CMMS visit model: keep the existing JSON store for backward compatibility,
-- but normalize legacy visit rows and add indexes used by the dispatch board.
update public.jilco_realtime_data
set data = data
  || jsonb_build_object(
    'visitType', coalesce(data->>'visitType', case when nullif(data->>'ticketId', '') is null then 'preventive' else 'corrective' end),
    'workOrderStatus', coalesce(data->>'workOrderStatus', case when data->>'status' = 'completed' then 'completed' else 'not_started' end),
    'plannedDurationMinutes', coalesce(nullif(data->>'plannedDurationMinutes', '')::int, 60),
    'priority', coalesce(data->>'priority', case when nullif(data->>'ticketId', '') is null then 'medium' else 'high' end)
  )
where collection = 'jilco_maintenance_visits'
  and (data->>'visitType' is null or data->>'workOrderStatus' is null or data->>'plannedDurationMinutes' is null or data->>'priority' is null);

create index if not exists jilco_realtime_visits_dispatch_idx
  on public.jilco_realtime_data (company_id, (data->>'scheduledDate'), (data->>'technicianId'))
  where collection = 'jilco_maintenance_visits';

create index if not exists jilco_realtime_visits_status_idx
  on public.jilco_realtime_data (company_id, (data->>'status'), (data->>'workOrderStatus'))
  where collection = 'jilco_maintenance_visits';
