# MyRecipes UIUX Mission Control

**Date:** 2026-04-06
**Type:** Planning / Mission Control HTML generation
**Artifact:** `docs/plans/myrecipes-uiux-mission-control.html`

## Summary

Built an interactive Mission Control HTML plan for the MyRecipes UIUX redesign, matching the pattern previously used for MyMood and MyHealth. 26 executable prompts mapped to 27 design screens from `/Users/trey/Downloads/RecipesUIUX/`, organized into 6 phases.

## Source Material

- **Design system:** `/Users/trey/Downloads/RecipesUIUX/obsidian_noir/DESIGN.md` -- "The Digital Curator" / Obsidian Noir theme with culinary green (#22C55E) accent
- **27 design screens:** 15 mobile + 11 web + 1 print
- **Existing prompt doc:** `docs/uiux-prompts/myrecipes.md`
- **Current code:** `apps/mobile/app/(recipes)/`, `apps/web/app/recipes/`, `modules/recipes/`

## Phase Structure

| Phase | Type | Prompts | Screens Covered |
|-------|------|---------|-----------------|
| P0 Foundation | Sequential | 3 | tokens+typography, tab restructure, shared components |
| P1 Core Tabs | Parallel | 5 | home, recipe library, meal planner, shopping lists hub, pantry tracker |
| P2 Detail Screens | Parallel | 5 | recipe detail, add recipe, shopping list detail, cooking mode, collections |
| P3 Import Pipeline | Parallel | 4 | source hub, import review, photo OCR, video import |
| P4 Settings + Print | Parallel | 2 | settings, print preview (web) |
| P5 Web Screens | Parallel | 7 | web dashboard, library+detail, create+import, cooking mode, collections, meal planner+grocery, pantry+settings |

## Key Gap Analysis

- **Tab structure:** Design requires 5 tabs (Home/Recipes/Plan/Shop/Pantry); code has 4 (Home/Recipes/Meal Plan/Settings)
- **Shopping Lists and Pantry** need promotion from hidden stack screens to bottom tabs
- **Settings** needs demotion from tab to header gear icon
- **Typography:** Inter -> Plus Jakarta Sans across all screens
- **No-line rule:** Must remove `borderTopWidth: 1` from tab bar; use surface color shifts instead
- **Tab icons:** Emoji -> Material Symbols style (dashboard, restaurant_menu, calendar_today, shopping_cart, inventory_2)
- **Accent color:** Already correct (`#22C55E` in `modules/recipes/src/definition.ts`), no change needed
- **New files needed:**
  - Mobile: `import-photo.tsx`, `import-video.tsx`
  - Web: `[id]/print/page.tsx`, `[id]/cook/page.tsx`, `collections/page.tsx`

## Files Changed

- Created: `docs/plans/myrecipes-uiux-mission-control.html` (26-prompt interactive tracker with localStorage state, copy-to-clipboard, collapsible phases)
- Updated: `memory.md` (added session row)

## Execution Path

- **Session 1:** Run P0-A -> P0-B -> P0-C sequentially (foundation)
- **Sessions 2-17:** Run P1-P4 (16 mobile prompts) in parallel after P0
- **Sessions 18-24:** Run P5 (7 web prompts) after mobile complete
- **Session 25:** Verification (`pnpm typecheck`, `pnpm test`, visual review)
- **Max parallelism:** 23 prompts can run simultaneously after P0 foundation

## References

- MyHealth Mission Control: `docs/plans/myhealth-uiux-mission-control.html` (template pattern)
- MyMood Mission Control: `docs/plans/mymood-uiux-mission-control.html`
- Design reference directory: `/Users/trey/Downloads/RecipesUIUX/` (keep -- all prompts reference these paths)

## Notes

- Module accent color is already correct (#22C55E). No change needed in `modules/recipes/src/definition.ts`.
- Tab bar restructure is the largest structural change. All existing screens remain accessible; just the tab visibility changes.
- Settings design screen references tabs "Recipes, Import, Loom, Vault" -- ignore; use the actual 5-tab structure from P0-B.
- Mission control HTML includes localStorage state tracking so progress persists across browser sessions.
