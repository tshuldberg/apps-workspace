# Cluster D Mobile Validation Pass (budget, homes, car, closet, pets, subs)

Date: 2026-04-07
Commits:
- `c8ce77bee` fix(car): populate empty mobile screens to prevent crashes
- `5f4c1e596` fix(subs): remove duplicate calendar Pressable in dashboard

## Goal

Walk every screen in the admin-and-home cluster (`budget`, `homes`, `car`,
`closet`, `pets`, `subs`) on mobile, flag broken code, and fix bugs that
would block hands-on testing. Keep changes minimal: no refactors, no new
features, no styling rewrites.

## Scope

Owned files:
- `apps/mobile/app/(budget)/**`
- `apps/mobile/app/(homes)/**`
- `apps/mobile/app/(car)/**`
- `apps/mobile/app/(closet)/**`
- `apps/mobile/app/(pets)/**`
- `apps/mobile/app/(subs)/**`

## Route enumeration

| Module | Route count (.tsx files) |
|--------|--------------------------|
| budget | 55 |
| homes | 37 |
| car | 32 |
| closet | 14 |
| pets | 18 |
| subs | 11 |

## Bugs found and fixed

### car: seven empty screens crash on navigation

The `(car)` layout registers tab and stack screens whose source files were
zero bytes. Expo Router crashes the screen when it cannot locate a default
export. The seven empty files were:

- `fuel.tsx` (Fuel tab) -> populated with `export { default } from './fuel-prices';`
- `maintenance.tsx` (Service tab) -> populated with re-export from `./reminders`
- `parking.tsx` -> populated with re-export from `./parking-history`
- `vin.tsx` -> populated with re-export from `./vin-decoder`
- `obd.tsx` -> populated with re-export from `./diagnostics`
- `service-history.tsx` -> populated with re-export from `./reminders`
- `_ui.tsx` -> placeholder with `export {};` comment (underscore-prefixed so
  it is not a route, and it is not imported anywhere, but leaving it empty
  is a TS smell)

Each target re-export already contained the intended feature for its sister
route (fuel-prices.tsx is the full fuel tracker, reminders.tsx is the full
maintenance schedule screen, parking-history.tsx is the full parking saver,
etc.), so the fix collapses to one-line re-exports that stand up the same
UX as the pre-redesign layout intended.

### subs: duplicate calendar Pressable in index dashboard

`apps/mobile/app/(subs)/index.tsx` had two separate Pressables that both
navigated to `/(subs)/calendar`:

- Lines 24-30: "View Renewal Calendar" with an `as never` type assertion
  and a `body` variant label, placed BEFORE the hero card.
- Lines 46-49: "Renewal Calendar" with no type cast and a `label` variant,
  placed AFTER the hero card.

The first block was dead copy-paste from an earlier iteration: it pushed the
hero card below the fold, duplicated the calendar button, and used the
un-necessary `as never` cast. The second block is the intended visual
position. Removed the first block.

Reference: `docs/reports/REPORT-mobile-quality-2026-04-07.md` P0 item.

## Clean modules

### homes, closet, pets, budget

Walked every screen in the remaining four modules:

- No empty `.tsx` files.
- No `onPress={() => {}}` stubs.
- Every `router.push('/(module)/path')` target resolves to an existing file.
- Every useEffect carries the correct dependency array.
- All imports from `@mylife/<module>` resolve against the module barrel
  exports (verified by mobile typecheck).
- Error handling for DB reads inside useMemo patterns is either implicit
  (never throws because tables are migrated on module enable) or wrapped in
  try/catch.

Budget in particular is the biggest module in the cluster (55 routes) and
has a clean layout: `(tabs)/_layout.tsx` wires the five main tabs with a
FAB-injected transaction sheet, and the flat `_layout.tsx` stack registers
every deep screen.

## Per-module verdict

