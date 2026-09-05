# MyCycle UIUX Phase 0 — Foundation

Date: 2026-04-06
Plan: `docs/plans/mycycle-uiux-mission-control.html`

## Summary

Completed all 3 Phase 0 prompts (P0-A, P0-B, P0-C) for the MyCycle Obsidian Noir redesign. Phase 0 is the sequential foundation that every subsequent phase depends on: design tokens, tab restructure, and shared component primitives.

## P0-A — Design Tokens + Typography

- Added `modules/cycle/src/ui/typography.ts` with `CYCLE_FONTS` constants (5 Plus Jakarta Sans weights) plus individual `CYCLE_FONT_*` aliases.
- Added `modules/cycle/src/ui/tokens.ts` with the dual accent strategy: warm gold `CYCLE_ACCENT` (#C9894D) for chrome/CTAs alongside 4 phase semantic colors (menstrual #EF4444, follicular #FBCFE8, ovulation #F472B6, luteal #FDA4AF). Also exports surfaces, glass, gradient, typography presets, and `getPhaseColor` helper.
- Added `modules/cycle/src/ui/index.ts` barrel re-exporting tokens, typography, and components.
- Re-exported everything from `modules/cycle/src/index.ts` so mobile/web can consume via `@mylife/cycle`.
- Updated `modules/cycle/src/definition.ts` accentColor to `#C9894D` (gold chrome) — phase colors live in `ui/tokens.ts`.
- Updated `apps/mobile/app/(cycle)/_layout.tsx` to load Plus Jakarta Sans via `useFonts`, gate render on fonts loaded with a spinner fallback, and consume `CYCLE_ACCENT` for the lock guard accent.

## P0-B — Tab Restructure to 5-Tab Navigator

- Converted the flat `(cycle)/` Stack into a nested structure: `(cycle)/_layout.tsx` is now a Stack that hosts a `(tabs)` group plus the remaining non-tab stack screens (log-day, pregnancy, pregnancy-log, temperature, sharing, community, insights-detail, compare).
- Created `apps/mobile/app/(cycle)/(tabs)/_layout.tsx` with an Expo Router `Tabs` navigator for 5 tabs: Home, Calendar, History, Insights, Settings.
- Glass bottom nav: `BlurView` background, `borderTopWidth: 0` (no-line rule), active tint `#C9894D`, inactive tint `rgba(228,225,233,0.4)`, 10px uppercase `CYCLE_FONTS.medium` labels, lucide icons (`Home`, `Calendar`, `History`, `TrendingUp`, `Settings`).
- `git mv`'d `index.tsx`, `insights.tsx`, and `settings.tsx` into `(cycle)/(tabs)/` and fixed their relative imports (`../../components/` → `../../../components/`).
- Created placeholder `(tabs)/calendar.tsx` and `(tabs)/history.tsx` screens (real implementations land in P1-B and P1-C).
- Preserved `ModuleLockGuard` and `ModuleErrorBoundary` wrappers at the outer layout.

## P0-C — Shared Components

Created 7 reusable primitives under `modules/cycle/src/ui/components/`:

1. **`PhaseRing.tsx`** — 288px SVG ring built with `react-native-svg` `Circle` stroke-dasharray segments. Accepts the live prediction engine shape (`currentDay`, `totalDays`, `phase`, phase lengths). Centers a labeled day count, phase pill, and a 12 o'clock active indicator dot. Uses a single rotated `G` group so segment 0 starts at the top.
2. **`PhaseBadge.tsx`** — small dot+label pill with `sm`/`md` sizes, colored by phase.
3. **`PhaseLegend.tsx`** — horizontal row of 4 `PhaseBadge`s for use below the ring.
4. **`GlassCard.tsx`** — Obsidian Noir glass card with `low`/`high` variants, 16px radius, no borders, optional press scale animation (1.02 on press).
5. **`LogTodayFAB.tsx`** — contextual FAB: absolute `bottom: 112`, right 24, `expo-linear-gradient` from `CYCLE_ACCENT_LIGHT` to `CYCLE_ACCENT`, 0.95 scale on press, text "+" glyph (no icon dep) + label.
6. **`SectionDivider.tsx`** — invisible spacer (default 32px) enforcing the no-line rule.
7. **`StatPill.tsx`** — compact uppercase-label + bold-value pill for analytics/history headers.

All 7 components export from `modules/cycle/src/ui/index.ts` and through the module barrel `@mylife/cycle`.

## Package + Test Infrastructure

- Updated `modules/cycle/package.json` to expose a secondary `./ui` entry and declare peer deps on `react`, `react-native`, `react-native-svg`, `expo-linear-gradient`, `@mylife/ui`.
- Updated `modules/cycle/tsconfig.json` to extend `@mylife/typescript-config/react.json` and include `react-native` ambient types.
- Added `modules/cycle/src/__tests__/ui.phase-ring.test.ts` verifying the phase-to-color mapping: 4 tests covering direct token access, key coverage, the `getPhaseColor` helper, and safe fallback for unknown/null phases.

## Verification

- `pnpm --filter @mylife/cycle typecheck` — clean
- `pnpm --filter @mylife/mobile typecheck` — clean
- `pnpm --filter @mylife/cycle test` — **203/203 passing** (7 test files: engine 26, insights 30, crud 25, temperature 33, sharing 33, pregnancy 52, ui.phase-ring 4)

## Files Changed

Created:
- `modules/cycle/src/ui/typography.ts`
- `modules/cycle/src/ui/tokens.ts`
- `modules/cycle/src/ui/index.ts`
- `modules/cycle/src/ui/components/PhaseRing.tsx`
- `modules/cycle/src/ui/components/PhaseBadge.tsx`
- `modules/cycle/src/ui/components/PhaseLegend.tsx`
- `modules/cycle/src/ui/components/GlassCard.tsx`
- `modules/cycle/src/ui/components/LogTodayFAB.tsx`
- `modules/cycle/src/ui/components/SectionDivider.tsx`
- `modules/cycle/src/ui/components/StatPill.tsx`
- `modules/cycle/src/__tests__/ui.phase-ring.test.ts`
- `apps/mobile/app/(cycle)/(tabs)/_layout.tsx`
- `apps/mobile/app/(cycle)/(tabs)/calendar.tsx`
- `apps/mobile/app/(cycle)/(tabs)/history.tsx`

Modified:
- `modules/cycle/package.json`
- `modules/cycle/tsconfig.json`
- `modules/cycle/src/definition.ts`
- `modules/cycle/src/index.ts`
- `apps/mobile/app/(cycle)/_layout.tsx`

Moved (git mv):
- `apps/mobile/app/(cycle)/index.tsx` → `(cycle)/(tabs)/index.tsx`
- `apps/mobile/app/(cycle)/insights.tsx` → `(cycle)/(tabs)/insights.tsx`
- `apps/mobile/app/(cycle)/settings.tsx` → `(cycle)/(tabs)/settings.tsx`

## Next

Phase 1 (P1-A through P1-E) can now run in parallel. All 5 prompts depend only on Phase 0, and each one owns a different tab screen so there are no file conflicts.
