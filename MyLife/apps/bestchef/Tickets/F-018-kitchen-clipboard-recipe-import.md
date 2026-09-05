# Kitchen — clipboard recipe import (paste URL or text)

## Problem Statement

### Who is affected?
Users who already have a recipe URL or block of text from another app.

### What is the current experience?
Kitchen upload hub at `app/(root)/(tabs)/kitchen.tsx` line 346 lists **Clipboard recipe import** which routes to `/soon`.

### Pain point
There is no way to bring an external recipe in without retyping it.

---

## Desired Outcome

Tapping **Paste recipe** reads the system clipboard. If it contains a supported URL (e.g., a recipe website with JSON-LD `@type=Recipe`) the app fetches and parses; if it's plain text, the app attempts a structured extraction (title, ingredients, steps). The user reviews, edits, and saves the recipe to Kitchen.

## Success Criteria

1. [ ] Clipboard read prompts permission only when required by OS.
2. [ ] URL parsing works for the top 20 recipe sites (best effort, fallback if not supported).
3. [ ] Plain-text parsing extracts at least title and ingredient list.
4. [ ] Review screen lets the user fix anything before saving.
5. [ ] Saved recipe attributes a "Source URL" when applicable.

## Scope Boundaries

**Not in scope:** Background scraping of arbitrary HTML; copyright handling beyond attribution.

## Business Case
- [x] **Should have**

## Technical Context
- File: `app/(root)/(tabs)/kitchen.tsx` line 343–347.
- `expo-clipboard`. Recipe sites with JSON-LD support `application/ld+json` Recipe schema.

## Status

Done in P14-C (SHA bb0b841b1, kitchen barcode + clipboard import + saved-recipe search facets).
