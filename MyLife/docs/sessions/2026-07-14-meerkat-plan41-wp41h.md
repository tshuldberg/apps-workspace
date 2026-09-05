# Meerkat Plan 41 WP-41H Storage Lifecycle Report

Date: 2026-07-14  
Scope: scheduling, retention, mirrors, repair, destination moves, credential rotation, account deletion, and cross-device locator discovery  
Verification target: the current working tree in `/Users/trey/Desktop/Apps-wt-41-meerkat-storage`

## Outcome

WP-41H is implemented across the shared storage core and the mobile and web Meerkat surfaces. Backups now publish bounded, provider-discoverable locator records on every destination. A fresh install can list and open those backups with destination credentials and the recovery key. Retention, scheduled backup decisions, repair, moves, credential rotation, and account deletion all operate on persisted storage truth and report partial results without fabricating completion.

The existing hosted `GET /api/storage/v1/backups` route was sufficient. `packages/meerkat-relay` was not changed.

## Deliverables

### Retention

- `mk_storage_policies.retention_json` now supports bounded keep-last and max-age rules. Keep-last is clamped to 1 through 100 and max age to 1 through 3,650 days.
- Deletion requires a backup to be outside both policy windows.
- At least one verified complete logical backup is always retained.
- A mirror is protected when its primary copy is not verified, including the primary-failed-after-mirror case from AC-41.11.
- Runtime classification uses the backup's tracked, prefixed object rows. A policy cannot claim or delete a backup from another data class merely because both use one destination.
- Malformed and legacy-unclassifiable rows fail closed and do not become deletion candidates.

### Scheduling

- The shared pure scheduler returns due, not due, disabled, invalid, destination unavailable, health unavailable, revoked, quota full, active-job, and paused-job decisions.
- Last-run evidence is keyed by data class and destination and is derived only from complete backups with verified tracked objects.
- Mobile scheduling is opt-in and rides the existing background sync task and deferred OS registration discipline. Native OS registration remains behind the existing dev-build and native-module capability checks.
- Manual backup and manual scheduled "Run now" actions remain available.
- Web scheduling runs best effort while the app is open and visible. The UI says this directly and does not imply a closed-tab OS schedule.
- Schedule status is derived from persisted jobs, backups, health, and policy rows. No last-run timestamp is invented.

### Missing-object repair

- Repair scans missing and error rows, groups verified matching copies once, and prefers a local source before a remote mirror.
- It downloads from the source, checks byte length and SHA-512, uploads with bounded resume handling, reads back, and verifies again before marking the target row verified.
- Corrupt backup rows return to complete only when the manifest and every tracked object are verified.
- Reports include planned, repaired, failed, impossible, and backups reverified counts plus exact per-object outcomes.
- Planning is bounded by nlogn behavior instead of repeatedly scanning the full object set for every target.

### Destination changes

- Changing the primary updates the policy for future writes immediately.
- Existing data moves only through the explicit migrate action.
- The existing router move contract remains authoritative: copy, read-back verify, then delete source.
- Mobile and web destination details show live checked, moved, failed, and skipped counts.

### Credential rotation

- WebDAV and S3 updates write a new secure credential record, atomically swap the destination reference, authorize, perform a write/read/delete probe, refresh health, and resume paused jobs.
- A failed probe restores the prior reference and state.
- The old secret is deleted only after the new credential proves usable.
- Broker reconnect obtains a replacement vault ID and swaps the `broker://oauth/...` reference atomically after verification.

### Account deletion

- Mobile and web account deletion now include storage cleanup before local identity and database destruction.
- The user chooses whether adapters should delete remote encrypted objects or only revoke access.
- Broker vaults and the hosted account are deleted through their existing routes.
- Destination credentials, including scheduled recovery-key references, are cleared.
- `mk_storage_*` rows are removed only after every requested remote step succeeds. A partial remote failure leaves local evidence for an honest retry.
- The report contains exact destination, remote object, vault, credential, hosted-account, and local-row counts. Repeating a completed deletion is idempotent and returns zero remaining work.

### Cross-device locator discovery

- Every Backup Format v1 object is mapped under a deterministic flat prefix: `mkb1.<sha256(backupId)>.`.
- Each primary and mirror destination receives `locator.json`, `manifest-ref.json`, the encrypted manifest, and the encrypted data objects under that prefix.
- `listRemoteBackups(adapter)` performs bounded pagination and object reads, validates locator/path agreement, validates the manifest reference, and requires a present manifest whose metadata or read-back bytes match the locator hash.
- Fresh-install restore on mobile and web merges remote discovery with local tracked rows and consumes the same byte-twin restore-orchestrator core.
- The former same-device limitation copy changed on both surfaces to: "A fresh install can find and restore these backups with the recovery key and destination credentials."
- The parity law block was updated with both surfaces in the same change.

## Baseline and final verification

| Command | Pre-change baseline | Final result | Delta |
|---|---|---|---|
| `pnpm --filter @mylife/sync test` | 169 files passed, 2 failed; 2,129 tests passed, 3 failed | 180 files passed, 2 failed; 2,175 tests passed, 3 failed | 11 passing files and 46 passing tests added; the same 3 listener-restricted tests fail |
| `pnpm --filter @mylife/sync typecheck` | Pass | Pass | No regression |
| `pnpm --filter @mylife/meerkat-app test` | 124 files and 1,266 tests passed | 125 files and 1,268 tests passed | 1 passing file and 2 passing tests added |
| `pnpm --filter @mylife/meerkat-app typecheck` | Pass | Pass | No regression |
| `pnpm --filter meerkat-web test` | 101 files passed, 10 failed; 806 tests passed, 14 failed | 102 files passed, 10 failed; 808 tests passed, 14 failed | 1 passing file and 2 passing tests added; the same 14 listener-restricted tests fail |
| `pnpm --filter meerkat-web typecheck` | Pass | Pass | No regression |
| `node scripts/check-meerkat-parity.mjs` | Pass | Pass | Storage cores and law copy remain aligned |

