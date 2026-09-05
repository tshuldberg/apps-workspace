# Challenges — progress bar always shows 0 %

## Summary

The progress bar on every challenge card shows a 0 % fill regardless of actual progress because the width is hardcoded.

## Current Behavior

`app/(root)/challenges.tsx` line 58 renders the progress bar with `width: '0%'`. The bar never updates because there is no progress source.

## Steps to Reproduce

1. Open the Challenges screen (route exists; reachable from Profile or direct link).
2. Observe every challenge card shows 0/target and an empty bar.
3. There is no action that can change the bar.

## Expected Behavior

Progress reflects the user's enrolment and submissions for that challenge. Until F-012 lands, this card should at minimum not render a fake progress bar — it should either be hidden or show "Not joined".

## Severity

- [x] **Major** — UI states a false fact (your progress is 0).

## Environment
- File: `app/(root)/challenges.tsx`, lines 45–64.

## Reproducibility
- [x] 100 %.

## Related
F-012 is the feature that gives this bar a real source.

## Status

Done in P13-E (SHA d29a4f2e7, challenges interactive cards + reward redemption).
