# BestChef Server Launch: Deletion Worker + Media Scaffold

Date: 2026-04-26

## Summary

Advanced the server-first public launch path without relying on local-only device communication. This slice moves BCSERVER-P0-03 and BCSERVER-P0-04 from planning into local, tested server scaffolding.

Public beta and GA remain blocked. The new server pieces are not deployed, hosted Storage buckets are not created, and no staging deletion/media drill has been run.

## Completed

- Added `supabase/migrations/20260426000008_bestchef_account_deletion_worker.sql`.
  - Makes `bc_account_deletion_requests.user_id` nullable.
  - Replaces the Auth user FK with `on delete set null`.
  - Preserves deletion request rows after Supabase Auth user deletion so support can audit completed/failed requests.
- Mirrored the deletion request retention contract in `modules/bestchef/src/cloud/schema.sql`.
- Added `supabase/functions/bestchef-delete-account/index.ts`.
  - Requires `BESTCHEF_ACCOUNT_DELETION_WORKER_SECRET`.
  - Uses service-role Supabase REST calls from server env only.
  - Processes targeted or batch requested/failed deletion rows.
  - Deletes owned Storage objects before Auth deletion.
  - Marks owned `bc_media_assets` deleted/rejected/private.
  - Deletes the Supabase Auth user.
  - Marks requests completed or failed with diagnostic metadata.
- Added local private Storage bucket config in `supabase/config.toml` for:
  - `bestchef-submission-images`
  - `bestchef-submission-videos`
  - `bestchef-thumbnails`
  - `bestchef-product-evidence`
  - `bestchef-receipt-evidence`
  - `bestchef-quarantine`
- Added `supabase/functions/_shared/media.ts` for media validation, bucket selection, size/MIME policy, and Storage key construction.
- Added `supabase/functions/bestchef-media-upload/index.ts`.
  - Requires an authenticated Supabase JWT.
  - Validates owner kind, media kind, MIME type, byte size, and rejects local/remote URL payloads.
  - Creates a server-approved Storage key, signed upload URL, and pending private `bc_media_assets` row.
- Added `supabase/functions/bestchef-media-finalize/index.ts`.
  - Requires authenticated ownership.
  - Marks uploaded media `uploaded`, `pending`, and `private`.
  - Does not approve public delivery or write public URLs.
- Updated mission control and runbooks:
  - `docs/plans/features/recipes/bestchef-server-launch-mission-control.md`
  - `docs/plans/features/recipes/bestchef-production-launch-mission-control.md`
  - `docs/runbooks/bestchef-account-lifecycle-runbook.md`
  - `docs/runbooks/bestchef-supabase-environment-runbook.md`
  - `docs/runbooks/bestchef-server-source-of-truth-runbook.md`
  - `docs/runbooks/bestchef-media-storage-runbook.md`

## Tests Added

- `supabase/functions/bestchef-delete-account/__tests__/index.test.ts`
- `supabase/functions/bestchef-media-upload/__tests__/index.test.ts`
- `supabase/functions/bestchef-media-finalize/__tests__/index.test.ts`

These cover worker-secret gating, targeted/list deletion processing, storage failure fail-closed behavior, upload validation, no `file://`/remote URL payloads, bucket routing, size limits, profile ownership, and private pending finalize state.

## Verification

- `pnpm --filter @mylife/bestchef-app typecheck` - pass.
- `pnpm --filter @mylife/bestchef-app test` - pass, 106 tests.
- `pnpm --filter @mylife/bestchef-app test:uiux` - pass, 24 tests.
- `pnpm --filter @mylife/bestchef typecheck` - pass.
- `pnpm --filter @mylife/bestchef test` - pass, 56 files / 754 tests.
- `pnpm gate:function:changed` - pass. Existing mobile/web lint warnings remain warning-only.
- `pnpm check:parity --quiet` - pass with existing standalone tracking warnings.
- `pnpm check:generated-artifacts` - pass.

## Not Done

- Did not push `20260426000008` to staging.
- Did not deploy any Edge Functions.
- Did not configure hosted Supabase Storage buckets.
- Did not wire the app upload queue to the signed upload/finalize functions.
- Did not implement moderation approval, thumbnail generation, variants, or public HTTPS URL promotion.
- Did not run a seeded staging deletion drill or media upload drill.

## External Dependencies

- Supabase staging/production owner access to push migration `20260426000008`.
- Production Supabase project, URL, anon key, and service-role secret.
- Hosted Storage bucket creation and policies.
- Server-only function secrets:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `BESTCHEF_ACCOUNT_DELETION_WORKER_SECRET`
- Edge Function deployment for:
  - `bestchef-delete-account`
  - `bestchef-media-upload`
  - `bestchef-media-finalize`
  - existing provider broker functions.

## Next Local Slice

Wire the standalone app upload queue to `bestchef-media-upload` and `bestchef-media-finalize`, then add moderation/public-delivery promotion once hosted buckets and deployment targets are available.
