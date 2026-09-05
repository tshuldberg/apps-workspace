# 2026-04-16: Duplicate module header sweep

## Problem

User screenshot of MyWorkouts home showed two stacked headers: the unified
`ModuleHeader` (`‹ Apps | MyWorkouts | ☰`) on top, and a module-branded
in-content top bar (`MyWorkouts / PERFORMANCE CENTER 🔍 🔔`) underneath.

Root cause: the 2026-04-16 "unified module navigation" commit (`dc7c78158`)
added `ModuleHeader` via `ModuleLayoutWrapper` to every module's tabs layout,
but did not remove the per-screen in-content top bars that earlier per-module
UIUX rebuilds had rendered inside screen bodies.

## Shared plumbing

- `apps/mobile/components/ModuleHeader.tsx`: right slot now always wraps both
  the optional per-screen accessory AND the hamburger in a single row
  (`flexDirection: 'row'`, `gap: 10`). Previously, a `rightAccessory`
  replaced the hamburger.
- `apps/mobile/components/ModuleLayoutWrapper.tsx`: the Tabs `header`
  callback now reads `options.headerRight` (the standard React Navigation
  convention) and forwards it to `ModuleHeader.rightAccessory`. Per-tab
  icons can therefore be declared directly on `<Tabs.Screen options>` in
  the module's tabs layout, or dynamically via `navigation.setOptions` when
  icons depend on screen state.

## Modules fixed

### Workouts (5 screens)

- `_layout.tsx` declares per-tab `headerRight` with the original icon actions:
  - index: search → `/explore`, notifications → `/insights`
  - explore: notifications → `/insights` (dead search button dropped)
  - workouts: add_circle → `/builder`
  - progress: search → `/history`, notifications → `/insights`
- `settings.tsx` uses `navigation.setOptions` in a `useEffect` to toggle
  between edit/check_circle icons driven by `isEditingProfile` state.
- All five tab screens had `<WorkoutTopBar>` blocks removed, along with
  unused imports of `WorkoutTopBar` and `WorkoutIconButton`.
- Test mock at `apps/mobile/app/(workouts)/__tests__/index.test.tsx`
  updated to drop the now-unused `WorkoutTopBar` / `WorkoutIconButton`
  stubs.

### Presence (4 screens)

- `_layout.tsx` declares per-tab `headerRight` via shared `SettingsButton`
  + `DiscoverChip` components inside the layout:
  - index: Discover chip + settings gear
  - stats: settings gear
  - sessions: settings gear
- Removed the `PresenceTopBar` / `PeriodTopBar` / `SessionsTopBar` /
  `SettingsTopBar` local components from each screen.
- Removed the `<View style={styles.stickyShell}>` wrappers and
  `stickyHeaderIndices` props that existed only to support the old top
  bar. stats.tsx shifted from `[0, 1]` to no sticky (period chips are no
  longer index 1 in the tree).

### Habits (home tab)

- `(tabs)/index.tsx` dropped the `GlassCard` brand header row
  (avatar + "MyHabits" title + notifications + more_vert). The
  more_vert → /(habits)/settings icon moved into the unified header
  via `Tabs.Screen` options in `(tabs)/_layout.tsx` using the shared
  `HeaderIconButton` from `components/habits/phase1-shared`.
- Notifications button was a dead placeholder with no onPress; dropped.

### Forums (5 tab screens, all sharing `_phase1-ui.tsx`)

- Removed the inline brand rows (`HeaderAvatar` + "MyForums" /
  "Communities" / "Search" / "Saved" brandTitle + action icons) from
  Feed, Communities, Search, and Saved sections of `_phase1-ui.tsx`.
- `(tabs)/_layout.tsx` now declares per-tab `headerRight`:
  - feed: notifications → /activity-feed; more_vert → Alert menu
  - communities: add → /create-community; more_vert → Alert
  - search / saved / profile: none
- user-profile.tsx (Stack route, not inside tabs) retains its own
  profile chrome as it is not a duplicate of the tabs-level
  `ModuleHeader`.

## Not touched (no duplicate found)

Audit flagged by grepping `brandTitle` / `brandCopy` but on inspection
these are content-specific headers (week nav, day detail, back buttons),
not brand duplicates under a `ModuleLayoutWrapper`:

- `(mood)/weekly-report.tsx` "WEEKLY REPORT" header is week-nav chrome.
- `(garden)/journal.tsx`, `(garden)/plant/[id].tsx` – no brand rows.
- `(nutrition)/notes.tsx`, `(nutrition)/restaurant.tsx`,
  `(nutrition)/phase3-kit.tsx` – back-button kits, not brand rows.
- `(market)/phase1.tsx` – back-button kit, not a brand row.

## Verification

- `pnpm typecheck` (apps/mobile) green after every edit
  (enforced by PostToolUse hook).
- `npx vitest run app/(workouts)/__tests__/index.test.tsx` green (2/2).
- `pnpm check:parity` green: workouts / module / passthrough / module
  layouts all passed.

## Pattern worth remembering

If `ModuleLayoutWrapper` is wrapping a tabs tree, **no screen under it
should render its own top bar component.** Per-tab icons belong on
`<Tabs.Screen options={{ headerRight: () => ... }}>`. Dynamic icons that
depend on screen state belong in a `useEffect` calling
`navigation.setOptions`. The `ModuleHeader` right slot renders the
accessory followed by the hamburger menu, in that order.
