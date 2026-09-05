# MyHabits Phase 0 Foundation

**Date:** 2026-04-07
**Scope:** Sequential execution of P0-A, P0-B, and P0-C from `docs/plans/myhabits-uiux-mission-control.html`.

## What Shipped

### P0-A: Design Tokens + Typography
- `modules/habits/src/ui/typography.ts` now exports `HB_FONTS` plus the requested `HB_FONT_*` aliases for Plus Jakarta Sans 400/500/600/700/800.
- `modules/habits/src/ui/tokens.ts` adds the violet accent system (`#8B5CF6` / `#A78BFA`), streak tones, seeded area colors, XP gold, completion-status colors, Obsidian surface tiers, glass presets, typography presets, and a reusable violet glow shadow.
- `modules/habits/src/ui/components/MaterialSymbol.tsx` adds a habits-local Material Symbols wrapper covering the Phase 0 icon map.
- `modules/habits/src/ui/index.ts` and `modules/habits/src/index.ts` now export the habits UI layer.
- `apps/mobile/app/(habits)/_layout.tsx` now loads Plus Jakarta Sans via `useFonts` before rendering the stack shell.
- `modules/habits/package.json` and `modules/habits/tsconfig.json` were upgraded to the repo’s standard React-capable module shape so `.tsx` UI exports typecheck inside `@mylife/habits`.

### P0-B: Tab Shell Reskin
- The four tab screens were moved into `apps/mobile/app/(habits)/(tabs)/`.
- `apps/mobile/app/(habits)/_layout.tsx` is now a nested stack with `(tabs)` as the root screen and all non-tab routes retained as stack children: `[id]`, `add-habit`, `badge-gallery`, `craving-insights`, `cycle`, `focus-analytics`, `focus-timer`, `healthkit`, `locations`, `log-craving`, `onboarding`, `pet-detail`, `program-detail`, `programs`, `rpg`, `sobriety-clock`, `stacking`, and `time-reports`.
- `apps/mobile/app/(habits)/(tabs)/_layout.tsx` now renders a glass 4-tab navigator (Today / Habits / Stats / Settings) with Plus Jakarta Sans labels, violet active tint, no top border, a custom header, and a centered quick-check FAB above the tab bar.
- The quick-check FAB opens a bottom-sheet style modal with today’s pending habits and one-tap completion for standard, measurable, and timed habits.
- Because `focus-timer` and `onboarding` live outside `(tabs)`, they render full-screen without the tab bar.

### P0-C: Shared Components
- Added 12 shared UI primitives under `modules/habits/src/ui/components/`:
  1. `GlassCard`
  2. `HabitRow`
  3. `CheckCircle`
  4. `StreakFlame`
  5. `AreaChip`
  6. `HeatmapCalendar`
  7. `BadgeTile`
  8. `PetAvatar`
  9. `StatTile`
  10. `XPBar`
  11. `QuickCheckFAB`
  12. `SectionHeader`
- `modules/habits/src/__tests__/ui.shared.test.tsx` adds targeted coverage for CheckCircle rendering, StreakFlame tone mapping, and HeatmapCalendar intensity scaling.
- The mobile habits screen test was updated to import the Today tab from its new `(tabs)` location.

## Verification
- `pnpm --filter @mylife/habits typecheck` ✅
- `pnpm --filter @mylife/habits test` ✅ 317/317 pass
- `pnpm --filter @mylife/mobile exec vitest run 'app/(habits)/__tests__/index.test.tsx'` ✅
- `pnpm --dir apps/mobile exec eslint 'app/(habits)/_layout.tsx' 'app/(habits)/(tabs)/_layout.tsx' 'app/(habits)/(tabs)/index.tsx' 'app/(habits)/(tabs)/habits.tsx' 'app/(habits)/(tabs)/stats.tsx' 'app/(habits)/(tabs)/settings.tsx' 'app/(habits)/__tests__/index.test.tsx'` ✅
- `pnpm --filter @mylife/mobile typecheck` ⚠️ still fails in unrelated Budget, Stars, and Meds files outside Habits
- `pnpm gate:function:changed` ⚠️ still fails because the changed-file sweep includes unrelated Budget and Stars mobile work already present in the repo

## Decisions
- The component animations use React Native `Animated`, not `react-native-reanimated`. The repo does not currently carry a reanimated dependency or Babel/plugin setup, so Phase 0 kept the animation work inside the project’s existing runtime constraints.
- The quick-check sheet excludes negative/sobriety habits from one-tap completion because that surface has no positive “complete” action in the current data model. Those remain available in the dedicated sobriety flows for later phase work.

## Follow-ups
- Phase 1 can now rebuild the Today, Habits, Stats, and Settings tabs on top of the new tokens, tab shell, and shared component layer.
- The repo-wide mobile gate and full mobile typecheck need separate cleanup for unrelated Budget, Stars, and Meds issues before a global green run is possible.
