# Cross-App Next Steps Plan (Post 72-Hour Review)

**Created:** February 8, 2026  
**Planning horizon:** Next 7-14 days  
**Drivers:** Commit/timeline review across `/Apps` repos, completed PRs, and active blockers

## Inputs (Findings -> Action Drivers)
- `Parks/easystreet-monorepo/timeline.md` is out of sync with actual git history (duplicate of native EasyStreet timeline).
- `tron-castle-fight` has active development but no `timeline.md` audit trail.
- `receipts` has launch-gate blockers due to environment constraints (staging DNS and package network reachability).
- `Parks/EasyStreet` documented a known logic limitation in same-day multi-rule sweep handling.
- `shiphawk-templates` still has pending cleanup items after migration/simplification.

## Success Criteria
- Timeline and git history are consistent across all active repos.
- Launch blockers in `receipts` are either closed or escalated with hard evidence.
- High-risk app logic gaps are closed with regression coverage.
- Remaining refactor debt is converted into tracked, testable work items.

## Priority Plan

### P0 Workstream 1: Timeline Integrity + Evidence Hygiene
**Goal:** Ensure timeline documentation is trustworthy for every active app.

Checklist:
- [ ] Rebuild `Parks/easystreet-monorepo/timeline.md` from its own commit graph (do not copy from native EasyStreet).
- [ ] Backfill `tron-castle-fight/timeline.md` with at least: MVP baseline, multiplayer/server expansion, responsive UI/governance pass.
- [ ] Add a lightweight consistency check script (for example, compare timeline latest date vs latest commit date) and run it from workspace root.
- [ ] Add timeline-update requirement to each repo's `AGENTS.md` or `CLAUDE.md` where missing.

Exit criteria:
- [ ] Each active repo has a timeline matching its own recent commits.
- [ ] No duplicate timeline files across separate repos.

### P0 Workstream 2: `receipts` Launch Gate Unblocking
**Goal:** Clear Week 1/Week 3 blockers with reproducible validation artifacts.

Checklist:
- [ ] Resolve DNS/network path for `staging.receeps.com` from validation environment.
- [ ] Re-run `docs/plans/2026-02-08-w1-4-password-reset-staging-checklist.md` and attach evidence artifacts.
- [ ] Close `W1-4` and `W1-5` in `docs/plans/2026-02-07-launch-tracker.md` once evidence passes.
- [ ] Restore package egress (`pypi.org`) or configure an internal mirror for Poetry.
- [ ] Run backend regression suite via Poetry-managed env and publish pass/fail report.
- [ ] Advance Week 3 tracker statuses (`W3-2`, `W3-3`) based on validated test results.

Exit criteria:
- [ ] Launch tracker reflects real tested state (not pending placeholders).
- [ ] Backend and frontend validation both have timestamped evidence.

### P1 Workstream 3: `Parks/EasyStreet` Logic Hardening
**Goal:** Close known correctness gap and keep cross-platform parity stable.

Checklist:
- [ ] Refactor same-day status evaluation to handle multiple rules per day (replace current first-match behavior).
- [ ] Add/expand tests for multi-rule same-day morning+evening sweep scenarios.
- [ ] Run iOS and Android parity checks for holiday handling, countdown behavior, and notification lead-time logic.
- [ ] Re-verify data pipeline against newest SF dataset and regenerate artifacts only if source changed.

Exit criteria:
- [ ] Documented limitation removed from timeline and replaced with validated fix reference.
- [ ] Regression suite passes on both platforms with parity deltas logged.

### P1 Workstream 4: `shiphawk-templates` Post-Migration Debt Burn-Down
**Goal:** Finish functional cleanup left after repository simplification.

Checklist:
- [ ] Refactor priority templates from inline CSS to shared stylesheet architecture without PDF layout regressions.
- [ ] Complete remaining customer field-mapping JSONs using canonical schema.
- [ ] Fix Liquid syntax edge cases (`order.references[...]`) in known affected templates.
- [ ] Add template rendering verification samples (before/after output snapshots) for high-volume customers.

Exit criteria:
- [ ] Core templates render correctly with shared CSS.
- [ ] Mapping coverage is complete for active customers.

### P1 Workstream 5: `tron-castle-fight` Multiplayer Stabilization
**Goal:** Convert rapid feature expansion into a testable and operable baseline.

Checklist:
- [ ] Define and test authoritative multiplayer message contracts (join/state sync/input/reconcile).
- [ ] Add server-side guardrails for malformed or out-of-order client payloads.
- [ ] Create mobile viewport QA checklist for `online.html` and responsive menu flows.
- [ ] Add timeline/process docs so future changes are auditable.

Exit criteria:
- [ ] Multiplayer flow passes deterministic smoke tests.
- [ ] Basic governance/test docs exist and are used.

### P2 Workstream 6: Workspace-Wide Delivery Controls
**Goal:** Improve repeatability across repos now that PR volume is rising.

Checklist:
- [ ] Standardize PR template sections (scope, risk, validation, rollback notes).
- [ ] Standardize branch naming and merge strategy in each repo handbook.
- [ ] Add a workspace-level weekly report job that rolls up commits, merges, blockers, and timeline deltas.
- [ ] Add a shared "definition of done" checklist for docs-only vs code+runtime changes.

Exit criteria:
- [ ] Same delivery controls are visible in all active repos.
- [ ] Weekly rollup can be generated with minimal manual effort.

## Recommended Execution Order
1. P0 Workstream 1 (timeline integrity) and P0 Workstream 2 (`receipts` blockers) in parallel.
2. P1 Workstream 3 (`EasyStreet`) immediately after P0 blockers are stabilized.
3. P1 Workstream 4 (`shiphawk-templates`) and P1 Workstream 5 (`tron-castle-fight`) as parallel hardening tracks.
4. P2 Workstream 6 after first full validation cycle is complete.

## Reporting Cadence
- Daily: blocker board update (DNS, package access, failing tests, unresolved parity deltas)
- Twice weekly: repo-level progress against the checklists above
- End of cycle: cross-app acceptance review with evidence links and carry-over list
