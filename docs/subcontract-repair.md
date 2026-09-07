# Relational subcontract repair

The subcontract UI reads the existing relational subcontractors, subcontracts, subcontract_certificates and subcontract_attachments tables. The old embedded JSON contract records remain as historical source records and cannot be changed by authenticated clients.

## Deployment

Apply `20260906131547_repair_relational_subcontracts.sql` against the existing production relational schema before deploying the frontend. This migration is not a replacement for the production schema migrations. It requires the seven subcontract tables, app_users, companies, jilco_realtime_data, and the private subcontract-documents bucket already present in production. Do not replay an already-applied migration.

The migration was applied successfully to project `pxdvxyludlulcgpeossx`. The production migration ledger assigns its own timestamp. Local and remote migration timestamps may therefore differ; match this migration by name before using CLI migration repair/push.

The migration preserves historical embedded paid certificates without inventing approval timestamps, and restores their missing expense record using the deterministic SUB-certificate ID. Existing JSON records are retained. After reconciliation production contains one historical certificate, one payment, and nine expense records. No new transfer is initiated by migration.

## Authorization and lifecycle

- Cloud app_users roles govern access; browser-local roles are not a financial authorization boundary.
- Authenticated users can read their own membership but cannot assign their role or company. First-run bootstrap is allowed only before any membership exists. Provision additional cloud memberships through trusted administration.
- Admin/manager create and maintain contractors/contracts and pending simple certificates.
- Admin/manager/technician provide engineering approval. Admin/manager/accountant provide finance approval and payment.
- Certificate approval and its approval log commit together. Payment, certificate status and expense voucher commit together. An identical retry returns the existing payment; changed payment parameters fail.
- Approved certificates and paid vouchers cannot be edited or deleted through the client. Payment reversal requires a separately designed accounting workflow; this release does not expose deletion as reversal.
- Composite company foreign keys prevent links across companies. Approved variations are immutable, and certificate totals cannot exceed contract value plus approved variations.
- The compact certificate form represents a single net/gross amount. Existing certificates with deductions/tax cannot have their detailed amounts overwritten by that form.
- Attachments use private storage and five-minute signed URLs. Referenced objects cannot be overwritten or removed from storage by clients.

## Verification

`npm test`, `npm run typecheck`, and `npm run build` validate the change. The PGlite tests execute the migration against a schema fixture captured from production, covering historical reconciliation, role denial, approval sequence, payment retry, protected vouchers and rollback when expense creation fails.

A production transaction also created a temporary certificate, approved it in both stages, paid it twice and asserted one payment, one voucher and two approval entries. The entire verification transaction was rolled back. Production checks confirmed that authenticated users cannot update app_users or certificates directly.

Supabase security advisors reported no database findings after the migration. The existing Auth warning about disabled leaked-password protection remains an account configuration setting.
