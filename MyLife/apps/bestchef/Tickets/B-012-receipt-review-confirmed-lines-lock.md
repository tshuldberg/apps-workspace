# Receipt review — confirmed or ignored lines lock with no undo

## Summary

Once a line on `kitchen-receipt-review.tsx` is confirmed or ignored, the card becomes a read-only pill with no way to undo or re-edit.

## Current Behavior

`app/(root)/kitchen-receipt-review.tsx` lines 112–128: when `match_status` is `confirmed` or `ignored`, the LineCard returns a small read-only pill (lines 126–128) and the editable form is unmounted. The user has no path back without restarting the entire receipt import.

## Steps to Reproduce

1. Run a receipt import.
2. On the review screen, confirm a line by mistake (or ignore one you wanted to confirm).
3. Try to revert. There is no UI affordance to do so.

## Expected Behavior

A confirmed or ignored line shows an Undo / Edit affordance until the receipt is finalized. Undo restores the line to `pending` and reopens the editor. If the confirm already wrote to pantry, undo also reverses the write.

## Severity

- [x] **Major** — single misclick costs the entire flow.

## Environment
- File: `app/(root)/kitchen-receipt-review.tsx`, lines 112–128.

## Reproducibility
- [x] 100 %.

## Related
F-042 covers the desired feature behaviour.

## Status

Done in P14-D (SHA 217053cef, OCR pipeline hardening).
