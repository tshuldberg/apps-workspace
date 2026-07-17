# BestChef Production Readiness Research

Date: 2026-04-24
Workspace: `/Users/trey/Desktop/Apps/MyLife`
Scope: BestChef standalone app, canonical `@mylife/bestchef` module, sync policy, cloud/social assumptions, launch blockers, and the requested Mesh hub/source database model.

## Executive Summary

BestChef is close for a controlled client beta, but it is not ready for a public production launch with leaderboards, comments, social features, and a shared source database.

The local app is materially healthier after the recent security and build passes. Typecheck, tests, production export, parity, and production dependency audit now pass for BestChef-specific work. A follow-up server blocker pass added local active Supabase migrations for the shared social server and the BestChef `bc_*` core hub schema, including RLS, server RPCs, media manifests, public delta events, and leaderboard snapshots. The main remaining launch blocker is now deployment and operations: apply and verify those migrations against staging/production Supabase, then add media storage, Edge Functions, moderation jobs, rate limits, observability, legal URLs, and release runbooks.

This pass also addressed the user's media requirement: images and videos should not all be downloaded by default. BestChef now keeps media online-first and adds an explicit device-local media cache manifest for user-selected offline video downloads. The cache table is scoped `device_local` so it does not sync or replicate heavy media through Mesh.

## What Was Corrected In This Pass

- Added schema v10 device-local media cache manifest in `modules/bestchef/src/db/schema.ts`.
- Registered the v10 migration and `bestchef_media_cache` sync policy as `device_local` in `modules/bestchef/src/definition.ts`.
- Added `apps/bestchef/app/(root)/data/media-cache.ts` to stream remote media by default and download individual media only on explicit user action.
- Local cache filenames include a deterministic remote-URL hash so multiple media URLs for the same owner cannot overwrite each other.
- Added per-video offline controls in `apps/bestchef/app/(root)/feed.tsx`.
- Extended account wipe and reset flows to delete cached media files and manifest rows.
- Completed BestChef i18n key parity for all non-English catalogs. The new strings are English fallback entries pending translation.
- Added a root `postcss@8.5.10` override, refreshed the lockfile, and re-ran production dependency audit successfully.
- Added active Supabase migrations for the shared social server and BestChef core hub/source database contract.
- Added `modules/bestchef/src/cloud/schema.sql` mirrored to `supabase/migrations/20260424000005_add_bestchef_core_hub.sql`.
- Added social and BestChef schema tests to keep the active migrations from drifting.
- Hardened public delta output, hub manifest ownership, vote writes, note consensus, media moderation writes, and service-owned monetization tables.
- Updated BestChef vote/helpful-comment client flows to rely on server RPCs/triggers instead of direct client score/count writes.

## Current Architecture Observed

- The standalone app under `apps/bestchef` is an Expo Router app backed by local SQLite.
- The canonical product module is `modules/bestchef` with registry id `recipes`.
- BestChef local social data currently uses local tables for submissions, comments, votes, follows, and follower update seeds.
- `RECIPES_MODULE.syncPolicy` strips `photo_uri` and `videos_json` from `bestchef_submissions`, and v10 makes `bestchef_media_cache` device-local.
- The app starts a native-safe `@mylife/sync` facade. It can record outbound changes, but native direct sharing and full inbound CRDT session exchange are not yet production-ready.
- The cloud engines in `modules/bestchef/src/cloud/` assume many `bc_*` Supabase tables through a lazy `getBestChefClient()` wrapper.
- `supabase/migrations/20260424000004_add_social_server_schema.sql` now applies the shared social server tables and leaderboard RPCs.
- `supabase/migrations/20260424000005_add_bestchef_core_hub.sql` now applies the BestChef official core hub tables, RLS policies, triggers, and RPCs.

## P0 Launch Blockers

1. **Production BestChef database schema must be applied and validated.**
   Local active migrations now define the required `bc_*` tables, indexes, constraints, RLS policies, triggers, and core RPCs. This remains a launch blocker until those migrations are applied to staging and production Supabase projects and verified with real SQL/RLS integration tests.

