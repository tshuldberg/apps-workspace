# Phase 2B Tier 1 + Tier 2 iOS Runtime Sweep

Date: 2026-04-07
Device: iPhone 16e simulator (iOS 26.2, UDID FEDE5E75-7F2E-4114-B5FC-037021EA50B0)
Driver: Maestro v2.4.0
App: com.mytoolbox.mylife (Expo dev client)
Bundle: served by Metro on localhost:8081 (hot=false, lazy=true)

## Goal

Click through every MyLife module on a real iOS surface, surface runtime
crashes that survived the most recent native fixes (d9626903b, 554a80d62,
3510ddd18, da698c83d), fix what we can, and document the rest.

## Constraints

- Never read PNG screenshots into context (iPhone 16e screenshots are
  1170 x 2532 px which exceeds the agent image limit). All verification
  used Maestro exit codes, view-hierarchy dumps, file-size checks, and
  iOS log inspection.
- No metro restart, no native rebuild, no node_modules patching.

## Discoveries

### Navigation surface

- The MyLife app uses expo-router with deep links via the `mylife://`
  scheme. Each module is mounted under `mylife://(<id>)`.
- The hub dashboard (`mylife://(hub)`) renders a 2x2 bento grid of the
  first four enabled modules followed by a horizontal Quick Actions row
  and a 4-column Library Modules grid of every enabled visible module.
- Bento cards expose accessibility labels of the form
  `MYBUDGET, 4, Total Budget Cents, 0, Spent This Month Cents, $0.00`.
  Library grid items expose the bare module name (`MyBudget`).
- The previous "tap by short module name" strategy (`Budget`) collides
  with the Quick Actions buttons that render the same string in upper
  case. Maestro disambiguation requires the full bento label or a deep
  link.
- Cold launches without `clearState` resume in whichever module the
  previous Maestro session left the app in (Maestro launchApp does not
  reset router state). Deep links override the resumed location.

### Module hierarchy fingerprint

Maestro view hierarchies expose React Native text via `accessibilityText`,
not `text`. Empty `accessibilityText` entries are noise. Counting
non-empty entries gives a quick health metric per module screen.

## Tier 1 results

Strategy: launch app, deep-link to `mylife://(hub)`, deep-link to
`mylife://(<module>)`, capture screenshot, dump hierarchy, compute
non-empty entry count, classify.

| module    | status     | hier entries | notes |
|-----------|-----------|-------------:|-------|
| budget    | OK        | 58 | |
| habits    | STUCK_LOADER | 6 | ActivityIndicator never resolves |
| health    | OK        | 46 | |
| recipes   | OK        | 26 | |
| mood      | OK        | 42 | |
| meds      | CRASH (fixed in this session) | 22 | TodayScreen load failed: no such table hub_settings |
| cycle     | OK        | 24 | |
| stars     | OK        | 56 | |
| trails    | OK        | 58 | |
| workouts  | OK        | 36 | |
| garden    | OK        | 26 | Welcome onboarding screen |
| forums    | OK        | 49 | |
| market    | OK        | 33 | |
| nutrition | OK        | 33 | |
| presence  | OK        | 29 | |
| rsvp      | OK        | 27 | hidden in release-states but routable |
| books     | OK        | 32 | hidden in release-states but routable |
| flash     | OK        | 41 | hidden |
| fast      | OK        | 58 | hidden |
| journal   | OK        | 49 | hidden |
| notes     | OK        | 44 | hidden |
| voice     | OK        | 45 | hidden |
| words     | OK        | 32 | hidden |
| surf      | OK        | 57 | hidden |
| homes     | OK        | 20 | hidden, empty state |
| pets      | OK        | 23 | hidden |
| car       | OK        | 38 | hidden |
| closet    | OK        | 51 | hidden |
| mail      | OK        | 19 | hidden, Welcome onboarding |
| subs      | CRASH      | 16 | ModuleErrorBoundary: no such table sb_subscriptions |

User-testable on iOS after Tier 1 fixes: 28 of 30 modules.

## Tier 2 results

For the 27 Tier 1 GREEN modules, run a deeper flow: deep-link home,
take screenshot, swipe up twice, take screenshots, deep-link back to
hub, take screenshot. Each module produced 4 screenshots and 0 crashes.
Module-home screenshots compress to ~53 KB because module home cards
sit on a near-uniform dark background; scroll1/scroll2 jump to
80 KB - 929 KB once content panes scroll into view.

| modules captured | screens | crashes | stuck loaders |
|-----------------:|--------:|--------:|--------------:|
| 27 | 108 | 0 | 0 |

## Bugs found

### Bug 1: MyMeds TodayScreen crash on boot

- File: `apps/mobile/app/(meds)/(tabs)/index.tsx:213-251`
- Symptom: ModuleErrorBoundary surfaces
  `TodayScreen load failed Error: FunctionCallException ... no such
  table: hub_settings`
- Root cause: meds (and workouts) read user preferences from a
  `hub_settings` table that was never created in the hub schema. The
  table is referenced by `apps/mobile/app/(meds)/home-style.tsx` and
  `apps/mobile/lib/workouts/settings.ts` as well.
