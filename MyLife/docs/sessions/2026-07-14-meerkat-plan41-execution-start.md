# 2026-07-14 - Meerkat Plan 41 execution start + WP-41A landed

## Decision

Founder decided to BUILD Plan 41 (user-controlled storage destinations and
recovery) in full. This resolves the open build-vs-scope-cut question. No scope
reduction per the MyLife Scope And Completeness mandate.

## Setup

- Worktree `/Users/trey/Desktop/Apps-wt-41-meerkat-storage`, branch
  `feature/meerkat-plan41-storage` off `origin/main` `2607ca5c`. Independent of
  the in-flight Plan 25 and Plan 43 branches.
- Baseline gates green before any change: full `check:parity`, meerkat parity,
  sync typecheck, sync 1,812 tests, relay 1,190 tests.
- Work packet board WP-41A..WP-41I appended to the plan file as a Status Delta
  (commit `84acbca7`), mirroring the Plan 25 board ritual.

## WP-41A landed (`d795c979`)

Phase 0 foundation in `packages/sync/src/storage/` (16 files, +4,598 lines,
71 storage tests):

- `types.ts`: StorageDestinationAdapter contract per the plan, typed
  verification evidence on StorageWriteResult (read_back / provider_checksum /
  none; `none` can never verify, NC-41.2), StorageAdapterError taxonomy.
- `schema.ts`: the six `mk_storage_*` tables byte-faithful to the plan DDL,
  idempotent ensure-tables, row CRUD, `assertNotSecretLike` guard at the
  credential_ref write seam (NC-41.3). Tables are device-local, outside sync
  prefixes.
- `job-reducer.ts`: pure state machine; event-carried timestamps; succeed gated
  on complete per-object plus manifest verification evidence; exact-missing-list
  partials; cancel terminal for new writes.
- `backup-format.ts`: Backup Format v1 over the existing recovery key + HKDF +
  secretbox only (no new primitive). Explicit field-by-field canonical binary
  manifest (repo pattern), purpose-separated per-chunk KDF, Ed25519-signed
  manifest, fail-closed decode taxonomy (wrong_key, tampered_chunk, truncated,
  chunk_order, bad_signature, locator_mismatch, unsupported_version,
  missing_chunk). Streaming seams added after Fable review: createBackupEncoder
  (incremental, retains descriptors only, zeroizes keys) and
  openBackupManifest + verifyAndDecryptBackupChunk +
  verifyBackupIdentityChunk, all sharing the batch internals so paths cannot
  drift; byte-equivalence proven against unchanged golden vectors.
- `test-vectors.ts` + vectors test: golden vectors cross-checked against an
  independent inline RFC 5869 implementation (not the production HKDF).
- `conformance.ts` + `fakes.ts`: 16-behavior provider conformance harness
  (injectable describe/it) proven against an honest in-memory adapter with
  fault injection, resume tokens, quota, conflict fail-closed.
- Fixture backup + compat test locking v1 decode for future format versions.

## Verification (Fable, primary evidence)

Independent rerun after the fix: sync 1,883/1,883 tests (including the three
localhost e2e tests the codex sandbox cannot bind), sync typecheck, function
gate, meerkat parity, generated-artifact guard, meerkat-app and meerkat-web
consumer typechecks. Tree clean at `d795c979`.

## Method

