# Expiration photo — searchable pantry item picker

## Problem Statement

### Who is affected?
Users with pantries larger than 12 items running expiration OCR.

### What is the current experience?
`expiration-photo.tsx` line 371 limits the pantry list to the first 12 items with no scroll or search. Items 13+ cannot be selected as the OCR target.

### Pain point
Users with full pantries cannot assign an expiration date to most items, defeating the whole flow.

---

## Desired Outcome

The pantry picker shows a search field and a scrolling list of all pantry items (or a sheet modal that does). The selected item is reflected on the main expiration screen.

## Success Criteria

1. [ ] All pantry items reachable.
2. [ ] Search filters in real time on name.
3. [ ] Selection state preserved when returning to the main screen.

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/expiration-photo.tsx` lines 361–381.

## Status

Done in P14-E (SHA a24343bc9, expiration photo searchable pantry picker + confirm validation).
