# 2026-07-11 - DoWork production readiness remediation (plan 46)

## What was done

Executed plan 46 end to end: closed every code-addressable finding from the 8-zone adversarial production audit (`docs/reports/REPORT-dowork-adversarial-production-audit-2026-07-11.md`), Phases 1 through 4, on `feature/dowork-production-readiness`.

Two sessions worked this branch concurrently (this one and a sibling session that also handled the yearn twin plan). This session ran as orchestration lead with seven parallel implementation agents on disjoint file zones; the sibling session contributed fixes and made the phase commits. All work was reconciled through shared gates before each commit.

## Findings closed

- **P0:** BH-2 (Save Workout now persists title/notes: workouts migration V7 + `annotateWorkoutSession`, wired in DoWork and, for parity, in the hub `apps/mobile` save screen which had the identical bug; public shares upload via `uploadWorkoutShare`), BH-1 (end-of-session draft-set flush, extracted to pure `resolveDraftSetFlush` with 12 tests), BK-1 (verify_jwt split pinned in `supabase/config.toml` + `apps/dowork/scripts/deploy-functions.sh` + 16-test contract in `deploy-jwt-split.test.ts`), LG-2 (iOS privacy manifest via official `expo.ios.privacyManifests` + contract tests). LG-1/LG-3 are founder-ops.
- **P1:** MN-1 (CANCELLATION keeps access to period end; regression-tested), SH-1 (5 coaching screens registered + parity assertion), DL-1 (KV read-modify-write in transactions + race tests), CG-2 (likes/comments/shares queues persist at enqueue via persist hooks; stale TODOs corrected), RT-6, RT-7 (device-scoped push tokens + `20260711000012` migration), RT-2/RT-4 (refresh gate + 60s expiry poll), RT-8 (GPS timer pauses on background with honest note), BH-3, DL-2.
- **P2:** RT-1 (resume-row prune on delete/wipe/revoke), RT-15, BH-6, BH-5 (unit-aware pace via `lib/gps/pace`), BH-4 (calculator.tsx retired, Toolbox repointed to Plate Loader, parity manifest updated), DL-3 (zod per-item queue validation), DL-4, BK-2 (timing-safe secret compare + per-isolate fixed-window rate limit with 429), CG-3 (a11y on builder + session), CG-4, LG-4 (honest "invite-only, approved" guidelines copy + "Approved trainer" badge label), SH-2/SH-3, CG-1 (tests for cloud-blocks, cloud-reports, launch-environment, public-render-policy), RT-9 (cold-start push route gated on cloud readiness), RT-12 (401 -> `needs_reauth`, distinct from offline).
- **P3/Phase 4:** CG-5 (delete/edit saved workouts + delete history sessions, new transactional `deleteWorkoutSession` module CRUD), CG-6 (pull-to-refresh on Programs; others already had it), CG-7 (debounced Explore text search), CG-8 (locked premium teaser), IMP-9 (repeat last session from Home + Progress via `run-repeat.ts`), CG-9 (voice control in live sessions: new `session-commands.ts` matcher + generic `VoiceCoachGrammar`), BK-3/BK-4/DL-6 hardening.
- **Beyond the audit:** DoWork `DatabaseProvider` now runs `PRAGMA foreign_keys = ON` (ON DELETE CASCADE was silently inert on device; hub runner already did this).

## Commits

`9b0a1596` (phases 1-2) · `770c4e46` (BK-1 contract tests) · `3bf222d0` (phases 3-4) · `32c04d9e` (BK-2 rate limit) · `47b304fe` (hub save-workout parity) · `f8ade694` (parity manifest).

## Verification

Typecheck clean (dowork, workouts, mobile) · 518 dowork app tests · 556 `@mylife/workouts` tests · `check:dowork-parity`, `check:workouts-parity`, full `check:parity` all pass · pre-commit function gates passed on the final two commits.

## Remaining

Founder-ops only (F1-F8): live deploy through the new script + Database Webhooks, ASC $4.99 record + real `ascAppId`, RevenueCat 8-product ladder + secrets, revenue-split decision, legal hosting + counsel + moderation SLA, APNs/FCM keys, TestFlight white-glove QA, icon + splash art. Handoff: `apps/dowork/Tickets/launch-plan.md`. Deferred code nits are listed there (friendly-error copy for the BK-4 trigger exception; 3 stale persist-hook header comments).

## Decisions

- Blank reps in a draft set falls back to the exercise's programmed reps instead of dropping the set (matches BH-1 intent; the lossy alternative was rejected).
- RT-6 hook-level unit test skipped: would require expo-speech-recognition event-system mock infra the pure voice tests deliberately avoid.
- calculator.tsx deleted rather than left dormant; its parity manifest entries removed in the same unit.

## Incident

The husky pre-commit gate stashes unstaged changes; with two sessions and seven agents editing concurrently, one stash pop landed conflict markers in two test files and left `downloads.test.ts` unmerged (UU). Resolved in place; final files verified coherent and green. Logged in `errors_log.md`.