2. **Social server schema must be deployed and tested.**
   The social server schema is now represented as an active Supabase migration with profiles, follows, friendships, activities, comments, challenges, groups, and leaderboard RPCs. BestChef cannot rely on it for public launch until it is deployed and tested against real authenticated users and RLS policies.

3. **Native sync is still a facade for production social use.**
   The native bundle records outbound change-log entries, but `shareEntity` is unavailable in the native facade and full inbound exchange is not ready. A production social server or official hub API is required for public comments, leaderboards, and source database updates.

4. **Media pipeline is not production-deployed.**
   Client-side lazy/offline caching and server-side media manifest tables are now in place, but the server still needs upload URLs, storage buckets, thumbnails, transcoding, CDN delivery, signed URLs, abuse scanning, quota enforcement, retention rules, and deletion propagation.

5. **Auth and profile identity need production wiring.**
   Public social features need stable authenticated users, profile handles, account deletion propagation, age-gate enforcement, blocked users, and privacy settings. Local/demo identity paths cannot back official leaderboards.

6. **Moderation and trust operations are not complete.**
   The app has moderation helper code, but launch needs server-side queues, review tooling, rate limits, report handling, audit trails, automated image/video safety checks, comment filters, appeal flows, and admin-only policies.

7. **Leaderboards need deployed server authority.**
   Vote scoring now has a server RPC and trigger-backed score refresh in the local schema. Official leaderboards still need deployed scheduled rebuild jobs, anti-abuse checks, immutable score snapshots, and signed export snapshots for external hubs.

8. **Legal, policy, and store launch artifacts remain blockers.**
   Privacy policy, terms, UGC policy, creator terms, moderation policy, data deletion policy, and age requirements need live URLs and store-review-ready text before public launch.

## Mesh Hub And Source Database Requirements

BestChef needs an official BestChef Core Hub plus a federation contract for community hubs.

### Official Core Hub

The official hub should own canonical public data:

- Dish taxonomy and aliases.
- Canonical recipe snapshots and version history.
- Submission metadata, score snapshots, vote aggregates, comment threads, reports, and moderation state.
- Leaderboard snapshots by dish, cuisine, geography, time window, and challenge.
- Media manifests with remote URLs, variants, byte size, content hashes, width, height, duration, moderation status, and owner.
- Public content export cursors and signed content-version manifests.

The official hub should be authoritative for official leaderboards. Clients and community hubs can submit events, but official rankings should come from server-side aggregation after validation and abuse checks.

### Community Or User-Hosted Hubs

People can host their own hubs, but those hubs should sync against the official core database through a versioned contract:

- `hub_manifest`: hub id, schema version, public signing keys, supported feature flags, media base URL, moderation policy, and last official content version.
- `content_delta`: cursor-based changes for dishes, aliases, recipe snapshots, media manifests, and public ranking snapshots.
- `social_delta`: optional signed public events such as comments, follows, votes, and submissions, subject to official validation if they should affect official leaderboards.
- `provenance`: every imported object carries source hub, original id, signature, import time, and moderation status.
- `conflict_policy`: official canonical data wins for dish taxonomy and official rankings; community hubs can maintain local rankings and local comment threads.

### Media Handling Contract

Media should not be distributed as Mesh row payloads.

- Sync metadata only: media id, content hash, remote URL, variants, moderation state, and cache policy.
- Stream from CDN or hub storage when online.
- Download a specific recipe, image, or video only when the user taps an offline action.
- Store downloaded files in app document storage and track them in `rc_bestchef_media_cache`.
- Keep `bestchef_media_cache` at `device_local` scope so cache state and local file paths never sync.
- Support recipe bundles for offline mode that include recipe JSON plus selected media files, not every media file in the source database.

## Security Review Status

Resolved or improved:

- BestChef-specific typechecks, tests, parity, production export, and production dependency audit pass.
- Sync secrets are stored through SecureStore in the app provider path.
- Sync policy strips `photo_uri` and `videos_json` from syncable submission rows.
- Media cache local file paths are scoped device-local.
- Prior BestChef security work closed concrete findings around plaintext share payloads, URL import validation, generated permission hygiene, and dependency advisories.

Improved in the server blocker follow-up:

