# 2026-04-28 — DoWork standalone app extraction (P0-P4 + parity scaffold)

## Goal

Break the workouts module out of the MyLife hub into a standalone Expo app called **DoWork**, mirroring the BestChef extraction pattern (`apps/bestchef/`) for independent App Store + Play Store release.

## Scope decisions confirmed during planning

- **Brand:** new "gritty gym" identity — iron orange `#FF6B00` accent on matte black `#0B0B0E`. Re-uses Plus Jakarta Sans body type from `@mylife/workouts/ui`.
- **Cloud:** server-backed via Supabase (Auth + Postgres/RLS + Storage + Edge Functions). Mesh sync deliberately skipped for v1.
- **Cross-module insights:** stripped (mood / nutrition / fasting detectors). DoWork ships only `@mylife/workouts`.

Plan saved at `/Users/trey/.claude/plans/goofy-foraging-squirrel.md`.

## What landed

### P0 — App scaffolding ✓

- `apps/dowork/package.json` — `@mylife/dowork-app`, depends on `@mylife/workouts`, `@mylife/ui`, `@mylife/db`, `@mylife/auth`, `@mylife/sync`, `@mylife/module-registry`, `@supabase/supabase-js`, plus the standard Expo dep set
- `apps/dowork/app.json` — name DoWork, slug dowork, scheme dowork, bundle id `com.dowork.dowork`, dark UI, minimal en-only locale
- `apps/dowork/eas.json` — development / preview / production profiles
- `apps/dowork/metro.config.js` — workspace root watchFolders + `crypto` shim
- `apps/dowork/tsconfig.json` — extends `@mylife/typescript-config/react.json`, RN module resolution
- `apps/dowork/shims/crypto.js` — RN polyfill for `crypto.randomBytes` (used by `@mylife/sync`)
- `apps/dowork/app/_layout.tsx` — Stack with ErrorBoundary
- `apps/dowork/app/index.tsx` — redirect to `(root)/(tabs)`
- `apps/dowork/.gitignore`

### P1 — Brand system ✓

- `apps/dowork/app/(root)/theme/tokens.ts` — `DW_ACCENT`, `DW_SURFACES`, `DW_TEXT`, `DW_BORDER`, `DW_GLASS`, `DW_CTA_GRADIENT`, `DW_FEEDBACK`. Re-exports `WK_FONTS`, `WK_TYPOGRAPHY`, `WK_CATEGORY_COLORS`, `getWorkoutCategoryColor` from `@mylife/workouts` so screens reading those stay in sync.
- `apps/dowork/app/(root)/providers/AppThemeProvider.tsx` — `useAppThemeColors()` exposes the merged token map.

### P2 — Database + providers ✓

- `apps/dowork/app/(root)/providers/DatabaseProvider.tsx` — opens `dowork.db`, runs `WORKOUTS_MODULE.migrations` (V1-V6, 18 tables, `wk_` prefix), exposes `useDatabase()`. WAL journal mode + reset path.
- `apps/dowork/app/(root)/providers/DoWorkProvider.tsx` — minimal cross-screen state context.
- `apps/dowork/app/(root)/_layout.tsx` — provider stack: `DatabaseProvider → DoWorkCloudProvider → DoWorkProvider → AppThemeProvider → Stack`.
- `apps/dowork/app/(root)/components/ErrorBoundary.tsx` — DoWork-branded error UI.

### P3 — Cloud / Auth foundation ✓ (scaffold)

Supabase migrations (4 files under `supabase/migrations/20260428*`):

- `dowork_bootstrap.sql` — `dw_user_profiles` + public profile view, RLS for self-only writes
- `dowork_workout_shares.sql` — `dw_workout_shares` (private/followers/public), `dw_likes`, `dw_comments`. Public-read RLS with privacy gating.
- `dowork_trainer_videos.sql` — `dw_trainers`, `dw_trainer_videos` with angle / primary / sort metadata
- `dowork_moderation.sql` — `dw_reports` + `dw_moderation_decisions` (audited; service-role-only writes)

Edge function stubs (Deno):

- `supabase/functions/dowork-upload-finalize/index.ts` — signed upload finalizer; size + MIME caps per upload kind. Returns 501 until wired.
- `supabase/functions/dowork-delete-account/index.ts` — server-side wipe. Returns 501 until wired.

Client wiring:

- `apps/dowork/app/(root)/data/launch-environment.ts` — `getDoWorkCloudConfig()`, `isDoWorkPublicLaunchBuild()`, `getDoWorkAuthRedirectUrl()`. Mirrors BestChef's launch policy without BYO-provider concept.
- `apps/dowork/app/(root)/data/account.ts` — `ensureAnonymousSession`, `requestEmailMagicLink`, `requestPasswordReset`, `signOut`, `requestAccountDeletion`.
- `apps/dowork/app/(root)/providers/DoWorkCloudProvider.tsx` — Supabase client init via `expo-secure-store`-backed storage, anonymous session bootstrap, auth state listener, magic link / password reset / sign-out helpers.
- `apps/dowork/app/(root)/auth-callback.tsx` — deep-link handler that routes back to home or settings based on token / error params.

Runbook: `docs/runbooks/dowork-supabase-setup.md` documents project provisioning, migration apply, auth dashboard setup, Storage buckets, edge function deploy, and EAS env wiring.

### P4 — Tab nav + home screen ✓

