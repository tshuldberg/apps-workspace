# Reports — cloud failure on public launch loses the report (no local fallback)

## Summary

When `ReportMenu.submit()` runs in public-launch mode and the cloud write fails, the user sees a generic error alert and the report is silently dropped — no local persistence, no retry queue, no visibility to moderators.

## Current Behavior

`app/(root)/components/ReportMenu.tsx` lines 122–148 attempts a cloud report. On `cloudReported = false` (e.g., network down, server 5xx) inside the `publicLaunch` branch the function returns at line 145 without writing the report locally. The user sees a confirmation that suggests the report was sent, even when it was not (depending on which branch produced the alert).

## Steps to Reproduce

1. Build the app with the public-launch flag enabled.
2. Disable the network on the device (airplane mode).
3. Open any submission detail or chef detail.
4. Tap the report icon and submit a report.
5. Observe that no error path stores the report locally; pulling the device back online never replays it.

## Expected Behavior

Either:
- the cloud failure produces a clear, retry-able error alert and a local queue entry that retries on the next online tick; or
- the report is written locally as a tombstone with `pending sync` status that the user can see on the moderation screen.

In no path should a tapped Submit produce a confirmation while the report is not actually anywhere.

## Severity

- [x] **Critical** — moderation reports going missing is a trust-and-safety blocker.

## Environment
- File: `app/(root)/components/ReportMenu.tsx`, lines 106–167.

## Reproducibility
- [x] 100 % when offline + `publicLaunch === true`.

## Status

Done in P15-D (SHA 8d6e898c9, trust-and-safety report fallback + DEMO removal audit).
