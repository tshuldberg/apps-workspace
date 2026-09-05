# MyRecipes P4 — Settings & Print

Date: 2026-04-06
Phase: Phase 4 of MyRecipes UIUX mission control (`docs/plans/myrecipes-uiux-mission-control.html`)
Strategy: 2-agent parallel team (both `hub-shell-dev`, non-overlapping files)

## Scope

Two independent redesign tasks executed concurrently:

- **P4-A** — Mobile settings screen redesign to Obsidian Noir spec
- **P4-B** — Web print-optimized recipe page

## P4-A: Settings Screen Redesign

### Files modified
- `apps/mobile/app/(recipes)/settings.tsx` (full rewrite)

### Design sections implemented
- **Header** — "Settings" extra-bold title + "Tailor your culinary archive to your lifestyle." subtitle (Plus Jakarta Sans)
- **Defaults** (gold-iconed section header)
  - 2-column bento: Default Servings stepper card ("4 People" via Alert sheet) + Measurement Units card (Metric/Imperial toggle)
  - Full-width Preferred Cuisine dropdown (10 cuisines via Alert)
- **Dietary Restrictions** — single GlassCard with 3 rows (Vegetarian off, Vegan on, Gluten-Free off) using native `Switch` with green `#22C55E` track when on
- **Cooking Preferences**
  - Skill Level row with Intermediate pill (Beginner/Intermediate/Advanced selector)
  - Timer Sound row with "Classic" + chevron (Classic/Chime/Bell/Soft selector)
- **Storage & Data bento** — "1.2 GB" local cache square card next to stacked Export/Import buttons. Export uses `Share` API with full JSON payload from `getRecipes(db, {})`.
- **Danger Zone** — top divider, red "Delete All Recipes" button (`#EF4444` text on `#93000A` 20% bg). Two-step confirmation Alert; on confirm wipes `rc_recipes`, `rc_ingredients`, `rc_steps`, `rc_recipe_tags`, `rc_recipe_collections`.
- **Footer** — "VERSION 2.4.0  •  OBSIDIAN NOIR" centered, letter-spaced

### Implementation notes
- Uses `GlassCard` from `@mylife/recipes` for all surfaces
- Uses `RECIPES_ACCENT`, `RECIPES_DANGER`, `RECIPES_TERTIARY`, `RECIPES_SECONDARY`, `RECIPES_SURFACES`, `JAKARTA_FONTS` tokens
- All settings persisted via `getSetting`/`setSetting` keys: `defaultServings`, `measurementSystem`, `preferredCuisine`, `skillLevel`, `timerSound`, `dietVegetarian`, `dietVegan`, `dietGlutenFree`
- Loading + error states preserved
- Lucide icons: Sliders, Leaf, Flame, Database, Upload, Download, Trash2, Edit3, ChevronDown, ChevronRight, Salad, WheatOff

## P4-B: Print Preview (Web)

### Files created/modified
- `apps/web/app/recipes/library/[id]/print/page.tsx` (replaced stub re-export with ~600-line client component)
- `apps/web/app/recipes/library/[id]/print/nutrition-action.ts` (new server action wrapping `calculateRecipeNutrition`)

> Note: the mission-control plan specified `apps/web/app/recipes/[id]/print/page.tsx` but the actual route is under `library/[id]/`. The agent detected the drift and adapted without asking. Worth flagging in the plan HTML for future phases.

### Design sections implemented
- Header bar with back link + title + Print Recipe button (hidden in print via `.no-print` + `@media print`)
- Recipe title (44px, 800 weight, dark) with optional description
- Metadata bar (Prep / Cook / Servings) with accent label color
- QR code with "Scan to Sync" caption
- Full-width recipe photo (300px tall, rounded, grayscale + contrast bump on print)
- Two-column responsive grid: Ingredients (square checkboxes + bottom borders) | Nutrition facts panel (gray background, 5 rows: calories/fat/protein/carbs/sodium) + estimation disclaimer
- Numbered instructions with large outlined step numerals (01, 02, …) and derived step titles
- Footer with "Generated via MyRecipes Digital Curator" branding + "Cooking is an art…" quote
- "End of Print Preview" hint below paper (hidden in print)

### Data fetching
- Existing `fetchRecipeWithDetails` server action (recipe + ingredients + steps)
- New `fetchRecipeNutritionAction` server action wraps `calculateRecipeNutrition` for per-serving nutrition
- Both wrapped in try/catch; nutrition is best-effort and falls back to `--`

### QR code approach
- URL-based via `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data={encoded digital URL}`
- No new dependencies added (`qrcode.react` was not present in `apps/web/package.json`)
- Resolves to `${origin}/recipes/library/{id}` so a phone camera scan opens the digital recipe

### Print optimization
- Inline `@media print` CSS hides chrome (`.no-print`), removes shell padding, drops paper shadow/border, grayscales photo + QR
- Inline styles used throughout to avoid Tailwind dependency for paper rendering since the page intentionally uses a white/black palette outside the Obsidian Noir theme
- Page marked `'use client'` for `window.print()` access; server actions handle data fetch

## Verification

- `pnpm typecheck` — 39/39 tasks successful, full turbo cache hit on second run
- LSP diagnostic about `./nutrition-action` was a stale race between the two file writes; file exists and typecheck is green
- `pnpm check:parity` hook: `.gitmodules not found` warning (pre-existing, non-blocking)

## Remaining Phase 4 / next phases

- Phase 4 complete (P4-A + P4-B)
- Phase 5 (Web Screens) — 7 prompts in parallel: Web Dashboard, Web Library+Detail, Meal Planner, Pantry, Grocery, Add Recipe, Import flow
