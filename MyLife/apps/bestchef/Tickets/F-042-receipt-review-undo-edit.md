# Receipt review — undo or re-edit a confirmed line

## Problem Statement

### Who is affected?
Users reviewing imported receipts.

### What is the current experience?
`kitchen-receipt-review.tsx` line 112–115 disables a line card once `match_status` is `confirmed` or `ignored`. There is no way to undo a mistake without restarting the entire receipt import.

### Pain point
A single misclick (Confirm instead of Ignore) costs a full re-import.

---

## Desired Outcome

A confirmed or ignored line shows an **Undo** action (or a small revert / edit affordance) for as long as the user is on the review screen. Returning the line to `pending` restores the editable form.

## Success Criteria

1. [ ] Undo visible on every locked line.
2. [ ] Undo restores `pending` state and re-opens the editor.
3. [ ] Undo also reverses the pantry write if it already happened.
4. [ ] Undo is no longer available once the user fully exits and the receipt is finalized.

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/kitchen-receipt-review.tsx` lines 112–183.

## Status

Done in P14-D (SHA 217053cef, OCR pipeline hardening).
