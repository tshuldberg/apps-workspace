# Kitchen receipt — failed review leaves a stuck draft

## Summary

When the receipt review call fails (`reviewReceipt()` throws or returns failed status), the draft state on `kitchen-receipt.tsx` is left mid-flow with no automatic recovery; users must tap **Reset** manually to start over.

## Current Behavior

`app/(root)/kitchen-receipt.tsx` lines 87–115: a failure populates an error message but does not clear or roll back the draft. Subsequent attempts to re-run review on the same draft can fail in the same way without explanation.

## Steps to Reproduce

1. Open Kitchen → Receipt photo.
2. Pick a photo (or paste text).
3. Force a failure (e.g., disable the network or mis-type for a manual provider that rejects empty input).
4. Observe error alert; draft state appears intact but actions are inconsistent.
5. Tapping Review again often fails identically.

## Expected Behavior

A failure either:
- resets the draft to a known-clean state with the photo preserved and an inline error explaining what to do next; or
- shows a clear retry action that operates on the same draft.

The user should never be in a "stuck" state where every tap repeats the same failure.

## Severity

- [x] **Major** — kills the import flow on transient failures.

## Environment
- File: `app/(root)/kitchen-receipt.tsx`, lines 87–115.

## Reproducibility
- [x] 100 % when the underlying review call fails.

## Status

Done in P14-D (SHA 217053cef, OCR pipeline hardening).
