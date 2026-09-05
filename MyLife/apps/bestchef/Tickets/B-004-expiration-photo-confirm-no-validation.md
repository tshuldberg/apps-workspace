# Expiration photo — Confirm submits empty assignment when no item is chosen

## Summary

`expiration-photo.tsx` lets the user tap **Confirm Expiration** without assigning the date to any pantry item, producing a downstream failure with no clear guidance.

## Current Behavior

In `app/(root)/expiration-photo.tsx`, `confirmDate()` (lines 138–156) checks that a date is selected (line 145) but does not require either an existing pantry item id or a new item name. With both fields blank, the call to `confirmKitchenExpirationDate` is invoked with `selectedPantryItemId: null` and `itemName: ""`, which fails server-side / store-side with a non-specific error.

## Steps to Reproduce

1. Open Pantry → Capture expiration → Read date.
2. Pick a candidate date.
3. Skip the pantry item picker (do not select an existing item or type a new name).
4. Tap **Confirm Expiration**.
5. Observe a failure alert that does not point at the missing assignment.

## Expected Behavior

The Confirm button is disabled (or shows an inline hint) until either an existing pantry item is selected or a new item name is typed. Successful confirmation only proceeds when both date and assignment are present.

## Severity

- [x] **Major** — flow can dead-end; users blame OCR for an input-validation bug.

## Environment
- File: `app/(root)/expiration-photo.tsx`, lines 138–156.

## Reproducibility
- [x] 100 %.

## Status

Done in P14-E (SHA a24343bc9, expiration photo searchable pantry picker + confirm validation).
