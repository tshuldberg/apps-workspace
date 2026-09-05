# Meerkat restart recovery + errors_log removal - 2026-06-11

Context: the machine restarted mid-work on Meerkat (`feature/meerkat-network`). This
session recovered context, confirmed nothing was lost, then removed the write-only
error-log system.

## Part 1: recovery audit (nothing lost)

All Meerkat code was committed before the restart. The only uncommitted changes were
session-memory breadcrumbs (`errors_log.md` +3 rows, `memory.md` +1 row).

Git thread on `feature/meerkat-network` (all 2026-06-10):
- `6c5279698` docs: v2 deep-dive artifacts (report + plan + scratch gitignore)
- `4497949cf` feat: standalone node app + real encryption/seeding core (node core, content addressing, sealed shares, friend codes)
- `1177fb938` docs: plan 14 active + node-core/app session log
- `8bde5010c` feat: real relay transport (MK-005 server + MK-006 client) - first real cross-client byte transfer
- `fdf561590` docs: mark MK-005/006 done + relay session log

Sessions were saved: 3 logs in `docs/sessions/` (deep-dive, node-core+app, relay), the
99 KB report `docs/reports/REPORT-meerkat-network-deep-dive-2026-06-10.html`, and the
active plan `docs/plans/active/14-meerkat-network-v2-mission-control.md`.

Verified green live this session:
- `@mylife/sync` src/node: 38/38
- `@mylife/sync` full: 798/798 (40 files)
- `@mylife/meerkat-relay`: 16/16
- `apps/meerkat`: 20/20

The 3 uncommitted `errors_log.md` rows were false alarms: auto-logged stubs for a merkle
test that failed transiently during the node-core build because the test `bytes()` helper
produced period-256 (byte-identical) 512-byte chunks. That was diagnosed and fixed in the
same commit `4497949cf` (helper now adds an `((i/97)|0)*13` term). The test passes now.
Dropped those 3 stub rows via `git checkout -- errors_log.md`.

## Part 2: errors_log review + removal

Question: is `errors_log.md` ever read usefully? Evidence said no.
- 335 data rows; 177 (53%) are hook-generated auto-stubs.
- 176 of 177 auto-stubs were never upgraded from `Unresolved` (99.4% abandonment).
- Only ~31 rows link a session log, ~19 a commit (the curated minority).
- History is append-only; the log's own rules forbade reading it during routine work.
- This session it actively misled recovery with 3 false `Unresolved` rows.

Removed the write-only system:
- Deleted hook `.claude/hooks/posttooluse-error-logger.mjs` (git-tracked, recoverable).
- Unregistered the `PostToolUse` Bash error-logger block in `.claude/settings.json`
  (kept the Edit/Write typescript-guard block).
- Removed the `## Error Log (Critical)` section from `CLAUDE.md` and `AGENTS.md` (synced pair).
- Updated `memory.md` Known Tech Debt; froze `errors_log.md` with a DEPRECATED header
  (history kept, no new rows).

Bugs going forward live in session logs under `docs/sessions/` and in `memory.md`
Known Tech Debt.

## Files changed
- Deleted: `.claude/hooks/posttooluse-error-logger.mjs`
- `.claude/settings.json` (removed PostToolUse Bash error-logger hook)
- `CLAUDE.md`, `AGENTS.md` (removed Error Log section)
- `errors_log.md` (deprecation header; reverted 3 false stub rows)
- `memory.md` (tech-debt line + session row)

## Next
Resume M0 at MK-007 (LAN rung) or MK-008 (mount SyncEngine in apps/meerkat = the visible
phone-to-phone demo), per plan 14. No device run yet.
