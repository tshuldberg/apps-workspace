# MyRecipes P2 -- Detail & Input Screens (Obsidian Noir)

Date: 2026-04-06
Plan: `docs/plans/myrecipes-uiux-mission-control.html` Phase 2

## Summary

Redesigned 5 MyRecipes detail/input screens to the Obsidian Noir UIUX spec via a 5-member parallel `module-dev` agent team. Each agent owned one file; no edit conflicts.

## Tasks

### P2-A -- Recipe Detail (`apps/mobile/app/(recipes)/recipe/[id].tsx`)
- Full-width 380px hero photo with bottom-up gradient fade, glass pill header overlay (back, heart, share, overflow)
- Green rating pill ("4.9 (1.2K RATINGS)"), 32pt extra-bold title
- Three surface-card stat row with gold-tinted icon circles: servings (+/- stepper), prep, cook
- Ingredients with Metric/Imperial toggle (inline converter for cup/tsp/tbsp/oz/lb/fl oz), checkbox rows, Swap action for substitutions
- Nutrition GlassCard with kcal headline + proportional Protein/Carbs/Fat bars
- Utensils chips from `tool:` prefixed tags
- Numbered prep steps with auto-detected timer pills via `detectStepTimerMinutes`
- Fixed-position `#22C55E` START COOKING CTA routes to cooking-mode

### P2-B -- Add Recipe Form (`apps/mobile/app/(recipes)/add-recipe.tsx`)
- Custom Stack.Screen header (Cancel / Save pill in green palette)
- 16:9 dashed-border cover photo upload via `expo-image-picker`
- Uppercase RECIPE TITLE input, servings stepper (1-99), 3-segment difficulty toggle, prep/cook time cards
- Smart ingredient input with `parseIngredientText` NLP, quantity highlighted in accent
- Numbered step rows with step badge and multiline instruction, dashed "+ Add Step" button
- Removable tag chips with inline add
- Save wires `createRecipe`, `addIngredient`, raw `rc_steps` INSERT with `detectStepTimerMinutes`, and persists `image_uri`

### P2-C -- Shopping List Detail (`apps/mobile/app/(recipes)/shopping-list.tsx`)
- Dynamic "N ITEMS REMAINING" header + gold "CLEAR" pill
- Category sections in deterministic order (Produce, Dairy, Meat, Pantry, Bakery, Frozen, ...) with 4x22 colored accent bar via `RECIPES_CATEGORY_COLORS`
- Reuses `ShoppingItemRow` with category prop for matching left border
- Recipe sources strip above list with multiplier badges + Add Recipe pill
- Completed section (opacity 0.55) with strikethrough and gold check squares
- Floating pill add bar at bottom: 96 above tab bar
- Slide-up recipe picker sheet with 1x/2x/3x multiplier

### P2-D -- Cooking Mode (`apps/mobile/app/(recipes)/cooking-mode.tsx`)
- Full-screen immersive (header hidden via `(recipes)/_layout.tsx`)
- Top floating bar: X exit, "Cooking Mode" title, gold "VOICE ACTIVE" pill
- "Step N of M" headline, percent progress pill, 6px gold progress track
- Instruction hero card (lift surface, 28pt padding, 30pt extra-bold text)
- Auto-detected timer via `detectStepTimerMinutes` with M:SS countdown, Play/Pause/Reset controls, Vibration on complete, green when done
- Step ingredients filtered by matching item words to current step instruction
- Visual guide image block (180pt) with overlay + badge
- Bottom bar: Previous / LISTENING indicator / Next (or Finish + check icon on last step)
- PanResponder swipe nav (left advances, right goes back)

### P2-E -- Collections (`apps/mobile/app/(recipes)/collections.tsx`)
- Featured hero card (360px tall) backed by most-recent collection's first recipe image, dark glass overlay
- "Featured Collection" eyebrow + sparkle, 36pt title, description, stats row (Recipes, Updated, Avg Time), Cooking Mode CTA, Share button using native `Share.share`
- Controls row: "Your Collections" 22pt heading + accent-tinted New Collection pill
- Vertical collection cards: 16:9 2x2 thumbnail grid from `rc_recipe_collections` join, "+N" overflow cell when > 4 recipes
- Long-press delete confirm
- Glass modal for create (centered, X close, name input, multiline description, disabled-until-name submit)

## Verification

- `pnpm typecheck` PASS: 85/85 tasks successful
- `pnpm --filter @mylife/mobile typecheck` clean
- Parity hook warning non-blocking (environmental `.gitmodules` missing)

## Diagnostics fixed post-agent-run

- `shopping-list.tsx`: removed unused `listName`/`setListName` and unused `unchecked` destructure key
- `add-recipe.tsx`: removed unused `SAVE_GREEN`, replaced deprecated `ImagePicker.MediaTypeOptions.Images` with `['images']`
- `collections.tsx`: removed unused React default, ScrollView, Clock, RECIPES_ACCENT, RECIPES_TYPOGRAPHY, colors imports
- `cooking-mode.tsx`: removed unused React default and ActivityIndicator imports

## Deferred / known gaps

- `expo-keep-awake` not in `apps/mobile/package.json`; P2-D left a TODO comment rather than add a dep mid-task. Cooking mode relies on device sleep timer until dep is added.
- Add-recipe tag persistence is state-only (not yet wired to `rc_recipe_tags`); the helper join would need surfacing to the form module.
- Drag-reorder handles in add-recipe are visual only (no `react-native-draggable-flatlist` dep added).

## Files changed

- `apps/mobile/app/(recipes)/recipe/[id].tsx`
- `apps/mobile/app/(recipes)/add-recipe.tsx`
- `apps/mobile/app/(recipes)/shopping-list.tsx`
- `apps/mobile/app/(recipes)/cooking-mode.tsx`
- `apps/mobile/app/(recipes)/collections.tsx`
- `memory.md` (session row)
