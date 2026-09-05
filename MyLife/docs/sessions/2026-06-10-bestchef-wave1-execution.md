# 2026-06-10 BestChef Wave 1 Execution (priority/severity order)

## Goal
Execute the work items from the 2026-06-09 production eval in priority/severity order: gate-blocking type breaks first, then parity blindness, then the three launch-blocker tickets, then production verification and test cleanup.

## Task 1: Hub recipes type breaks (gate blockers)
- `apps/mobile/app/(recipes)/comments.tsx`: addComment stub now returns the full CommentSchema shape (`parentId`, `editedAt`, `deletedAt` added).
- `apps/mobile/app/(recipes)/creator-apply.tsx`: status logic rewritten for the real 6-value union (`submitted/under_review/approved/declined/more_info_needed/withdrawn`); pending copy keys off submitted/under_review; reviewer note shows for declined/more_info_needed.
- `apps/web/app/recipes/cloud-actions.ts`: castVoteAction maps legacy numeric widget tiers 0-3 onto canonical VoteTier (`like/bronze/silver/gold`, exactly the VoteTier const labels) and rejects out-of-range tiers.
- `apps/web/app/recipes/chef-actions.ts`: getSignatureDishes called as `(getBestChefClient(), { chefId })`.
- Verified: mobile and web typechecks fully green for the first time since the are-blaze rebuild.

## Task 2: Parity blindness
- `scripts/check-module-parity.mjs`: new `standalone_app` status; recipes entry now points at `apps/bestchef` (in-repo canonical standalone). Asserts app presence, @mylife/bestchef dependency, route files (122), archive placeholder, and emits a standing drift WARN. Full `pnpm check:parity` green (exit 0).

## Tasks 3+4: F-045 / F-046 / F-047 (cloud endpoints)
- New module helper `modules/bestchef/src/cloud/video-feed.ts` (+ barrel exports): `listFeedVideos` / `getFeedVideoById` compose approved public submission videos from `bc_media_assets` (video, approved, public, HTTPS remote_url) with `bc_submissions` (approved only), `bc_recipe_snapshots`, `bc_dishes`, `social_profiles`. No new table; videos go live as media uploads are approved.
- New app adapters: `app/(root)/data/cloud-dishes.ts` (bc_dishes catalog via searchDishes/getDishById, mapCloudDish with derived-visuals fallback, 5-min shared cache, demo fallback gated by shouldShowDemoContent, fail-closed in public builds) and `app/(root)/data/cloud-videos.ts` (FeedVideo to DemoVideo mapping, same policy).
- Rewired routes: `(tabs)/dishes.tsx` (catalog + loading state; tag Filters hidden on cloud source since cloud dishes carry no TagId tags; newest sort uses createdAtMs), `submit/steps/DishSelectionStep.tsx`, `discover.tsx` (trending, dish results, cuisine counts, recipe-row visuals from catalog; chefs via cloud searchChefs with gated demo fallback), `dish/[id].tsx` (loadDishRecord cloud-first), `feed.tsx` (cloud video catalog + loading state), `video/[id].tsx` (async load, loading/not-found states reusing the translated 'No videos yet' key to avoid 21-catalog churn).
- `recipe/[id].tsx` left as-is: its DEMO lookups are policy-gated and can only match demo submissions.
- Tickets F-045/F-046/F-047 Status sections updated to Done with implementation notes.
- Tests: `app/(root)/data/__tests__/cloud-dishes.test.ts` (12) + `modules/bestchef/src/__tests__/video-feed.test.ts` (6), covering cloud paths, demo fallback, and public-launch fail-closed.

## Task 5: Production verification
- VERIFIED via supabase CLI: all 7 BestChef edge functions ACTIVE on production `zjxabnazbdocrqpyixgo` (version 3, deployed 2026-04-29): media-upload, media-finalize, vision, nutrition, product-identity, moderate_vote_proof, delete-account. This retires the eval's riskiest unknown.
- NOT verifiable from CLI here: `secrets list` hangs (needs dashboard); `storage ls --linked` prompts for the DB password on the stale link. Both go to Wave 2 ops.

