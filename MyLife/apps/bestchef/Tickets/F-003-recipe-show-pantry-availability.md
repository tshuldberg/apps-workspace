# Recipe detail — show which ingredients are already in the pantry

## Problem Statement

### Who is affected?
Anyone deciding whether to cook a recipe right now or shop first.

### What is the current experience?
Recipe detail (`app/(root)/recipe/[id].tsx` and `saved-recipe/[id].tsx`) displays ingredients as plain text. There is no awareness of pantry contents on this screen, so the user must mentally cross-reference Pantry before cooking.

### Pain point
Either the user shops for items already on hand or starts cooking and discovers a missing ingredient mid-flow.

---

## Desired Outcome

Each ingredient row on a recipe detail screen shows a small indicator: **In pantry**, **Low** (have some but not enough), or **Missing**. A summary at the top of the ingredients list reads "You have X of Y ingredients on hand." A single **Add missing to grocery list** action sends the missing items to a list of the user's choice.

---

## User Scenarios

### Scenario 1 — Happy path
- **Starting context:** Pantry contains 5 of the 7 ingredients in the recipe.
- **What they do:** Open the recipe.
- **What they expect:** Header reads "5 of 7 ingredients on hand"; missing ingredients are visually flagged; tapping **Add missing to grocery list** opens a list picker and inserts only the 2 missing items.

### Scenario 2 — Edge case: pantry item present but expired
- **What they expect:** Ingredient flagged with a separate "expired" indicator, treated as missing for shopping purposes.

---

## Success Criteria

1. [x] Each ingredient row shows one of: in-pantry, low, expired, missing.
2. [x] Summary count above the ingredients list is accurate.
3. [x] **Add missing to grocery list** is shown only when at least one ingredient is missing.
4. [x] Tapping it opens a grocery list picker and inserts only the missing items.
5. [x] If the user has no pantry items, the screen falls back gracefully — no crash, no false "missing" flags.

## Scope Boundaries

**In scope:** Visual indicators on community recipe detail and saved recipe detail; missing-to-grocery shortcut.

**Not in scope:** Smart unit conversion (best-effort match by name); auto-suggest substitutions.

## Business Case
- [x] **Should have** — synergy with F-001 / F-002.

## Technical Context
Files: `app/(root)/recipe/[id].tsx`, `app/(root)/saved-recipe/[id].tsx`. Pantry data via `getPantry(db)`. Match accuracy gated on F-034.

## Implementation Notes

- Added a shared app data helper that matches recipe ingredients against pantry items by best-effort name match, treats expired batches as shopping-needed, and marks low quantities when compatible units can be compared.
- Saved recipe and community recipe detail screens now render the availability summary, per-row badges, and an inline grocery list picker for missing, low, or expired ingredients.
- Missing ingredient insertion uses the existing shopping list item table and preserves saved recipe `recipe_id` linkage when available.

## Status

Done in pre-areblaze workstream (see docs/sessions/2026-04-27-bestchef-f003-pantry-availability.md).
