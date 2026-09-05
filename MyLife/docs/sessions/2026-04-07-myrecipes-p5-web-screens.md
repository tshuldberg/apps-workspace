# MyRecipes P5 Web Screens

**Date:** 2026-04-07
**Phase:** P5 (Web Screens) of MyRecipes UIUX Mission Control
**Strategy:** 7 parallel agents (one per prompt P5-A through P5-G)

## Goal

Replace the monolithic `apps/web/app/recipes/page.tsx` (~49KB single client component handling every recipe surface) with 11 focused route pages built to the Obsidian Noir design references in `/Users/trey/Downloads/RecipesUIUX/`.

## Pre-Work

Added missing server actions to `apps/web/app/recipes/actions.ts` so the parallel agents would not collide on the same file:

- Collections CRUD: `fetchCollections`, `addCollection`, `editCollection`, `removeCollection`, `linkRecipeToCollection`, `unlinkRecipeFromCollection`
- Settings: `fetchDefaultServings`, `fetchMeasurementSystem`, `fetchSetting`, `saveSetting`
- Nutrition: `fetchNutrition`
- Meal plan: `generateShoppingListFromPlan`

## Agents Run (7 parallel, background)

| Prompt | Files | Notes |
|--------|-------|-------|
| P5-A Dashboard | `recipes/page.tsx` (917) | Sidebar nav, hero banner, stats, collections carousel, recent grid, today's plan |
| P5-B Library + Detail | `library/page.tsx` (746), `library/[id]/page.tsx` (932) | Filter sidebar, 3-col grid, sort dropdown, hero image, nutrition sidebar, scalable ingredients |
| P5-C Create + Import | `add/page.tsx` (728), `import/review/page.tsx` (710) | Hero header, ingredient parser, side-by-side raw vs parsed |
| P5-D Cooking Mode | `library/[id]/cook/page.tsx` (846) | Immersive 3-panel (ingredients/instruction/technique), circular SVG timer, keyboard nav (arrows + space), step mini-map |
| P5-E Collections | `collections/page.tsx` (715, NEW) | Grid w/ deterministic gradient placeholders, create modal, inline edit |
| P5-F Meal Planner + Grocery | `meal-planner/page.tsx` (605), `grocery/page.tsx` (649) | 7-day grid, recipe drawer, generate shopping list, category sections, progress bar |
| P5-G Pantry + Settings | `pantry/page.tsx` (981), `settings/page.tsx` (916, NEW) | Quick entry, category sidebar, expiration warnings, 4 numbered settings sections |

**Total:** 9,228 lines across 11 pages + actions.ts. All use Obsidian Noir tokens (surface tier shifts, no 1px borders), CTA gradient `#FFB877 → #C9894D`, glass morphism with backdrop-blur, 'use client' + inline `React.CSSProperties`.

## Issues Fixed Mid-Run

- P5-G initially assumed `PantryItem` had a `category` field; the actual type uses `grocery_section`. P5-B agent fixed this when it touched `pantry/page.tsx`, mapping `category` → `grocery_section` via helper functions.
- Initial `addCollection` call missed the `id` argument; fixed by passing `crypto.randomUUID()`.

## Verification

- `pnpm --filter @mylife/web typecheck` -- clean
- All 11 routes exist and link correctly to each other via the module sidebar nav
- Parity check failures are pre-existing (missing standalone repos / DESIGN.md files), unrelated to P5

## Outcome

Phase 5 complete. MyRecipes UIUX Mission Control now done across all 6 phases (P0 foundation, P1 mobile tabs, P2 mobile detail/input, P3 import pipeline, P4 settings/print, P5 web screens). The web side now has full feature parity with mobile and follows the same Obsidian Noir spec.
