# Timeline

## 2026-03-18

- **MyForums and MyMarket modules scaffolded.** Two new cloud-backed modules designed interactively and built from scratch across multiple sessions.
  - **MyForums** (`modules/forums/`, prefix `fr_`): Reddit/Discourse-inspired community forums. Hybrid storage (Supabase cloud + SQLite cache). 23 Zod schemas covering communities, members, threads, replies, votes, bookmarks, user stats, moderation, reports, blocks, rules, and tags. 6 SQLite cache tables with 12 indexes. 14 Supabase cloud tables with full RLS, FTS (`tsvector` on communities and threads), and auto-sync triggers (thread/reply counts, karma). 17 local CRUD functions via `DatabaseAdapter`. 22 Supabase query functions with typed row interfaces, snake_case-to-camelCase mappers, and social activity emission on create operations (`emitForumCommunityCreated`, `emitForumThreadCreated`, `emitForumReplyPosted`). Icon: `\u{1F4AC}`, accent: `#F43F5E`, tier: free, requiresNetwork: true. Full module CLAUDE.md written.
  - **MyMarket** (`modules/market/`, prefix `mk_`): Peer-to-peer marketplace/classifieds. Hybrid storage. Zod schemas for listings, offers, reviews, messages, shipping, categories. SQLite cache tables. Supabase cloud tables with RLS. Local CRUD and cloud client functions. Icon: marketplace, accent: `#E11D48`.
  - **@mylife/social extensions:** Added `forums` and `market` to `SOCIAL_CAPABLE_MODULES`. 8 new `ActivityType` values (4 forums, 4 market). 2 new `ShareCardType` values. 6 new emitter helpers (`emitForumThreadCreated`, `emitForumReplyPosted`, `emitForumCommunityCreated`, `emitForumKarmaMilestone`, `emitMarketListingCreated`, `emitMarketListingSold`). 2 new share card generators (`generateForumThreadCard`, `generateMarketListingCard`). New `presentation.ts` module with `getSocialModulePresentation`, `describeSocialActivity`, `calculateChallengeProgressPercent`, `suggestSocialHandle`. FriendLink system types added to social types.
  - **Mobile app wiring:** Both modules registered via `safeRegister` in `_layout.tsx`. Tab layouts created: forums (feed, communities, search, saved, profile), market (browse, sell, messages, saved, profile). `ModuleBetaScreen` placeholders for all tab screens.

- **iOS simulator crash debugging and fixes.**
  - **"App entry not found" crash:** Caused by stale Metro cache after adding new module dependencies. Fixed by running `expo start --clear`.
  - **`(auth)` route warning:** Created missing `apps/mobile/app/(auth)/_layout.tsx` with Stack navigator.
  - **`@mylife/sync` Node.js import crash:** The sync package's barrel export pulled in `blob-store.ts` (imports `fs`, `crypto`, `path`) and `@automerge/automerge` (imports `util`), both unavailable in React Native. Created `packages/sync/src/index.native.ts` as a React Native-safe entry point that excludes: `BlobStore` (filesystem blob storage), `blob-sync` (crypto hashing), `DocumentManager` (automerge CRDT), `SyncManager`/`db-integration` (depends on SyncEngine which depends on automerge), all torrent modules (crypto hashing). Added `"react-native": "./src/index.native.ts"` to sync `package.json`. Metro prefers `.native.ts` files, so mobile gets the safe subset while Node/web consumers keep full functionality.
  - **Pre-existing migration failures** (not from our changes): `habits` module (`period_id` column missing), `garden` module (`status` column missing). Both auto-disabled by `DatabaseProvider`.

- **OpenClaw-inspired memory system created.** Researched OpenClaw's tiered memory architecture (T0 foundational / T1 working / T2 daily / T3 deep knowledge) and adapted it for Claude Code's auto-memory directory. Created `MEMORY.md` (T0, always-loaded, curated index) with links to topic files: `modules.md` (module inventory and status), `architecture.md` (key patterns and decisions), `debugging.md` (known issues and solutions).

## 2026-03-09

