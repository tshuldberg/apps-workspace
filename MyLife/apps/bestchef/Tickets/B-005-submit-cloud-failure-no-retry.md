# Submit — cloud upload failure navigates user away with no retry

## Summary

When a submission's cloud write fails, the user is navigated to the local recipe id and given an alert. There is no retry path; the local-only submission becomes orphaned from the cloud catalog.

## Current Behavior

`app/(root)/submit.tsx` lines 119–142: the submit handler writes to the local DB, attempts a cloud submission gated on `cloud.isReady && cloud.profile`, and on failure shows an alert. Regardless of cloud success, the user is then routed to `/recipe/{cloudSubmissionId ?? localSubmission.id}` (line 137). When the cloud call failed, the recipe screen opens against a local-only id with no link to the cloud catalog. Re-tapping Submit creates yet another local copy.

## Steps to Reproduce

1. Disable the network.
2. Compose and submit a recipe.
3. Observe an alert about cloud failure.
4. The app navigates to the local recipe id.
5. Re-enable the network and revisit Submit; nothing in the UI offers to push the existing local submission to the cloud.

## Expected Behavior

Cloud failure shows a retry-able error and either keeps the user on the submit screen with the form preserved, or queues the submission and surfaces a "Pending sync" badge on the recipe with an explicit retry. No "ghost" local submissions left orphaned.

## Severity

- [x] **Critical** — submissions are the core value loop.

## Environment
- File: `app/(root)/submit.tsx`, lines 119–142.

## Reproducibility
- [x] 100 % when offline.

## Status

Done in P11-A (SHA ab99fa614, submit cloud retry queue + proposed dish persistence).
