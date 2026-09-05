# Session: Workout Apps Adversarial Review + Completion Plan (2026-08-12)

## What was done

Founder asked: find all workout apps, review them and their git history adversarially, pick the most complete to finish, plan absorption of features the others have, and start a MacroFactor Workouts gap analysis.

Ran 4 parallel adversarial agents; lead spot-verified every load-bearing claim against source (fixture gating, sync flags, router exports, parity script contents, `is_verified` write, phantom test script, missing icon assets, webhook compare, eas.json placeholder). All agent claims checked held.

## Deliverables

- `docs/reports/REPORT-workout-apps-adversarial-review-2026-08-12.md` (+ `.html` twin)
- `docs/plans/queue/55-dowork-completion-and-macrofactor-gap.md`

## Verdict

DoWork 87/100 (most complete; missing proof not features), hub mobile 62/100, hub web ~45, archived MyWorkouts superseded but recoverable at `.git/modules/MyWorkouts` HEAD `10d4beb9`.

## Key findings (full detail in report)

- DoWork: LG-4 verified-badge defect real (redeem-invite auto `is_verified: true`); never built via EAS; no icon assets; prod schema 2 migrations behind (push broken in prod); phantom `test:uiux` + zero UI tests; rc-webhook missing timing-safe compare; SDK 55 break pending in 6 files; 14/16 plan-46 fix claims verified.
- Hub: ungated fabricated social users on mobile (`apps/mobile/lib/workouts/social.ts:111`); watch capability shell; voice engine dead in hub; `HUB_SYNC_ENABLED_MODULES = []`; CRDT claim in `7848cb0c` false; `check:workouts-parity` requires the web placeholder to exist; docs stale (CLAUDE.md Supabase claim, "active standalone" 5 months post-archive).
- Archaeology: DoWork is a 2026-04-28 copy-fork of the hub mobile tree (41 identical filenames) + a from-scratch trainer platform. Lost in 2026-03 consolidation: coach portal, templates + clone, followers/multi-user social, web recordings pages. Workout calendar (WO-025) never built anywhere. Twin trees drift up to ~1000 lines/screen with no gate.
- `77423c0e` (2026-03-18) deleted 9 working web pages under a "mobile QA" label; parity script then amended to require the replacement placeholder.

## MacroFactor Workouts research summary (agent inventory, official sources)

Separate app (`com.sbs.train`), launched 2026-01-12, v1.2.4 (2026-07-09), iOS 18+, $11.99/mo / $71.99/yr / $89.99/yr bundle, 7-day trial, no free tier, 250k+ downloads, 4.8 stars.

- Exercise library: 900+ exercises claimed, 600+ Jeff Nippard 3-angle videos; rich metadata (type, laterality, equipment, BW flag, ROM, stability, movement pattern); full custom-exercise builder (no media); suggestion blocklist.
- Building: Smart Generation (goal, experience, days, length, equipment, split; PPL still unshipped) + Build From Scratch; cycles not calendar dates; RIR/rep/set periodization; opt-in deloads (first or last cycle); live muscle-group set counts in editor; set types W/D/M/F + partials; pairwise supersets only; class-based rest timers with media-volume alerts; smart warm-ups (percent schemes); multi-gym profiles with plate inventories, bands, per-machine weight stacks (+ AI photo scan, Jul 2026).
- Logging: previous-performance column, auto-advance, RIR 0 to 6+, plate calculator with per-side view, bodyweight contribution split, asymmetrical L/R logging, iOS Live Activity (v1.2.0), workout change log, backfill/history editing.
- Progression: rule-based (not generative); expectation = rep-range midpoint + RIR target; wand suggestions; static program skeleton (only targets adapt); no missed-workout penalty; no auto next block.
- Analytics: weekly rings, Volume/Reps/e1RM records, per-exercise e1RM + e3RM + e10RM curves, Levels muscle-map (avg sets/week with lift drill-in), resistance vs bodyweight volume split. No training-load/fatigue score.
- Integrations: Apple Health write (Feb 2026), Health Connect; NO watch app, NO web (unconfirmed alpha), no Garmin/Fitbit/Whoop direct; limited offline (network needed at cold start); .xlsx export/import only; no importer from Strong/Hevy.
- Social/coach: none by design; sharing = .xlsx file passing; Nippard program import for separately purchased programs only.
- Cardio: near-absent (basic support Feb 2026; no programming, HR zones, GPS).
- Unshipped roadmap: Apple Watch, PPL generation, fatigue-logic refinements.

Citations: macrofactor.com/workouts/, macrofactor.com/workouts-release-notes/, macrofactor.com/versions-1-2-0/, macrofactor.com/wo-version-1-1-0/ (and 1-1-3, 1-1-8), macrofactor.com/mm-june-2026/, mm-july-2026/, help.macrofactorapp.com articles 276, 277, 285, 287, 300, 304, 305, 313, 315, 317, 321, 328, 342, 344, 354, 356, 366, 369, 370, 372, 381, 382, 389, 394, 396, 402, 403. Reddit unreachable (blocked); flagged UNCONFIRMED: search filters, web-alpha scope, Health read direction.

## Decisions made

- DoWork is canonical; hub web remains the web surface (restore the 9 deleted pages).
- Plan numbered 55 (54 taken by Meerkat rc kickoff).
- Cross-module insights in DoWork stays a founder decision; plan default keeps them stripped.

## Remaining

- Founder: MacroFactor screenshots (capture list in plan appendix), insights decision, badge semantics decision, icon art, prod credentials.
- Execute plan 55 (queue).
