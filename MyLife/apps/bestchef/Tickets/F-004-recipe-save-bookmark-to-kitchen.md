# Recipe detail — save / bookmark a community recipe to my Kitchen

## Problem Statement

### Who is affected?
Any viewer browsing community submissions.

### What is the current experience?
A submission detail screen (`app/(root)/recipe/[id].tsx`) offers Vote, Remix, Share, and Report. There is no Save / Bookmark control. The only way to keep a community recipe in the user's Kitchen is to manually re-create it via `recipes/new.tsx`, retyping everything.

### Pain point
Users either lose recipes they wanted to come back to or duplicate them by hand.

---

## Desired Outcome

A **Save** (bookmark) button on every submission. Tapping it copies the recipe (title, ingredients, steps, hero photo, attribution) into the user's saved recipes. The Kitchen tab shows it under saved recipes; the original submission still links to it.

---

## User Scenarios

### Scenario 1 — Save and reopen
- **What they do:** Open a community submission, tap **Save**, then open the Kitchen tab.
- **What they expect:** The recipe appears in the saved-recipes grid with its hero image; tapping it opens `saved-recipe/[id]` with all fields populated.

### Scenario 2 — Already saved
- **What they expect:** The Save icon shows filled / "Saved"; tapping again offers to remove it from saved recipes.

---

## Success Criteria

1. [x] Every submission detail surfaces Save as a primary affordance.
2. [x] Save copies title, ingredients, steps, hero media, source-chef attribution.
3. [x] Saved recipe shows attribution to the original chef and a link back to the submission.
4. [x] Save state is reflected on return to the screen (idempotent, not toggled silently).
5. [x] Unsave removes the local copy after a confirmation prompt.

## Scope Boundaries

**In scope:** Local copy of community recipe data; Kitchen indexing; attribution.

**Not in scope:** Cross-device sync of saved recipes; offline media caching of hero image.

## Business Case
- [x] **Must have** — closes the loop between social discovery and personal Kitchen.

## Technical Context
- Submission detail: `app/(root)/recipe/[id].tsx` line 358–376 currently shows only Vote/Remix/Share.
- Saved recipe data layer in `@mylife/bestchef`.

## Implementation Notes
- Added schema v20 source attribution fields on saved recipes, plus a unique local source-submission marker for idempotent community saves.
- Added Kitchen helpers to save, inspect, and remove local community recipe copies with copied ingredients, steps, hero media, and chef attribution.
- Added submission detail Save/Saved controls with confirm-to-remove behavior and an Open saved recipe action.
- Added saved recipe detail attribution linking back to the original public submission.
- Made save-state refresh tolerate local/demo routes that later resolve to a cloud submission id.
- Kept duplicated saved recipes independent by clearing the unique source-submission marker on duplicate local copies.

## Status

Done in pre-areblaze workstream (see docs/sessions/2026-04-27-bestchef-f004-save-community-recipe.md).
