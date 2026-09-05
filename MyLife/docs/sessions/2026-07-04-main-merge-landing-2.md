# 2026-07-04 Main Merge Landing 2

## Goal

Second same-day landing. Founder: "A bunch of work was completed, go through and get it safely pushed and merged to main as well." Same approved strategy as landing 1 (merge everything, push, cleanup), executed in the kept `.claude/worktrees/main-merge` worktree without touching the active session checkouts.

## Deltas landed (since landing 1 at `edd6b2e3`)

1. `feature/meerkat-launch-finish` (+33 commits incl. my ledger commit `1e662554`): BestChef plan 33 Phases 2.3 (dish translations + locale search), 2.5 (UGC language tagging), 3.x through 3.7 (CLDR plurals, RTL pass, honest completeness; 978 keys x21), 5.7 IA mocks; three new gates (`check:raw-strings`, `check:rtl-icons`, `check:compliance-keys`). Also committed the stray MyNews P2 ledgers that session left uncommitted in the primary checkout.
2. `feature/dowork-trainer-launch` (+26 commits): plan 36 Phases 5-7 (RevenueCat monetization w/ server-truth entitlements, push notifications e2e, offline downloads, store ops), production-review punch list (sign-in reachability, offline queue caps, voice restart, real GPS), founder-ops F1/F2-half/F5/F7 executed. Branch had been pushed by its own session.
3. `feature/mynews-p0-scaffold` (+11 commits): P2 editing desk (suggest mode, review queue, newsrooms, web editing surfaces), Task 14 ChannelPostType widened with article/preprint (was gated on the Meerkat landing), registration/magic-link fixes, memory-budget archive.
4. `feature/phone-web-daily-driver`: already landed - its own session squashed it onto main as `52d49611` (dashboard v2, PWA, macro loop, Manhattan depth, prod hermeticity). Verified tree-identical to the branch; worktree removed, branch left for manual `-D`.

## Conflict resolutions

- `package.json`: parity chain unioned to 12 legs (mynews-parity + i18n-parity + the three new BestChef gates).
- `memory.md` / `errors_log.md` (all three merges): union with the freshest per-app rows; branch-side resolutions that superseded stale "Not yet fixed" rows won. The MyNews branch's memory-budget archive was honored: rows already in `docs/archives/memory-sessions-2026-06-09-to-2026-07-04.md` dropped from the table, post-archive main-only rows kept, 23 duplicate stop-hook auto-rows collapsed.
- `pnpm-lock.yaml`: regenerated via `pnpm install`.

## Bugs caught by the merge gate

- Real FIFO-ordering bug in BestChef's new media upload queue: same-millisecond `created_at` ties made `ORDER BY created_at` ambiguous; the Phase 4.4 requeue test failed on ~half of vitest seeds. Fixed with rowid tiebreaks on all three ORDER BY clauses (`a329a393`), stable across 5 seeded runs (errors_log row added).
- Dowork merge pre-commit crash: node_modules predated the merged `react-native-purchases` dep; `pnpm install` before committing merge commits that touch manifests (errors_log row added).

## Verification

Merged main: typecheck green, `pnpm test` 129/129 turbo tasks, full `check:parity` chain (12 legs, compliance-keys current at 70), generated-artifacts guard green.

## Pushed

main `3c8b41f5 -> a329a393` (incl. the `52d49611` daily-driver squash that was sitting unpushed), `feature/meerkat-launch-finish -> 1e662554`, `feature/mynews-p0-scaffold -> 29a954df`; dowork already in sync.

## Left for founder

- `git branch -D feature/mylife-improvements-sprints` and `git branch -D feature/phone-web-daily-driver` (both content-verified in main; force-delete blocked by the destructive-op policy).
