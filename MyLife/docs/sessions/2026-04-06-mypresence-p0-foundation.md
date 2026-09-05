# MyPresence Phase 0 Foundation

Date: 2026-04-06

## Summary

Implemented Phase 0 of the MyPresence UIUX mission-control plan in sequence:

1. P0-A: presence-scoped typography, cyan token set, Material Symbols wrapper, package wiring, and Plus Jakarta Sans loading in the mobile layout.
2. P0-B: converted the mobile presence shell from a flat stack to a nested `(tabs)` layout with a glass bottom tab bar and cyan active pill treatment.
3. P0-C: added the shared MyPresence UI component layer and minimal helper tests for delta-state and XP progress math.

## Why

Phase 0 establishes the reusable design primitives all later MyPresence screens depend on. The module now has its own cyan-accent token system, scoped typography, icon mapping, shared cards/charts/FAB primitives, and the correct mobile navigation structure for later screen rebuilds.

## Files Changed

- `modules/presence/package.json`
- `modules/presence/tsconfig.json`
- `modules/presence/src/definition.ts`
- `modules/presence/src/index.ts`
- `modules/presence/src/ui/typography.ts`
- `modules/presence/src/ui/tokens.ts`
- `modules/presence/src/ui/logic.ts`
- `modules/presence/src/ui/index.ts`
- `modules/presence/src/ui/components/MaterialSymbol.tsx`
- `modules/presence/src/ui/components/GlassPanel.tsx`
- `modules/presence/src/ui/components/DailyTimeCard.tsx`
- `modules/presence/src/ui/components/XPLevelBar.tsx`
- `modules/presence/src/ui/components/BadgeChip.tsx`
- `modules/presence/src/ui/components/AppRow.tsx`
- `modules/presence/src/ui/components/GoalRing.tsx`
- `modules/presence/src/ui/components/TrendBars.tsx`
- `modules/presence/src/ui/components/FocusFAB.tsx`
- `modules/presence/src/ui/components/SectionHeader.tsx`
- `modules/presence/__tests__/ui.shared.test.tsx`
- `apps/mobile/app/(presence)/_layout.tsx`
- `apps/mobile/app/(presence)/(tabs)/_layout.tsx`
- `apps/mobile/app/(presence)/(tabs)/index.tsx`
- `apps/mobile/app/(presence)/(tabs)/stats.tsx`
- `apps/mobile/app/(presence)/(tabs)/sessions.tsx`
- `apps/mobile/app/(presence)/(tabs)/settings.tsx`
- `docs/plans/mypresence-uiux-mission-control.html`
- `pnpm-lock.yaml`
- `memory.md`

## Implementation Notes

- Added `PR_*` presence UI tokens for cyan accents, glass presets, typography, surfaces, and glow styling.
- Added `MaterialSymbol` with an explicit mapping table from design symbol names to `MaterialIcons` names.
- Switched `@mylife/presence` to the React TS config and added the RN peer/dev deps needed for shared `.tsx` exports to typecheck correctly.
- Updated presence module tab metadata to use `home`, `insights`, `timer`, and `settings`.
- Reworked the presence mobile route structure into a stack with a nested `(tabs)` group so tab screens and push screens can diverge cleanly.
- Added the shared component library required by later phases: `GlassPanel`, `DailyTimeCard`, `XPLevelBar`, `BadgeChip`, `AppRow`, `GoalRing`, `TrendBars`, `FocusFAB`, and `SectionHeader`.
- Kept data math testable via `modules/presence/src/ui/logic.ts`.

## Verification

- `pnpm install --filter @mylife/presence...`
- `pnpm --filter @mylife/presence typecheck`
- `pnpm --filter @mylife/mobile typecheck`
- `pnpm --filter @mylife/presence test -- ui.shared`
- `pnpm typecheck`

## Verification Notes

- `pnpm gate:function:changed` was started because function logic changed.
- The gate picks up unrelated changed files already present in `apps/mobile`, including cycle and garden work, so it runs the broader mobile package gate instead of isolating MyPresence.
- The gate reached mobile lint/typecheck/test execution and did not surface a MyPresence-specific failure before hanging inside the wider mobile suite, so it was stopped.
- The broader repo-wide fallback check `pnpm typecheck` completed successfully after the targeted presence/mobile checks were already green.

## Remaining Work

- Phase 1+ MyPresence screen rewrites still need to consume the new shared component layer.
- If strict gate completion is required before commit, rerun `pnpm gate:function:changed` after the unrelated mobile worktree changes are cleared or split out.
