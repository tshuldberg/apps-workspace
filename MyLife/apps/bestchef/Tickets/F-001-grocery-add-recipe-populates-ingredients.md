# Grocery — allow users to add a saved recipe to a list and auto-populate every ingredient

## Problem Statement

### Who is affected?
Anyone planning a meal or shopping trip from a recipe they have already saved to their Kitchen.

### What is the current experience?
1. The user creates or opens a saved recipe (`app/(root)/recipes/new.tsx`, `saved-recipe/[id].tsx`).
2. They can mark the recipe `groceryFlagged = true` and tap "Add to List" on a per-recipe basis. That call only adds the recipe row itself, not its ingredients.
3. To shop for the recipe, the user opens `grocery.tsx` and taps **Add Flagged**, which calls `addGroceryFlaggedRecipesToList()`. The implementation only pulls the *titles* of flagged recipes into the list — none of the underlying ingredients are added.
4. The user must then read every ingredient line out of the recipe and re-type each one as a manual grocery item.

### Pain point
Every recipe-to-shopping trip requires the user to retype 5–20 lines they already entered when saving the recipe. Quantities, units, and item names are lost in translation. There is no path inside Grocery to even browse saved recipes — flagging must happen earlier and elsewhere.

---

## Desired Outcome

From inside any grocery list the user can tap **Add a recipe**, pick from a list of their saved recipes, and the list immediately receives:

- a header / section row that names the recipe (so items can later be removed together), and
- one grocery item per parsed ingredient, with quantity and unit pre-filled where the recipe supplied them, ready to check off.

If multiple recipes are added, the list groups them by recipe header but still allows individual items to be checked, edited, or removed.

---

## User Scenarios

### Scenario 1 — Happy path
- **User role:** Home cook
- **Starting context:** Has 6 saved recipes in Kitchen; current grocery list "Sunday shop" is empty.
- **What they do:**
  1. Open `Sunday shop` in `grocery.tsx`.
  2. Tap **Add a recipe**.
  3. Pick "Pad Thai" from a sheet of saved recipes.
- **What they expect:**
  - The Pad Thai recipe header appears in the list.
  - 9 ingredient rows appear under it (rice noodles 200 g, fish sauce 3 tbsp, …).
  - Items can be checked individually.
- **How to verify:** Inspect the list rows; each parsed ingredient is present.

### Scenario 2 — Multiple recipes, deduplication
- **User role:** Meal planner
- **Starting context:** List already contains "garlic, 4 cloves" added from "Pad Thai".
- **What they do:** Add "Aglio e Olio" which also calls for 6 cloves of garlic.
- **What they expect:** The list shows a single garlic row with quantity merged ("garlic, 10 cloves") OR two rows clearly grouped under their respective recipes (decision documented in scope), but never silently duplicated without a hint.
- **How to verify:** Garlic appears in a way that is unambiguous to the shopper.

### Scenario 3 — Edge case: ingredient text cannot be parsed
- **User role:** Home cook
- **Starting context:** A saved recipe has an ingredient line "salt and pepper, to taste".
- **What they do:** Add the recipe to the list.
- **What they expect:** The unparseable line is added with quantity / unit blank, name = "salt and pepper, to taste", flagged with a small "review" affordance so the shopper can fix it.
- **How to verify:** Row exists, no crash, no swallowed line.

---

## Success Criteria

1. [x] Each grocery list shows an **Add a recipe** action (button, FAB, or row).
2. [x] Tapping it opens a picker of every saved recipe in the user's Kitchen, sorted most-recent-first.
3. [x] Selecting a recipe inserts a recipe header row plus one item per ingredient line, in the order the recipe defines them.
4. [x] Quantity and unit are populated from the parsed ingredient when present.
5. [x] Each item can be checked, edited, and deleted individually without affecting the others.
6. [x] Removing the recipe header row offers to remove all of its child items in one action.
7. [x] Adding the same recipe twice does not silently duplicate — the user is asked or items are merged, behaviour explicit and documented.
8. [x] Unparseable ingredient lines are added as text-only rows and never dropped.
9. [x] No work is required outside the grocery screen — the entire flow is launched from `grocery.tsx`.

## Implementation Notes

Completed 2026-04-27.

- `grocery.tsx` now exposes an inline **Add Recipe** picker from the selected grocery list.
- Recipe-sourced items render under visual recipe headers, while custom items remain grouped by grocery section.
- Re-adding the same recipe prompts the user to replace the existing recipe items rather than silently duplicating them.
- Recipe headers expose a remove action that deletes all child grocery items after confirmation.
- Individual items can be checked, edited inline, or deleted from the existing item action menu.
- Recipe ingredient rows without parsed quantity/unit keep their original text and show a `Review quantity` cue in the list.

---

## Scope Boundaries

### In scope
- Picker UI inside grocery list
- Reading saved recipes from the local `@mylife/bestchef` store
- Inserting parsed ingredients as grocery items
- Recipe header / grouping in the list

### Explicitly NOT in scope
- Building a parser from scratch — F-034 covers structured ingredient parsing. This ticket can ship with best-effort parsing while F-034 lands properly.
- Suggesting recipes based on pantry contents
- Cloud sync of grocery lists between devices

### Future considerations
- Smart deduplication across multiple recipes (auto-merge "garlic")
- "What's missing from pantry?" filter once F-003 lands

---

## Business Case

This is the single biggest cross-feature integration gap surfaced in the audit and was raised by the product owner as a representative example of "buttons should do real things." Saving a recipe is essentially useless for shopping today; the manual workaround dissuades users from using saved recipes at all.

### Priority
- [x] **Must have** — flagship Kitchen value-prop is undercut without this

---

## Technical Context (Reference Only)

- `app/(root)/grocery.tsx` already calls `addGroceryFlaggedRecipesToList(db, listId)` at line 446 — the integration point exists but only inserts recipe rows, not ingredients.
- `app/(root)/recipes/new.tsx` line 170 stores ingredients as a single `\n`-separated string — F-034 should land before quantity/unit precision is reliable.
- `app/(root)/saved-recipe/[id].tsx` line 215–224 already lets the user fire ingredients into a list one recipe at a time; the Grocery side simply needs the picker.
- `@mylife/bestchef` store is the source of truth for saved recipes.

**Related tickets:** F-034 (ingredient parser), F-002 (pantry decrement), F-003 (pantry availability).

## Status

Done in pre-areblaze workstream (see docs/sessions/2026-04-27-bestchef-f001-grocery-recipe-picker.md).
