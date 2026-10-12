-- Allow company members to read/upload subcontract documents while keeping
-- tenant isolation and manager-only deletion enforced by restrictive guards.
drop policy if exists subcontract_storage_select on storage.objects;
create policy subcontract_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'subcontract-documents'
  and (storage.foldername(name))[1] = (select company_id::text from public.app_users where id = (select auth.uid()))
);

drop policy if exists subcontract_storage_insert on storage.objects;
create policy subcontract_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'subcontract-documents'
  and (storage.foldername(name))[1] = (select company_id::text from public.app_users where id = (select auth.uid()))
);

-- The restrictive tenant guard remains authoritative for the company folder;
-- remove the old manager-only INSERT check so authorized company users can
-- upload documents through the subcontract module.
drop policy if exists subcontract_storage_tenant_guard on storage.objects;
create policy subcontract_storage_tenant_guard on storage.objects as restrictive
for all to authenticated
using (
  bucket_id <> 'subcontract-documents'
  or (storage.foldername(name))[1] = (select company_id::text from public.app_users where id = (select auth.uid()))
)
with check (
  bucket_id <> 'subcontract-documents'
  or (storage.foldername(name))[1] = (select company_id::text from public.app_users where id = (select auth.uid()))
);
