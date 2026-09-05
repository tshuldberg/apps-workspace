# Profile — cook-proof fetch errors are not surfaced

## Summary

If `getCookProofs()` (used inside `MyCookProofGrid` on the profile tab) fails, the user sees a permanent loading state with no error message and no retry.

## Current Behavior

`app/(root)/(tabs)/profile.tsx` lines 198–211: the effect handles cancellation but not error. On a fetch failure, the loading state is never cleared and the empty / error state is never shown. Pull-to-refresh likewise does not surface an error.

## Steps to Reproduce

1. With the cloud provider intentionally erroring (e.g., dev-mode mock that throws), open the Profile tab.
2. Observe the cook-proof grid shows the loading skeleton indefinitely.
3. No retry, no error message.

## Expected Behavior

A failure shows an inline error with a Retry button and a clear empty state distinguishable from "still loading".

## Severity

- [x] **Minor** — affects only error edge; on a healthy network the screen behaves correctly.

## Environment
- File: `app/(root)/(tabs)/profile.tsx`, lines 100–211.

## Reproducibility
- Reproduces 100 % when the underlying cook-proof fetch throws.

## Status

Done in P13-A (SHAs 68dc27430 + 0d538dfc3, signature dishes + cookproof error state).
