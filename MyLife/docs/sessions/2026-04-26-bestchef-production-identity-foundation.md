# BestChef Production Identity Foundation

Date: 2026-04-26

## Summary

Advanced BestChef Production Launch `BCPROD-P0-01` from not started to in progress and started `BCPROD-P0-02`. The app now has the foundation for durable identity, email linking and recovery entry points, local/cloud delete-account orchestration, account lifecycle SQL, schema mirror coverage, a support runbook, and a production guard for demo cloud alias writes.

Public beta and GA remain blocked until auth deep links/provider configuration, staging device verification, a service-role deletion worker, public seed-content approval, media storage, moderation operations, and legal/compliance launch items are complete.

## Work Completed

- Added Supabase account lifecycle tables, RLS policies, identity status, deletion request, owned-row count, and merge-conflict RPCs in `supabase/migrations/20260426000007_bestchef_account_lifecycle.sql`.
- Mirrored the lifecycle SQL in `modules/bestchef/src/cloud/schema.sql` and added schema coverage.
- Added typed cloud account lifecycle helpers in `modules/bestchef/src/cloud/account-lifecycle.ts`.
- Hardened BestChef account deletion in `apps/bestchef/app/(root)/data/account.ts` to request cloud deletion, remove the cloud social profile, sign out, wipe local tables, remove local media files, and clear known SecureStore refs.
- Added settings account UI for local-only, anonymous, and linked account states, with email linking, sign-in link, recovery email, and delete-account entry points.
- Extended the BestChef cloud provider with auth state, anonymous status, provider list, email link, and recovery helpers.
- Added `docs/runbooks/bestchef-account-lifecycle-runbook.md`.
- Added `apps/bestchef/app/(root)/data/public-data-policy.ts` to block demo cloud alias writes by default in production or public-launch builds unless explicitly allowlisted.
- Added public data policy and cloud-submission bridge tests, including function-gate tests for the new guard behavior.
- Added `docs/runbooks/bestchef-public-data-policy-runbook.md`.
- Updated `docs/plans/features/recipes/bestchef-production-launch-mission-control.md` for P0-01 progress and Phase 9 screenshot evidence cleanup.

## Verification

- `pnpm --filter @mylife/bestchef test -- src/cloud/__tests__/account-lifecycle.test.ts src/cloud/__tests__/schema.test.ts`
- `pnpm --filter @mylife/bestchef-app test -- "app/(root)/data/__tests__/account.test.ts"`
- `pnpm --filter @mylife/bestchef-app test -- "app/(root)/data/__tests__/public-data-policy.test.ts" "app/(root)/data/__tests__/cloud-submissions.test.ts"`
- `pnpm gate:function --file 'apps/bestchef/app/(root)/data/public-data-policy.ts'`
- `pnpm gate:function --file 'apps/bestchef/app/(root)/data/cloud-submissions.ts'`
- `pnpm --filter @mylife/bestchef typecheck`
- `pnpm --filter @mylife/bestchef-app typecheck`
- `pnpm --filter @mylife/bestchef-app test:uiux`
- `pnpm --filter @mylife/bestchef test`
- `pnpm --filter @mylife/bestchef-app test`
- `pnpm check:parity --quiet`
- `pnpm gate:function:changed`

`pnpm check:generated-artifacts` failed on unrelated tracked file `docs/investor-deck/MyLife-Two-Pager.pdf`, which is over the 2 MB policy limit. Logged in `errors_log.md`.

## Remaining Launch Blockers

- Configure production auth redirects, magic-link deep links, password recovery links, and provider policies.
- Verify anonymous-to-linked account behavior on staging devices.
- Build and test the service-role deletion worker for Auth user deletion, cloud row deletion, and storage cleanup.
- Complete the rest of P0-02 through P0-07: seed content approval and labeling, seed import/rollback workflow, media storage and moderation, legal URLs and disclaimers, reporting and safety ops, provider architecture, release branch, evidence packet, and launch signoff.
