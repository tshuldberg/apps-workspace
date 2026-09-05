---
id: 06-duplicate-module-header-remediation
title: Remediate duplicate module headers across mobile
status: queue
created: 2026-04-16
owner: hub-shell-dev
priority: high
scope: apps/mobile only (web unaffected)
---

# Duplicate Module Header Remediation

## Problem

Per user screenshot of MyWorkouts home: two stacked headers render on every tab screen.

1. **Outer header** (height ~44): `‹ Apps` • `MyWorkouts` • `☰` — the unified `ModuleHeader` injected via `ModuleLayoutWrapper` (apps/mobile/components/ModuleHeader.tsx).
2. **Inner header** (height ~64): `[dumbbell avatar] MyWorkouts / PERFORMANCE CENTER` • `🔍` `🔔` — a legacy in-content top bar (`WorkoutTopBar` in `apps/mobile/app/(workouts)/(tabs)/_screen-kit.tsx`) rendered by each screen body.

The outer bar was introduced in commit `dc7c78158` (2026-04-16, "unified module navigation"). The inner bars were introduced earlier during per-module UIUX rebuilds (MyWorkouts P1, MyPresence P1-P2, MyHabits P0 foundation, etc.) and never removed when the unified header rolled out.

## Root cause

Unified-nav rollout edited only each module's `(tabs)/_layout.tsx` (replaced custom Tabs/Stack setup with `ModuleLayoutWrapper`). It did not audit screen bodies for pre-existing in-content top bars. Result: a `ModuleHeader` is drawn by the layout, and a module-branded top bar is drawn by the screen body.

## Scope (confirmed offenders)

Mobile screens that render a secondary in-content top bar under `ModuleLayoutWrapper`:

| Module | Screens | Component |
|--------|---------|-----------|
| Workouts | `(tabs)/index.tsx`, `explore.tsx`, `workouts.tsx`, `progress.tsx`, `settings.tsx` | `WorkoutTopBar` in `_screen-kit.tsx:63` |
| Presence | `(tabs)/index.tsx`, `sessions.tsx`, `stats.tsx`, `settings.tsx` | `PresenceTopBar` (defined inline in each screen or in `_screen-kit`) |
| Habits | `(tabs)/index.tsx` (brand row inside gradient hero, line ~459) | Inline `brandTitle` + gradient logo row |

Additionally audit these module flows which may render similar inline brand/header rows (from `brandTitle`/`brandCopy` grep):
- `(mood)/` several non-tab screens (meditation-session, insights-feed, top-emotions, weekly-report, emergency-contacts, breathing, sos) — these are Stack sub-routes, NOT wrapped by ModuleLayoutWrapper, so Stack header draws + screen inline header may duplicate
- `(forums)/activity-feed.tsx` and forums `_phase1-ui.tsx`
- `(garden)/journal.tsx`, `(garden)/plant/[id].tsx`
- `(nutrition)/notes.tsx`, `restaurant.tsx`, `phase3-kit.tsx`
- `(market)/phase1.tsx`

## Remediation phases

### Phase 1 — Workouts (smallest blast radius, confirmed-broken example)
1. Delete `WorkoutTopBar` usage from all 5 `(tabs)/*.tsx` files. Keep `WorkoutTopBar` export in `_screen-kit.tsx` only if reused by non-tab routes; otherwise remove.
2. Move the two right-side icon buttons (🔍 search, 🔔 notifications) into `ModuleLayoutWrapper`'s `headerRightAccessory` prop per screen. Extend `ModuleHeader` to accept per-tab right-accessory override if needed, OR pass via `Tabs.Screen` options so each tab can supply its own header right-slot.
3. Replace `subtitle="Performance Center"` with an eyebrow label already present in `WorkoutHero` on each screen — hero already carries the section name ("Performance Center" / "Digital Sanctuary"), so no info is lost.
4. Update `apps/mobile/app/(workouts)/__tests__/index.test.tsx` mock for `WorkoutTopBar` (line 54) to match new render shape.

