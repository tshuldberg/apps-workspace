# Pantry — automatically decrement on-hand quantities when a recipe is cooked

## Problem Statement

### Who is affected?
Users who track inventory in Pantry and follow saved recipes.

### What is the current experience?
The Pantry screen (`app/(root)/pantry.tsx`) tracks quantity and expiration for every food on hand. When the user follows a saved recipe, nothing in the Recipe detail screen connects to Pantry. After cooking, the user must manually open Pantry, find each used item, and edit the quantity by hand.

### Pain point
Inventory drifts out of sync within a few cooking sessions, which makes Pantry useless for shopping decisions and undermines expiration tracking.

---

## Desired Outcome

When the user marks a saved recipe as "cooked" (or completes a cook-proof submission), the app proposes a pantry decrement for every recipe ingredient that matches an on-hand pantry item. The user reviews and confirms the deductions in one screen; the pantry then reflects the new on-hand quantities.

---

## User Scenarios

### Scenario 1 — Happy path
- **Starting context:** Pantry shows "rice noodles, 400 g" and "fish sauce, 200 ml". Saved recipe "Pad Thai" calls for 200 g rice noodles and 30 ml fish sauce.
- **What they do:** Open the recipe, tap **Cook this** (or **I cooked this**) when finished.
- **What they expect:** A confirmation sheet shows two suggested deductions; tapping **Apply** decrements pantry to 200 g and 170 ml.
- **How to verify:** Re-open Pantry — quantities reflect the new totals.

### Scenario 2 — Edge case: ingredient not in pantry
- **What they do:** Cook a recipe whose ingredient "tamarind paste" is not in pantry.
- **What they expect:** The deduction sheet flags that ingredient as "not tracked" and offers to **Add to Pantry** (with a remembered quantity).

---

## Success Criteria

1. [x] Recipe detail screen exposes an **I cooked this** action.
2. [x] Tapping it shows a sheet listing every recipe ingredient.
3. [x] Ingredients matched to pantry items show suggested decrement quantity (using the recipe's qty/unit converted where possible).
4. [x] User can edit any suggested decrement before applying.
5. [x] **Apply** persists changes to the pantry table.
6. [x] Unmatched ingredients show "not tracked" with a one-tap **Add to Pantry**.
7. [x] Cooking history is timestamped per-recipe so the user can see when they last cooked it.

## Implementation Notes

- Added batch-aware saved recipe cook review APIs in `modules/bestchef/src/db/cooking.ts`.
- Added `rc_recipe_cook_history` in schema V19 and scoped it as personal replica data.
- Wired the saved recipe detail screen with an **I cooked this** review sheet, editable decrements, one-tap **Add to Pantry**, and last-cooked display.
- Added focused module and app data tests for conversion, pantry apply, unmatched ingredient add, and history persistence.

## Scope Boundaries

**In scope:** Recipe-to-pantry matching by name and unit, manual review sheet, pantry decrement.

**Not in scope:** Auto-decrement without user confirmation; smart unit conversion of every culinary unit (best-effort only).

## Business Case
- [x] **Should have** — pantry tracking has limited value without this; foundation for shopping suggestions.

## Technical Context
- `app/(root)/pantry.tsx` exposes `useNextPantryBatchEntry()` (line 187) — the engine for marking a batch consumed already exists for a different surface and can be reused.
- Ingredient parsing precision depends on F-034.
- Recipe screen is `app/(root)/recipe/[id].tsx`.

**Related:** F-001, F-003, F-034.

## Status

Done in pre-areblaze workstream (see docs/sessions/2026-04-27-bestchef-f002-pantry-cook-decrement.md).
