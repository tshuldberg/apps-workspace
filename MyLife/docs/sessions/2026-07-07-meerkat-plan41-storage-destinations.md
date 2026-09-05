# Meerkat Plan 41 Storage Destinations

Date: 2026-07-07

## Summary

Created Plan 41 for user-controlled Meerkat storage destinations and updated Plan
40 so final launch gates on Plan 41 evidence. The plan covers local device storage,
iCloud Drive, Google Drive, other retail SaaS/file-provider storage, WebDAV/S3,
first-party hosted storage, self-hosted storage, and connected server storage.

## Changes

- Created `docs/plans/queue/41-meerkat-storage-destinations.md`.
- Created and opened `docs/plans/queue/41-meerkat-storage-destinations.html`.
- Updated Plan 40 markdown and HTML to include Plan 41 storage-destination evidence.
- Updated the founder-ops runbook with Google OAuth, iCloud entitlement/provider,
  storage-provider disclosure, and device QA items.
- Updated `memory.md`.

## Grounding

- Existing local storage is grounded in `ExpoBlobStore`, `NodeProvider`, and the
  library storage budget/meter code.
- Hosted usage grounding exists in the hosted API usage path.
- iCloud Drive, Google Drive, generic retail SaaS/file-provider destinations, and
  connected server storage are not implemented today, so Plan 41 is active queue
  work.

## Verification

- Active Meerkat queue listing: Plans 25, 40, and 41.
- Plan 40 references Plan 41 as launch-gating evidence.
- Founder-ops runbook includes Plan 41 setup and QA items.
- `git diff --check`: passed.
- `pnpm check:generated-artifacts`: passed.
- `pnpm check:parity --quiet`: passed.

## Notes

No source function logic changed. This is a docs-only launch-plan update.