- `apps/dowork/app/(root)/(tabs)/_layout.tsx` — 5-tab bottom bar (Home / Explore / Workouts / Progress / Profile) with iron orange active accent.
- `apps/dowork/app/(root)/(tabs)/_screen-kit.tsx` — `WorkoutHero`, `WorkoutSectionHeader`, `WorkoutTabScrollView`, `WorkoutPrimaryButton`, plus formatters (`formatMinutes`, `formatVolume`, `formatDeltaPercent`, `formatDateLabel`, `getDeltaTint`).
- `apps/dowork/app/(root)/(tabs)/index.tsx` — Home: stat strip (this week, volume, all-time), upcoming-plan card, recent sessions, recovered muscles chips, FAB to workouts tab. Reads real data from `seedWorkoutExerciseLibrary`, `getWorkoutDashboard`, `getWorkoutSessions`, `getWorkouts`, `getWorkoutPlans`, `getActivePlanSubscription`, `getCurrentPlanPosition`, `getTodaysWorkout`, `buildRecoveryMap`, `getBestToTrain`.
- `apps/dowork/app/(root)/(tabs)/explore.tsx` — Exercise library browser with category chip filters; routes to `/(root)/exercise/[id]` (added in P5 Batch A).
- `apps/dowork/app/(root)/(tabs)/workouts.tsx` — Saved-workouts list + Create CTA → `/(root)/builder` (P5 Batch A).
- `apps/dowork/app/(root)/(tabs)/progress.tsx` — Streak + total reps + history. Inline math against camelCase `WorkoutSession` (skipping the snake-case `progress.ts` engine path until a row-format adapter lands in P5 polish).
- `apps/dowork/app/(root)/(tabs)/settings.tsx` — Profile / cloud status rows + sign-out CTA when authenticated.

### P7 partial — QA scaffold ✓

- `scripts/check-dowork-parity.mjs` — verifies P0-P4 file presence, package.json deps, `app.json` bundle ids, `DW_ACCENT` + `#FF6B00` brand presence, cloud `dw_` prefix + no `bc_` leakage, `dowork.db` filename, `WORKOUTS_MODULE` migration wiring, and that the hub `(workouts)` surface stays intact.
- Wired into `package.json` `check:dowork-parity` script + appended to `check:parity` chain.
- `apps/dowork/app/__tests__/smoke.test.ts` — 12 vitest tests cover brand tokens (accent, surfaces, glass, text/border) and launch-environment policy (public-launch flags, Supabase HTTPS-only, prod-vs-staging gating, redirect URL allowlist). All green.

### P9 partial — Documentation ✓

- `apps/dowork/CLAUDE.md` — full architecture + design tokens + relationship to hub module + cloud architecture + public launch policy + session memory protocol.
- `apps/dowork/README.md` — quick-start commands.
- `apps/dowork/Tickets/launch-plan.md` — current phase status + remaining P5/P6/P8/P9 work itemized with adaptation rules per batch.
- Root `MyLife/CLAUDE.md` — added `apps/bestchef/` and `apps/dowork/` to the Architecture diagram, added `pnpm check:dowork-parity` to commands.
- `memory.md` — Project State row added, Sessions row added, Next Session Notes updated.

## What's still pending

- **P5 — Port 31 workout screens** in 8 batches (A-H). Adaptation rules + per-batch screen lists captured in `apps/dowork/Tickets/launch-plan.md`. Recommended approach: parallel sub-agents in `cmux` worktrees, one batch per agent.
- **P6 — Cloud-backed data helpers** for social feed / likes / comments / trainer videos. Lands after Batch H ports the social screens.
- **P8 — EAS + App Store provisioning.** Requires user-side interactive auth (Apple Developer Portal, App Store Connect, Google Play Console, EAS CLI init). Blocked on real account work; code-side plugins (`withSecurityHardening`, `withDataProtection`) can be ported from BestChef once user signals green light.
- **P9 polish** — Workspace `Apps/CLAUDE.md` + `Apps/AGENTS.md` updates, Open Brain capture once a launch milestone lands.

## Verification

- `pnpm install` succeeded (no DoWork-specific failures, only pre-existing peer warnings)
- `pnpm --filter @mylife/dowork-app typecheck` passes
- `pnpm --filter @mylife/dowork-app test` — 12/12 pass (smoke + launch policy)
- `pnpm check:dowork-parity` — all 50+ checks pass
- Hub `(workouts)` routes left untouched — extraction is additive, no regression risk to the hub

## Files changed

New files:
- 33 files under `apps/dowork/`
- 4 SQL migrations under `supabase/migrations/`
- 2 edge functions under `supabase/functions/`
- 1 runbook under `docs/runbooks/`
- 1 parity script under `scripts/`
- 1 session log under `docs/sessions/`

Modified files:
- `package.json` — `check:dowork-parity` script + `check:parity` chain
- `CLAUDE.md` — Architecture + Commands sections
- `memory.md` — Project State + Sessions + Next Session Notes

## Decisions to revisit

- **Brand color** — iron orange `#FF6B00` chosen for "gritty gym" feel. If user prefers a different palette during P1 polish, adjust `apps/dowork/app/(root)/theme/tokens.ts` (`DW_ACCENT`, `DW_ACCENT_LIGHT`, `DW_ACCENT_DARK`, `DW_ON_ACCENT`).
- **i18n** — DoWork ships English-only in v1. Adding locales is an `app.json` `expo-localization` config change + `apps/dowork/scripts/check-i18n-parity.mjs` later.
- **Mesh sync** — deliberately skipped per the cloud-first scope decision. Revisit post-launch if peer sharing matters.
- **Trainer video storage costs** — Supabase Storage with signed uploads + per-user lifetime caps. Implementation lives in `dowork-upload-finalize` edge function (still a stub).