The sync failures are the two `community-catalog` HTTP cases and one `lan-tcp-e2e` case. The web failures are the same 14 real-relay cases recorded at baseline. Every failure originates from `listen EPERM: operation not permitted 127.0.0.1` in this sandbox and times out after the denied listener. No WP-41H focused test fails.

Additional verification:

- Shared function gate: lint and typecheck pass; 11 files and 46 focused tests pass.
- Mobile function gate: lint and typecheck pass; 6 files and 46 focused tests pass.
- Web function gate: lint and typecheck pass; 5 files and 24 focused tests pass.
- Web production build: pass, 483 modules transformed. Existing SQL.js externalization and large-chunk warnings remain informational.
- Relay pre-change baseline: 102 files passed, 71 failed, 30 skipped; 935 tests passed, 326 failed, 172 skipped, with 75 listener errors. The focused hosted-storage API suite was green. Relay was not touched, so its full suite was not rerun.

`pnpm gate:function:changed` and `pnpm check:generated-artifacts` were not run because both invoke Git internally and the packet explicitly prohibited every Git command. Explicit package function gates were run instead. No Git command was executed.

In-app visual browser QA could not run because the in-app browser-control runtime was not available in this session. No separate browser automation mechanism was substituted. The required direct `open` attempt was also made immediately after HTML creation, but this environment has no compatible desktop application. UI coverage therefore consists of lint, strict typecheck, focused UI/core tests, the production web build, and the parity gate.

## Tests added or strengthened

- Adversarial all-corrupt-except-one retention safety.
- Mirror retention when the primary is corrupt.
- Per-data-class retention classification on one destination.
- Scheduler golden cases for due, not due, paused, revoked, and quota full.
- Separate last-run evidence for two data classes sharing one destination.
- Local-source repair, mirror-source repair, impossible partial repair, and backup re-verification.
- Credential rotation with paused-job resume and rollback behavior.
- Exact account-deletion counts, idempotency, and no surviving storage rows.
- Fresh-install fake-adapter discovery and mobile and web restore-core consumption.
- Function-quality contract, deterministic fuzz, complexity, and memory checks for retention, scheduling, locator IDs, repair planning, broker vault references, and credential configuration parsing.

## Judgment calls

1. The well-known backup convention is a flat provider-safe prefix rather than a directory tree. Every existing adapter accepts the same restricted object-ID alphabet, so this keeps discovery portable across local, WebDAV, S3, broker, and hosted stores.
2. Remote discovery calls a candidate valid only after locator and manifest-reference validation plus manifest hash evidence. Full cryptographic authenticity still occurs when the recovery key opens and verifies the manifest. UI copy preserves that distinction.
3. A verified primary remains complete if a mirror leg fails. The result is reported as partial mirror coverage, not a failed primary backup.
4. Remote account cleanup fails closed. Local storage evidence is retained until all requested revocations and deletions finish, which makes retry and exact reporting possible.
5. A legacy backup without the v1 discoverable prefix is neither retention-deleted nor accepted as schedule last-run evidence. Creating a fresh verified backup is safer than guessing ownership.
6. Web scheduling is foreground best effort only. Mobile OS scheduling uses the existing gated registration path, while both surfaces retain manual execution.

## Files

Shared storage runtime and barrels:

- `packages/sync/src/storage/{credential-config,lifecycle,remote-backups,repair,retention,storage-scheduler}.ts`
- `packages/sync/src/storage/{router,schema}.ts`
- `packages/sync/src/{index,index.native}.ts`

Shared tests:

- `packages/sync/src/storage/__tests__/{credential-config,lifecycle,remote-backups,repair,retention,storage-scheduler}*.test.ts`

Mobile integration:

- `apps/meerkat/app/(root)/data/{background-task-definitions,delete-account-core}.ts`
- `apps/meerkat/app/(root)/data/storage-destinations/{credential-store,local-backup-run,local-restore-source,restore-orchestrator-core,storage-account-delete,storage-scheduler-run}.ts`
- `apps/meerkat/app/(root)/(tabs)/storage/{backup,restore}.tsx`
- `apps/meerkat/app/(root)/(tabs)/storage/destination/[id].tsx`
- `apps/meerkat/app/(root)/(tabs)/settings.tsx`
- Related focused tests under the adjacent `__tests__` directories.

Web integration:

- `apps/meerkat-web/src/lib/MeerkatProvider.tsx`
- `apps/meerkat-web/src/lib/delete-account-core.ts`
- `apps/meerkat-web/src/lib/storage/{adapter-restore-source,broker-reconnect,configured-registry,credential-store,restore-orchestrator-core,storage-account-delete,web-backup-run,web-storage-scheduler-run}.ts`
- `apps/meerkat-web/src/ui/settings/{DangerSection,StorageOverlay}.tsx`
- Related focused tests under `apps/meerkat-web/src/lib/**/__tests__/`.

Parity and records:

- `scripts/check-meerkat-parity.mjs`
- `errors_log.md`
- `memory.md`
- `docs/README.md`
- This Markdown report and its same-basename HTML twin.
