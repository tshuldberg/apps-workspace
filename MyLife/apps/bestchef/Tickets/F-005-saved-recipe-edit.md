# Saved recipe — edit an existing saved recipe

## Problem Statement

### Who is affected?
Any user maintaining personal saved recipes in Kitchen.

### What is the current experience?
`app/(root)/saved-recipe/[id].tsx` displays a saved recipe with Favorite, Add-to-list, and Delete actions. The only way to fix a typo, swap a quantity, or update steps is to delete the recipe and recreate it from `recipes/new.tsx`.

### Pain point
Saved recipes are append-only. Notes, corrections, and improvements after cooking are impossible without a destructive workaround.

---

## Desired Outcome

A pencil / **Edit** action on every saved recipe opens the same form used at creation time, pre-populated with the existing recipe. Saving updates the existing record (preserving id, timestamps, favorites, list links) instead of creating a new one.

---

## User Scenarios

### Scenario 1 — Edit a quantity
- **What they do:** Open Pad Thai, tap **Edit**, change "3 tbsp fish sauce" to "2 tbsp", save.
- **What they expect:** Detail screen shows the new value; nothing else changes.

### Scenario 2 — Cancel
- **What they expect:** Tapping cancel discards changes; recipe is unchanged.

---

## Success Criteria

1. [x] Edit button visible from saved-recipe detail.
2. [x] Form opens pre-populated with all existing fields.
3. [x] Save updates the existing row (id, createdAt unchanged; updatedAt advances).
4. [x] Favorite state, grocery flag, and list links are preserved.
5. [x] Cancel returns to detail with no changes persisted.
6. [x] If a user has flagged this recipe to a list, edits to ingredient text do not silently re-add items to the list - list sync remains explicit.

## Completion Notes

- Added a pencil action to saved recipe detail that opens `recipes/new` with `recipeId`.
- Reused the saved recipe form in create/edit modes and prefilled title, description, servings, timings, difficulty, grocery flag, ingredients, and steps.
- Added `updateSavedRecipe` to update the existing recipe row and replace its ingredients/steps without touching favorite state, source attribution, or existing grocery list items.
- Added focused helper and UIUX contract coverage.

## Scope Boundaries

**In scope:** Edit form, persistence into existing row.

**Not in scope:** Edit history / version control.

## Business Case
- [x] **Must have** — append-only saves are unworkable.

## Technical Context
- Add a `recipeId` query param to `app/(root)/recipes/new.tsx` and branch create vs update.
- Detail file: `app/(root)/saved-recipe/[id].tsx`.

## Status

Done in pre-areblaze workstream (see docs/sessions/2026-04-27-bestchef-f005-saved-recipe-edit.md).