Acceptance:
- Only one header visible on each workouts tab screen.
- Search and notification shortcuts still reachable (either from unified header right-slot or from in-hero action buttons).
- `pnpm typecheck` green; workouts tests green.
- Manual: iPhone 16e sim, each tab (Home/Explore/Workouts/Progress/Profile) shows a single `‹ Apps | MyWorkouts | ☰` header and no second strip below it.

### Phase 2 — Presence (same pattern)
1. Repeat Phase 1 steps for `(presence)/(tabs)/*.tsx`. Inline `PresenceTopBar` function bodies are defined per-screen; delete them or consolidate into `_screen-kit`.
2. Migrate any icon-button accessories to `ModuleLayoutWrapper.headerRightAccessory`.

### Phase 3 — Habits home brand row
1. `(habits)/(tabs)/index.tsx:459` renders `<Text style={styles.brandTitle}>MyHabits</Text>` inside a gradient hero. The wrapper also renders `ModuleHeader` with `MyHabits`. Either:
   - (preferred) remove the inline brand row; let `ModuleHeader` be the only brand surface, OR
   - keep the hero but drop the word "MyHabits" — rename to something like a section eyebrow ("Today at a glance").

### Phase 4 — Stack-level sub-route headers (mood/forums/garden/nutrition/market)
1. For each file flagged in Scope (non-tab Stack routes), check `(module)/_layout.tsx` to see if the outer Stack renders its own `headerShown: true` with a module name.
2. Where the outer Stack draws a header AND the screen draws an inline brand row, remove the inline row.
3. Where the outer Stack has `headerShown: false` AND the screen draws a full header, either: (a) wire in ModuleHeader via a shared wrapper, or (b) keep the inline header — pick one per screen, but never both.

### Phase 5 — Guardrails (prevent regression)
1. Add lint/ESLint custom rule OR grep-based CI check: any file under `apps/mobile/app/(<module>)/(tabs)/` that imports `*TopBar` from `_screen-kit` should be flagged for review. Simpler: add a `scripts/check-duplicate-headers.mjs` that greps for known in-content header component names (`WorkoutTopBar`, `PresenceTopBar`, `HabitsTopBar`, etc.) inside `(tabs)` screens and fails CI if found.
2. Document the "one header per module route" rule in:
   - `apps/mobile/components/ModuleLayoutWrapper.tsx` doc comment
   - `CLAUDE.md` (Key Patterns Learned — "Unified module header is the only top chrome allowed inside a ModuleLayoutWrapper Tabs tree")
3. Add a short `docs/patterns/module-header-contract.md` with do/don't examples.

## Non-goals

- No change to hub-level tab bar (`(hub)/_layout.tsx`) — already correct.
- No web changes — `WebModuleLayoutWrapper` and its headers appear unaffected; confirm during Phase 5 audit.
- Not refactoring the underlying per-module theming (WK_ACCENT, PR_ACCENT, HB_ACCENT etc.) — these still drive `ModuleHeader`'s title color via `colors.modules[moduleId]`.

## Rollout

- One PR per phase (Phase 1 first, user-confirmed fix before proceeding).
- Each PR: file list, before/after screenshot of at least one affected screen, `pnpm check:parity` green, `pnpm gate:function:changed` green.
- Update `memory.md` sessions row per phase, full log at `docs/sessions/2026-04-XX-phase-N-duplicate-header-fix.md`.

## Open questions for the user

1. For Phase 1, do you want the module-specific icon buttons (search + notifications in workouts) migrated into the unified ModuleHeader right-slot, or dropped in favor of in-screen navigation (hero action buttons / tab-bar items)?
2. Should Phase 4 (Stack sub-routes like mood breathing, forums activity-feed) be grouped into this plan, or handled as a separate follow-up once tab screens are clean?
