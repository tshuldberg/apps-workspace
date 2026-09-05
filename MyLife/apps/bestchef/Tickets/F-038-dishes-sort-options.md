# Dishes — sort options (popularity, newest, alphabetical)

## Problem Statement

### Who is affected?
Anyone browsing the dish catalog.

### What is the current experience?
`(tabs)/dishes.tsx` only offers search and tag filters; the order is fixed.

### Pain point
Users cannot find the most popular or the newest dishes.

---

## Desired Outcome

A sort menu (Popularity default, Newest, A–Z) above the grid. Sort state combines with search and filters.

## Success Criteria

1. [ ] Sort menu visible.
2. [ ] Sort applies immediately; persists per session.
3. [ ] Empty state respected when no results.

## Business Case
- [x] **Nice to have**

## Technical Context
File: `app/(root)/(tabs)/dishes.tsx`.

## Status

Done in P15-B (SHA 2e77a82e1, dishes sort options).