| Module | Routes | Bugs found | Bugs fixed | Blockers | Verdict |
|--------|--------|------------|------------|----------|---------|
| car | 32 | 7 empty screens | 7 | 0 | GREEN |
| homes | 37 | 0 | 0 | 0 | GREEN |
| closet | 14 | 0 | 0 | 0 | GREEN |
| pets | 18 | 0 | 0 | 0 | GREEN |
| budget | 55 | 0 | 0 | 0 | GREEN |
| subs | 11 | 1 duplicate Pressable | 1 | 0 | GREEN |

## Verification

- `apps/mobile` `tsc --noEmit` is clean in the isolated worktree.
- Direct `npx vitest run` across the cluster D mobile tests (18 tests) all
  pass: car index, budget index/goals/goal-forms/settings/csv-import-utils,
  homes index.

## Commits

- `c8ce77bee` fix(car): populate empty mobile screens to prevent crashes
- `5f4c1e596` fix(subs): remove duplicate calendar Pressable in dashboard

## Tooling notes / cross-cluster issues (report only, not fixed)

1. **Mobile test script is still broken at the infra level.** Same bug
   previously documented by Cluster B: `apps/mobile/package.json` declares
   `"test": "vitest run 2>&1 | tee /dev/stderr | grep -q 'Tests.*passed'
   && exit 0 || exit 1"`. When the gate passes extra flags via `pnpm test
   -- --pool-options...`, the trailing `exit 0` / `exit 1` receive those
   flags as positional arguments and crash with `sh: line 0: exit: too
   many arguments`. Fixing the script in the main checkout was immediately
   reverted during this session (likely by an iCloud restore or another
   agent). Owner: hub-shell-dev.

2. **Stash thrashing under concurrent agent work.** The husky pre-commit
   hook's stash/apply dance fails when multiple agents commit within the
   same minute. Each failed commit leaves behind a `pre-commit-gate-*`
   stash, and stash apply operations were observed to clobber this
   session's working-tree edits back to the empty file state. The
   mitigation that worked for this session was moving to a sibling git
   worktree (`/Users/trey/Desktop/Apps/Apps-wt-cluster-d`) with its own
   independent node_modules, committing there, and fast-forward merging
   into main. Worth tightening the stash scope further in the hook.

3. **iCloud restores are clobbering files.** Cluster B already reported
   this. During this session the same pattern was observed: writing one-line
   exports into `(car)/fuel.tsx` and siblings would succeed, then minutes
   later the files would be back to 0 bytes on disk. The worktree escape
   hatch avoided this because the worktree is outside the iCloud-synced
   Desktop folder path (same machine, different working copy path).

## Hook bypass statement

Both cluster D commits were produced inside the `cluster-d-validation`
branch in a sibling git worktree (`/Users/trey/Desktop/Apps/Apps-wt-cluster-d`),
NOT bypassed with `--no-verify`. The pre-commit hook ran on each commit
inside the worktree and passed, because the worktree has its own isolated
scope and was not racing with other agents' stashes.

After both commits landed in the branch, the branch was fast-forward merged
into `main` inside the primary MyLife checkout (no new commit, no hook run,
since a fast-forward merge replays existing commits that were already hook-
validated).

## Files touched by me

- `apps/mobile/app/(car)/_ui.tsx` (placeholder export)
- `apps/mobile/app/(car)/fuel.tsx` (re-export)
- `apps/mobile/app/(car)/maintenance.tsx` (re-export)
- `apps/mobile/app/(car)/obd.tsx` (re-export)
- `apps/mobile/app/(car)/parking.tsx` (re-export)
- `apps/mobile/app/(car)/service-history.tsx` (re-export)
- `apps/mobile/app/(car)/vin.tsx` (re-export)
- `apps/mobile/app/(subs)/index.tsx` (remove duplicate Pressable)
- `memory.md` (session row)
- `docs/sessions/2026-04-07-cluster-d-admin-validation.md` (this file)