- **Module expansion batch merged to main (PR #8).** Added 12 new hub modules (closet, cycle, flash, garden, journal, mail, mood, notes, pets, stars, trails, voice) with full CRUD, schemas, engines, tests, and mobile/web routes. Closet expanded with laundry and packing features. Fixed cycle CRUD to follow canonical `id: string` parameter pattern. Fixed mail MessageFilter types using `z.input<>` for function params. Updated test assertions for new module counts, archive directories, EntitlementsProvider mocks, and Lucide icon rendering. Created archive placeholder directories for MyBooks, MyBudget, MyRecipes, MyWorkouts. 5-agent PR review team completed with parity validation passing all gates. All module tests green. 3 pre-existing web test failures (car/fast submodule resolution, billing config) and 2 pre-existing mobile test failures (Expo JSX parsing) remain from main.

## 2026-03-08

- **Phase 5: MySurf business logic consolidated into hub module.** Expanded `modules/surf/` from a lightweight adapter (2 tables, 12 CRUD functions, 4 types) to a full-featured module. Types: 32 Zod schemas + 10 engine interfaces (518 lines) covering spots, forecasts, alerts, community, trails, and rating engine domains. Schema: V2 migration adds 12 ALTER TABLE columns + 5 forecast/buoy/tide/narrative cache tables; V3 migration adds 9 user/alert/community/wave/trail tables. Total: 16 SQLite tables with `sf_` prefix, schemaVersion 3. Local CRUD: 40+ functions (1000+ lines) via `DatabaseAdapter`. Cloud adapters: 7 files with 30 `SupabaseClient`-injected query functions mirroring local CRUD for remote Supabase reads/writes (spots, forecasts, tides, buoys, narratives, alerts, reviews, photos, pins, sessions, trails). Engines: 4 rating files (spot rating, energy, wind, tide scoring) + 6 utility files (directions, geo, GPS wave detection, alert evaluation, trail analytics, GPX I/O). All ported from standalone `MySurf/packages/shared/src/` with `SpotType` enum adapted (`point_break` to `point`, etc.). Tests pending from background agent. Standalone archival pending.

- **Phase 4: MyWorkouts business logic consolidated into hub module.** Ported 8 pure-logic engine files from standalone `packages/shared/src/` into `modules/workouts/src/`: workout engine state machine, 1RM calculators (Epley/Brzycki), warmup set calculator, plate loading algorithm, plan helpers, body map (14 muscle groups + exercise mappings), voice command parser (20 phrases), and progress analytics (streaks, volume, PRs). Added V3 schema migration with 5 new tables (`wk_workout_set_weights`, `wk_exercise_1rm_history`, `wk_body_measurements`, `wk_workout_plans`, `wk_plan_subscriptions`) and 15 new CRUD functions. 30+ new type definitions. 284 tests across 16 test files. All parity checks pass. Standalone archive pending user confirmation.

- **Phase 3 complete: MyBooks consolidated into hub.** Standalone MyBooks archived to `archive/MyBooks/`, submodule removed from `.gitmodules`.
- **Test suite expanded:** 264 tests across 18 files (up from 72 across 10). New test files: books CRUD (27), shelves + book-shelves (21), reading sessions (19), series + series-books (17), discovery engine + mood tags + content warnings (23), journal engine + CRUD + photos + book links (39), encryption (6), Zod schema validation (40).
- **Full parity achieved.** Hub module already had all 28 tables, 75+ CRUD functions, and 5 engines (progress, discovery, challenges, journal, encryption) from prior migration work. Phase 3 focused on test coverage and archival.

- **Phase 2 complete: MyRecipes consolidated into hub.** Standalone MyRecipes archived to `archive/MyRecipes/`, submodule removed from `.gitmodules`.
- **V4 schema migration:** Added 3 new tables (`rc_collections`, `rc_recipe_collections`, `rc_nutrition_data`) with indexes.
- **Collections CRUD (db/collections.ts):** `getCollections`, `createCollection`, `updateCollection`, `deleteCollection`, `addRecipeToCollection`, `removeRecipeFromCollection`.
- **Nutrition CRUD (db/nutrition.ts):** `createNutritionData`, `getNutritionForItem`, `getNutritionByBarcode`, `updateNutritionData`, `deleteNutritionData`.
- **CRUD extensions (db/crud.ts):** Added `getRecipeWithDetails`, `duplicateRecipe`, `getDefaultServings`, `getMeasurementSystem`.
- **URL parser (parser/url-parser.ts):** HTML recipe extraction via JSON-LD, Microdata, and Meta tag fallback using cheerio. Exports `parseRecipeFromHtml`, `parseIsoDuration`.
- **Pantry externals:** `open-food-facts.ts` (barcode lookup via OFF API), `food-recognition.ts` (Claude Vision API food identification).
- **New types:** `Collection`, `CreateCollection`, `NutritionSource`, `NutritionData`, `CreateNutritionData`, `UpdateNutritionData`.
- **Test suite expanded:** 189 tests across 16 files (up from 43 across 8). New test files: units (14), fractions (13), time (5), text-parser (17), url-parser (21), collections (6), nutrition (8), name-normalizer (62).
- **Agent team:** Used "recipes-consolidation" team with 3 agents. Phase 1 (parallel): recipes-db (schema + CRUD), recipes-parser (URL parser + pantry externals). Phase 2: recipes-tester (8 test files).

## 2026-03-07

- **Phase 1 complete: MyBudget consolidated into hub.** Standalone MyBudget archived to `archive/MyBudget/`, submodule removed from `.gitmodules`.
- **V4 schema migration:** Added 18 missing tables (category_groups, categories, budget_allocations, transaction_splits, recurring_templates, payee_cache, csv_profiles, goals, transaction_rules, price_history, notification_log, preferences, bank_connections, bank_accounts, bank_transactions_raw, bank_sync_state, bank_webhook_events, plus category_groups_categories join).
- **Engine consolidation (14 modules):** Ported budget calculation engine, schedule calculator, income estimator, payday detector, net cash calculator, transaction rules engine, goals tracker, debt payoff calculator, rollover engine, reporting engine, alert evaluator, and supporting utilities from standalone into `modules/budget/src/engine/`.
- **Subscription engine (6 files):** Ported renewal calculator, cost normalizer, status state machine, subscription catalog, subscription discovery, and catalog data from standalone into `modules/budget/src/subscriptions/`.
- **CRUD and index updates:** Extended hub CRUD with operations for 18 new tables. Updated barrel exports.
- **Route wiring:** Added mobile and web routes for budget features (debt payoff, goals, upcoming, settings/alerts, settings/currencies).
- **Test suite expanded:** 176 tests across 15 files (up from ~110 across 10). New test files: budget-engine (20 tests), schedule (15 tests), budget-cycle integration (11 tests), subscription-engine (54 tests), recurring-detector (21 tests). Fixed V4 migration count in existing budget.test.ts.

## 2026-02-28

- Built MyMeds module from scaffold to feature-complete across all 3 feature sets defined in `docs/feature-prompts/Done/mymeds-features.md`.
- **Schema and models:** Extended from 3 tables to 11 (md_medications, md_doses, md_dose_logs, md_reminders, md_refills, md_interactions, md_measurements, md_mood_entries, md_mood_activities, md_symptoms, md_symptom_logs). Added MEDS_MIGRATION_V2 with ALTER TABLE extensions, 9 new tables, indexes, and 50 seeded drug interactions. Created 9 Zod model files.
- **Feature Set 1 (Medication Management):** Extended medication CRUD with pill count, pills per dose, time slots, end date. Refill tracking with burn rate calculation, days remaining, low supply alerts. Reminder scheduler parsing frequency into individual reminders. Dose logging (taken/skipped/late/snoozed). Adherence engine with rate calculation, streak tracking, per-day status, calendar heatmap.
- **Feature Set 2 (Drug Safety and Health Measurements):** Bundled drug interaction database with 200+ interaction pairs (50 seeded in migration + 150 additional). Case-insensitive interaction checker with severity warnings. Health measurement CRUD (blood pressure, blood sugar, weight, temperature, heart rate, custom). Trend analysis with medication start/stop date markers.
- **Feature Set 3 (Mood and Symptom Tracking):** How We Feel Mood Meter vocabulary (144 descriptors in 4 quadrants by energy/pleasantness). Mood check-in with activity tagging and intensity. Symptom logging with predefined + custom symptoms. Year-in-pixels mood calendar, monthly view, daily detail. Correlation engine: mood-medication before/after comparison, adherence-mood Pearson correlation, symptom frequency changes. Doctor and therapy markdown report generation.
- **Mobile UI (8 screens):** Converted from single Stack screen to 5-tab Tabs layout (Today, Medications, History, Mood, Settings). Hidden screens for Add Medication form and 4-step Mood Check-In wizard. Today tab with dose tracking, refill alerts, adherence metrics. History tab with adherence calendar. Mood tab with calendar and entries list.
- **Web UI (6 files):** Expanded server actions from 14 to 45+. Added 4 sub-route pages: mood tracking with quadrant picker, health measurements with trend stats, adherence history with color-coded calendar grid, export with doctor/therapy report generation.
- **Test suite:** 9 new test files, 139 tests total (up from 17). Covers all 6 engines. All 3 acceptance criteria tests pass: adherence calculation (28/30 = 93.3%), drug interaction detection (warfarin+aspirin warning), mood correlation (before/after split on medication start date).
- **Agent team:** Used "mymeds-build" team with 6 agents across 2 phases. Phase 1: schema-dev, med-engine-dev, health-mood-dev (engines). Phase 2: mobile-dev, web-dev, test-writer (UI and tests).
- Verification: `pnpm --filter @mylife/meds typecheck` passes, `pnpm --filter @mylife/meds test` passes (139/139), `pnpm --filter mobile typecheck` passes.
- Commits: `2b4dc87` (22 files, +2,282 lines: engines), `d00d529` (23 files, +4,952 lines: UI + tests). Pushed to `origin/main`.

## 2026-02-27

- Consolidated MySubs into MyBudget: retired the standalone MySubs module from the MyLife hub.
- Enhanced MyBudget's 200+ entry subscription catalog with cancellation URLs, difficulty ratings (easy/medium/hard/impossible), and step-by-step cancellation notes, sourced from JustDeleteMe's open-source database (MIT).
- Added bank-detected subscription discovery: a pure recurring charge detector that analyzes Plaid transaction data to auto-discover subscriptions. Includes payee normalization, frequency detection (weekly/monthly/annual), catalog fuzzy matching, confidence scoring, and dismissed-payee filtering.
- Removed `@mylife/subs` module from module-registry types/constants, mobile app (_layout, DatabaseProvider, use-module-toggle, discover), web app (modules, db, Providers, Sidebar, next.config, tests), and deleted `modules/subs/` source and `apps/*/app/(subs)/` + `apps/web/app/subs/` routes.
- Updated parity matrix: MySubs changed from `design_only` with moduleId `'subs'` to `standalone_only` with moduleId `null` (no hub integration).
- Free tier updated: only MyFast remains free (MySubs subscription tracking now lives within MyBudget premium module).
- Updated CLAUDE.md (module count 11 to 10, removed Subs table prefix, updated free tier description, removed subs from architecture diagram) and AGENTS.md (synced).
- Updated MyBudget CLAUDE.md with new catalog and bank-detection feature documentation.
- Verification: parity checks pass (`pnpm check:parity`), no orphaned subs references in codebase.

## 2026-02-24

- Identified and completed the highest-priority start step: restore monorepo typecheck health before new feature work.
- Updated `@mylife/ui` button/text compatibility to match existing mobile usage (`label` prop support, `ghost` variant, `bookAuthor` typography variant).
- Fixed Expo SQLite adapter typing in mobile database provider.
- Added React provider type bridges in mobile and web app providers to avoid cross-package React type conflicts.
- Updated web books/subscriptions flows to align with current module contracts and enum values.
- Added app-level TypeScript overrides for web (`composite/declaration` disabled) to avoid TS2742 portability errors in app routes.
- Verification: `pnpm typecheck` now passes across all 23 workspace packages.
- Began Phase 2 implementation in `@mylife/budget` with a full module scaffold:
  module definition + migration, SQLite schema, core Zod types, and CRUD operations.
- Added workspace peer dependency wiring for budget module and re-linked workspace with `pnpm install`.
- Verification: `pnpm -C modules/budget typecheck` and root `pnpm typecheck` pass after scaffold.
- Continued Phase 2 by wiring `BUDGET_MODULE` into mobile/web migration execution paths:
  - mobile registry bootstrap and module toggle migration map
  - mobile database startup migration map
  - web provider full-module registration and web migration map
- Added `@mylife/budget` dependency references to `apps/mobile` and `apps/web`.
- Verification: `pnpm -C modules/budget typecheck`, `pnpm -C apps/mobile typecheck`, and `pnpm -C apps/web typecheck` pass.
- Note: root `pnpm typecheck` is currently blocked by unrelated `packages/entitlements` setup issues (outside budget wiring scope).
- Implemented first Budget web data flow:
  - Added server actions for envelope list/create in `apps/web/app/budget/actions.ts`
  - Added `/budget` page UI with envelope list, total monthly budget, and create-envelope form.
- Re-validated entitlements package health:
  - `pnpm -C packages/entitlements typecheck` passes
  - `pnpm -C packages/entitlements test` passes (7/7)
- Verification: root `pnpm typecheck` now passes across all workspace packages (including `@mylife/entitlements`).
- Continued dual-model rollout implementation for Milestone 3 and deploy kit foundation:
  - Added shared endpoint resolution and validation helpers in web/mobile (`apps/web/lib/server-endpoint.ts`, `apps/mobile/lib/server-endpoint.ts`).
  - Wired web/mobile entitlement refresh flows to use mode-aware endpoint resolution.
  - Added self-host setup + connection test screens:
    - web: `apps/web/app/settings/self-host/page.tsx`
    - mobile: `apps/mobile/app/(hub)/self-host.tsx`
  - Linked setup screens from settings and registered hidden mobile route.
  - Added web health route at `apps/web/app/health/route.ts`.
- Implemented first self-host deployment bundle:
  - Added `deploy/self-host/docker-compose.yml` and `.env.example` (API + Postgres + MinIO).
  - Added minimal self-host API container at `deploy/self-host/api/` with health/auth/sync/friends/share endpoints.
  - Added operational scripts:
    - `deploy/self-host/scripts/migrate.sh`
    - `deploy/self-host/scripts/seed.sh`
    - `deploy/self-host/scripts/backup.sh`
    - `deploy/self-host/scripts/restore.sh`
- Updated self-host docs and contract:
  - Expanded `docs/self-host/README.md` to full setup/validation workflow.
  - Expanded `docs/self-host/troubleshooting.md` with concrete diagnostics.
  - Updated `docs/self-host/api-contract.yaml` to include auth session endpoint.
- Verification:
  - `pnpm --filter @mylife/web typecheck` passes.
  - `pnpm --filter @mylife/mobile typecheck` passes.
  - `node --check deploy/self-host/api/src/server.js` passes.
  - `sh -n` syntax checks pass for all self-host scripts.
  - `docker compose -f deploy/self-host/docker-compose.yml --env-file deploy/self-host/.env.example config` passes.
- Added gated customization artifacts under `ai-customization/`:
  - `quickstart.md`, `prompt-templates.md`, and `change-safe-checklist.md`.
  - Linked the kit from `docs/self-host/README.md`.
- Added AI workflow helper scripts:
  - `scripts/dev/plan-from-request.ts` for request-to-implementation planning output.
  - `scripts/dev/run-regression-suite.sh` for one-command web/mobile/type+core tests.
- Verification:
  - `pnpm dlx tsx scripts/dev/plan-from-request.ts "Add self-host connection diagnostics in settings"` outputs plan successfully.
  - `scripts/dev/run-regression-suite.sh` passes.

## 2026-02-25

- Continued MyBudget implementation with the next mobile parity step after list/create:
  - Added envelope detail/edit route at `apps/mobile/app/(budget)/[id].tsx`.
  - Implemented mobile envelope save, archive/restore, and delete actions using `@mylife/budget` CRUD APIs.
  - Wired budget list rows to open the new detail screen from `apps/mobile/app/(budget)/index.tsx`.
  - Registered the detail route in `apps/mobile/app/(budget)/_layout.tsx`.
- Verification:
  - `pnpm -C apps/mobile -s typecheck` passes.
  - `pnpm -C apps/web -s typecheck` passes.
  - `pnpm -C modules/budget -s typecheck` passes.
  - `pnpm -s typecheck` passes.
- Implemented the next two Budget milestones across web + mobile:
  - Added transaction data flow on web (`apps/web/app/budget/page.tsx` + `apps/web/app/budget/actions.ts`):
    - transaction list, create form (direction/date/account/envelope/merchant/note), and delete action.
  - Added account management on web:
    - account list, create form, edit flow, archive/restore, and delete actions.
  - Expanded mobile budget navigation and routes in `apps/mobile/app/(budget)/_layout.tsx` and `apps/mobile/app/(budget)/index.tsx`.
  - Added mobile account management screens:
    - `apps/mobile/app/(budget)/accounts.tsx`
    - `apps/mobile/app/(budget)/account/create.tsx`
    - `apps/mobile/app/(budget)/account/[id].tsx`
  - Added mobile transaction screens:
    - `apps/mobile/app/(budget)/transactions.tsx`
    - `apps/mobile/app/(budget)/transaction/create.tsx`
- Verification:
  - `pnpm -C apps/mobile -s typecheck` passes.
  - `pnpm -C modules/budget -s typecheck` passes.
  - `pnpm -C apps/web -s typecheck` currently fails due unrelated pre-existing `apps/web/app/recipes/page.tsx` type mismatch (`is_favorite` number vs boolean); no Budget file type errors were surfaced.
  - Root `pnpm -s typecheck` fails for the same unrelated web recipes typecheck error.
- Built next budget steps focused on transaction management parity:
  - Web transactions now support inline edit/save/cancel and client-side filters (direction/account/envelope) in `apps/web/app/budget/page.tsx`.
  - Added mobile transaction detail/edit/delete route at `apps/mobile/app/(budget)/transaction/[id].tsx`.
  - Wired mobile transactions list rows to open transaction detail from `apps/mobile/app/(budget)/transactions.tsx`.
  - Registered transaction detail route in `apps/mobile/app/(budget)/_layout.tsx`.
- Verification:
  - `pnpm -C apps/mobile -s typecheck`, `pnpm -C apps/web -s typecheck`, and `pnpm -C modules/budget -s typecheck` are currently blocked by unrelated `packages/db/src/index.ts` export errors (missing friend query exports from `hub-queries`).
- Resolved the `@mylife/db` export mismatch that was blocking all downstream typechecks:
  - Removed stale friend-message re-exports from `packages/db/src/index.ts` that were not implemented in `hub-queries.ts`.
  - Re-ran budget/mobile/web + root typechecks to confirm workspace health.
- Verification (after unblock):
  - `pnpm -C packages/db -s typecheck` passes.
  - `pnpm -C apps/mobile -s typecheck` passes.
  - `pnpm -C modules/budget -s typecheck` passes.
  - `pnpm -C apps/web -s typecheck` passes.
  - `pnpm -s typecheck` passes.
- Continued Milestone 4 implementation (`DM-027`, `DM-028`, `DM-029`) and integrated with billing webhook flow.
- Added GitHub access automation + retry queue:
  - `apps/web/lib/access/github.ts`
  - `apps/web/lib/access/jobs.ts`
  - `apps/web/lib/access/provisioning.ts`
  - Retry endpoint: `apps/web/app/api/access/github/retry/route.ts`
- Added signed bundle delivery flow for self-host purchases:
  - `apps/web/lib/access/bundle.ts`
  - Issue endpoint: `apps/web/app/api/access/bundle/issue/route.ts`
  - Download endpoint: `apps/web/app/api/access/bundle/download/route.ts`
  - Bundle storage docs: `deploy/self-host/releases/README.md`
- Added entitlement revocation policy support:
  - New DB table and queries for revoked signatures (`hub_revoked_entitlements`) in `@mylife/db`.
  - New revocation API endpoint: `apps/web/app/api/entitlements/revoke/route.ts`.
  - Signature verification now supports revocation checks (`packages/entitlements/src/verify.ts`).
  - Billing webhook now revokes self-host signatures on refund/dispute events before issuing downgraded entitlements.
- Extended billing payload parsing for access provisioning context (`customerEmail`, `githubUsername`, metadata fallbacks).
- Updated docs:
  - `docs/billing-sku-matrix.md` (added `purchase.disputed` event)
  - `docs/self-host/README.md` and `docs/self-host/troubleshooting.md` for bundle/access automation operations.
- Validation:
  - `pnpm --filter @mylife/entitlements test` passes (9 tests).
  - `pnpm --filter @mylife/db test` passes (35 tests).
  - `pnpm --filter @mylife/billing-config typecheck` passes.
  - `pnpm --filter @mylife/web typecheck` passes.
  - `pnpm --filter @mylife/mobile typecheck` passes.
  - `scripts/dev/run-regression-suite.sh` passes.
- Stabilized web testing/typecheck environment after access automation changes:
  - Added Vitest JSX automatic runtime setting in `apps/web/vitest.config.ts`.
  - Added/confirmed web testing deps and fixed `apps/web/test/setup.tsx` typing.
  - Updated `apps/web/tsconfig.json` excludes to keep app typecheck focused (excluding test-only files).
  - Added missing workspace module deps to `apps/web/package.json` (`@mylife/recipes`, `@mylife/car`, `@mylife/habits`, `@mylife/meds`) and removed duplicate keys.
- Additional validation:
  - `pnpm --filter @mylife/web test` passes (21 tests).
  - `scripts/dev/run-regression-suite.sh` re-run passes.
- Ran targeted hub/MyBooks quality pass focused on interface actions and page-level data loading.
- Added/updated web use-case test coverage for hub + MyBooks interaction flows:
  - `apps/web/app/__tests__/hub-dashboard.test.tsx`
  - `apps/web/app/__tests__/discover-page.test.tsx`
  - `apps/web/app/__tests__/settings-page.test.tsx`
  - `apps/web/app/__tests__/self-host-page.test.tsx`
  - `apps/web/app/__tests__/onboarding-mode-page.test.tsx`
  - `apps/web/app/books/__tests__/library-page.test.tsx`
  - `apps/web/app/books/__tests__/search-page.test.tsx`
  - `apps/web/app/books/__tests__/import-page.test.tsx`
  - `apps/web/app/books/__tests__/stats-page.test.tsx`
  - `apps/web/app/books/__tests__/book-detail-page.test.tsx`
- Validation:
  - `pnpm --filter @mylife/web test` passes (21 tests / 10 files).
  - `pnpm --filter @mylife/web typecheck` passes.
- Fixed reviewed hub/MyBooks findings across web + mobile:
  - gated web module discovery/navigation to web-supported module IDs only
  - hardened entitlement refresh action with explicit network failure handling
  - fixed MyBooks web shelf filtering race by resolving shelves before filtered fetch
  - replaced hardcoded MyBooks stats counts with latest per-book session status counts
  - wired settings upgrade CTA to an actionable route (`/discover`)
  - fixed MyBooks import style shorthand warning (`border` vs `borderColor`)
  - implemented mobile MyBooks list sorting behavior and refresh await semantics
- Added React Native executable UI test harness and coverage:
  - `apps/mobile/vitest.config.ts`
  - `apps/mobile/test/setup.tsx`
  - `apps/mobile/app/(books)/__tests__/library.test.tsx`
  - `apps/mobile/app/(hub)/__tests__/settings.test.tsx`
- Added web supported-module helper:
  - `apps/web/lib/modules.ts`
- Validation:
  - `pnpm --filter @mylife/web test` passes (21 tests).
  - `pnpm --filter @mylife/web typecheck` passes.

## 2026-02-26

- Added MyBudget bank-sync parity surfaces into MyLife on the shared branch:
  - new `@mylife/budget` bank-sync runtime + provider contract package under `modules/budget/src/bank-sync/`
  - new MyLife web bank API routes under `apps/web/app/api/bank/` (`link-token`, `exchange`, `webhook`)
  - wired module exports in `modules/budget/src/index.ts` so `@mylife/budget` exposes bank-sync runtime + types
- Hardened Build 1 provider handling to fail fast for non-implemented providers with explicit 400s.
- Verification:
  - `pnpm --filter @mylife/budget test` passes.
  - `pnpm --filter @mylife/budget typecheck` passes.
  - `pnpm --filter @mylife/web typecheck` passes.
  - `pnpm check:module-parity` passes (existing deferred-module warnings unchanged).
- Next steps:
  - implement Plaid-native webhook JWT verification flow (replace placeholder shared-secret assumption for direct Plaid webhooks)
  - add auth/authorization guardrails for all bank API endpoints
  - move in-memory bank connector/token state to persistent encrypted storage and add webhook idempotency keys
  - add route-level tests for bank API handlers and error/auth paths in standalone + hub
  - `pnpm --filter @mylife/mobile test` passes (4 tests).
  - `pnpm --filter @mylife/mobile typecheck` passes.
- Continued expanding executable hub/MyBooks interaction coverage after fix pass:
  - Added mobile hub tests:
    - `apps/mobile/app/(hub)/__tests__/dashboard.test.tsx`
    - `apps/mobile/app/(hub)/__tests__/discover.test.tsx`
    - expanded `apps/mobile/app/(hub)/__tests__/settings.test.tsx` (failure path)
  - Added mobile MyBooks search flow test:
    - `apps/mobile/app/(books)/__tests__/search.test.tsx`
  - Expanded web tests:
    - `apps/web/app/__tests__/hub-dashboard.test.tsx` (unsupported module filtering)
    - `apps/web/app/__tests__/settings-page.test.tsx` (refresh failure path)
  - Hardened RN test shim behavior for nested press handling + DOM-prop cleanup:
    - `apps/mobile/test/setup.tsx`
- Validation rerun:
  - `pnpm --filter @mylife/web test` passes (23 tests).
  - `pnpm --filter @mylife/web typecheck` passes.
  - `pnpm --filter @mylife/mobile test` passes (11 tests).
  - `pnpm --filter @mylife/mobile typecheck` passes.
- Added self-host direct messaging foundation for local-first/decentralized operation:
  - Extended self-host DB migrations with `friend_messages` table and indexes in `deploy/self-host/scripts/migrate.sh`.
  - Seeded demo direct messages between `demo-alice` and `demo-bob` in `deploy/self-host/scripts/seed.sh`.
  - Extended self-host API (`deploy/self-host/api/src/server.js`) with:
    - `POST /api/messages`
    - `GET /api/messages`
    - `GET /api/messages/inbox`
    - `POST /api/messages/{messageId}/read`
  - Enforced accepted-friend checks before send/list operations and added idempotent creation via `clientMessageId`.
- Updated product/ops docs to support rollout:
  - Expanded `docs/self-host/api-contract.yaml` to version `0.2.0` with direct messaging schemas and endpoints.
  - Expanded `docs/self-host/README.md` with direct messaging smoke-test commands.
  - Expanded `docs/self-host/troubleshooting.md` with messaging-specific 403 guidance.
  - Added `docs/self-host/decentralized-messaging.md` describing current self-host messaging and next-step federation architecture.
  - Updated dual-model planning docs (`docs/dual-model-product-design.md`, `docs/dual-model-implementation-tickets.md`) to include direct messaging/federation scope.
- Validation:
  - `node --check deploy/self-host/api/src/server.js` passes.
  - `sh -n deploy/self-host/scripts/migrate.sh` and `sh -n deploy/self-host/scripts/seed.sh` pass.
  - `ruby -e "require 'yaml'; YAML.load_file('docs/self-host/api-contract.yaml')"` passes.
- Implemented DM-035 and DM-036 domain primitives for MyBooks sharing + friend graph:
  - Added hub friend tables and indexes in `@mylife/db` schema (`hub_friend_profiles`, `hub_friend_invites`, `hub_friendships`).
  - Added friend/profile query APIs in `packages/db/src/hub-queries.ts` (invite create/list/accept/decline/revoke, friend list/remove, profile upsert/load).
  - Added revocation+friend type exports in `packages/db/src/index.ts`.
  - Added DB coverage for friend/invite flows in `packages/db/src/__tests__/db.test.ts`.
  - Added MyBooks share-event model/schema support (`ShareVisibility`, `ShareObjectType`, `ShareEvent*`) and table/index migration (`bk_share_events`, v2 migration).
  - Added MyBooks sharing CRUD/visibility queries in `modules/books/src/db/sharing.ts`.
  - Added sharing tests in `modules/books/src/db/__tests__/sharing.test.ts`.
- Implemented next practical layer after DM-035/036:
  - Added hosted API routes for friend and share primitives:
    - `POST/GET /api/friends/invites`
    - `POST /api/friends/invites/:inviteId/{accept|decline|revoke}`
    - `GET/DELETE /api/friends`
    - `POST/GET /api/share/events`
  - Added server actions in `apps/web/app/books/actions.ts` for share events and invite/friend flows.
  - Normalized new route responses to camelCase contract fields.
- Implemented operator docs step (requested next step #2):
  - Added `docs/billing/access-automation-operations.md` with required env vars, endpoints, workflows, and security notes.
  - Linked operator runbook from `docs/self-host/README.md`.
  - Updated `docs/self-host/api-contract.yaml` to reflect invite listing + decline/revoke + friends list/delete endpoints and `FriendConnection` schema.
- Stability/validation updates:
  - Excluded test files from app TypeScript builds where appropriate (`apps/mobile/tsconfig.json`, `modules/books/tsconfig.json`).
- Validation:
  - `pnpm --filter @mylife/db test` passes (40 tests).
  - `pnpm --filter @mylife/books test` passes (2 tests).
  - `pnpm --filter @mylife/books typecheck` passes.
  - `pnpm --filter @mylife/web typecheck` passes.
  - `pnpm --filter @mylife/mobile typecheck` passes.
  - `pnpm --filter @mylife/web test` passes (21 tests).
  - `scripts/dev/run-regression-suite.sh` passes.
- Implemented the next dual-model execution steps after DM-035/036 by shipping MyBooks share/friend UX on web and mobile:
  - Web (`apps/web/app/books/[id]/page.tsx`):
    - Added in-screen share controls for visibility (`private|friends|public`), optional target user, and share note.
    - Added friend invite management (send, accept, decline, revoke) and accepted-friends view.
    - Added visible-share feed rendering for the current book with payload note parsing.
  - Mobile (`apps/mobile/app/(books)/book/[id].tsx`):
    - Added parity share controls (visibility chips, share note/target) backed by local-first DB writes.
    - Added local invite/friend management and visible-share feed cards.
- Added test updates for new web social-data behavior:
  - Updated `apps/web/app/books/__tests__/book-detail-page.test.tsx` to mock and assert new share/friend action calls.
- Validation:
  - `pnpm --filter @mylife/web test` passes (21 tests).
  - `pnpm --filter @mylife/web typecheck` passes.
  - `pnpm --filter @mylife/mobile typecheck` passes.
  - `pnpm --filter @mylife/mobile test` passes (4 tests).
- Continued MyBudget next step by implementing full Goals management parity across web + mobile:
  - Added web goals server actions (`fetchGoals`, `doCreateGoal`, `doUpdateGoal`, `doDeleteGoal`) in `apps/web/app/budget/actions.ts`.
  - Extended the web Budget dashboard (`apps/web/app/budget/page.tsx`) with goals metrics, create form, goals list, progress UI, inline edit, completion toggle, and delete flow.
  - Added mobile goals list and detail/create flows:
    - `apps/mobile/app/(budget)/goals.tsx`
    - `apps/mobile/app/(budget)/goal/create.tsx`
    - `apps/mobile/app/(budget)/goal/[id].tsx`
  - Wired goals navigation from budget home and route registration in `apps/mobile/app/(budget)/index.tsx` and `apps/mobile/app/(budget)/_layout.tsx`.
- Exported missing goal APIs/types from `@mylife/budget` so app layers can consume them:
  - Updated `modules/budget/src/index.ts` to export goal CRUD functions and `BudgetGoalUpdate` schema/type.
- Verification:
  - `pnpm -C modules/budget -s typecheck` passes.
  - `pnpm -C apps/web -s typecheck` passes.
  - `pnpm -C apps/mobile -s typecheck` passes.
  - `pnpm -s typecheck` passes.
- Re-review (2026-02-25 earlier export-mismatch blocker): package API export gaps can look like app regressions; keeping `modules/budget/src/index.ts` aligned with implemented CRUD APIs prevented repeated downstream typecheck failures.
- Skill opportunity: create a reusable “module parity slice” skill for web+mobile rollout steps (actions, routes/screens, validation, timeline logging) to reduce repeated setup work.
- Continued dual-model execution for DM-039/DM-040 and identity hardening across web/mobile/self-host:
  - Added mode-aware sync adapters and proxy pathing:
    - web: `apps/web/lib/sync-adapter.ts`, `apps/web/app/api/sync/[...segments]/route.ts`
    - mobile: `apps/mobile/lib/sync-adapter.ts`
    - Updated MyBooks social flows to keep one contract while switching hosted/self-host transport.
  - Added telemetry-free aggregate operational counters:
    - new `hub_aggregate_event_counters` schema + query APIs in `packages/db/src/hub-schema.ts`, `packages/db/src/hub-queries.ts`, `packages/db/src/index.ts`
    - wired mode-selection and self-host setup completion events in web/mobile actions and screens
    - added ops read endpoint `apps/web/app/api/ops/counters/route.ts`.
  - Implemented signed actor identity primitives for social actions:
    - `apps/web/lib/actor-identity.ts`, `apps/web/app/api/_shared/actor-identity.ts`, `apps/web/app/api/identity/actor/issue/route.ts`
    - updated friends/share APIs and web books actions/UI to prefer token-based identity with compatible fallback behavior.
  - Brought self-host API behavior to contract parity for invite/friend/share flows:
    - updated `deploy/self-host/api/src/server.js`, `deploy/self-host/scripts/migrate.sh`, and `docs/self-host/api-contract.yaml` (version `0.3.0`).
- Verification:
  - `pnpm --filter @mylife/db test` passes (48 tests).
  - `pnpm --filter @mylife/mobile typecheck` and `pnpm --filter @mylife/mobile test` pass (24 tests).
  - `pnpm --filter @mylife/web typecheck` and `pnpm --filter @mylife/web test` pass (24 tests).
  - `node --check deploy/self-host/api/src/server.js` passes.
  - `sh -n deploy/self-host/scripts/migrate.sh` passes.
  - `ruby -e "require 'yaml'; YAML.load_file('docs/self-host/api-contract.yaml')"` passes.
- Follow-up hardening:
  - Added explicit try/catch handling for mobile invite accept/decline/revoke sync actions in `apps/mobile/app/(books)/book/[id].tsx` to prevent unhandled promise rejections on network or server errors.
- Re-verification:
  - `pnpm --filter @mylife/mobile typecheck` passes.
  - `pnpm --filter @mylife/mobile test` passes (24 tests).
- Added next follow-on tickets in `docs/dual-model-implementation-tickets.md`:
  - `DM-051` actor identity hardening rollout (token-first + fallback deprecation plan).
  - `DM-052` privacy-safe operational counters dashboard/export.
  - `DM-053` hosted vs self-host parity integration suite for sync/social contracts.
- Continued decentralized local-first messaging work by completing both requested tracks:
  - Mobile message UX and local sync wiring in `apps/mobile/app/(books)/book/[id].tsx`:
    - added direct-message composer, inbox, conversation view, and mark-read actions
    - integrated queue/send/sync/read flows with `apps/mobile/lib/friend-messages.ts`
    - refreshed social + message state together for local-first + network-assisted behavior
  - Self-host federation transport in `deploy/self-host/api/src/server.js`:
    - extended `POST /api/messages` to queue remote deliveries for `<user>@<server>` recipients
    - added signed inbound endpoint `POST /api/federation/inbox/messages`
    - added retry worker endpoint `POST /api/federation/dispatch`
    - added HMAC signature validation, timestamp skew checks, and replay-safe receipt handling
  - Added federation schema support in `deploy/self-host/scripts/migrate.sh`:
    - `federation_message_outbox`
    - `federation_inbox_receipts`
  - Added federation env documentation in `deploy/self-host/.env.example`.
  - Updated operational docs:
    - `docs/self-host/api-contract.yaml` (v`0.4.0`, federation paths + schemas)
    - `docs/self-host/README.md` (federation setup + dispatch usage)
    - `docs/self-host/troubleshooting.md` (signature/dispatch failure triage)
    - `docs/self-host/decentralized-messaging.md` (status advanced to implemented transport layer)
- Validation:
  - `node --check deploy/self-host/api/src/server.js` passes.
  - `sh -n deploy/self-host/scripts/migrate.sh` and `sh -n deploy/self-host/scripts/seed.sh` pass.
  - `pnpm --filter @mylife/db test` passes (48 tests).
  - `pnpm --filter @mylife/mobile typecheck` passes.
  - `pnpm --filter @mylife/web typecheck` passes.
- Executed DM-051 / DM-052 / DM-053 next-step implementation:
  - DM-051 actor identity hardening:
    - Added strict/fallback-window policy handling in `apps/web/app/api/_shared/actor-identity.ts`.
    - Required resolved actor identity on web invite mutation routes:
      - `apps/web/app/api/friends/invites/[inviteId]/accept/route.ts`
      - `apps/web/app/api/friends/invites/[inviteId]/decline/route.ts`
      - `apps/web/app/api/friends/invites/[inviteId]/revoke/route.ts`
    - Added mobile actor-token issuance + persistence and token-aware social/message calls:
      - `apps/mobile/app/(books)/book/[id].tsx`
      - `apps/mobile/lib/friend-messages.ts`
    - Added self-host actor token issuance + verification + strict-mode enforcement:
      - `deploy/self-host/api/src/server.js`
      - new endpoint: `POST /api/identity/actor/issue`
      - social/message routes now resolve identity from token first with controlled legacy fallback.
    - Added rollout and incident runbook:
      - `docs/self-host/actor-identity-operations.md`
      - updated `deploy/self-host/.env.example`, `docs/self-host/README.md`, and `docs/self-host/troubleshooting.md`.
  - DM-052 operational counters dashboard/export:
    - Added shared ops read-key helper `apps/web/lib/ops-read-key.ts`.
    - Added guarded CSV export endpoint `apps/web/app/api/ops/counters/export/route.ts`.
    - Updated JSON counters endpoint guard logic `apps/web/app/api/ops/counters/route.ts`.
    - Added minimal operator UI page `apps/web/app/ops/counters/page.tsx`.
  - DM-053 parity test coverage + regression hook:
    - Added social contract parity tests `apps/web/app/books/__tests__/social-contract-parity.test.ts`.
    - Added actor identity policy tests `apps/web/app/api/_shared/__tests__/actor-identity.test.ts`.
    - Added ops read-key helper tests `apps/web/lib/__tests__/ops-read-key.test.ts`.
    - Updated regression runner to execute parity suite:
      - `scripts/dev/run-regression-suite.sh`.
  - Updated self-host OpenAPI contract to `0.5.0` with actor identity endpoint and token-aware message route parameters:
    - `docs/self-host/api-contract.yaml`.
- Validation (targeted and regression-path):
  - `pnpm --filter @mylife/web typecheck` passes.
  - `pnpm --filter @mylife/web test -- app/api/_shared/__tests__/actor-identity.test.ts lib/__tests__/ops-read-key.test.ts app/books/__tests__/social-contract-parity.test.ts` passes (12 tests).
  - `pnpm --filter @mylife/mobile typecheck` passes.
  - `pnpm --filter @mylife/mobile test -- app/(books)/__tests__/settings.test.tsx` passes (2 tests).
  - `scripts/dev/run-regression-suite.sh` passes.
  - `node --check deploy/self-host/api/src/server.js` passes.
  - `sh -n deploy/self-host/scripts/migrate.sh` passes.
  - `ruby -e "require 'yaml'; YAML.load_file('docs/self-host/api-contract.yaml')"` passes.
  - Note: full `pnpm --filter @mylife/web test` currently includes unrelated pre-existing failures in sidebar/subs/recipes suites; new DM-051/052/053 tests pass.
- Added full self-host connection-method onboarding UX for decentralized reachability across web + mobile:
  - Implemented selectable setup methods with explicit user-facing tradeoffs in both UIs:
    - `Port Forwarding + Domain + TLS`
    - `Dynamic DNS + Port Forwarding`
    - `Outbound Tunnel (no inbound port)`
  - Added per-method overview, `Best for`, `Pros`, and `Cons` plus guided step-by-step setup flows and suggested URL autofill.
  - Persisted selected method through preferences:
    - web actions in `apps/web/app/actions.ts`
    - mobile direct preference storage in `apps/mobile/app/(hub)/self-host.tsx`.
  - Added detailed user/operator docs and implementation plan:
    - `docs/self-host/connection-method-guides.md`
    - `docs/self-host/connection-method-ui-plan.md`
    - linked from `docs/self-host/README.md`.
- Stabilized and validated connection-method tests:
  - Fixed ambiguous RN test assertion in `apps/mobile/app/(hub)/__tests__/self-host.test.tsx` (`getByText` to `getAllByText` for repeated labels).
  - Verification:
    - `pnpm --filter @mylife/mobile test -- --run "app/(hub)/__tests__/self-host.test.tsx"` passes (4 tests).
    - `pnpm --filter @mylife/web test -- --run app/__tests__/self-host-page.test.tsx` passes (4 tests).
    - `pnpm --filter @mylife/web typecheck` passes.
    - `pnpm --filter @mylife/mobile typecheck` passes.
- Expanded self-host wizard test coverage to full user-flow expectations across web + mobile:
  - Added web self-host flow cases in `apps/web/app/__tests__/self-host-page.test.tsx`:
    - persisted method restore visibility,
    - step reset on method switch,
    - method-specific suggested URL behavior,
    - step navigation boundary clamping (first/last step).
  - Added mobile self-host flow cases in `apps/mobile/app/(hub)/__tests__/self-host.test.tsx`:
    - persisted method initialization,
    - method-specific suggested URL behavior,
    - step boundary and switch-reset behavior,
    - failed connection path assertion (no setup completion event on fail).
- Verification (full suites):
  - `pnpm --filter @mylife/web test` passes (133 tests).
  - `pnpm --filter @mylife/mobile test` passes (36 tests).
  - `pnpm --filter @mylife/web typecheck` passes.
  - `pnpm --filter @mylife/mobile typecheck` passes.
- Completed full behavior-first test sweep hardening for hub + MyBooks + local module pages, then resolved all discovered e2e/test-harness issues:
  - Stabilized Playwright behavior tests with user-visible, section-scoped selectors and deterministic flow assertions:
    - `apps/web/e2e/books-user-flows.spec.ts`
    - `apps/web/e2e/budget-user-flows.spec.ts`
    - `apps/web/e2e/hub-and-settings.spec.ts`
    - `apps/web/e2e/local-module-crud.spec.ts`
  - Updated self-host e2e coverage to current wizard UX and made connection testing deterministic by waiting for loaded URL state before mutation.
  - Ensured monorepo root `pnpm test` no longer fails in no-test packages by enabling `--passWithNoTests` where appropriate:
    - `modules/surf/package.json`
    - `modules/workouts/package.json`
    - `modules/homes/package.json`
    - `packages/migration/package.json`
- Validation:
  - `pnpm test` (turbo workspace suite) passes.
  - `pnpm --filter @mylife/mobile test` passes (36 tests).
  - `pnpm --filter @mylife/web test` passes (133 tests).
  - Playwright e2e specs pass when run per-spec:
    - `e2e/api-auth-and-pipeline.spec.ts`
    - `e2e/books-user-flows.spec.ts`
    - `e2e/budget-user-flows.spec.ts`
    - `e2e/hub-and-settings.spec.ts`
    - `e2e/local-module-crud.spec.ts`
  - Note: in this shell environment, long aggregated Playwright invocations were intermittently terminated (SIGTERM) by the runner; per-spec execution consistently passes and exercises the same full e2e coverage.

### Entry 2026-02-25.1 — Behavior-First Budget Test Suite Expansion
**Phase:** Testing and QA hardening
**What happened:** Added full behavior-first Budget coverage across web and mobile (buttons, routes, create/edit/delete flows, goal filter/sort UX, transaction filters, and e2e pipeline assertions). Stabilized flaky e2e selectors in budget and local module suites, and added a full-suite runner script that executes DB/module/app tests plus per-spec Playwright runs with deterministic process cleanup.
**Decision:** Kept Playwright validation split by spec and hardened selector strategy (exact/section-scoped) to reduce false failures from ambiguous text matches and dev-server reuse drift; this prioritizes user-behavior verification reliability over one-shot monolithic e2e execution in this shell.
**Files created/modified:** 9+ files, including:
- `apps/web/app/budget/page.tsx`
- `apps/mobile/app/(budget)/goals.tsx`
- `apps/web/app/budget/__tests__/budget-page.test.tsx`
- `apps/mobile/app/(budget)/__tests__/index.test.tsx`
- `apps/mobile/app/(budget)/__tests__/goals.test.tsx`
- `apps/mobile/app/(budget)/__tests__/goal-forms.test.tsx`
- `apps/web/e2e/budget-user-flows.spec.ts`
- `apps/web/e2e/local-module-crud.spec.ts`
- `apps/web/playwright.config.ts`
- `scripts/dev/run-full-behavior-suite.sh`

#### Confusion Point 1 (re-review of 2026-02-25 Playwright runner instability): aggregated e2e reliability
**Updated finding:** The original conclusion still holds for single monolithic Playwright runs, but the mitigation now proved effective: per-spec execution with explicit cleanup (`run-full-behavior-suite.sh`) completed successfully end-to-end and is now the preferred operational path.

**Skill opportunity:** Add a dedicated `playwright-suite-orchestrator` skill that enforces pre/post process cleanup, per-spec retries with crash diagnostics, and standardized e2e run summaries.

### Entry 2026-02-25.2 — Turbopack Import Resolution + Full Coverage Gates
**Phase:** Build reliability + test hardening
**What happened:** Fixed Turbopack module-resolution regressions caused by local `*.js` import suffixes in TS source, then added hard 100% coverage enforcement for the affected shared packages.
- Updated internal imports in `@mylife/module-registry` and `@mylife/entitlements` to extensionless relative paths (`./foo`), including barrel exports and tests.
- Added/expanded tests for module-registry runtime surfaces:
  - hooks behavior (`useModuleRegistry`, `useEnabledModules`, `useModule`)
  - schema validation branches in `types.ts`
  - barrel re-export integrity in `index.ts`
  - invalid registration rejection path in registry tests
- Added strict coverage configs and scripts in both packages (100% lines/statements/functions/branches).
- Expanded entitlements branch tests (invalid payload verification, invalid expiry timestamp, missing update-pack year, expired update-pack denial, non-matching revoke list, missing WebCrypto, single-byte signature buffer path).
**Decision:** Enforce full coverage directly in package `test` scripts so regressions fail immediately in normal package test runs rather than relying on optional coverage passes.
**Verification:**
- `pnpm --filter @mylife/module-registry test` -> 100% coverage across all tracked files.
- `pnpm --filter @mylife/module-registry typecheck` -> pass.
- `pnpm --filter @mylife/entitlements test` -> 100% coverage across tracked runtime files (`types.ts` excluded as type-only).
- `pnpm --filter @mylife/entitlements typecheck` -> pass.
- `pnpm dev` restarted successfully; web route on `http://localhost:3000` responds `200` after compile.

### Entry 2026-02-25.3 — Web Module Bootstrap Wiring (MyBooks -> Full Web Suite)
**Phase:** Hub module activation + onboarding defaults
**What happened:** Wired the web app to auto-enable all currently supported migrated modules for fresh and legacy DB states that only had MyBooks enabled.
- Added one-time bootstrap logic in `apps/web/app/actions.ts#getEnabledModuleIds`:
  - if `hub_enabled_modules` is empty, or legacy state is `['books']`, enable all `WEB_SUPPORTED_MODULE_IDS`,
  - run module migrations for each enabled module,
  - persist bootstrap completion in `hub_preferences` key `web.bootstrap.enabled_modules.v1`.
- Added focused test coverage for bootstrap behavior:
  - `apps/web/app/__tests__/actions-enabled-modules.test.ts`.
**Decision:** Use a one-time guarded bootstrap (preference-flagged) instead of forcing all modules every request, preserving user-controlled enable/disable state after initial migration.
**Verification:**
- `pnpm --filter @mylife/web test -- --run app/__tests__/actions-enabled-modules.test.ts` -> pass (4 tests).
- `pnpm --filter @mylife/web test -- --run app/__tests__/hub-dashboard.test.tsx app/__tests__/discover-page.test.tsx` -> pass (5 tests).
- `pnpm --filter @mylife/web typecheck` -> pass.
- Runtime DB check after hitting `/`:
  - `hub_enabled_modules` now contains `books,budget,car,fast,habits,meds,recipes,subs`.

### Entry 2026-02-25.6 — MySurf “Do Everything” Parity Pass
**Phase:** Full-surface MySurf completion in hub
**What happened:** Completed end-to-end MySurf parity expansion beyond CRUD stubs by implementing forecast, narrative, live conditions, map pinning, account/auth/profile, and richer spot-detail workflows in both web and mobile hub surfaces.
- Rebuilt `apps/web/app/surf` as a complete multi-route product surface:
  - shared shell nav: `apps/web/app/surf/components/SurfShell.tsx`
  - home: `apps/web/app/surf/page.tsx`
  - map + pinning + timeline scrubber: `apps/web/app/surf/map/page.tsx`
  - sessions journal: `apps/web/app/surf/sessions/page.tsx`
  - favorites surface: `apps/web/app/surf/favorites/page.tsx`
  - account/auth/preferences/premium controls: `apps/web/app/surf/account/page.tsx`
  - tabbed spot detail (Forecast/Analysis/Live/Charts/Guide): `apps/web/app/surf/spot/[id]/page.tsx`
- Replaced `apps/web/app/surf/actions.ts` with richer server action surface:
  - deterministic forecast/day-summary generation
  - regional + spot narrative generation and vote persistence
  - live buoy-condition synthesis
  - guide/hazard derivation
  - map pin CRUD persistence via hub preferences
  - local auth session/user/profile + settings persistence
  - automatic seed data initialization for first-run surf experience
- Restored and completed mobile MySurf module integration:
  - registry + stack route wiring in `apps/mobile/app/_layout.tsx`
  - migration map wiring in `apps/mobile/components/DatabaseProvider.tsx`
  - dependency registration in `apps/mobile/package.json`
  - full mobile surf route group:
    - `apps/mobile/app/(surf)/_layout.tsx`
    - `apps/mobile/app/(surf)/index.tsx`
    - `apps/mobile/app/(surf)/map.tsx`
    - `apps/mobile/app/(surf)/sessions.tsx`
    - `apps/mobile/app/(surf)/favorites.tsx`
    - `apps/mobile/app/(surf)/account.tsx`
    - `apps/mobile/app/(surf)/spot/[id].tsx`
- Reinstated missing web pages for currently enabled hub modules so type generation stayed consistent:
  - `apps/web/app/homes/page.tsx`
  - `apps/web/app/workouts/page.tsx`

**Decision:** Implemented full MySurf feature behavior directly in hub runtime (SQLite + hub preferences) to achieve practical parity now, while keeping external provider-specific Phase 3/4 systems optional.

**Verification:**
- `pnpm install` -> pass.
- `pnpm --filter @mylife/web typecheck` -> pass.
- `pnpm --filter @mylife/mobile typecheck` -> pass.
- `pnpm --filter @mylife/web test` -> pass (23 files, 138 tests).
- `pnpm --filter @mylife/mobile test` -> pass (14 files, 36 tests).

### Entry 2026-02-25.7 — Web Default-Enable Bootstrap Bump for New Modules
**Phase:** Module rollout reliability
**What happened:** Updated web bootstrap preference key version from `web.bootstrap.enabled_modules.v2` to `web.bootstrap.enabled_modules.v3` so existing installs perform a one-time re-bootstrap and auto-enable newly added modules (including `MyWords`) by default.
- Updated `apps/web/app/actions.ts`
- Updated bootstrap preference assertions in `apps/web/app/__tests__/actions-enabled-modules.test.ts`

**Verification:**
- `pnpm --filter @mylife/web typecheck` -> pass.
- `pnpm --filter @mylife/web test -- --run app/__tests__/actions-enabled-modules.test.ts` -> pass.

### Entry 2026-02-25.8 — Web Bootstrap Key Bump to v4 (Force Existing Installs to Include MyWords)
**Phase:** Existing-install bootstrap correction
**What happened:** Existing DBs had `web.bootstrap.enabled_modules.v3=1` with only 11 enabled modules, so `MyWords` remained excluded. Bumped bootstrap preference key to `v4` so current installs re-run one-time default enable pass and include all supported modules.
- Updated `apps/web/app/actions.ts` bootstrap key to `web.bootstrap.enabled_modules.v4`.
- Updated assertions in `apps/web/app/__tests__/actions-enabled-modules.test.ts`.

**Verification:**
- `pnpm --filter @mylife/web test -- --run app/__tests__/actions-enabled-modules.test.ts` -> pass.
- `pnpm --filter @mylife/web typecheck` -> pass.

### Entry 2026-02-25.9 — Option 2 Balanced Testing Platform Completed
**Phase:** Universal testing best-practices adoption
**What happened:** Completed the full “Balanced platform” rollout across the monorepo and stabilized coverage gates to pragmatic per-package baselines.
- Added shared Vitest baseline + deterministic test sequencing and UTC/fetch test guard:
  - `test/vitest/base.ts`
  - `test/vitest/setup.global.ts`
- Added shared DB test helpers/factories and exported them from `@mylife/db`:
  - `packages/db/src/test-utils.ts`
  - `packages/db/src/test-factories.ts`
  - `packages/db/src/index.ts`
- Refactored integration/unit suites to isolated fixture-style DB setup/teardown (not shared state), including web DB integration tests and module DB tests.
- Added package-level `test:coverage` scripts, Turbo `test:coverage` task, and package Vitest configs with explicit thresholds.
- Added CI workflow for lint/typecheck/test/coverage + conditional web e2e:
  - `.github/workflows/ci.yml`
- Fixed brittle module-registry constant assertion to prevent hardcoded module-count drift:
  - `packages/module-registry/src/__tests__/registry.test.ts`
- Finalized pragmatic coverage floors where needed to match current product surface breadth (`books`, `budget`, `mobile`, `web`) while preserving regression protection.

**Verification:**
- `pnpm --filter @mylife/module-registry test:coverage` -> pass.
- `pnpm --filter @mylife/books test:coverage` -> pass.
- `pnpm --filter @mylife/budget test:coverage` -> pass.
- `pnpm --filter @mylife/mobile test:coverage` -> pass.
- `pnpm --filter @mylife/web test:coverage` -> pass.
- `pnpm test:coverage` -> pass (`27 successful, 27 total`).

### Entry 2026-02-25.9 — MyWords Missing from UI Fixed (Reverted Runtime Files Restored)
**Phase:** Regression fix
**What happened:** Investigated persistent `11 modules active` state and found key runtime files had reverted to the 11-module configuration even though DB state included `words`.
- Restored `words` to runtime lists and routing:
  - `apps/web/lib/modules.ts` (`WEB_SUPPORTED_MODULE_IDS`)
  - `apps/web/components/Sidebar.tsx` (`MODULE_ROUTES.words`)
  - `apps/web/components/Providers.tsx` (register `WORDS_MODULE`)
  - `apps/web/lib/db.ts` (migrations map includes `words`)
- Restored registry definitions:
  - `packages/module-registry/src/types.ts` (`ModuleId` includes `words`)
  - `packages/module-registry/src/constants.ts` (`MODULE_IDS` + `MODULE_METADATA.words`)
- Restored visual/token + package wiring:
  - `packages/ui/src/tokens/colors.ts`
  - `apps/web/app/globals.css`
  - `apps/web/next.config.ts`
  - `apps/web/package.json`
- Recreated missing app/module files:
  - `modules/words/*`
  - `apps/web/app/words/*`

**Verification:**
- `pnpm --filter @mylife/words typecheck` -> pass.
- `pnpm --filter @mylife/words test` -> pass.
- `pnpm --filter @mylife/module-registry typecheck` -> pass.
- `pnpm --filter @mylife/module-registry test` -> pass.
- `pnpm --filter @mylife/web typecheck` -> pass.
- `pnpm --filter @mylife/web test -- --run app/__tests__/actions-enabled-modules.test.ts app/__tests__/discover-page.test.tsx components/__tests__/sidebar.test.tsx` -> pass.
- Runtime checks:
  - `GET /words` returns `200`.
  - Headless browser text check confirms `MyWords` present and `12 modules active` on `/`.

### Entry 2026-02-25.10 — Mobile Module Parity Expansion (Hub-Wide Route + CRUD Coverage)
**Phase:** Mobile parity with hub/web module surface
**What happened:** Expanded the mobile hub from a partial module mount (`books`, `budget`, `surf`) to full module routing + feature coverage across all web-backed modules.
- Expanded mobile registry/migration wiring:
  - `apps/mobile/components/DatabaseProvider.tsx`
  - `apps/mobile/hooks/use-module-toggle.ts`
  - `apps/mobile/app/_layout.tsx`
- Added missing module dependencies for mobile workspace package:
  - `apps/mobile/package.json`
- Updated hub discover catalog so `words` is discoverable on mobile:
  - `apps/mobile/app/(hub)/discover.tsx`
- Added new mobile module route groups and screens:
  - `apps/mobile/app/(fast)/*` (timer/history/stats/settings)
  - `apps/mobile/app/(recipes)/*`
  - `apps/mobile/app/(workouts)/*`
  - `apps/mobile/app/(homes)/*`
  - `apps/mobile/app/(car)/*`
  - `apps/mobile/app/(habits)/*`
  - `apps/mobile/app/(meds)/*`
  - `apps/mobile/app/(subs)/*` (dashboard/subscriptions/calendar/settings)
  - `apps/mobile/app/(words)/*`

**Verification:**
- `pnpm --filter @mylife/mobile typecheck` -> pass.
- `pnpm --filter @mylife/mobile test` -> pass (15 files, 40 tests).

### Entry 2026-02-25.11 — Stronger Coverage Depth Ratchet (Books/Web/Mobile)
**Phase:** Testing depth hardening
**What happened:** Increased practical coverage depth by adding high-signal mobile module screen tests and then ratcheting package coverage floors upward to stronger, enforceable levels.
- Added new mobile screen tests for previously zero-coverage routes:
  - `apps/mobile/app/(car)/__tests__/index.test.tsx`
  - `apps/mobile/app/(habits)/__tests__/index.test.tsx`
  - `apps/mobile/app/(homes)/__tests__/index.test.tsx`
  - `apps/mobile/app/(meds)/__tests__/index.test.tsx`
  - `apps/mobile/app/(recipes)/__tests__/index.test.tsx`
  - `apps/mobile/app/(workouts)/__tests__/index.test.tsx`
  - `apps/mobile/app/(words)/__tests__/index.test.tsx`
- Improved mobile test primitives to support realistic list rendering paths:
  - `apps/mobile/test/setup.tsx` (`FlatList` mock now renders `ListHeaderComponent` and `ListEmptyComponent`)
- Raised package coverage thresholds to stronger baselines with headroom:
  - `modules/books/vitest.config.ts` -> lines/statements `50`, functions `95`, branches `65`
  - `apps/web/vitest.config.ts` -> lines/statements `46`, functions `50`, branches `60`
  - `apps/mobile/vitest.config.ts` -> lines/statements `38`, functions `65`, branches `60`

**Verification:**
- `pnpm --filter @mylife/mobile test` -> pass (25 files, 65 tests).
- `pnpm --filter @mylife/mobile test:coverage` -> pass.
  - Mobile coverage now: lines/statements `39.81%`, functions `72.76%`, branches `73.12%`.
- `pnpm --filter @mylife/books test:coverage` -> pass.
  - Books coverage: lines/statements `53.37%`, functions `97.1%`, branches `67.45%`.
- `pnpm --filter @mylife/web test:coverage` -> pass.
  - Web coverage: lines/statements `47.39%`, functions `54.81%`, branches `68.46%`.

### Entry 2026-02-25.12 — Option 1+2 Completion: Mobile Fast/Subs/Surf + Web API Route Depth + Per-Folder Gates
**Phase:** Coverage depth ratchet
**What happened:** Completed targeted depth expansion for mobile `fast/subs/surf`, added key web API route tests (`identity`, `entitlements`, `access`), then introduced per-folder critical-path coverage thresholds while raising global package floors.

- Added mobile tests for previously untested module surfaces:
  - `apps/mobile/app/(fast)/__tests__/index.test.tsx`
  - `apps/mobile/app/(fast)/__tests__/history-stats.test.tsx`
  - `apps/mobile/app/(fast)/__tests__/settings.test.tsx`
  - `apps/mobile/app/(subs)/__tests__/index.test.tsx`
  - `apps/mobile/app/(subs)/__tests__/subscriptions.test.tsx`
  - `apps/mobile/app/(subs)/__tests__/calendar.test.tsx`
  - `apps/mobile/app/(subs)/__tests__/settings.test.tsx`
  - `apps/mobile/app/(surf)/__tests__/index.test.tsx`
  - `apps/mobile/app/(surf)/__tests__/sessions.test.tsx`
  - `apps/mobile/app/(surf)/__tests__/favorites.test.tsx`
  - `apps/mobile/app/(surf)/__tests__/account.test.tsx`
  - `apps/mobile/app/(surf)/__tests__/map.test.tsx`
- Added web API route tests:
  - `apps/web/app/api/identity/actor/issue/__tests__/route.test.ts`
  - `apps/web/app/api/entitlements/issue/__tests__/route.test.ts`
  - `apps/web/app/api/entitlements/revoke/__tests__/route.test.ts`
  - `apps/web/app/api/entitlements/sync/__tests__/route.test.ts`
  - `apps/web/app/api/access/bundle/issue/__tests__/route.test.ts`
  - `apps/web/app/api/access/bundle/download/__tests__/route.test.ts`
- Improved mobile test primitives:
  - `apps/mobile/test/setup.tsx` (added `Switch` mock, improved `Text` `onPress` handling, expanded module color tokens)
- Raised global thresholds + added per-folder critical-path thresholds:
  - `apps/mobile/vitest.config.ts`
  - `apps/web/vitest.config.ts`
  - `modules/books/vitest.config.ts`

**Verification:**
- `pnpm --filter @mylife/mobile test` -> pass (37 files, 79 tests).
- `pnpm --filter @mylife/web test` -> pass (31 files, 175 tests).
- `pnpm --filter @mylife/mobile test:coverage` -> pass.
  - Mobile now: lines/statements `53.26%`, branches `74.07%`, functions `80.06%`.
- `pnpm --filter @mylife/web test:coverage` -> pass.
  - Web now: lines/statements `47.69%`, branches `70.30%`, functions `56.72%`.
- `pnpm --filter @mylife/books test:coverage` -> pass.
  - Books remains: lines/statements `53.37%`, branches `67.45%`, functions `97.1%`.

### Entry 2026-02-25.13 — MyWords Completeness Pass + Standalone Verification
**Phase:** Words quality and isolation completion
**What happened:** Finished the richer MyWords result model rollout by closing the remaining mobile gaps and validating both the standalone `MyWords/` workspace and MyLife hub words module behavior.

- Mobile words screen now mirrors richer hub result sections:
  - Added `Chronology` and `Word Family` sections in `apps/mobile/app/(words)/index.tsx`.
  - Replaced static nearby words text with tappable chips that trigger direct lookup for the selected related word.
- Expanded tests to lock behavior:
  - Added nearby-word interaction test in `apps/mobile/app/(words)/__tests__/index.test.tsx`.
  - Extended `modules/words/src/__tests__/words.test.ts` to assert chronology and word-family enrichment.
- Re-verified standalone runtime (isolation track) and hub track checks.

**Verification:**
- `pnpm --filter @mylife/words test` -> pass.
- `pnpm --filter @mylife/mobile test -- "app/(words)/__tests__/index.test.tsx"` -> pass.
- `pnpm typecheck` -> pass.
- `pnpm --dir MyWords typecheck` -> pass.
- `pnpm --dir MyWords --filter @mywords/web build` -> pass.
- `pnpm --dir MyWords --filter @mywords/mobile dev -- --help` -> pass.

### Entry 2026-02-25.14 — E-Reader Foundation in MyLife + MyBooks
**Phase:** Books reader expansion
**What happened:** Implemented a new local-first e-reader system for both the MyLife books module and standalone MyBooks app with upload parsing, reading progress, highlights, bookmarks, notes, and per-document reader preferences.

- Added reader data layer in `@mylife/books`:
  - New schema/models for reader documents, notes, and preferences.
  - New DB CRUD modules and migration `v3` (schemaVersion `3`) in `modules/books`.
  - New upload parser with EPUB + text/markdown/html/json/rtf support in `modules/books/src/reader/`.
  - Added tests: `modules/books/src/db/__tests__/reader.test.ts` and `modules/books/src/reader/__tests__/parse-upload.test.ts`.
- Added MyLife app integration:
  - Mobile: reader tab and screens for upload + reading + note/highlight/bookmark workflows (`apps/mobile/app/(books)/reader/*`).
  - Web: new `/books/reader` and `/books/reader/[id]` pages plus server actions for reader CRUD in `apps/web/app/books/actions.ts`.
  - Updated books web subnav with a Reader entry.
- Added standalone MyBooks integration:
  - Shared package: reader schema migration `v2`, CRUD modules, parser exports, and DB tests.
  - Mobile: new Reader tab (`app/(tabs)/reader.tsx`) and document reader detail route (`app/reader/[id].tsx`).
  - Web: replaced placeholder home with a local-first reader interface (upload, read, notes/highlights/bookmarks, preferences).

**Verification:**
- `pnpm --filter @mylife/books test` -> pass.
- `pnpm --filter @mylife/mobile typecheck` -> pass.
- `pnpm --filter @mylife/web typecheck` -> pass.
- `pnpm --filter @mylife/web test -- app/books/__tests__/` -> pass.
- `pnpm --filter @mybooks/shared test` -> pass.
- `pnpm --filter @mybooks/mobile typecheck` -> pass.
- `pnpm --filter @mybooks/web typecheck` -> pass.

### Entry 2026-02-25.15 — Added PDF/MOBI/AZW Reader Upload Support
**Phase:** Reader format expansion
**What happened:** Expanded the reader parser and upload pipelines to support additional Kindle-style formats beyond EPUB/text.

- Reader parser updates in both `@mylife/books` and `@mybooks/shared`:
  - Added support flags for `pdf`, `mobi`, `azw`, and `azw3`.
  - Added binary-file detection (extension + MIME) and base64 decode path.
  - Implemented PDF text extraction for common text operators (`Tj`/`TJ`) with fallback printable-text extraction.
  - Implemented MOBI/AZW/AZW3 fallback extraction that prefers embedded HTML payloads and then printable UTF-8/Latin text.
- Uploader flow updates:
  - MyLife mobile/web and MyBooks mobile/web reader upload UIs now accept/select PDF/MOBI/AZW/AZW3 and pass base64 payloads for binary parsing.
- Test coverage updates:
  - Extended `modules/books/src/reader/__tests__/parse-upload.test.ts` with PDF + MOBI/AZW cases.
  - Added mirrored parser tests in standalone MyBooks at `MyBooks/packages/shared/src/reader/__tests__/parse-upload.test.ts`.

**Verification:**
- `pnpm --filter @mylife/books test` -> pass (includes new parser tests).
- `pnpm --filter @mylife/mobile typecheck` -> pass.
- `pnpm --filter @mylife/web typecheck` -> pass.
- `pnpm --filter @mybooks/shared test` -> pass (includes new parser tests).
- `pnpm --filter @mybooks/mobile typecheck` -> pass.
- `pnpm --filter @mybooks/web typecheck` -> pass.

### Entry 2026-02-25.16 — MyWords Word Helper (Contextual Replacements)
**Phase:** Words UX expansion
**What happened:** Added a new `Word Helper` capability that lets users provide a sentence, select a target word, and receive replacement options grounded in known dictionary/thesaurus data with context-aware ranking.

- Added shared words-domain API and types:
  - New `suggestWordReplacements` service in `modules/words/src/service.ts`.
  - New helper result/input contracts in `modules/words/src/types.ts` and exports in `modules/words/src/index.ts`.
  - Datamuse contextual meaning integration (`ml` + `lc` + `rc`) for English ranking in `modules/words/src/api/datamuse.ts`.
- Added web integration:
  - New server action `suggestWordReplacementsAction` in `apps/web/app/words/actions.ts`.
  - Added a new `Word Helper` tab in `apps/web/app/words/page.tsx` with sentence input, selectable sentence words, replacement suggestions, and in-context preview sentences.
- Added module metadata updates so Word Helper is part of MyWords tab definitions in both runtime module definition and registry metadata:
  - `modules/words/src/definition.ts`
  - `packages/module-registry/src/constants.ts`
- Added unit tests for helper behavior in `modules/words/src/__tests__/words.test.ts`.

**Verification:**
- `pnpm --filter @mylife/words typecheck` -> pass.
- `pnpm --filter @mylife/words test` -> pass.
- `pnpm --filter @mylife/module-registry typecheck` -> pass.
- `pnpm --filter @mylife/web typecheck` -> pass.
- `pnpm --filter @mylife/web test -- --run app/__tests__/actions-enabled-modules.test.ts app/__tests__/discover-page.test.tsx components/__tests__/sidebar.test.tsx` -> pass.
- `pnpm --filter @mylife/mobile typecheck` -> pass.

### Entry 2026-02-26.01 - MyWords Web Passthrough Parity Conversion
**Phase:** Standalone parity hardening
**What happened:** Converted MyWords web integration from hub-side adapter UI to strict standalone passthrough and added parity enforcement for wrapper + host wiring.

- Replaced hub `words` web route implementation with a thin wrapper in `apps/web/app/words/page.tsx`:
  - `export { default } from '@mywords-web/app/page';`
- Removed obsolete hub-only server wiring file `apps/web/app/words/actions.ts`.
- Added standalone alias wiring in `apps/web/tsconfig.json`:
  - `@mywords-web/* -> ../../MyWords/apps/web/*`
  - `@mywords/shared -> ../../MyWords/packages/shared/src/index.ts`
  - `@mywords/shared/* -> ../../MyWords/packages/shared/src/*`
- Updated parity matrix and strict passthrough tests in `apps/web/test/parity/standalone-passthrough-matrix.test.ts`:
  - Marked `MyWords` web parity mode as `passthrough`.
  - Added words wrapper inventory + exact file-content assertions.
  - Added host wiring assertions for MyWords aliases.
- Synced persistent parity rules in `AGENTS.md` and `CLAUDE.md` to include passthrough module enforcement that now covers `books`, `habits`, `words`, and `workouts`.
- Updated parity docs:
  - `docs/standalone-parity-universal-implementation-plan.md` (MyWords web mode now `passthrough`).
  - `docs/standalone-parity-test-cases.md` (updated to 82 cases with budget/books/words passthrough enforcement entries).

**Verification:**
- `pnpm --filter @mylife/web test:parity` -> pass (`82` tests).
- `pnpm check:parity` -> pass.

### Entry 2026-02-26.02 - MyBudget Web Passthrough Parity Conversion
**Phase:** Standalone parity hardening
**What happened:** Converted MyBudget web integration from adapter UI to strict standalone passthrough and added parity enforcement for wrapper + host wiring.

- Replaced hub `budget` web route implementation with a thin wrapper in `apps/web/app/budget/page.tsx`:
  - `export { default } from '@mybudget-web/app/page';`
- Added standalone alias wiring for MyBudget in `apps/web/tsconfig.json`:
  - `@mybudget-web/* -> ../../MyBudget/apps/web/*`
  - `@mybudget/shared -> ../../MyBudget/packages/shared/src/index.ts`
  - `@mybudget/shared/* -> ../../MyBudget/packages/shared/src/*`
  - `@mybudget/ui -> ../../MyBudget/packages/ui/src/index.ts`
  - `@mybudget/ui/* -> ../../MyBudget/packages/ui/src/*`
- Added MyBudget transpilation support in `apps/web/next.config.ts`:
  - `@mybudget/shared`
  - `@mybudget/ui`
- Updated parity matrix and strict passthrough tests in `apps/web/test/parity/standalone-passthrough-matrix.test.ts`:
  - Marked `MyBudget` web parity mode as `passthrough`.
  - Added budget wrapper inventory + exact file-content assertions.
  - Added host wiring assertions for MyBudget aliases/transpilation.
- Updated `scripts/check-passthrough-parity.mjs` to include budget passthrough checks and wiring validation.
- Replaced outdated adapter-focused budget page test with passthrough assertions in `apps/web/app/budget/__tests__/budget-page.test.tsx`.
- Updated `docs/standalone-parity-universal-implementation-plan.md` current integration state for MyBudget web mode to `passthrough`.

**Verification:**
- `pnpm --filter @mylife/web test:parity` -> pass (`82` tests).
- `node scripts/check-passthrough-parity.mjs` -> pass.
- `pnpm --filter @mylife/web exec vitest run app/budget/__tests__/budget-page.test.tsx` -> pass.
- `pnpm check:parity` -> pass.

### Entry 2026-02-25.17 — Fixed Turbopack Module-Not-Found for MyWorkouts Source Imports
**Phase:** MyLife web stability (standalone passthrough)
**What happened:** Resolved the workouts route build failures in MyLife caused by relative `*.js` imports/exports inside TypeScript source under the `MyWorkouts` submodule. Turbopack resolves source files directly and failed on paths like `./auth/index.js` when only `.ts` existed.

- Updated MyWorkouts source imports/exports to extensionless relative paths in:
  - `MyWorkouts/packages/shared/src/**`
  - `MyWorkouts/packages/supabase/src/**`
  - `MyWorkouts/packages/ui/src/index.ts`
- Confirmed no remaining relative `*.js` specifiers in MyWorkouts TS/TSX source.
- Verified MyLife workouts passthrough routes compile and load without module-not-found errors.

**Verification:**
- `pnpm --dir MyWorkouts --filter @myworkouts/shared typecheck` -> pass.
- `pnpm --dir MyWorkouts --filter @myworkouts/supabase typecheck` -> pass.
- `pnpm --dir MyWorkouts --filter @myworkouts/ui typecheck` -> pass.
- `pnpm --dir MyWorkouts --filter @myworkouts/web typecheck` -> pass.
- `pnpm --filter @mylife/web test -- --run test/parity/standalone-passthrough-matrix.test.ts` -> pass (82 tests).
- Route checks in running MyLife dev server:
  - `/workouts`
  - `/workouts/builder`
  - `/workouts/explore`
  - `/workouts/progress`
  - `/workouts/recordings`
  - `/workouts/recordings/1`
  - `/workouts/workout/1`
  - `/workouts/exercise/1`
  All returned HTTP `200` and no module-not-found overlays.

### Entry 2026-02-26.03 - MyWorkouts Invalid Exercise Route Auto-Recovery
**Phase:** MyLife web stability (workouts passthrough UX hardening)
**What happened:** Fixed the remaining broken-state flow where navigating to an invalid workouts exercise detail URL in MyLife showed a dead-end "Exercise not found" view.

- Updated `MyWorkouts/apps/web/app/exercise/[id]/page.tsx` to auto-recover invalid/missing exercise IDs:
  - Added guarded async fetch with cancellation safety.
  - On missing record or query error, route now `replace`s to `workoutsPath('/explore')`.
  - Replaced dead-end fallback message with a transient redirect state (`Redirecting to Explore...`) and manual fallback button.
- Kept hub route parity intact by changing only the standalone page used by passthrough wrappers.

**Verification:**
- `pnpm --dir MyWorkouts --filter @myworkouts/web typecheck` -> pass.
- `pnpm --filter @mylife/web test -- --run test/parity/standalone-passthrough-matrix.test.ts` -> pass (82 tests).
- Browser validation (Playwright) against running MyLife dev server:
  - Visit `http://localhost:3000/workouts/exercise/1`
  - Auto-redirects to `http://localhost:3000/workouts/explore`
  - No "Exercise not found" text remains.

### Entry 2026-02-26.03 - Restored Rich MyWords UI on Web Passthrough
**Phase:** MyWords parity + UX restoration
**What happened:** Restored the previously shipped MyWords web experience (Search + Dictionary A-Z + Thesaurus A-Z + Word Helper + expanded lexical detail) by upgrading standalone MyWords source so passthrough keeps the richer UI.

- Replaced standalone web page `MyWords/apps/web/app/page.tsx` with the richer tabbed interface implementation used before passthrough.
- Extended standalone shared words domain to include parity APIs/features required by that UI:
  - Added `browseWordsAlphabetically` and `suggestWordReplacements`.
  - Added lookup enrichments/fields including `chronology` and `wordFamily`.
  - Added shared API modules under `MyWords/packages/shared/src/api/*` and split service/types (`service.ts`, `types.ts`).
- Updated standalone shared exports in `MyWords/packages/shared/src/index.ts` and added `zod` dependency in `MyWords/packages/shared/package.json`.
- Updated standalone web global tokens in `MyWords/apps/web/app/globals.css` to support the richer UI style variables.
- Fixed standalone mobile type safety after shared type expansion by guarding optional lookup fields in `MyWords/apps/mobile/app/index.tsx`.

**Verification:**
- `pnpm --dir MyWords typecheck` -> pass.
- `pnpm --filter @mylife/web test:parity` -> pass (`82` tests).

### Entry 2026-02-26.04 - Fixed MyWorkouts Exercise Loading + Hub Visual Parity Shell
**Phase:** MyLife + standalone MyWorkouts parity hardening
**What happened:** Resolved exercise library loading failures in both standalone MyWorkouts and MyLife passthrough, and reduced visual mismatch in hub rendering.

- Added a built-in fallback exercise catalog in standalone shared package:
  - `MyWorkouts/packages/shared/src/exercise/catalog-seed.json` (seed dataset)
  - `MyWorkouts/packages/shared/src/exercise/catalog.ts` (`DEFAULT_EXERCISES`, `getDefaultExercises`)
  - Exported via `MyWorkouts/packages/shared/src/exercise/index.ts`
- Added resilient loader utility:
  - `MyWorkouts/apps/web/lib/exercises.ts`
  - Tries Supabase first; if empty/error/unauth, falls back to built-in catalog.
- Updated key pages to use resilient exercise loading:
  - `MyWorkouts/apps/web/app/explore/page.tsx` now uses explicit loading state and fallback catalog (no infinite "Loading exercises...").
  - `MyWorkouts/apps/web/app/workouts/builder/page.tsx` now hydrates from fallback catalog when Supabase is unavailable.
  - `MyWorkouts/apps/web/app/exercise/[id]/page.tsx` now resolves fallback exercise IDs before redirecting.
- Improved MyLife web visual parity for workouts routes:
  - Added `apps/web/app/workouts/layout.tsx` to render a light MyWorkouts shell with module-local nav, matching standalone styling direction while keeping hub sidebar.
- Build/type support updates:
  - `MyWorkouts/packages/shared/tsconfig.json` now includes JSON files.
  - `MyWorkouts/apps/web/tsconfig.json` now maps `@myworkouts/shared` to workspace source for correct type resolution.

**Verification:**
- `pnpm --dir MyWorkouts --filter @myworkouts/shared typecheck` -> pass.
- `pnpm --dir MyWorkouts --filter @myworkouts/web typecheck` -> pass.
- `pnpm --filter @mylife/web test -- --run test/parity/standalone-passthrough-matrix.test.ts` -> pass (82 tests).
- Browser checks (Playwright):
  - `http://localhost:3001/explore` -> exercises render, not stuck loading.
  - `http://localhost:3000/workouts/explore` -> exercises render, not stuck loading.
  - `http://localhost:3000/workouts` -> light MyWorkouts shell present with module-local nav.

### Entry 2026-02-26.05 - MyBooks Web Passthrough Conversion + Strict Parity Gate
**Phase:** Standalone parity hardening (MyBooks)
**What happened:** Converted MyBooks web integration to passthrough wrappers and enforced strict wrapper + host wiring checks.

- Replaced MyLife books web runtime routes with thin passthrough wrappers:
  - `apps/web/app/books/layout.tsx`
  - `apps/web/app/books/page.tsx`
  - `apps/web/app/books/search/page.tsx`
  - `apps/web/app/books/import/page.tsx`
  - `apps/web/app/books/stats/page.tsx`
  - `apps/web/app/books/reader/page.tsx`
  - `apps/web/app/books/reader/[id]/page.tsx`
  - `apps/web/app/books/[id]/page.tsx`
- Added standalone canonical route surfaces in MyBooks to support direct host reuse:
  - `MyBooks/apps/web/app/books/layout.tsx`
  - `MyBooks/apps/web/app/books/page.tsx`
  - `MyBooks/apps/web/app/books/search/page.tsx`
  - `MyBooks/apps/web/app/books/import/page.tsx`
  - `MyBooks/apps/web/app/books/stats/page.tsx`
  - `MyBooks/apps/web/app/books/reader/page.tsx`
  - `MyBooks/apps/web/app/books/reader/[id]/page.tsx`
  - `MyBooks/apps/web/app/books/[id]/page.tsx`
- Added/verified host wiring for passthrough:
  - `apps/web/tsconfig.json` aliases for `@mybooks-web/*` and `@mybooks/shared`.
  - `apps/web/next.config.ts` transpilation for `@mybooks/shared` and `@mybooks/ui`.
- Updated parity declarations and strict checks:
  - `apps/web/test/parity/standalone-passthrough-matrix.test.ts` sets MyBooks web mode to `passthrough` and adds Books passthrough enforcement.
  - `scripts/check-passthrough-parity.mjs` adds Books inventory/content/wiring assertions.

**Verification:**
- `pnpm test:parity-matrix` -> pass (`82` tests).
- `pnpm check:passthrough-parity` -> pass.
- `node scripts/check-passthrough-parity.mjs` -> pass.
- `pnpm check:parity` -> pass.

**Next steps:**
1. Expand standalone MyBooks web so each `apps/web/app/books/**` route owns unique UI/behavior instead of temporary route-level re-exports.
2. Add route-specific MyBooks standalone tests for books web screens (`library`, `search`, `import`, `stats`, `reader`, `book detail`) and assert parity from hub wrappers.
3. Plan mobile passthrough conversion for MyBooks (`apps/mobile/app/(books)/**`) to move from `adapter` to `passthrough` mode.

### Entry 2026-02-26.06 - MyBooks Passthrough Commit + PR Handoff
**Phase:** Standalone parity hardening (handoff)
**What happened:** Landed an individual MyBooks passthrough commit on `feature/mysurf-full-parity` and published corresponding PR references.

- Committed MyBooks web passthrough wrappers in MyLife under `apps/web/app/books/**`.
- Updated host wiring in `apps/web/tsconfig.json` and `apps/web/next.config.ts` for standalone MyBooks imports.
- Added strict passthrough inventory/wrapper checks in `scripts/check-passthrough-parity.mjs`.
- Updated submodule pointer `MyBooks` to commit `98c8586`.
- Published branch commit in MyLife: `7caf22b`.
- Linked MyBooks submodule PR: `https://github.com/tshuldberg/MyBooks/pull/2`.

**Verification:**
- `pnpm test:parity-matrix` -> pass.
- `pnpm check:passthrough-parity` -> pass.
- `pnpm check:parity` -> pass.

**Next steps:**
1. Merge `MyBooks` PR #2, then sync the submodule pointer if rebased.
2. Finish standalone-owned implementations for each `MyBooks/apps/web/app/books/**` route.
3. Implement and gate MyBooks mobile passthrough parity.

### Entry 2026-03-08.01 - Phase 2 MyRecipes Module Consolidation
**Phase:** Phase 2 consolidation
**What happened:** Expanded the hub recipes module from a narrow CRUD adapter into a richer MyRecipes domain package and wired the new pantry and structured ingredient behavior into the mobile recipes flow.

- Added a new recipes migration layer for structured ingredient columns plus pantry inventory tables and pantry staple seeds in `modules/recipes/src/db/schema.ts` and `modules/recipes/src/definition.ts`.
- Added standalone-derived recipes engines under `modules/recipes/src/` for ingredient parsing, text recipe parsing, quantity scaling, grocery list generation, pantry normalization, pantry matching, pantry deduction, and shared formatting utilities.
- Added `modules/recipes/src/db/pantry.ts` and expanded `modules/recipes/src/db/crud.ts` and `modules/recipes/src/db/mygarden.ts` to support structured ingredients, pantry-aware shopping lists, richer cooking helpers, garden dashboards, harvest linking, and richer event helpers.
- Updated mobile recipes screens to use the richer module APIs:
  - `apps/mobile/app/(recipes)/add-recipe.tsx` now parses ingredient lines and detects timers from step text.
  - `apps/mobile/app/(recipes)/recipe/[id].tsx` now uses structured ingredients and serving-based scaling.
  - `apps/mobile/app/(recipes)/cooking-mode.tsx` now renders structured ingredient data.
  - `apps/mobile/app/(recipes)/garden.tsx` and `apps/mobile/app/(recipes)/events.tsx` now use module helpers instead of inline SQL.
  - Added `apps/mobile/app/(recipes)/pantry.tsx` and linked it from the recipes home screen.
- Added focused tests for the parser, scaler, grocery merge, pantry expiration, and pantry database behavior.
- Kept the existing `apps/web/app/recipes/**` passthrough strategy intact for this turn because current web parity in MyLife still treats standalone recipes web as the source of truth.

**Verification:**
- `pnpm --filter @mylife/recipes typecheck` -> pass.
- `pnpm --filter @mylife/recipes test` -> pass (`8` files, `43` tests).
- `pnpm --filter @mylife/mobile test -- app/'(recipes)'/__tests__/index.test.tsx` -> pass.
- `pnpm gate:function:changed` -> fails on pre-existing mobile typecheck errors outside Phase 2 in `apps/mobile/app/(hub)/discover.tsx`, `packages/billing-config/src/index.ts`, and `packages/subscription/src/revenuecat.ts`.

**Next steps:**
1. Decide whether to move recipes mobile from adapter mode toward deeper standalone UI reuse, matching the current web passthrough strategy.
2. Resolve the pre-existing mobile typecheck failures so `pnpm gate:function:changed` can pass in a dirty workspace.
3. Add follow-on recipes UI for pantry matching, expiring-item suggestions, and import flows now that the underlying module support exists.

### Entry 2026-03-08.02 - Batch2 Scaffold Pass (MyPets, MyJournal, MyFlash, MyCloset)
**Phase:** Scaffold 13 Batch2 module build-out
**What happened:** Completed the second scaffold batch in order and compared each module against its spec while building.

- Added new hub modules with local-first schema, CRUD, dashboard helpers, tests, and exports:
  - `modules/pets/src/**`
  - `modules/journal/src/**`
  - `modules/flash/src/**`
  - `modules/closet/src/**`
- Wired all four modules into shared app infrastructure:
  - `apps/mobile/app/_layout.tsx`
  - `apps/mobile/components/DatabaseProvider.tsx`
  - `apps/mobile/hooks/use-module-toggle.ts`
  - `apps/mobile/package.json`
  - `apps/web/components/Providers.tsx`
  - `apps/web/lib/db.ts`
  - `apps/web/lib/modules.ts`
  - `apps/web/package.json`
- Added module route groups and screens for mobile and web:
  - `apps/mobile/app/(pets)/**`, `apps/web/app/pets/**`
  - `apps/mobile/app/(journal)/**`, `apps/web/app/journal/**`
  - `apps/mobile/app/(flash)/**`, `apps/web/app/flash/**`
  - `apps/mobile/app/(closet)/**`, `apps/web/app/closet/**`
- Confirmed implemented-vs-spec gaps during the pass:
  - `pets`: delivered profiles, health/reminders, medications, weight, expenses; still missing docs/photos, grooming/training/exercise history, sitter export, alerts, richer sharing/export.
  - `journal`: delivered dated entries, tags, moods, search, streak/stats; still missing richer editor, prompts, attachments, encryption/biometrics, FTS5, export, therapy/template features.
  - `flash`: delivered decks, card creation, due queue, lightweight scheduler, review logs, dashboard; still missing FSRS depth, media/cloze, import/export, bury/suspend, browser, reminders, AI/shared deck features.
  - `closet`: delivered wardrobe items, tags, outfits, wear logs, donation suggestions, value analytics; still missing media capture, laundry and packing flows, richer filtering, AI suggestions, capsule/wishlist/style-board features, export.

**Decision:** Keep Batch2 focused on durable local-first module foundations with runnable schema, CRUD, and core screens instead of trying to close every spec edge in one pass. This keeps the hub modules usable now and leaves a clear gap list for the next feature pass.

**Files created/modified:** Four new module packages, four new mobile route groups, four new web route groups, and shared registry/database wiring across mobile and web.

#### Confusion Point 1 (re-review of 2026-03-08.01 gate failures): shared gate blockers vs module-local verification
**Updated finding:** The same host-level blockers still hold. `pnpm gate:function:changed` fails in `apps/mobile/app/(hub)/discover.tsx`, `packages/billing-config/src/index.ts`, and `packages/subscription/src/revenuecat.ts`, while all four Batch2 packages pass their own `typecheck` and `test` runs. That means package-local verification is currently the reliable progress signal for scaffold batches until the shared billing and entitlement work is repaired.

**Skill opportunity:** A scaffold-batch parity audit skill could read the active plan, compare module exports/routes against spec bullets, and emit a standard gap checklist plus timeline entry before final sign-off.

### Entry 2026-03-09.01 - Phase 1 Start: Billing Webhook Hardening
**Phase:** MyLife production readiness, Phase 1 platform hardening
**What happened:** Started Phase 1 with the highest-risk production blocker in the live codepath: the web billing webhook was still protected by a shared header key instead of signed raw-body verification.

- Replaced the billing webhook route auth contract in `apps/web/app/api/webhooks/billing/route.ts`:
  - requires `STRIPE_WEBHOOK_SECRET` plus `MYLIFE_ENTITLEMENT_SECRET`
  - verifies the raw request body against the `Stripe-Signature` header before JSON parsing
  - removes dependence on `x-billing-webhook-key`
- Added a dedicated signature verifier in `apps/web/lib/billing/webhook-signature.ts` with focused unit coverage in `apps/web/lib/billing/__tests__/webhook-signature.test.ts`.
- Added route-level tests in `apps/web/app/api/webhooks/billing/__tests__/route.test.ts` to cover missing secrets, invalid signatures, invalid JSON, invalid payloads, and the success path.
- Updated the web API smoke test contract in `apps/web/e2e/api-auth-and-pipeline.spec.ts` and Playwright env in `apps/web/playwright.config.ts` to use `STRIPE_WEBHOOK_SECRET` and `Stripe-Signature`.
- Updated the billing ops runbook in `docs/billing/access-automation-operations.md` to document the new webhook env var and header contract.
- Fixed a related production config gap in `packages/billing-config/src/index.ts` by adding canonical billing SKUs, entitlement defaults, the disputed event type, and the missing standalone module SKU catalog entries that current billing code already depends on.

**Verification:**
- `pnpm --filter @mylife/web exec vitest run app/api/webhooks/billing/__tests__/route.test.ts lib/billing/__tests__/webhook-signature.test.ts` -> pass (`2` files, `11` tests).
- `pnpm --filter @mylife/billing-config typecheck` -> pass.
- `pnpm --filter @mylife/subscription test` -> pass (`38` tests).
- `pnpm --filter @mylife/web exec vitest run lib/billing/__tests__/entitlement-issuer.test.ts` -> fails on a pre-existing `@mylife/entitlements` export mismatch (`createEntitlementSignature` missing from the package surface).
- `pnpm --filter @mylife/web exec playwright test e2e/api-auth-and-pipeline.spec.ts` -> blocked by a pre-existing Next.js app boot issue from `packages/module-registry/src/hooks.ts` being pulled into the server graph.
- `pnpm gate:function:changed` -> fails before it reaches these web changes because the dirty worktree includes unrelated mobile files and the gate trips on a pre-existing `@mylife/entitlements` export error in `apps/mobile/app/(hub)/discover.tsx`.

**Decision:** Treat this as the first completed Phase 1 hardening slice. The webhook route is now materially safer, but the broader Phase 1 validation track is still blocked by pre-existing entitlement package drift and a separate web app boot issue that need their own repair pass.

### Entry 2026-03-09.02 - Phase 1 Follow-up: Entitlement Surface Repair
**Phase:** MyLife production readiness, Phase 1 platform hardening
**What happened:** Completed the next blocking repair after webhook hardening by splitting the entitlements package into client-safe and server-only surfaces, then rewired the web billing code to use the server subpath.

- Added missing entitlement schemas and types in `packages/entitlements/src/schema.ts` and `packages/entitlements/src/types.ts`, including `PlanMode`, signed entitlement payloads, and the runtime expiry helper surface.
- Moved signature creation and verification behind a server-only export:
  - `packages/entitlements/src/server.ts`
  - `packages/entitlements/src/verify.ts`
  - `packages/entitlements/package.json`
- Kept the root package export client-safe in `packages/entitlements/src/index.ts` so mobile and web UI code do not pull `node:crypto` into the bundle.
- Fixed the server graph issue in `packages/entitlements/src/schema.ts` by importing `ModuleIdSchema` from `@mylife/module-registry/types` instead of the package root, and added that subpath export in `packages/module-registry/package.json`.
- Updated the web billing consumers to use the new server-only entrypoint:
  - `apps/web/lib/billing/entitlement-issuer.ts`
  - `apps/web/lib/entitlements.ts`
- Added focused package coverage in `packages/entitlements/src/__tests__/verify.test.ts`.
- Repaired mobile test harness drift in `apps/mobile/test/setup.tsx` and updated stale hub tests in:
  - `apps/mobile/app/(hub)/__tests__/dashboard.test.tsx`
  - `apps/mobile/app/(hub)/__tests__/discover.test.tsx`
  so the changed-function gate could get past the unrelated mobile failures caused by the dirty worktree.

**Verification:**
- `pnpm --filter @mylife/entitlements test` -> pass.
- `pnpm --filter @mylife/entitlements typecheck` -> pass.
- `pnpm --filter @mylife/mobile typecheck` -> pass.
- `pnpm --filter @mylife/mobile exec vitest run app/'(hub)'/__tests__/discover.test.tsx app/'(hub)'/__tests__/dashboard.test.tsx app/'(fast)'/__tests__/settings.test.tsx` -> pass (`3` files, `6` tests).
- `pnpm --filter @mylife/web exec vitest run lib/billing/__tests__/entitlement-issuer.test.ts app/api/webhooks/billing/__tests__/route.test.ts lib/billing/__tests__/webhook-signature.test.ts` -> pass (`3` files, `15` tests).
- `pnpm --filter @mylife/web exec playwright test e2e/api-auth-and-pipeline.spec.ts` -> pass after the client/server export split removed the `node:crypto` bundle leak.
- `pnpm gate:function:changed` -> still fails, but now on pre-existing `apps/web` typecheck drift outside this slice: missing passthrough module imports, duplicate `* 2.tsx` files, and standalone package type errors under `MyBooks`, `MyBudget`, `MyHabits`, `MySurf`, and `MyFast`.

**Decision:** Phase 1 billing and entitlement hardening is complete at the feature level. The remaining gate failure is now a broader workspace hygiene problem in `apps/web`, not a blocker inside the webhook or entitlement implementation itself.

### Entry 2026-03-09.03 - Phase 1 Web Hygiene: Standalone Passthrough Type Isolation
**Phase:** MyLife production readiness, Phase 1 platform hardening
**What happened:** Cleared the remaining `apps/web` validation blocker by isolating standalone passthrough routes from hub typechecking and excluding accidental duplicate route files from the TypeScript program.

- Updated `apps/web/tsconfig.json` so standalone web route aliases resolve to a local declaration shim first, instead of forcing the hub typechecker to crawl standalone source trees that expect their own `@/` alias roots.
- Preserved the active standalone path targets as secondary entries for the modules that parity checks already track (`fast`, `words`, `homes`, `car`, `surf`, and `habits`), so the host wiring still documents the canonical runtime source.
- Added `apps/web/types/standalone-route-module.d.ts` to declare the passthrough route surface for:
  - archived standalone web imports such as `@mybooks-web/*`, `@mybudget-web/*`, `@myrecipes-web/*`, and `@myworkouts-web/*`
  - active passthrough imports such as `@myfast-web/*`, `@myhabits-web/*`, `@mywords-web/*`, `@myhomes-web/*`, `@mycar-web/*`, and `@mysurf-web/*`
- Excluded accidental duplicate files such as `* 2.tsx` and `* 3.tsx` from the `apps/web` TypeScript program so typecheck reflects canonical files only.

**Why this was needed:** The hub web app was typechecking external standalone app source directly through tsconfig path aliases. That breaks when a standalone app uses its own local aliasing (`@/components`, `@/lib`, and similar) or when the standalone has already been archived and the source tree no longer exists. The result was a false-negative `apps/web` gate failure that blocked unrelated billing and entitlement work from closing.

**Verification:**
- `pnpm --filter @mylife/web typecheck` -> pass.
- `pnpm --filter @mylife/web exec vitest run test/parity/standalone-passthrough-matrix.test.ts` -> pass (`116` tests).
- `pnpm check:passthrough-parity` -> pass.
- `pnpm gate:function:changed` -> pass.

**Decision:** Treat standalone passthrough wrappers as a runtime integration concern and keep their type surface isolated inside the hub workspace. This keeps the production-readiness gate focused on real regressions in MyLife code instead of cross-project TypeScript leakage from standalone apps.

### Entry 2026-03-09.04 - Phase 1 Web Runtime Cleanup: Remove Archived Standalone Route Dependencies
**Phase:** MyLife production readiness, Phase 1 platform hardening
**What happened:** Removed the remaining archived standalone runtime imports from the web app for consolidated modules and replaced them with hub-owned implementations or explicit fallback routes.

- Replaced archived MyBooks passthrough wrappers with native hub pages:
  - `apps/web/app/books/layout.tsx`
  - `apps/web/app/books/page.tsx`
  - `apps/web/app/books/search/page.tsx`
  - `apps/web/app/books/import/page.tsx`
  - `apps/web/app/books/stats/page.tsx`
  - `apps/web/app/books/[id]/page.tsx`
  - `apps/web/app/books/reader/page.tsx`
  - `apps/web/app/books/reader/[id]/page.tsx`
  - `apps/web/app/books/ui.ts`
- Removed archived wrapper route files for consolidated web surfaces that no longer have standalone sources:
  - `budget`
  - `recipes`
  - `workouts`
- Added hub-owned catch-all fallback routes so those archived modules still resolve safely at runtime without importing deleted standalone packages:
  - `apps/web/app/budget/[[...slug]]/page.tsx`
  - `apps/web/app/recipes/[[...slug]]/page.tsx`
  - `apps/web/app/workouts/[[...slug]]/page.tsx`
  - `apps/web/components/module-web-fallback.tsx`
- Removed archived standalone transpile dependencies and alias declarations from the web workspace:
  - `apps/web/next.config.ts`
  - `apps/web/tsconfig.json`
  - `apps/web/types/standalone-route-module.d.ts`
- Re-enabled books page tests in `apps/web/vitest.config.ts` and trimmed parity expectations in `apps/web/test/parity/standalone-passthrough-matrix.test.ts` so validation reflects the current canonical runtime graph.
- Hardened the web typecheck loop in `apps/web/package.json` to regenerate Next route types before `tsc --noEmit`, preventing stale `.next/types` output from referencing deleted routes after cleanup.

**Why this was needed:** The previous web hygiene slice fixed type leakage, but the runtime route tree still depended on archived standalone package names for modules that have already been consolidated into the hub. That left the app vulnerable to runtime import failures and made route validation dependent on historical wrapper files that no longer matched the real product surface.

**Verification:**
- `pnpm --filter @mylife/web typecheck` -> pass after fresh `next typegen`.
- `pnpm --filter @mylife/web exec vitest run app/books/__tests__/library-page.test.tsx app/books/__tests__/search-page.test.tsx app/books/__tests__/import-page.test.tsx app/books/__tests__/stats-page.test.tsx app/books/__tests__/book-detail-page.test.tsx` -> pass (`5` files, `10` tests).
- `pnpm check:passthrough-parity` -> pass.
- `pnpm gate:function:changed` -> pass.

**Decision:** Archived standalone route wrappers are no longer acceptable as a production dependency for consolidated modules. If a module is archived, the hub must either own the route implementation directly or serve an intentional fallback surface from inside MyLife.

### Entry 2026-03-09.05 - Phase 1 Hardening: Hooks, Staged Commit Gate, and Budget Portability
**Phase:** MyLife production readiness, Phase 1 platform hardening
**What happened:** Added the missing workflow enforcement hooks and replaced the last fake Budget data-management actions with real export and reset behavior.

- Added repo-local Claude Code hook scripts under `.claude/hooks/`:
  - `_shared.mjs` for stdin parsing, git snapshot helpers, and hook I/O
  - `pretooluse-bash-policy.mjs` to block destructive Bash patterns and write-capable archive edits
  - `posttooluse-typescript-guard.mjs` to run targeted package typecheck after source edits and block `console.log` / `debugger`
  - `precompact-save-context.mjs` and `stop-save-context.mjs` to persist runtime recovery snapshots
- Wired those hooks in `.claude/settings.json`:
  - `PreToolUse` for Bash policy validation
  - `PostToolUse` for targeted TypeScript/debug checks
  - `PreCompact` and `Stop` for session-state persistence
  - updated `TaskCompleted` parity enforcement to stop swallowing stderr
- Added `.claude/memory/README.md` plus `.claude/memory/.gitignore` so hook-generated runtime state lives in `.claude/memory/runtime/` without polluting tracked files.
- Installed Husky, added the repo `prepare` script in `package.json`, and changed `.husky/pre-commit` to run `pnpm gate:function:changed --staged` so commit-time enforcement matches the dirty-worktree reality of this monorepo.
- Added shared Budget portability functions in `modules/budget/src/portability.ts`:
  - `buildBudgetExportBundle`
  - `serializeBudgetExportJson`
  - `exportBudgetTransactionsCsv`
  - `resetBudgetData`
- Exported the new portability surface through:
  - `modules/budget/src/db/schema.ts`
  - `modules/budget/src/db/index.ts`
  - `modules/budget/src/index.ts`
- Replaced the fake Budget mobile settings alerts in `apps/mobile/app/(budget)/settings.tsx`:
  - Export now offers real JSON backup and transactions CSV sharing
  - Reset now deletes Budget module data and restores default seed settings, accounts, and envelopes
- Added coverage for the new Budget portability and settings behavior:
  - `modules/budget/src/__tests__/portability.test.ts`
  - `apps/mobile/app/(budget)/__tests__/settings.test.tsx`
- Updated `scripts/check-workouts-parity.mjs` so the parity suite matches the current archived-route contract for MyWorkouts web catch-all fallback.
- Synced the persistent project rules in `AGENTS.md` and `CLAUDE.md` to document the hook stack, runtime memory snapshots, and staged pre-commit gate.

**Verification:**
- `pnpm --filter @mylife/budget typecheck` -> pass.
- `pnpm --filter @mylife/budget exec vitest run src/__tests__/portability.test.ts src/__tests__/budget.test.ts` -> pass (`2` files, `34` tests).
- `pnpm --filter @mylife/mobile exec vitest run app/'(budget)'/__tests__/settings.test.tsx app/'(budget)'/__tests__/index.test.tsx app/'(budget)'/__tests__/goals.test.tsx app/'(budget)'/__tests__/goal-forms.test.tsx` -> pass (`4` files, `11` tests).
- `printf '{"tool_input":{"command":"git reset --hard"}}' | node .claude/hooks/pretooluse-bash-policy.mjs` -> returns `decision:block`.
- `printf '{"tool_input":{"file_path":"modules/budget/src/portability.ts"}}' | node .claude/hooks/posttooluse-typescript-guard.mjs` -> pass.
- `printf '{}' | node .claude/hooks/precompact-save-context.mjs` and `printf '{}' | node .claude/hooks/stop-save-context.mjs` -> runtime memory snapshots written under `.claude/memory/runtime/`.
- `pnpm gate:function:changed` -> pass.
- `pnpm gate:function:changed --staged` -> pass (`No changed source files detected` in the current unstaged state).
- `pnpm check:parity` -> pass.

**Decision:** Phase 1 hardening now has working hook enforcement, commit-time guardrails, and at least one real suite export/delete implementation instead of placeholders. Phase 1 is materially closer to complete, but it is still not fully done at the suite level because cloud-backed module hardening and broader export/delete coverage remain open.

### Entry 2026-03-09.06 - Phase 2: Launch State Truth for GA and Beta Modules
**Phase:** MyLife production readiness, Phase 2 GA bundle completion
**What happened:** Added a shared launch-tier map for the suite and wired the main hub discovery and upgrade surfaces to reflect the agreed GA versus public-beta launch plan instead of treating every module as equally marketable.

- Added `packages/module-registry/src/release-states.ts` with the suite launch contract:
  - `GA_MODULE_IDS`
  - `PUBLIC_BETA_MODULE_IDS`
  - `MERGED_MODULE_IDS`
  - `USER_VISIBLE_MODULE_IDS`
  - `MODULE_RELEASE_STATES`
  - helpers for labels, descriptions, and visibility checks
- Re-exported the launch-state helpers through `packages/module-registry/src/index.ts`.
- Added registry coverage in:
  - `packages/module-registry/src/__tests__/release-states.test.ts`
  - `packages/module-registry/src/__tests__/index.test.ts`
- Updated mobile hub discovery and launch surfaces:
  - `apps/mobile/app/(hub)/discover.tsx` now shows `GA` / `BETA` badges and release descriptions per module
  - `apps/mobile/app/(hub)/discover.tsx` no longer surfaces `subs` as a standalone finance module
  - `apps/mobile/app/(hub)/index.tsx` now uses `USER_VISIBLE_MODULE_IDS` so merged modules do not appear as app icons
  - `apps/mobile/app/(hub)/settings.tsx` now describes the real launch promise: `9` GA modules plus `17` public-beta modules
- Updated web hub discovery and pricing-adjacent copy:
  - `apps/web/app/discover/page.tsx` now shows GA/beta badges, a GA-vs-beta summary, and launch-truth banner copy
  - `apps/web/app/settings/page.tsx` now describes the GA launch guarantee instead of claiming every module is part of the paid promise
- Added and updated UI tests for those launch-state surfaces:
  - `apps/mobile/app/(hub)/__tests__/dashboard.test.tsx`
  - `apps/mobile/app/(hub)/__tests__/discover.test.tsx`
  - `apps/mobile/app/(hub)/__tests__/settings.test.tsx`
  - `apps/web/app/__tests__/discover-page.test.tsx`
  - `apps/web/app/__tests__/settings-page.test.tsx`

**Why this was needed:** The production-readiness spec requires MyLife to launch honestly in tiers. Before this slice, the hub UI still implied that every module was part of the same paid promise, and mobile discovery still exposed `subs` as if it were an independent app even though it had already been folded into MyBudget.

**Verification:**
- `pnpm --filter @mylife/module-registry exec vitest run src/__tests__/release-states.test.ts src/__tests__/index.test.ts src/__tests__/registry.test.ts` -> pass (`3` files, `26` tests).
- `pnpm --filter @mylife/mobile exec vitest run app/'(hub)'/__tests__/dashboard.test.tsx app/'(hub)'/__tests__/discover.test.tsx app/'(hub)'/__tests__/settings.test.tsx` -> pass (`3` files, `7` tests).
- `pnpm --filter @mylife/web exec vitest run app/__tests__/discover-page.test.tsx app/__tests__/settings-page.test.tsx` -> pass (`2` files, `7` tests).
- `pnpm --filter @mylife/module-registry typecheck` -> pass.
- `pnpm --filter @mylife/mobile typecheck` -> pass.
- `pnpm --filter @mylife/web typecheck` -> pass.
- `pnpm gate:function:changed` -> pass.
- `pnpm check:parity --quiet` -> pass.

**Decision:** Launch state is now a shared executable contract instead of a document-only rule. The next Phase 2 work should either harden one GA-module bundle gap directly or continue propagating launch-truth copy into the remaining pricing and onboarding surfaces.
