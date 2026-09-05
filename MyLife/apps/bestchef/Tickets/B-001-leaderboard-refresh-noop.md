# Leaderboard — pull-to-refresh does not refetch data

## Summary

The pull-to-refresh gesture on the Leaderboard tab toggles the spinner state but never refetches data. Discovered during the BestChef functionality audit on 2026-04-27.

## Current Behavior

When the user pulls down on `(tabs)/leaderboard.tsx`, a spinner appears for ~1 second (just long enough for `setRefreshing(false)`) and disappears. The list contents do not change because the refresh handler's body only flips the `refreshing` flag and never calls a fetcher. Data remains the same `DEMO_DISHES`-derived ranking that was rendered on first paint.

## Steps to Reproduce

1. Open the BestChef app.
2. Tap the **Leaderboard** tab.
3. Pull down on the list.
4. Observe the spinner appearing briefly. The visible rankings do not change because no fetch was triggered.

## Expected Behavior

Pull-to-refresh should refetch the leaderboard data for the active tab and selected category, update the list with any changes, and dismiss the spinner only after the fetch resolves.

## Actual vs Expected

| | Actual | Expected |
|---|--------|----------|
| What the user sees | spinner ~1 s, no change | spinner until fetch resolves; updated ranks |
| What the system does | toggles refreshing flag only | calls leaderboard fetcher |
| Data stored / returned | unchanged | refreshed |

## Severity

- [x] **Major** — engagement loop is broken; users assume the data is fresh.

## Environment
- App: BestChef standalone (`apps/bestchef`).
- File: `app/(root)/(tabs)/leaderboard.tsx`, line 99.
- Reproduces on iOS and Android dev clients.

## Reproducibility
- [x] Reproducible 100 % of the time.

## Technical Notes (reference only)
The handler at line 99 sets `refreshing` true then false without calling any data layer.

## Status

Done in P15-A (SHA df2041df4, leaderboard time-range filter + pull-to-refresh fix).
