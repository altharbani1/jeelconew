# Contract repairs — release status

Prepared 2026-10-29. Production deployment is pending database access.

## Changes

- Reserve contract numbers on the server and use independent immutable record IDs.
- Save and delete through tenant- and role-checked RPCs. Failed writes must not fall back to the legacy document store or appear as saved in the archive.
- Keep drafts and caches scoped to company and user. Ignore stale loads and asynchronous results after identity changes.
- Validate parties, dates, positive monetary totals, integer counts, and named payment percentages summing to 100%. Allocate payment amounts to reconcile at halala precision.
- Import quotation tax and customer identity correctly; accessory quantities do not determine elevator count.
- Print configured company information, logo, stamp and execution duration. Allow long annexes to continue without fixed-height clipping.
- Migrate owned historical contracts with frozen import evidence and accurate success/failure counts. Retain source records.

## Verification

`npm run test:contracts`, `npm run test:invoices`, `npm run test:financial-migrations`, `npm test`, `npm run typecheck`, and `npm run build` passed locally.

Contract migration tests use PGlite and exercise reservation ownership, stable identity, validation rollback, tenant isolation, roles, revoked direct writes, legacy import evidence, and number tombstones after deletion. They do not simulate real concurrent database sessions.

A local browser preview using the print stylesheet and synthetic data showed the logo, company identifiers, duration, payment amounts, final annex text and signatures. Actual PDF pagination and production cloud writes remain to be checked after deployment.

## Deployment gate

The site's actual Supabase project is `lloisgcoberpynrqzyji`. The connected Supabase account currently returns a permission error for that project. Do not apply changes to a different project merely because its display name is `jeelconew`.

Before deploying this frontend, inspect production schema and migration history, then apply and verify `20261028162111_secure_contract_numbers_and_persistence.sql` on the correct project. The frontend requires `reserve_contract_number`, `save_contract_record`, `delete_contract_record`, and `reserve_existing_contract_number`.

Previously prepared invoice and financial migrations also require a production-state review; do not blindly replay the entire historical migration directory. After applying the required migrations, check Supabase advisors and test with an authorized account before releasing to production.
