# Subcontract fixes: rollout and verification

The frontend now relies on `mutate_subcontract_record`. Apply the matching migration before releasing the frontend. An old frontend cannot safely perform subcontract writes after this migration: deploy both in a coordinated maintenance window.

## Database prerequisites

The deployment must already have the legacy `public.jilco_realtime_data` store with a unique `(collection, record_id)` constraint, `company_id`, and `public.app_users` with `company_id` and `role`, as used by the existing HR migrations. The initial schema checked into this repository alone does not recreate all production legacy tables; do not treat it as a complete new-install script.

1. Take a database/storage backup and verify the deployment target.
2. Review `supabase/migrations/20260905165441_secure_subcontracts.sql` in staging.
3. Run the read-only preflight below. If unowned records exist and more than one company exists, explicitly assign their verified owners before applying the migration. The migration intentionally stops rather than guessing. Resolve duplicate contract numbers before creating the new unique index.
4. Apply the migration through the project's normal Supabase migration process, then deploy the frontend. No production migration or frontend deployment was performed as part of the local repair.
5. Verify with two separate cloud accounts/companies. Mutation authorization uses **cloud `app_users.role`**, with `admin`/`manager` allowed; local UI permissions additionally control buttons. Editing local browser storage does not grant a database role.

```sql
select collection, count(*) as missing_owner
from public.jilco_realtime_data
where collection in ('subcontractors','subcontracts','jilco_projects','jilco_expenses_archive')
  and company_id is null group by collection;

select company_id, data->>'number' as contract_number, count(*)
from public.jilco_realtime_data where collection='subcontracts'
group by company_id, data->>'number' having count(*) > 1;

-- Historical paid payments with no matching expense need reconciliation;
-- this release does not silently manufacture or remove historical transactions.
select c.record_id, p->>'id' as payment_id
from public.jilco_realtime_data c
cross join lateral jsonb_array_elements(coalesce(c.data->'payments','[]')) p
where c.collection='subcontracts' and p->>'status'='paid'
and not exists (
  select 1 from public.jilco_realtime_data e
  where e.collection='jilco_expenses_archive'
    and e.record_id='SUB-'||(p->>'id') and e.company_id=c.company_id
);
```

## Behavior changes

- Payment approval and payment posting are separate steps. The database creates the expense in the same transaction as posting; failed expense creation rolls back posting. A retry of the same committed record does not create another voucher.
- Revision checks reject stale edits. Close and reopen the form to merge with the current record; never force an old full document over a newer version.
- Approved/paid payments cannot be deleted, paid payments/vouchers cannot be edited, and linked contractors/projects cannot be deleted. Accounting reversal workflows are outside this repair; do not bypass these protections with direct edits.
- Contracts can move from draft to active to completed (100% progress). A closed contract cannot be reopened; cancellation requires no payments. Inactive contractors remain selectable on their existing contracts.
- Nonpositive amounts, precision greater than two decimals, over-contract totals, bad dates and invalid progress are rejected. Existing incomplete/invalid contracts may need their data corrected before editing their payments.
- Projects and expenses stored alongside subcontracts now use company-scoped cloud requests and local cache keys. Legacy unscoped cache entries are not used as a substitute for cloud ownership. Financial saves update the displayed cache only after a successful server response.
- `subcontract-files` is a private 10 MB-per-file bucket for PDF, PNG, JPEG and WebP. Metadata stores permanent object paths; short-lived signed URLs are generated when opening an attachment. Old blob URLs cannot be recovered without the original file and must be re-uploaded.
- Removing an attachment unlinks it and retains its private object for recovery/audit. Orphans from an uncertain upload/save response are also retained rather than risking deletion of a committed attachment. Storage lifecycle cleanup should be performed separately after reconciliation.
- The export button includes contractors, contracts, related expenses and attachment paths in JSON. Binary attachments remain in private Storage; include that bucket in full disaster-recovery backups. Restoring JSON requires ownership/revision-aware import, not blind upserts of paid records.
- Contract commitments and statements exclude draft/cancelled contracts. The due figure includes only approved payments due today or earlier.

## Validation

```sh
npm ci
npm test
npm run typecheck
npm run build
```

Tests run actual PostgreSQL SQL using PGlite with an isolated fixture of the existing legacy tables, roles and storage schema. They cover transaction rollback, lost-response retries, stale revisions, permissions, cross-company access, immutable vouchers, linked deletion, amount/date/progress checks, attachment ownership and contract lifecycle. Component rendering tests cover the main views/forms, filters, permission disabling and preserving the form after failed persistence.

These tests do not replace a staging test against the installed production schema, real Supabase Storage upload/signing, Realtime and browser interaction. Build warnings about bundle size and mixed static/dynamic imports predate this repair.

References used for database/storage implementation: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
