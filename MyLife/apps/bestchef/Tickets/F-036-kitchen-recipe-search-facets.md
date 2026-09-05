# Kitchen — search saved recipes by ingredient and cuisine

## Problem Statement

### Who is affected?
Users with many saved recipes.

### What is the current experience?
`(tabs)/kitchen.tsx` line 442 supports only a substring match on title.

### Pain point
"What can I make with chicken?" cannot be answered.

---

## Desired Outcome

Search supports filters: by ingredient (any of), by cuisine, by max prep + cook time, by favorited only. Filter chips above the list combine with the title search.

## Success Criteria

1. [ ] Ingredient filter accepts multiple ingredients and matches recipes containing all of them.
2. [ ] Cuisine filter is a chip multi-select.
3. [ ] Time filter slider with sane defaults.
4. [ ] Filters and search compose; clearing each is one tap.
5. [ ] Empty state explains why no results matched.

## Scope Boundaries

**In scope:** Local filter only. Cloud-search-backed recipe browser is separate.

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/(tabs)/kitchen.tsx` lines 300–323. Better matching once F-034 lands.

## Status

Done in P14-C (SHA bb0b841b1, kitchen barcode + clipboard import + saved-recipe search facets).
