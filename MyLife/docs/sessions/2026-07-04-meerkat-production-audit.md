# 2026-07-04 Meerkat Production Audit + Launch Readiness Report

## What was done
Four parallel audit agents (git history, workflows/user stories, code+security, production gaps) ran a deep production-launch audit of the Meerkat surfaces (apps/meerkat, apps/meerkat-web, packages/meerkat-relay, packages/sync). Disputed claims were re-verified directly before reporting. Deliverable: `docs/reports/REPORT-meerkat-production-audit-2026-07-04.html` (workflows + user stories inventory, audit findings, ranked gap outline, launch sequence).

## Key findings
- Code: ZERO P0/P1/P2 findings; 4 P3 notes (sync.tsx advanced-screen direct dial, ConnectionStatusCard inline candidate logic + one uncaught probeRelays promise, AttachmentCard raw-setting boolean). Gates green: app 699/699, typechecks, check-meerkat-parity.
- Git: 252 commits / ~197k LOC / 311 test files across the 4 surfaces; clean hygiene, no reverts, recurring hardening themes (fail-closed sync trust boundary, mobile-web parity drift, relay zero-knowledge discipline).
- Branch: `feature/meerkat-launch-finish` is FULLY MERGED to main (`bcb45871`) and pushed (local main == origin/main). The checkout still sits on the stale branch, 93 behind.
- Workflows: 40+ flows verified with status. Biggest lever: `DEFAULT_RELAY_URL` is still `''`, so every LIVE-NEEDS-SERVER flow (DMs, add-friend, file requests, member-removal fan-out, discover, public read/join) is dormant out of the box.
- 7 launch blockers, ALL operational: (1) deploy relay+nodes and set default relay envs, (2) app icon/splash DO NOT EXIST (no assets dir), (3) privacy policy/ToS/support contact nonexistent + unwired, (4) content scanning for the public archive, (5) prebuild+EAS builds+App Group+2-device QA matrix+48h soak, (6) monetization stance ($4.99 is copy only, no IAP path; recommend launch free), (7) web app has no hosting target.
- HIGH follow-ons: recovery restore (lose phone = lose account), crash-visibility plan (zero telemetry), Plan 29 auto-connect (all sync is manual-tap: retention risk), Plan 24 humanity verification before Plan 26 open participation, export-compliance reconcile (ITSAppUsesNonExemptEncryption false vs E2EE/ECCN 5D992.c), Plan 21 AC-13 link-device UI, TURN env.
- Corrected 3 stale docs claims during audit: apps/meerkat/CLAUDE.md says DM flag false (it is TRUE both surfaces); runbook + Plan 23 still say EAS projectId is a placeholder (app.json has real id `c662e59e-...`); Plan 19 delta implies FF3 owner dispatch unwired (verified wired at `packages/sync/src/protocol/mailbox-dispatch.ts:308`).
- MEDIUM: Files index bulk "Request" button still disabled with stale "coming in a later update" copy; no dial/preference UI for WebRTC/Nearby/BLE rungs; Plan 27 P3-P5 open; batch /design-review never ran; web meta/OG missing; node DATA_DIR backup runbook missing.

## Files changed
- `docs/reports/REPORT-meerkat-production-audit-2026-07-04.html` (new)
- `docs/sessions/2026-07-04-meerkat-production-audit.md` (this file)
- `memory.md` (session row)

## Remaining / next
- Founder-ops: execute the 8-step launch sequence in the report (spine deploy, brand assets, legal pages, monetization call, builds+QA, scanning+monitor, submit).
- Code follow-ups (small): stale docs fixes, Files bulk Request enable, safety un-hide verify, 4 P3 notes.

## Part 2 (same session): queue cleanup + Plan 37
- Appended corrected `Status Delta (2026-07-04)` sections to all 10 Meerkat queue plans (19, 20, 21, 22, 23, 24, 25, 26, 27, 29); fixed apps/meerkat CLAUDE.md + AGENTS.md DM copy (flag is true, DMs live both surfaces); marked runbook items 1.1 lockfile + 1.3 EAS projectId done.
- Authored `docs/plans/queue/37-meerkat-launch-completion-mission-control.md`: 5-wave build order (W0 branch setup; W1 four parallel tracks 27-P3-5 / 29-P0-1 / 24-P0-3 / 23-P0-2 + audit P3 notes; W2 29-P2-6 / 24-P4-6 / 26-P0-7 / 21-AC-13; W3 Plan 22 founder decision gate + 25-P0-1; W4 25-P2-9 + 23-P3; W5 23-P4 exit gate), 12 binding coordination rules updated for post-07-03 reality (descriptor-gossip exists, shared drain seam, D.2 retarget, D.4 superseded), embedded session kickoff prompt.
- Added SUPERSEDED banner to docs/plans/meerkat-launch-orchestration.md pointing at Plan 37.
- NOT committed: checkout still on stale feature/meerkat-launch-finish with cross-session dirty memory.md/errors_log.md; committing deferred to the Plan 37 Wave 0 session (which starts by moving to main).

## Part 3 (2026-07-05): errors_log curation
- Pruned errors_log.md 495 -> 164 rows: archived 331 rows (old Resolved before 2026-06-05, never-upgraded auto-stubs before 2026-06-20, duplicate stubs) to docs/archives/errors-log-archive-2026-07-05.md. All 11 manual Unresolved rows kept, including the ble-backend Metro export blocker.
- Hardened .claude/hooks/posttooluse-error-logger.mjs: new symptomAlreadyLogged() dedupe skips appending when the same symptom line already exists in the log (kills the 12x ERR_PNPM duplicate class). Syntax-checked.
- Plan 37: added the ble-backend dynamic-require Metro export failure to Wave 1 Track D as an EAS blocker (audit nearby-backend.ts and other lazy backends for the same pattern) and mapped the P3 moderation un-hide errors_log row to Plan 23 D.2.
- Added the archive convention to the Error Log rules in CLAUDE.md + AGENTS.md (synced pair).
