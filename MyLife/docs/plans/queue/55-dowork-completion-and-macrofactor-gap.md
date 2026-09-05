# Plan 55: DoWork Completion + Feature Absorption + MacroFactor Gap Build

- **Project:** DoWork (`apps/dowork/`) + `modules/workouts/` + hub twin trees
- **Created:** 2026-08-12
- **Source review:** `docs/reports/REPORT-workout-apps-adversarial-review-2026-08-12.md`
- **Status:** queue
- **Founder mandate applies:** full production-grade function, no deferred slices.

## Goal

Finish DoWork as the canonical workout app: close every honesty defect found in the 2026-08-12 adversarial review, produce the first device build, absorb every feature another surface has that DoWork lacks, close the MacroFactor Workouts feature gap (locked exactly against founder-provided UI screenshots), and stop the hub/DoWork twin trees from drifting silently.

## Phase 0: Truth and hygiene (no new features until these land)

All items verified against source in the review; each is a small, mechanical fix.

1. **LG-4 for real:** stop auto-setting `is_verified: true` in `supabase/functions/dowork-redeem-invite/index.ts:304`; rename the user-facing badge to "Invite-only trainer" in `trainer/[handle].tsx:603` and `(tabs)/settings.tsx:268` with accessibility labels, or gate `is_verified` behind a genuine review flow. Update plan 46 ledger.
2. **RC webhook parity with BK-2:** apply `timingSafeEqual` + rate limiter (copy the `dowork-notify` pattern at its `index.ts:154-163, 277`) to `dowork-rc-webhook/index.ts:149`. Contract tests.
3. **Router pollution, both trees:** rename `phase2-kit.tsx`, `phase3-kit.tsx`, `social-kit.tsx` to `_`-prefixed files in `apps/dowork/app/(root)/` AND `apps/mobile/app/(workouts)/`; fix imports.
4. **Phantom test script:** delete or implement `test:uiux`; remove `--passWithNoTests` from the default test script so empty suites fail loudly.
5. **Hub fixture honesty:** gate or delete `FIXTURE_PROFILES` in `apps/mobile/lib/workouts/social.ts:111` (port DoWork's `public-render-policy` gate). The hub must never render fabricated humans ungated.
6. **Stale docs sweep:** root `CLAUDE.md` (workouts is sqlite, not Supabase cloud), `modules/workouts/CLAUDE.md` (standalone archived 2026-03-08; watch is a stub; social has no hub network layer), registry tagline sync in `packages/module-registry/src/constants.ts:363`, the three stale `cloud-*.ts` header comments, errors_log rows 46/54/82 to Resolved, plan 46 F1 contradiction resolved in favor of `Tickets/launch-plan.md`.
7. **Parity honesty:** rewrite `scripts/check-workouts-parity.mjs` to stop requiring the web placeholder strings and stop mandating dead exports; add the real checks from Phase 5.

## Phase 1: Proof of life (build + deploy + test floor)

1. **Deploy R0:** `supabase db push` + `apps/dowork/scripts/deploy-functions.sh <prod-ref>` to land migrations `20260711000012` (push device scope, currently BREAKS push registration in prod) and `20260711000013` (moderation hardening). Founder runs credentials; script and verification checklist are code-side.
2. **First EAS build:** development-profile iOS build to flush never-compiled native issues (Meerkat's first build burned through 5 defects; assume similar). Placeholder icon/splash acceptable for the dev build; F8 founder art gates the store build only.
3. **SDK 55 prep:** migrate the six `expo-file-system/legacy` importers (`DatabaseProvider.tsx`, `(tabs)/settings.tsx`, `studio/ProfileEditor.tsx`, `studio/UploadQueue.tsx`, `data/downloads.ts`, `data/cloud-media.ts`) to the current API now, while it is a choice rather than an outage.
4. **UI test floor:** real render/interaction tests for the 8 highest-risk screens (session, builder, save-workout, player, form-check, studio upload, paywall, settings) plus the uiux-interaction-contract file the script already names. Target: no screen with cloud writes untested.

## Phase 2: Feature absorption (features other surfaces have, DoWork lacks)

| Feature | Source of truth | Work |
|---|---|---|
| CSV data export | `modules/workouts/src/export/csv.ts` (web-only today) | Surface in DoWork settings: full training history export, share sheet. Extend to .xlsx to match MacroFactor import expectations. |
| Workout templates + clone | Archived standalone (`.git/modules/MyWorkouts` HEAD `10d4beb9`: `apps/web/app/templates/*`, `api/templates/*`) | Rebuild on DoWork's stack: template save from any workout, template browser, one-tap clone, trainer-published templates via existing `dw_trainer_*` rails. |
| Followers / social graph | Archived standalone (`social/followers`) | Add `dw_follows` migration + RLS, follow/unfollow on trainer and user profiles, follower-aware feed ranking. DoWork already has the server; this is one table + UI. |
| Workout calendar (WO-025) | Spec'd in `SPEC-myworkouts.md`, never built anywhere | Month view of sessions + program schedule with streaks; entry point from Progress tab. |
| Cross-module insights | `modules/workouts/src/intelligence/` (hub-only; stripped from DoWork on purpose) | DECISION for founder: keep stripped (standalone purity) or ship a degraded-gracefully version reading only local data. Plan default: keep stripped, document the decision. |
| Web surface | Hub web (21 pages) | Hub web remains the web answer. In-scope here: restore the 9 pages deleted by `77423c0e` (recordings, exercise/[id], workout/[id], plans, body-map) so the hub web is not a placeholder farm. |

Watch sync is NOT absorbed from anywhere (every existing "watch" surface is a stub); it appears in Phase 4 as new work.

## Phase 3: MacroFactor gap build (screenshot-locked)

Step 1: founder captures full MacroFactor Workouts UI screenshots (screen list to capture is in the appendix). Lead produces the exact per-feature gap matrix from screenshots + the research inventory, marking each: already-have / build / consciously-skip.

Step 2: build the confirmed gaps. Expected build list from research (final after screenshots):

1. **Per-set RIR (0 to 6+)** in the session set table + storage in `wk_set_weights`.
2. **Set types:** warmup / drop / myo / failure flags per set, with distinct progression treatment.
3. **Previous-performance column** in the set entry table (last session's weight x reps inline).
4. **Smart warm-up schemes:** percent-of-working-set ladders, per-exercise override, hide-completed.
5. **Progression upgrade:** extend the overload engine to rep-range targets + RIR expectation (midpoint + RIR formula is public), in-session suggestion surface, and an update-program-or-not toggle for mid-session deviations.
6. **Periodization + deloads:** per-exercise RIR/rep/set periodization across cycles; opt-in deload placement.
7. **Multi-rep-range strength curves:** e1RM + e3RM + e10RM charts (1RM engine already exists; add rep-range estimates + charts).
8. **Equipment depth:** per-gym profiles (plate inventory exists in `wk_plate_inventories`; add bar types, machine weight-stack ranges, band inventory), bodyweight-contribution percentage for BW exercises.
9. **iOS Live Activity** for rest timer + current set from lock screen.
10. **Apple Health write** (workouts out; steps/weight read where entitled).

Consciously-skip candidates (founder confirms): 3-angle demo video library (licensing-scale content, substitute linked media on custom exercises + trainer videos which DoWork uniquely has), AI weight-stack photo scanning (nice-to-have), Japanese localization.

## First-trainer launch track (runs alongside Phases 1-3)

Founder input 2026-08-12: a trainer with multiple masters degrees has video content ready for the app. DoWork's trainer pipeline (invite redemption, Studio signed uploads, `dw_trainer_videos` exercise rail, 4-path entitled playback, offline downloads, coaching loop) is already code-complete; this makes plan 36 Phase 7 (white-glove TestFlight with the first trainer) concrete and raises the priority of everything that gates it.

1. **Sequence:** Phase 1 R0 deploy -> dev EAS build -> TestFlight build (needs F2 ASC + F8 icon) -> trainer invite minted -> redemption on device -> Studio bulk upload of their library -> playback + offline QA -> gym voice QA (plan 36 Phase 7 script).
2. **Content ingestion at library scale:** verify the Studio upload queue handles a full content library (dozens of videos) gracefully: batch queueing, retry/resume on flaky gym wifi, progress UI, storage cost sanity check. Add a bulk-tagging pass (exercise linkage per video) so the exercise rail is populated, not just a profile grid.
3. **Verification flow (supersedes the LG-4 rename option):** with a credentialed first trainer, build the real thing: `is_verified` starts false, a credentials-review flow (founder-approved for now, documented criteria) flips it, and the badge gets a label ("Verified trainer") plus accessibility text. LG-4 closes honestly instead of cosmetically.
4. **MacroFactor consequence:** the "demo video library" consciously-skip item in Phase 3 is partially reopened. Their moat is 600+ Nippard videos; DoWork's answer is credentialed trainer content through a pipeline MacroFactor does not have (they have zero coach features). Exercise-linked trainer videos can seed demo media on the exercises this trainer covers.
5. **Revenue-split decision (F4)** moves from abstract to blocking: the first trainer needs terms before their content goes live behind the paywall.

## Phase 4: New capability work

1. **Apple Watch app:** real watchOS target for DoWork (set logging + rest timer + heart rate). Neither MacroFactor nor any MyLife surface has shipped this; first-mover slot. Uses the existing `watch/sync-protocol.ts` message types with a real WatchConnectivity bridge.
2. **Hub back-port:** session/save-workout/GPS improvements that DoWork accumulated flow back to the hub twin files (the review found fixes crossing over only when a human remembers).

## Phase 5: Drift-proofing (make the twin-tree problem structural, not procedural)

1. Extract genuinely shared screens into `@mylife/workouts/ui` components consumed by BOTH `apps/mobile/app/(workouts)` and `apps/dowork/app/(root)`, starting with the 10 highest-drift files (session, tabs/index, gps, social-feed, builder).
2. Replace `check-workouts-parity.mjs` checks with: mobile-vs-web route diff, hub-vs-DoWork shared-file drift budget (fail above threshold), and every-exported-CRUD-symbol-has-a-consumer check (flags the 5 dead legacy functions immediately; delete `wk_programs`/`wk_workout_logs` legacy CRUD or wire it).
3. Keep `check-dowork-parity.mjs` security assertions; add the route-graph check to the hub tree.

## Acceptance criteria

- Zero findings from the 2026-08-12 review remain open (each mapped to a commit).
- A green EAS iOS build exists; push registration works against prod.
- UI test suite covers all cloud-writing screens; `--passWithNoTests` removed.
- Feature matrix: DoWork >= every other MyLife surface on every consumer feature (except consciously-documented skips).
- MacroFactor gap matrix complete with screenshot evidence; all build items shipped.
- Parity scripts fail on real drift (proven by mutation: revert one twin-file fix, gate goes red).
- Founder-ops ledger (F2-F8) explicitly tracked, unchanged in ownership.

## Founder inputs needed

1. MacroFactor Workouts screenshots (appendix list).
2. Decision: cross-module insights in DoWork or keep stripped.
3. Verified-badge semantics: RESOLVED toward a real credential-verification flow (see First-trainer launch track); founder confirms the review criteria.
4. Icon/splash art (F8) before the store build.
5. Supabase prod credentials at Phase 1 deploy time.

## Appendix: MacroFactor screens to capture

Dashboard (widgets + Recent Records), Levels tab (body map + muscle drill-in), active workout session (set table, action bar, wand suggestion, rest timer), plate calculator, weight-stack config, program editor (periodization view, muscle-group set counts), Smart Generation flow (all steps), exercise detail (video + fields), custom exercise builder, gym profile editor, warm-up config, settings (units, reps-first toggle), export screens, paywall/pricing, Live Activity on lock screen, workout change log, program-end screen.

Research citations for every claimed MacroFactor feature: see agent inventory embedded in the review session log (`docs/sessions/2026-08-12-workout-apps-adversarial-review.md`).
