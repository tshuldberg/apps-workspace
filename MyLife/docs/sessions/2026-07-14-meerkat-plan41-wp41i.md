# Meerkat Plan 41 WP-41I Session

Date: 2026-07-14  
Scope: Phase 9 adversarial proof pack and Plan 40 evidence links

## Outcome

WP-41I is implemented in the current working tree. The packet proves the landed WP-41A through WP-41H stack with deterministic fault injection rather than rebuilding it. It adds 33 sync tests, 3 relay tests, 18 mobile UI tests, and 18 web UI tests. The canonical criterion and failure-mode mapping is the [proof-pack report](../reports/REPORT-meerkat-plan41-proof-pack-2026-07-14.md).

## Work completed

- Added a real-stack sync suite combining the router, Backup Format v1 codec, restore controller, lifecycle seam, schemas, and fault-injected destination adapters.
- Covered all 13 Plan 41 Failure Modes rows and all additional Phase 9 attacks, including five artifact classes, backup and restore outage recovery, auth rotation, quota, conflict, six activation boundaries, account switch, stale permission, cross-origin redirects, MITM-equivalent tampering, 256 MiB simulated streaming, and staging-only restore.
- Added an honest NC sweep for NC-41.1, NC-41.3, NC-41.6, NC-41.7, and NC-41.8. Runtime-only negative criteria remain in end-to-end tests.
- Added hosted-storage tenant tamper and replay, mid-upload entitlement expiry, and idempotent deletion retry evidence.
- Added byte-twin mobile and web UI adversarial fixtures for every persisted ugly state and the no-false-`Backed up` invariant.
- Added the proof link and explicit founder-ops warning to the Plan 40 release evidence ledger.

## Testability seam

`StorageIngestOptions` accepts an optional injected clock. `hosted-storage-api.ts` threads it through direct and block-ingest entitlement verification. The default remains `Date.now()`. This is a behavior-neutral seam for deterministic mid-upload expiry testing.

## Verification snapshot

- Sync focused: 33 passed. Full: 2,208 passed and 3 existing localhost-listener failures from 2,211 current tests. Typecheck passed.
- Relay focused: 3 passed. Full sandbox inventory: 938 passed, 326 existing listener failures, 172 skipped; expected unrestricted inventory is 1,268 passing plus 168 skipped. Typecheck passed.
- Mobile: 1,286 passed. Typecheck passed.
- Web: 826 passed and 14 existing localhost-listener failures from 840 current tests. Typecheck passed.
- Meerkat parity passed.
- Relay function gate passed: lint, typecheck, and 3 focused tests.
- Non-Git packet artifact scan passed for forbidden paths and the 2 MiB cap. `pnpm check:generated-artifacts` was not run because it invokes Git internally and this packet forbids every Git command.
- Every new proof test passed. No existing test was weakened or skipped.

## Release status

Automated engineering evidence is present. Real provider OAuth, signed iCloud build, deployed broker KMS, physical per-provider QA, live-browser QA, and final store and privacy publication evidence remain open. Plan 40 remains NO-GO.

No Git command was run, per packet instructions.
