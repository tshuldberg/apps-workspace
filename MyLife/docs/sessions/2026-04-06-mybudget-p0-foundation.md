# MyBudget Phase 0 Foundation

## Summary

Completed Phase 0 of `docs/plans/mybudget-uiux-mission-control.html` in sequence:

1. `P0-A` foundation tokens, typography, and icon wrapper
2. `P0-B` tab-shell restructure with glass navigation and center add FAB
3. `P0-C` shared budget UI primitives and focused UI tests

Phase 0 establishes the reusable MyBudget foundation for later screen rebuilds. The module now has its own gold chrome + green money token system, Plus Jakarta Sans font loading, a Material Symbols wrapper for budget-specific icon names, a five-tab glass shell under `(tabs)/`, and a reusable shared component kit for envelopes, transactions, accounts, goals, subscriptions, and reporting filters.

## Files Changed

### Budget mobile shell

- `apps/mobile/app/(budget)/_layout.tsx`
- `apps/mobile/app/(budget)/(tabs)/_layout.tsx`
- `apps/mobile/app/(budget)/(tabs)/index.tsx`
- `apps/mobile/app/(budget)/(tabs)/transactions.tsx`
- `apps/mobile/app/(budget)/(tabs)/subscriptions.tsx`
- `apps/mobile/app/(budget)/(tabs)/reports.tsx`
- `apps/mobile/app/(budget)/(tabs)/accounts.tsx`
- `apps/mobile/app/(budget)/__tests__/index.test.tsx`

### Budget module UI package

- `modules/budget/package.json`
- `modules/budget/tsconfig.json`
- `modules/budget/src/index.ts`
- `modules/budget/src/ui/index.ts`
- `modules/budget/src/ui/typography.ts`
- `modules/budget/src/ui/tokens.ts`
- `modules/budget/src/ui/components/MaterialSymbol.tsx`
- `modules/budget/src/ui/components/GlassCard.tsx`
- `modules/budget/src/ui/components/AmountDisplay.tsx`
- `modules/budget/src/ui/components/CategoryChip.tsx`
- `modules/budget/src/ui/components/EnvelopeCard.tsx`
- `modules/budget/src/ui/components/TxRow.tsx`
- `modules/budget/src/ui/components/AccountCard.tsx`
- `modules/budget/src/ui/components/GoalProgressRing.tsx`
- `modules/budget/src/ui/components/NetWorthStat.tsx`
- `modules/budget/src/ui/components/SubscriptionRow.tsx`
- `modules/budget/src/ui/components/AddFAB.tsx`
- `modules/budget/src/ui/components/SectionHeader.tsx`
- `modules/budget/src/ui/components/PeriodSelector.tsx`
- `modules/budget/src/__tests__/ui.shared.test.ts`

## What Changed

### P0-A

- Added module-scoped Plus Jakarta Sans font constants in `modules/budget/src/ui/typography.ts`.
- Added MyBudget Obsidian Noir override tokens in `modules/budget/src/ui/tokens.ts`:
  - warm gold chrome (`#C9894D` / `#FFB877`)
  - money semantic green (`#22C55E` / `#4ADE80`)
  - expense red (`#FFB4AB`)
  - transfer cyan (`#8BCFF0`)
  - budget surface, glass, typography, and status palettes
- Added `MaterialSymbol` icon mapping for budget design names in `modules/budget/src/ui/components/MaterialSymbol.tsx`.
- Re-exported the new UI surface from `modules/budget/src/ui/index.ts` and `modules/budget/src/index.ts`.
- Updated `apps/mobile/app/(budget)/_layout.tsx` to load Plus Jakarta Sans with `useFonts`, gate render until loaded, and apply the budget surface + font defaults.
- Switched the budget package to the React TS config and added the peer/dev dependency shape needed for `.tsx` module UI.

### P0-B

- Moved the five tab routes into `apps/mobile/app/(budget)/(tabs)/`.
- Added `apps/mobile/app/(budget)/(tabs)/_layout.tsx` with:
  - glass blur bottom nav
  - gold active state
  - uppercase Plus Jakarta Sans labels
  - centered elevated add FAB
  - budget-specific MaterialSymbol tab icons
  - custom MyBudget header with `BackToHubButton`
- Updated `apps/mobile/app/(budget)/_layout.tsx` to treat `(tabs)` as the root shell and keep the rest of the routes as stack screens, which hides the tab bar automatically on `create`, `account/create`, `onboarding`, `receipt-scan`, and the other non-tab flows.

### P0-C

- Added 12 shared primitives under `modules/budget/src/ui/components/`:
  - `GlassCard`
  - `AmountDisplay`
  - `EnvelopeCard`
  - `TxRow`
  - `CategoryChip`
  - `AccountCard`
  - `GoalProgressRing`
  - `NetWorthStat`
  - `SubscriptionRow`
  - `AddFAB`
  - `SectionHeader`
  - `PeriodSelector`
- Added `modules/budget/src/__tests__/ui.shared.test.ts` covering:
  - `AmountDisplay` sign/color behavior
  - `EnvelopeCard` near-limit status color behavior

## Verification

Passed:

- `pnpm --filter @mylife/budget typecheck`
- `pnpm --filter @mylife/budget test -- ui.shared`
- `pnpm --filter @mylife/mobile typecheck 2>&1 | rg "app/\\(budget\\)|modules/budget"`
  - no MyBudget-specific typecheck output remained after the fixes

Blocked by unrelated pre-existing worktree issues:

- `pnpm --filter @mylife/mobile typecheck`
  - fails in unrelated files outside MyBudget, including:
    - `apps/mobile/app/(market)/(tabs)/_layout.tsx`
    - `modules/nutrition/src/ui/components/MacroGrid.tsx`
    - `modules/nutrition/src/ui/components/MaterialSymbol.tsx`
- `pnpm gate:function:changed`
  - started as required, but the repo-wide changed-file sweep picked up a large unrelated dirty mobile worktree and stalled inside long-running `apps/mobile` gate/test work rather than a MyBudget-specific failure

## Notes

- The center FAB currently routes to `/(budget)/create` per the Phase 0 prompt. That route is still the existing create screen and can be fully disambiguated in Phase 2 where the plan explicitly turns `create.tsx` into a multi-mode create flow.
- The root budget package now exposes a reusable UI surface suitable for later Phase 1 and Phase 2 mobile screen rebuilds without pushing shared UI back into `apps/mobile`.
