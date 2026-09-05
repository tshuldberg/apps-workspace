# MyNutrition Phase 5 Web Parity

Date: 2026-04-06
Plan: `docs/plans/mynutrition-uiux-mission-control.html` (Phase 5)
Scope: `P5-A`, `P5-B`, `P5-C`

## Summary

Completed the MyNutrition web parity bundle in `docs/plans/mynutrition-uiux-mission-control.html`:

1. Added a shared nutrition web shell, design helpers, and reusable desktop primitives for the Obsidian Noir nutrition surface.
2. Rebuilt the primary web routes for home, diary, search, dashboard, trends, community, food detail, goals, and settings.
3. Added the missing Phase 2-4 web routes for log food, hydration, restaurants index/detail, notes, and export.
4. Extended nutrition web server actions to cover recents, favorites, templates, notes, energy balance, profile data, restaurants, menu items, and destructive settings flows.
5. Updated the mission-control tracker and repo memory to mark MyNutrition Phase 5 web work complete.

## Delivered

### Shared Web Shell

- Added `apps/web/app/nutrition/_lib/design.ts` with nutrition chrome tokens, nav config, date/number formatting, source badges, and theme helpers.
- Added `apps/web/app/nutrition/_components/NutritionPrimitives.tsx` and `apps/web/app/nutrition/_components/NutritionShell.tsx` plus shell CSS for the shared desktop chrome.
- Updated `apps/web/app/nutrition/layout.tsx` to load Plus Jakarta Sans, Material Symbols, the nutrition shell, and the error boundary wrapper.

### Web Route Parity

- Rebuilt `apps/web/app/nutrition/page.tsx`, `diary/page.tsx`, and `search/page.tsx` for P5-A.
- Rebuilt `apps/web/app/nutrition/dashboard/page.tsx`, `trends/page.tsx`, `community/page.tsx`, and `food/[id]/page.tsx` for P5-B.
- Rebuilt `apps/web/app/nutrition/goals/page.tsx` and `settings/page.tsx`, and added `log/page.tsx`, `water/page.tsx`, `restaurants/page.tsx`, `restaurants/[id]/page.tsx`, `notes/page.tsx`, and `export/page.tsx` for P5-C.
- The goals screen now uses the shared nutrition TDEE engine helpers on the web side.

### Action Surface

- Extended `apps/web/app/nutrition/actions.ts` with recents, favorites, meal templates, daily notes range queries, energy balance, insights, restaurant/menu creation, and a `doClearFoodLog` destructive action for settings.

## Files Changed

- `apps/web/app/nutrition/_lib/design.ts`
- `apps/web/app/nutrition/_components/NutritionPrimitives.tsx`
- `apps/web/app/nutrition/_components/NutritionShell.tsx`
- `apps/web/app/nutrition/_components/nutrition-shell.module.css`
- `apps/web/app/nutrition/layout.tsx`
- `apps/web/app/nutrition/actions.ts`
- `apps/web/app/nutrition/page.tsx`
- `apps/web/app/nutrition/diary/page.tsx`
- `apps/web/app/nutrition/search/page.tsx`
- `apps/web/app/nutrition/dashboard/page.tsx`
- `apps/web/app/nutrition/trends/page.tsx`
- `apps/web/app/nutrition/community/page.tsx`
- `apps/web/app/nutrition/food/[id]/page.tsx`
- `apps/web/app/nutrition/goals/page.tsx`
- `apps/web/app/nutrition/settings/page.tsx`
- `apps/web/app/nutrition/log/page.tsx`
- `apps/web/app/nutrition/water/page.tsx`
- `apps/web/app/nutrition/restaurants/page.tsx`
- `apps/web/app/nutrition/restaurants/[id]/page.tsx`
- `apps/web/app/nutrition/notes/page.tsx`
- `apps/web/app/nutrition/export/page.tsx`
- `docs/plans/mynutrition-uiux-mission-control.html`
- `docs/sessions/2026-04-06-mynutrition-phase-5-web-parity.md`
- `memory.md`

## Verification

- `pnpm --filter @mylife/web exec eslint app/nutrition --ext .ts,.tsx`
  - PASS
- `pnpm --filter @mylife/web typecheck`
  - blocked by pre-existing non-nutrition errors in `app/market/*` and `app/workouts/*`
- `pnpm --filter @mylife/web typecheck 2>&1 | rg 'app/nutrition|apps/web/app/nutrition'`
  - no matching TypeScript errors for the nutrition web routes
- `pnpm check:passthrough-parity`
  - PASS
- `pnpm check:parity`
  - failed in the existing workouts parity checker because `apps/mobile/app/(workouts)/explore.tsx`, `progress.tsx`, and `workouts.tsx` are missing
- `pnpm gate:function:changed`
  - started per repo policy
  - mobile lint and mobile typecheck completed
  - then stalled in the shared dirty-worktree mobile Vitest sweep, which matches the repo's known gate behavior when unrelated mobile changes are in flight

## Notes

- The nutrition web surface itself is lint-clean and no nutrition route errors appear in the web typecheck output.
- Full repo parity is still not green because of the pre-existing workouts parity failure, not because of nutrition.
- The shared function gate remains noisy in this workspace because it sweeps unrelated changed mobile files outside the nutrition scope.