- Active RLS-enabled migrations now exist for the shared social server and BestChef `bc_*` schema.
- `bc_core_delta` emits sanitized approved public content only.
- Private recipe snapshots, pending media, storage keys, precise coordinates, and unapproved submissions are excluded from public delta events.
- `bc_register_hub_manifest` prevents slug hijacking by a different profile owner.
- `bc_submit_vote` rejects self-votes and moves score updates to server triggers.
- Server-controlled comment, note, vote, media moderation, subscription, tip, affiliate, and ranking fields are guarded by RLS and triggers.

Still required before public production:

- Apply and validate the migrations in staging and production.
- Server-side validation and Edge Functions for submissions, reports, media uploads, and creator monetization.
- Rate limits and abuse throttles by account, IP, device, media hash, and content target.
- Signed upload and download URLs with short TTLs.
- Media scanning, thumbnailing, transcoding, and unsafe-content quarantine.
- Admin-only moderation APIs and audit logs.
- Production secrets management, environment separation, backup and restore drills.
- Observability for sync lag, failed imports, moderation queues, ranking jobs, media failures, and API abuse.

## Recommended Launch Plan

### P0 Server Foundation

- Apply `supabase/migrations/20260424000004_add_social_server_schema.sql` and `20260424000005_add_bestchef_core_hub.sql` to staging.
- Run SQL execution, RLS, and authenticated integration tests against staging.
- Add Edge Functions for submissions, reports, media uploads, payments, creator monetization, and leaderboard administration.
- Add seed scripts for dish taxonomy, badge definitions, initial challenge templates, and test moderation users.

### P1 Media Foundation

- Add `bc_media_assets` and `bc_media_variants`.
- Add signed upload URL API.
- Add background moderation and thumbnail/transcode jobs.
- Wire app uploads to remote media manifests.
- Keep local-only offline cache as implemented in this pass.

### P2 Official Hub API

- Add cursor-based read APIs for core database deltas.
- Add signed manifest exports for official content versions.
- Add import validation for community hub submissions.
- Add official leaderboard rebuild jobs and immutable leaderboard snapshots.

### P3 App Cloud Wiring

- Replace local/demo public social flows with authenticated cloud calls.
- Add account deletion propagation to cloud data and media.
- Add conflict UX for content imported from external hubs.
- Add online/offline labels for streamed versus cached media.

### P4 Launch Operations

- Add E2E tests against a seeded staging Supabase project.
- Add moderation runbooks and admin UI.
- Add legal URLs and policy screens.
- Add production monitoring, incident runbooks, backup drills, and release-owner signoff.

## Verification Run

- `node apps/bestchef/scripts/check-i18n-parity.mjs`: passed, all catalogs at 100 percent key parity.
- `pnpm --filter @mylife/bestchef-app typecheck`: passed.
- `pnpm --filter @mylife/bestchef typecheck`: passed.
- `pnpm --filter @mylife/bestchef-app test`: passed, 15 tests.
- `pnpm --filter @mylife/bestchef test`: passed, 44 files and 604 tests.
- `pnpm audit --prod --audit-level moderate`: passed, no known vulnerabilities.
- `pnpm --filter @mylife/bestchef-app build`: passed, Android and iOS Expo export.
- `pnpm check:module-parity`: passed with existing inventory warnings.
- `pnpm check:parity --quiet`: passed.
- `pnpm gate:function --file apps/bestchef/app/(root)/data/media-cache.ts`: passed.
- `pnpm gate:function --file apps/bestchef/app/(root)/feed.tsx`: passed.
- `pnpm --filter @mylife/social typecheck`: passed.
- `pnpm --filter @mylife/social test`: passed, 6 files and 11 tests.
- `pnpm gate:function --file modules/bestchef/src/cloud/voting-engine.ts`: passed.
- `pnpm gate:function --file modules/bestchef/src/cloud/comments.ts`: passed.
- `pnpm gate:function:changed`: passed after resolving the duplicate Notes hook-order lint error, Hub onboarding-mode test DB mock drift, and stale web no-img ESLint disables.
- Disposable Postgres migration execution: passed against `postgres:16` after starting Docker Desktop locally.
