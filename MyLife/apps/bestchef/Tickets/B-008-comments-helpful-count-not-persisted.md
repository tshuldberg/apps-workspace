# Comments — Mark Helpful resets on every reload

## Summary

The Mark Helpful counter in `comments/[submissionId].tsx` increments only in local component state and is lost on navigation away or app relaunch.

## Current Behavior

`app/(root)/comments/[submissionId].tsx` lines 102–108: tapping the helpful button increments a local `helpfulCount` for the item in `useState`. There is no persistence (local DB or cloud), no de-duplication for repeated taps, and no re-fetch on focus.

## Steps to Reproduce

1. Open any submission's comments thread.
2. Tap **Mark helpful** on a comment 3 times.
3. Observe the count increases by 3 from this device only.
4. Force-quit the app and reopen the same comments thread.
5. Observe the count is back to its baseline (server) value.

## Expected Behavior

Mark Helpful is a per-user toggle that persists server-side. The displayed count is server-truth. A user cannot inflate the count by repeated taps.

## Severity

- [x] **Major** — the signal is meaningless; UI suggests engagement that does not exist.

## Environment
- File: `app/(root)/comments/[submissionId].tsx`, lines 102–108.

## Reproducibility
- [x] 100 %.

## Related
F-033 covers the desired feature behaviour.

## Status

Done in P12-A (SHA 016301651, comments reply + edit/delete + persisted helpful).