- Fix: add `CREATE TABLE IF NOT EXISTS hub_settings` to
  `packages/db/src/hub-schema.ts` so `initializeHubDatabase` creates
  it on every boot.
- Verified live on simulator: meds now opens to the empty-state
  Today dashboard with `START SETUP` CTA and 5-tab nav.
- Commit: 6d034b4d5

### Bug 2: MySubs missing migrations

- File: `apps/mobile/components/DatabaseProvider.tsx:76-106`
- Symptom: ModuleErrorBoundary surfaces
  `SQLiteErrorException ... no such table: sb_subscriptions`
- Root cause: SUBS_MODULE is intentionally absent from
  `MODULE_DEFINITIONS_WITH_MIGRATIONS`. The hub never runs the
  subs migrations. release-states.ts marks subs as
  always-hidden, so this is unreachable from the dashboard, but
  any deep link surfaces the error boundary.
- Decision: not fixed in this session. The crash is contained
  inside the ModuleErrorBoundary and is unreachable from the
  user-visible dashboard. A future release that flips subs to
  visible must also add SUBS_MODULE to the migration map.

### Bug 3: MyHabits stuck loader / infinite loop

- Files: `apps/mobile/app/(habits)/_layout.tsx:23-60`,
  `apps/mobile/app/(habits)/(tabs)/_layout.tsx`,
  `apps/mobile/app/(habits)/(tabs)/index.tsx`
- Symptoms (two paths):
  1. Deep link `mylife://(habits)`: HabitsLayout shows
     `ActivityIndicator` ("In progress") forever, no error boundary.
  2. Tap MYHABITS bento card on dashboard: ModuleErrorBoundary
     surfaces `Maximum update depth exceeded. This can happen when a
     component repeatedly calls setState inside componentWillUpdate or
     componentDidUpdate.`
- Diagnosed cause for the loop path: HabitsLayout's `useEffect` listed
  `router` as a dependency. The redirect predicate
  `onboardingDone !== 'true' && habitCount === 0` is true on first
  boot, so the effect calls `router.replace('/(habits)/onboarding')`.
  In expo-router 6 the router instance reference can change between
  renders, which re-fires the effect, which re-replaces, looping.
- Partial fix in this session:
  - Wrap the body in `try / catch / finally` so `setChecked(true)` is
    always called even when getSetting / countHabits throw.
  - Drop `router` from the deps to break the redirect loop.
- Status: still stuck after the fix. The deep-link path still shows
  the ActivityIndicator and the tap path still surfaces the same
  Maximum update depth error. The actual loop source is downstream of
  HabitsLayout (likely in `(habits)/(tabs)/_layout.tsx` or in
  `HabitsTodayScreen`), and could not be fully isolated within the
  budget for this session.
- Commits: f5475032d, 1ae12a6bd

## Files touched

- `packages/db/src/hub-schema.ts` (added CREATE_HUB_SETTINGS,
  registered in HUB_TABLES)
- `apps/mobile/app/(habits)/_layout.tsx` (try/catch/finally + drop
  router from deps)

## Commits

- 6d034b4d5 fix(db): add hub_settings table for meds and workouts preferences
- f5475032d fix(habits): unblock HabitsLayout when getSetting or countHabits throws
- 1ae12a6bd fix(habits): remove router from HabitsLayout effect deps to break loop

## Aggregate

After this pass: **28 of 30 modules user-testable on iOS**.
Blocking issue remaining: MyHabits (Tier 1 stuck loader / Tier 2 infinite render loop).
Non-blocking known issue: MySubs deep-link surfaces a crash boundary
because subs is intentionally excluded from the migrations map.

## Tooling notes for future runs

- Maestro on iPhone 16e produces 1170 x 2532 PNGs that exceed the
  agent's image read limit. Always inspect via `sips`, `stat`, and
  `maestro hierarchy` instead of any image read.
- `maestro hierarchy` output begins with two non-JSON lines
  (`Running on iPhone ...` and `None: `). Strip everything before
  the first `{` before parsing.
- Module screen content and deep-link routing all flow through
  `mylife://(<id>)`. Stick to deep links for the cleanest test path
  and use bento card accessibility labels (the full
  `MYNAME, n, Stat, n, Stat, n, ...` string) when tap navigation is
  required.
- Metro lazy bundles (hot=false, lazy=true) are picked up on cold
  app restart. Touch any file under `apps/mobile/app/_layout.tsx`
  before terminating + relaunching to force Metro to invalidate the
  entry chunk.

## Artifacts (not committed)

All Maestro flows and per-module hierarchy dumps live under
`/tmp/maestro-flows/`. Per-module screenshots:
- Tier 1 deep-link captures: `/tmp/maestro-flows/dl-<module>.png`
- Tier 2 module sweeps: `/tmp/maestro-flows/t2-<module>-{home,scroll1,scroll2,back}.png`
- Per-module hierarchies: `/tmp/maestro-flows/hier-<module>.json`,
  `/tmp/maestro-flows/hier-t2-<module>.json`
