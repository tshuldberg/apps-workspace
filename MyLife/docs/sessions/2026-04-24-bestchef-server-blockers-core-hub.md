# BestChef Server Blockers And Core Hub

Date: 2026-04-24

## Summary

Resolved the immediate local server-schema blockers for BestChef public social launch work. Added active Supabase migrations for the shared social server and the BestChef official core hub/source database contract, then hardened the RLS and RPC surface around public deltas, votes, media, comments, hub manifests, note consensus, and service-owned monetization rows. Follow-up verification also resolved the local gate blockers that had been preventing a clean changed-function gate run.

This does not mean BestChef is production-launched. The migrations still need to be applied and verified against a real Supabase staging project with storage buckets, Edge Functions, scheduled jobs, media processing, rate limits, monitoring, and launch policies.

## Changes

- Added `supabase/migrations/20260424000004_add_social_server_schema.sql` with social profiles, friend links, friendships, follows, activities, kudos, comments, challenges, groups, leaderboard configs, RLS, count guards, and leaderboard RPCs.
- Added `modules/bestchef/src/cloud/schema.sql` and mirrored it exactly to `supabase/migrations/20260424000005_add_bestchef_core_hub.sql`.
- Added BestChef `bc_*` cloud tables for dishes, aliases, recipe snapshots, media assets, media variants, submissions, votes, rankings, comments, reports, flags, notes, badges, creator applications, tips, subscriptions, posts, forks, affiliate orders, brand mappings, hubs, content events, and leaderboard snapshots.
- Added official hub/source database RPCs: `bc_submit_vote`, `bc_rebuild_rankings`, `bc_submission_bundle`, `bc_core_delta`, `bc_register_hub_manifest`, and `bc_record_media_asset`.
- Hardened public content deltas so `bc_core_delta` emits sanitized approved public payloads only. Private recipe snapshots, pending media, storage keys, precise location coordinates, and unapproved submissions are not emitted through the public delta stream.
- Added server-side vote guards, self-vote rejection, trigger-backed score refresh, hub manifest slug ownership checks, HTTPS URL constraints, note-rating consensus refresh, and guards for server-controlled comment/note/vote fields.
- Made media moderation updates, subscriptions, tips, affiliate orders, ranking rebuilds, and leaderboard snapshot writes admin/service-owned instead of client-writable.
- Updated app-facing BestChef vote and helpful-comment flows to rely on server RPCs/triggers rather than client-side score/count writes.
- Added static schema tests covering RLS coverage, migration mirroring, active social migration coverage, and the new hardening contracts.
- Fixed the duplicate Notes discovery route hook-order lint blocker by moving the `dailyNote` `useMemo` above the empty-state return.
- Started Docker Desktop locally and ran both new SQL migrations against a disposable `postgres:16` database with Supabase auth stubs.
- Updated the Hub onboarding-mode test database mock to include the `query` and `execute` adapter methods used by sync security preferences.
- Removed stale web lint disables for unavailable `@next/next/no-img-element` rules on the shop purchase detail page.

## Verification

- `pnpm --filter @mylife/bestchef typecheck`: passed.
- `pnpm --filter @mylife/bestchef test`: passed, 44 files and 604 tests.
- `pnpm --filter @mylife/social typecheck`: passed.
- `pnpm --filter @mylife/social test`: passed, 6 files and 11 tests.
- `pnpm gate:function --file modules/bestchef/src/cloud/voting-engine.ts`: passed.
- `pnpm gate:function --file modules/bestchef/src/cloud/comments.ts`: passed.
- Disposable Postgres migration execution: passed against `postgres:16` for `20260424000004_add_social_server_schema.sql` and `20260424000005_add_bestchef_core_hub.sql`.
- `pnpm --dir apps/mobile run lint --quiet`: passed.
- `pnpm --dir apps/web run lint --quiet`: passed.
- `pnpm --dir apps/mobile exec vitest run --pool-options.threads.maxThreads=2 'app/(hub)/__tests__/onboarding-mode.test.tsx'`: passed, 3 tests.
- `pnpm gate:function:changed`: passed.

## Remaining Launch Blockers

- Apply the new migrations to staging and production Supabase projects and run real SQL/RLS integration tests against Supabase.
- Add Supabase storage buckets, signed upload/download Edge Functions, media moderation, thumbnail/transcode jobs, CDN configuration, quota enforcement, deletion propagation, and abuse scanning.
- Add service-owned payment/creator monetization Edge Functions for tips, subscriptions, affiliate orders, and provider webhooks.
- Add scheduled leaderboard rebuild jobs, admin moderation workflows, rate limits, observability, backup/restore drills, and launch legal/policy URLs.
