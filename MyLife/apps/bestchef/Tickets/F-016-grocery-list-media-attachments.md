# Grocery list — attach photos to a list

## Problem Statement

### Who is affected?
Shoppers who reference a photo (a fridge shelf, a written list, a meal plan) while shopping.

### What is the current experience?
MediaSlot at `app/(root)/grocery.tsx` line 358 routes to `/soon?feature=Grocery list media attachments`.

### Pain point
A common shopping habit — taking a photo of an empty pantry / fridge — has nowhere to live in-app.

---

## Desired Outcome

Each grocery list can hold multiple photos as references. Photos are visible in a strip near the top of the list. Tapping opens a full-screen viewer.

## Success Criteria

1. [ ] **Add photo** action visible on every list.
2. [ ] Photos from camera and library both work.
3. [ ] At least 5 photos per list supported with smooth scrolling.
4. [ ] Removing a photo confirms before deletion.

## Scope Boundaries

**Not in scope:** Vision OCR of the photo to auto-add items (covered by `kitchen-photo` flow).

## Business Case
- [x] **Nice to have**

## Technical Context
File: `app/(root)/grocery.tsx` line 354–364.

## Status

Done in P14-B (SHA ed60b8ec6, pantry batch viewer + grocery media + photo overwrite fix).
