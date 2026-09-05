# Recipe creation — quick-start templates

## Problem Statement

### Who is affected?
First-time recipe authors.

### What is the current experience?
`recipes/new.tsx` shows a blank form. New users abandon at empty fields.

---

## Desired Outcome

Above the form, three or four quick-start chips ("Pasta", "Soup", "Bake", "Stir-fry") seed the form with a structured outline (typical sections, sample placeholder ingredients) the user can edit.

## Success Criteria

1. [ ] Templates available without leaving the form.
2. [ ] Selecting a template fills the form non-destructively (warns if there are unsaved edits).
3. [ ] User can clear the template back to blank.

## Scope Boundaries

**Not in scope:** Personalised templates from past recipes.

## Business Case
- [x] **Nice to have**

## Technical Context
File: `app/(root)/recipes/new.tsx`.

## Status

Done in P11-B (SHA f144cdcff, structured ingredient parser + recipe quick-start templates).
