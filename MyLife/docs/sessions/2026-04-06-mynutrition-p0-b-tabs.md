# MyNutrition P0-B Tab Restructure

Date: 2026-04-06

## Summary

Completed `P0-B` from `docs/plans/mynutrition-uiux-mission-control.html`:

- promoted Home into the primary nutrition tab set
- moved the six tab routes into `apps/mobile/app/(nutrition)/(tabs)/`
- rebuilt the nutrition root layout as a guarded `Stack` hosting the `(tabs)` navigator plus detail/tool screens
- loaded Plus Jakarta Sans at the nutrition layout level and gated rendering until fonts and onboarding state are ready
- updated the module definition to remove the dashboard tab, keep dashboard as a stack screen, and bump the module version to `0.3.0`

## Files Changed

- `apps/mobile/app/(nutrition)/_layout.tsx`
- `apps/mobile/app/(nutrition)/(tabs)/_layout.tsx`
- `apps/mobile/app/(nutrition)/(tabs)/index.tsx`
- `apps/mobile/app/(nutrition)/(tabs)/diary.tsx`
- `apps/mobile/app/(nutrition)/(tabs)/search.tsx`
- `apps/mobile/app/(nutrition)/(tabs)/trends.tsx`
- `apps/mobile/app/(nutrition)/(tabs)/community.tsx`
- `apps/mobile/app/(nutrition)/(tabs)/settings.tsx`
- `modules/nutrition/src/definition.ts`

## Verification

- `pnpm --filter @mylife/mobile typecheck`
- `pnpm check:module-parity`

## Notes

- `ModuleErrorBoundary`, `ModuleLockGuard`, and onboarding redirect behavior now live at the nutrition root layout.
- `/(nutrition)/dashboard` remains a stack route, so existing pushes to that path still resolve.
