# BestChef Server Launch Auth And Environment Slice

Date: 2026-04-26

## Summary

Advanced BestChef server-first public launch readiness across BCSERVER-P0-00, BCSERVER-P0-02, and BCSERVER-P0-01.

Public beta and GA remain blocked. Internal beta remains allowed with caveats.

## What Changed

- Added `apps/bestchef/app/(root)/data/launch-environment.ts` for launch guardrails:
  - Public or production builds disable BestChef mesh sync startup.
  - Public builds reject staging Supabase config unless the build is explicitly internal-only and not marked public launch.
  - Auth redirect URLs can be configured and validated.
- Added `apps/bestchef/app/(root)/data/auth-links.ts` for native Supabase callback handling:
  - PKCE `code`
  - implicit `access_token` and `refresh_token`
  - `token_hash` with supported email OTP types
  - recovery callback state
  - provider callback errors
- Wired `BestChefCloudProvider` to handle initial and runtime native auth URLs, refresh the user/profile after session completion, and expose auth callback state.
- Updated Settings to display account link or recovery callback state.
- Gated `DatabaseProvider` so BestChef mesh sync startup is disabled in public-launch builds. Local SQLite remains available as draft/cache/optimistic UI storage.
- Applied `20260426000007_bestchef_account_lifecycle.sql` to linked BestChef staging. `supabase migration list` now shows local and remote matching through `20260426000007`.
- Updated Supabase local auth redirects with `bestchef:///auth-callback`.

## Docs Updated

- `docs/runbooks/bestchef-server-source-of-truth-runbook.md`
- `docs/runbooks/bestchef-supabase-environment-runbook.md`
- `docs/runbooks/bestchef-account-lifecycle-runbook.md`
- `docs/plans/features/recipes/bestchef-server-launch-mission-control.md`
- `docs/plans/features/recipes/bestchef-production-launch-mission-control.md`
- `errors_log.md`
- `memory.md`

## Supabase And EAS Inventory

- Staging project visible and linked: `BestChef Staging`, ref `tcikvihyjetsfkjjpljv`, West US Oregon.
- Production BestChef Supabase project was not visible in `supabase projects list`.
- No deployed Edge Functions were listed.
- No local `supabase/functions` directory exists.
- EAS development, preview, and production envs currently point to the staging Supabase URL and anon key.
- Service-role secrets were not present in Expo public env output.

## Verification

- `pnpm --filter @mylife/bestchef-app typecheck`: passed.
- `pnpm --filter @mylife/bestchef-app test`: passed, 14 files and 96 tests.
- `pnpm --filter @mylife/bestchef-app test:uiux`: passed, 24 tests.
- `pnpm --filter @mylife/bestchef typecheck`: passed.
- `pnpm --filter @mylife/bestchef test`: passed, 49 files and 703 tests.
- `pnpm gate:function:changed`: passed across the current dirty worktree, with existing lint warnings only.
- `pnpm check:parity --quiet`: passed, with existing standalone tracking warnings.
- `pnpm check:generated-artifacts`: failed on known unrelated blocker `docs/investor-deck/MyLife-Two-Pager.pdf` at 3.41 MB over the 2 MB policy limit.

## Error Log

Logged and resolved a BestChef app test failure caused by a noisy complexity slope check in the new auth-link function-gate test. The benchmark sample size was increased and the full app test passed afterward.

## Remaining P0 Blockers

- Create and configure a separate BestChef production Supabase project.
- Replace production EAS staging URL/anon key with production URL/anon key and `EXPO_PUBLIC_BESTCHEF_CLOUD_ENV=production`.
- Configure Supabase Auth dashboard providers, email templates, site URL, redirect URLs, Apple Sign-In, and optional Google if approved.
- Run native deep-link smoke tests on device/simulator for email link, recovery, reinstall restore, and provider callbacks.
- Implement service-role account deletion worker and storage cleanup.
- Build Storage buckets, signed upload/finalize functions, and media moderation workflow.
- Build server-side provider broker and hide BYO provider key UI from public launch builds.
- Complete public seed content approval, labeling, import, and rollback workflow.
- Resolve the unrelated generated-artifact investor PDF blocker before merge readiness.
