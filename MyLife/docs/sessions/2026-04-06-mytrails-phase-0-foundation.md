# MyTrails Phase 0 Foundation

## Summary

Completed Phase 0 of `docs/plans/mytrails-uiux-mission-control.html` in sequence:

1. `P0-A` tokens, typography, and Material Symbols wrapper
2. `P0-B` tab-shell restructure with glass navigation and center record FAB
3. `P0-C` shared trails UI primitives and focused UI tests

Phase 0 now gives MyTrails a module-scoped Obsidian Noir foundation with lime trail accents, Plus Jakarta Sans, a dedicated glass tab shell, and the shared card/stat/chart primitives that later phases can build on.

## Files Changed

### Mission control and logs

- `docs/plans/mytrails-uiux-mission-control.html`
- `docs/sessions/2026-04-06-mytrails-phase-0-foundation.md`
- `memory.md`

### Trails mobile shell

- `apps/mobile/app/(trails)/_layout.tsx`
- `apps/mobile/app/(trails)/(tabs)/_layout.tsx`
- `apps/mobile/app/(trails)/(tabs)/index.tsx`
- `apps/mobile/app/(trails)/(tabs)/trails.tsx`
- `apps/mobile/app/(trails)/(tabs)/recordings.tsx`
- `apps/mobile/app/(trails)/(tabs)/settings.tsx`

### Trails module UI package

- `modules/trails/package.json`
- `modules/trails/tsconfig.json`
- `modules/trails/src/index.ts`
- `modules/trails/src/ui/index.ts`
- `modules/trails/src/ui/typography.ts`
- `modules/trails/src/ui/tokens.ts`
- `modules/trails/src/ui/components/MaterialSymbol.tsx`
- `modules/trails/src/ui/components/GlassCard.tsx`
- `modules/trails/src/ui/components/TrailCard.tsx`
- `modules/trails/src/ui/components/StatDisplay.tsx`
- `modules/trails/src/ui/components/DifficultyChip.tsx`
- `modules/trails/src/ui/components/MiniMapCard.tsx`
- `modules/trails/src/ui/components/RecordingCard.tsx`
- `modules/trails/src/ui/components/ElevationMiniChart.tsx`
- `modules/trails/src/ui/components/WeatherChip.tsx`
- `modules/trails/src/ui/components/GearRow.tsx`
- `modules/trails/src/ui/components/PackingRow.tsx`
- `modules/trails/src/ui/components/RecordFAB.tsx`
- `modules/trails/src/ui/components/SectionHeader.tsx`
- `modules/trails/src/__tests__/difficulty.test.ts`
- `modules/trails/src/__tests__/ui.shared.test.tsx`
- `modules/trails/src/engine/difficulty-calculator.ts`
- `modules/trails/src/react-dom-server.d.ts`

### Related parity and verification touchpoints

- `apps/web/app/trails/ui.ts`
- `modules/stars/src/ui/tokens.ts`
- `pnpm-lock.yaml`

## What Changed

### P0-A

- Added `modules/trails/src/ui/typography.ts` with Plus Jakarta Sans font constants for regular, medium, semibold, bold, and extrabold weights.
- Added `modules/trails/src/ui/tokens.ts` with the lime accent palette, difficulty colors, recording-state colors, weather tones, trail-type colors, glass tokens, typography presets, and lime glow helpers.
- Added `modules/trails/src/ui/components/MaterialSymbol.tsx` to normalize MyTrails design icon names onto runtime Material Community Icons.
- Re-exported the shared UI surface from `modules/trails/src/ui/index.ts` and `modules/trails/src/index.ts`.
- Updated `apps/mobile/app/(trails)/_layout.tsx` to load the Plus Jakarta Sans font family before rendering the trails stack.

### P0-B

- Moved the four primary tab routes into `apps/mobile/app/(trails)/(tabs)/`.
- Added `apps/mobile/app/(trails)/(tabs)/_layout.tsx` with:
  - a blurred glass bottom bar
  - lime active state
  - custom tab icons via `MaterialSymbol`
  - a centered `RecordFAB`
  - a custom header shell
- Updated the root trails layout to use a stack that hosts `(tabs)` plus full-screen/detail routes so the tab bar disappears on `record`, `recording/[id]`, and `route-builder`.
- Wired record-FAB pulse state to the recordings store so active recordings visually animate from the shared shell.

### P0-C

- Added 11 new shared UI primitives plus the icon wrapper already required by `P0-A`, covering cards, stats, difficulty, minimap, recording summaries, elevation sparkline, weather, gear, packing, record FAB, and section headers.
- Added `modules/trails/src/__tests__/ui.shared.test.tsx` covering:
  - `DifficultyChip` color and label mapping
  - `StatDisplay` value and unit formatting
- Updated `modules/trails/src/engine/difficulty-calculator.ts` and `apps/web/app/trails/ui.ts` to use the same Phase 0 difficulty palette, keeping mobile/web display intent aligned.
- Switched the trails module package to the React TS base and added the peer/dev dependency shape needed for shared React Native UI inside `modules/trails`.

## Verification

Passed:

- `pnpm install`
- `pnpm --filter @mylife/trails test`
- `pnpm --filter @mylife/trails typecheck`
- `pnpm --filter @mylife/mobile typecheck`

## Gate Status

- `pnpm gate:function:changed` was started as required because function logic changed.
- The gate completed the repo-wide mobile lint sweep with warnings only and reached `apps/mobile` typecheck successfully.
- The run then stalled in the dirty-worktree mobile test sweep rather than failing on a MyTrails-specific file. Multiple lingering `apps/mobile` vitest processes were already present in the wider workspace, so the required changed-file gate could not be observed to a clean exit in this session.

## Notes

- `modules/stars/src/ui/tokens.ts` was updated to re-export `ST_FONTS`, which surfaced during the full mobile typecheck pass and was needed to keep the broader app tree compiling while verifying the trails work.
- The mission-control tracker was updated to mark `P0-A`, `P0-B`, and `P0-C` as done.