## Task 6: Test cleanup review (corrections to the eval)
- `tips.test.ts` is NOT a duplicate: `calculatePlatformFee` exists only in tips.ts; the test covers real exports. KEEP.
- `testflight-smoke.live.test.ts` is already fenced with `describe.skipIf(!shouldRun)` (the suite's 1 skip). No change needed.

## Verification
- BestChef app: 33 files / 278 tests green. Module: 81 files / 1118 tests green (1 fenced skip). App + module + mobile + web typechecks green. `pnpm check:parity --quiet` exit 0. Generated-artifacts guard green. DEMO route-guard test green.
- `pnpm gate:function:changed`: lint + typecheck legs pass everywhere; the run aborts only at the pre-existing host-mobile vitest hang (worker dies after ~8 green files, no failing assertion; errors_log 2026-04-19 Partial row updated with the recurrence).
- Pre-existing discovery: `check-i18n-parity.mjs` fails with ~102 missing keys per non-EN catalog (drift predates 2026-05-11, script unwired from gates). Logged in errors_log as Unresolved.

## Continuation (same session): CHF-1 + scheduled jobs + i18n

### CHF-1: broker quota ledger + kill switch (apps-audit HIGH)
- The ledger shipped on `feature/bestchef-launch-hardening` (a973b06ec, 2026-05-29) with the wiring explicitly left as follow-up. Brought over via `git cherry-pick -n` (no commit; schema.sql conflict resolved to the commit-owned 18 lines only, dropping unrelated branch content).
- `_shared/broker.ts` additions: `BrokerDeps.quota` (required ProviderQuotaCheck), `isAnonymousAuth()` (reads Supabase `is_anonymous` JWT claim via shared claim decoder), `createServiceQuotaCheck()` (PostgREST RPC call with service-role key, fail-closed on missing config/HTTP error/exception, house REST pattern, no supabase-js).
- Wired all 3 brokers (vision, nutrition, product-identity): order is auth, env kill switch (503 fail-closed), anon-aware in-memory limiter, durable `bc_consume_provider_quota` (user_rate_limit/global_daily_cap deny as 429; kill_switch/quota_error/unknown fail closed as 503). Anonymous caps: vision 10/min (vs 30), nutrition and product 20/min (vs 60).
- Tests: 12 new cases (kill switch, 429 denial, fail-closed quota error, anonymous cap arg assertion per function). 39/39 function tests green (run from supabase/functions via npx vitest). Isolated strict tsc on the 4 changed files clean.
- USER-SIDE remaining: apply migration `20260529000005` to staging + production, redeploy the 3 functions, optionally set `BESTCHEF_PROVIDER_KILL_SWITCH` and tune `bc_provider_controls.global_daily_cap` (default 50000/day).

### Scheduled jobs migration (Wave 2 codeable ops)
- New `supabase/migrations/20260610000001_bestchef_scheduled_jobs.sql`: pg_cron schedules `bc_rebuild_rankings()` hourly (:17) and new `bc_run_account_deletion_worker()` every 15 min, which posts to the `bestchef-delete-account` Edge Function via pg_net using `X-BestChef-Worker-Secret`. Environment config (functions base URL + worker secret) lives in new service-role-only `bc_job_config` table; everything is exception-guarded and no-ops quietly when unconfigured or when pg_cron/pg_net are absent. Schema mirror updated. Statically verified (same convention as the DoWork migrations); exercises at `supabase db push`.
- USER-SIDE remaining: push migration, insert the 2 `bc_job_config` rows per environment.

### i18n catalog repair (delegated to module-dev agent)
- Agent diagnosed the "2 extra keys": en.ts stored two keys as `×`/`—` escape sequences while all catalogs held literal characters; normalized en.ts to literal chars (identical strings). Then translated the ~102 missing keys per catalog (21 catalogs incl. sv, which the original drift report undercounted), mining each catalog's existing vocabulary anchors for consistent terminology. Verification: check-i18n-parity green + i18n tests + app typecheck (see final status below).

### Module/parity re-verification after schema changes
- Module tests 1135/1136 green (schema-driven cases picked up bc_provider_usage/controls/job_config), `pnpm check:parity --quiet` exit 0.

## Remaining (next session, severity order)
1. Wave 2 ops (user-side): dashboard-verify prod secrets + buckets; push migrations 20260529000005 + 20260610000001; insert bc_job_config rows; redeploy the 3 brokers; wire app upload queue (codeable).
2. BCSERVER-P0-08 legal/store compliance.
3. Wire check-i18n-parity into a gate so catalog drift cannot silently recur.
4. Mobile vitest hang triage (sole remaining repo-gate blocker).