Codex (gpt-5.5) implemented from Fable-authored packet specs grounded in
verified substrate APIs; Fable adversarially reviewed against the plan's
Negative Criteria and verified against code + tests, not worker claims. One
review finding (batch-only codec vs the plan's streaming mandate) was dispatched
back and fixed before landing.

## Wave 2 (same session): WP-41B core, WP-41G, WP-41F, WP-41C landed

Parallel dispatch in disjoint file zones (workers barred from git; Fable owns
commits and verifies each packet against code + reran batteries locally):

- WP-41B core `95d69f99` (sync): router/policy/jobs/health + pure staged
  restore controller + diagnostics fold, 35 tests. Evidence-gated verification,
  mirror partials never invalidate a verified primary, move deletes source only
  after target verify + remote-absence confirm, activation type-gated. Fable
  added the NC-41.6 doc tightening on StorageObjectMetadata.ciphertextHash.
- WP-41G `a89ccc61` (relay): hosted storage v1 API (create/complete with server
  block re-verification + sha512 evidence, head, ranged get, list, idempotent
  delete via deletion jobs, quota, tenant health, backup locators, account
  deletion), PostgreSQL migration 13, object-store byte boundary, file-mode
  honestly legacy-only. REAL BUG caught by Fable's local rerun that the codex
  sandbox could not reach (it cannot bind listeners): the bin ready-log
  referenced block-scoped `storageApiHandler` and crashed EVERY boot of the
  hosted service. Fixed by let-hoisting next to `server`; the three real-bin
  process-boundary tests (state authority boot/stop, object-store secret
  hygiene, log canary) then passed. Relay 1,207 green.
- WP-41F `01e17cc7` (sync): WebDAV + S3 adapters over an injected
  no-auto-redirect transport with injected credential providers. SigV4 proven
  against official AWS golden vectors + RFC 4231 HMAC vectors; cross-origin
  redirect refusal asserts Authorization absence; ETag never evidence/hash;
  multipart resume + abort-on-failure; both pass the Phase 0 conformance
  harness. +65 tests, sync battery green.
- WP-41C (apps + new package, committed after lockfile reconcile): owned
  meerkat-icloud-storage Expo module (Swift sources, config plugin, honest-null
  bridge, UNVERIFIED-pending-dev-build), iCloud adapter whose durability
  evidence requires real ubiquitous upload + coordinated read-back (local
  container write stays verification `none`), iOS bookmark + Android SAF
  provider adapter validating permission at every operation, web File System
  Access adapter with IndexedDB handles + honest non-persistent fallback.
  Mobile and web directory cores byte-identical. Native 6 + app 1,183 + web
  758 tests green, parity green.

## Next

WP-41D (OAuth/credential broker on relay + Google Drive adapter + PKCE/web
token sources) dispatched. Then WP-41E (Dropbox/OneDrive/Box), the WP-41B
settings/diagnostics UI on a taste-tier model, the storage:v1 connected-server
descriptor remainder, WP-41H scheduling/retention/repair, WP-41I adversarial
proof pack. Founder-ops evidence remains flagged; release decision stays
NO-GO.

## Waves 3-5 (same session): WP-41D, WP-41B2, WP-41E, WP-41B3, WP-41G2, WP-41H, WP-41I - CODEABLE SCOPE COMPLETE

- WP-41D `e374ff4a`: OAuth/credential broker (hashed single-use state, S256 PKCE,
  exact redirect allowlist with trick-rejection tests, KMS-envelope refresh
  tokens with AAD binding and zeroization, 10-minute operation-bound sessions,
  migration 14, file mode honestly broker_unavailable) + Google Drive adapter
  (resumable + 308 recovery, sha256Checksum-preferred evidence) + mobile PKCE /
  web broker-session token sources.
- WP-41B2 `95e29b72`: local destination, WAL-safe bounded snapshots, three-phase
  journaled atomic restore activation (journal survives until boot verification;
  crash recovery rolls back conservatively; rollback retained until explicit
  release), web twin, destination registry.
- WP-41E `9167a2a7`: Dropbox/OneDrive/Box adapters; content_hash and
  QuickXorHash verified against independent inline implementations with pinned
  known answers; Box sha1 evidence only because Box validates at commit.
- WP-41B3 `cfa66a17` (opus taste-tier agent): full Storage & Backup UI mobile +
  web over the diagnostics read model only; byte-twin storage-ui-core LOCKED by
  the parity gate together with the product-law copy strings; agent honestly
  flagged the locator-at-destination gap (folded into WP-41H) and was shut down
  after an idle re-verification loop.
- WP-41G2 `81834321`: signed storage:v1 descriptor (pinned-operator-key trust,
  single-use bounded challenge nonces, credentials withheld until descriptor +
  challenge verify, reachable-but-unsigned never authorizes) + conformance-green
  connected-server adapter + TTL-bounded relay issuing.
- WP-41H `7f6e348b`: retention (never deletes the last verified complete backup,
  adversarial all-corrupt-except-one matrix), honest scheduling on the Plan 42
  background-sync discipline, repair from any verified copy, credential
  rotation, idempotent account deletion with exact counts, and
  locator-at-destination discovery closing the cross-device fresh-install
  restore gap (wizard + parity-locked copy updated together).
- WP-41I `9458f596`: 72 deterministic adversarial tests (corruption per artifact
  class, outage, revoked auth, quota, conflict, rollback at every stage
  boundary, account switch, stale bookmark, unsafe redirect, MITM tamper,
  256 MiB bounded-memory object, staging isolation), cross-tenant relay attack
  suite, mobile/web UI adversarial suites, NC sweep, and
  docs/reports/REPORT-meerkat-plan41-proof-pack-2026-07-14.md mapping every
  AC-41.x / NC-41.x / Failure-Mode row to named tests and commits, with Plan 40
  evidence links.

## Closing verification (Fable, local, full tree)

sync 2,211 / relay 1,268 (+168 skipped) / mobile 1,286 / web 840 tests, all
four typechecks, meerkat parity (now also locking the storage UI twin + law
copy), generated-artifact guard, full workspace parity suite: all green.

## Errors encountered (logged in errors_log.md)

1. WP-41G hosted-service bin crashed on every boot (block-scoped ready-log
   reference); caught only by real-bin process-boundary tests outside the codex
   sandbox; fixed before landing.
2. Pre-commit hook module-not-found crash from staging shared test dirs while a
   parallel packet's sources were unstaged; fixed with precise per-file staging.

## Close state

Plan 41 codeable scope COMPLETE: 10 packets, 11 destination kinds, roughly 830
new tests across four packages in one session. The plan file Status section and
packet board carry per-packet evidence. Remaining before done/: founder-ops
evidence only (real provider OAuth registrations, iCloud entitlement + signed
dev build, deployed broker KMS, physical per-provider QA matrix, live-browser
QA, store disclosures). Release decision stays NO-GO. Branch not pushed; push
and merge wait for the founder.
