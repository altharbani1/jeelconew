-- Supabase Storage Buckets and Policies
insert into storage.buckets (id, name, public) values ('app-files', 'app-files', false) on conflict do nothing;

-- Storage policy: Only allow users to access files for their company
-- (Assumes JWT claims or app_users join for company_id)
-- Path: company/<company_id>/<entity_type>/<entity_id>/<filename>
-- Example policy (pseudo):
-- allow if user is in app_users and file path starts with their company_id
