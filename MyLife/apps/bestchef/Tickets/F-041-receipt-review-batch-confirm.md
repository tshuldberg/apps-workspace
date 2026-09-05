# Receipt review — batch confirm and select-all

## Problem Statement

### Who is affected?
Users reviewing receipts with many lines.

### What is the current experience?
`kitchen-receipt-review.tsx` confirms one line at a time. There is `selectedIds` state but no select-all toggle, and no single confirm-all action.

### Pain point
A 30-line receipt requires 30 confirm taps even when most lines are already correct.

---

## Desired Outcome

A **Select all** toggle and a **Confirm selected** action. Per-line edits remain available; selected lines confirm in one batch.

## Success Criteria

1. [ ] Select all selects every confirmable line.
2. [ ] Confirm selected commits all selected lines atomically.
3. [ ] Failure on one line surfaces which one and why; remainder rolls back or is reported per-row (decision documented).
4. [ ] Tap target sized for thumb on phones.

## Business Case
- [x] **Should have**

## Technical Context
File: `app/(root)/kitchen-receipt-review.tsx` lines 254–327.

## Status

Done in P14-D (SHA 217053cef, OCR pipeline hardening).
