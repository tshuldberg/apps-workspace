# Meerkat Plan 41 WP-41I Adversarial Proof Pack

Date: 2026-07-14  
Scope: Plan 41 Build Phase 9, every Failure Modes row, AC-41.1 through AC-41.14, NC-41.1 through NC-41.8, and Plan 40 evidence linkage  
Verification target: the current working tree in `/Users/trey/Desktop/Apps-wt-41-meerkat-storage`

## Verdict

The WP-41I automated proof pack is implemented. The new deterministic suites add 72 tests across sync, relay, mobile, and web. Focused tests and all four package typechecks pass. The mobile package passes all 1,286 tests. The sync, relay, and web full runs reach the expected new totals, but this sandbox denies localhost listeners with `EPERM`; only pre-existing listener-dependent suites fail or time out. No WP-41I focused test fails.

This is an automated engineering proof, not a production launch sign-off. Plan 41 and Plan 40 remain **NO-GO** until the founder-operated provider, signed-build, deployed-infrastructure, physical-device, live-browser, and publication evidence listed below is attached to the release ledger.

No Git command was run. WP-41I is therefore described as implemented in the working tree, not as a new landed commit. The `Landed implementation` column identifies the existing Plan 41 packet whose behavior each test proves.

## Landed stack under proof

| Packet | Landed implementation |
|---|---|
| WP-41A | `d795c979` |
| WP-41B core | `95d69f99` |
| WP-41B2 platform | `95e29b72` |
| WP-41B3 UI | `cfa66a17` |
| WP-41C native and file providers | Landed, but the Plan 41 board records no hash |
| WP-41D | `e374ff4a` |
| WP-41E | `9167a2a7` |
| WP-41F | `01e17cc7` |
| WP-41G hosted | `a89ccc61` |
| WP-41G2 connected server | `81834321` |
| WP-41H lifecycle | `7f6e348b` |

## Evidence file key

| Key | Exact file |
|---|---|
| Sync adversarial | `packages/sync/src/storage/__tests__/storage-adversarial-e2e.test.ts` |
| NC sweep | `packages/sync/src/storage/__tests__/nc-sweep.test.ts` |
| Relay adversarial | `packages/meerkat-relay/src/__tests__/hosted-storage-adversarial.test.ts` |
| Mobile UI adversarial | `apps/meerkat/app/(root)/data/storage-destinations/__tests__/storage-ui-adversarial.test.ts` |
| Web UI adversarial | `apps/meerkat-web/src/lib/storage/__tests__/storage-ui-adversarial.test.ts` |

## Acceptance criteria matrix

`Open ops` means the code proof passes but an acceptance criterion still requires real accounts, infrastructure, hardware, or publication evidence. It is not a completion claim.

| Criterion | Status | Named automated evidence | Landed implementation | Outstanding evidence |
|---|---|---|---|---|
| AC-41.1 Every listed destination can be configured without developer tools | Open ops | Mobile `storage-ui-core.test.ts` -> `describes every registry kind including web_directory`; mobile and web UI adversarial -> `renders <state> with honest copy` | `cfa66a17`, `92b2cbd9` (WP-41C), `e374ff4a`, `9167a2a7`, `01e17cc7`, `a89ccc61`, `81834321` | Real provider registrations and live configuration journeys |
| AC-41.2 No external adapter receives private plaintext or a device private key | Automated pass | NC sweep -> `NC-41.1: router eligibility excludes device private keys and accepts ciphertext-only objects`; `router.test.ts` -> `allows plaintext downloads only at an explicit file provider` | `d795c979`, `95d69f99` | None for the static and adapter-boundary claim |
| AC-41.3 Complete only after every required object and manifest verifies | Automated pass | `router.test.ts` -> `completes a backup only after every object and manifest verifies`; mobile `local-backup-run.test.ts` -> `reaches complete only after every object and the manifest verify`; both UI adversarial suites -> `never derives a backed-up claim from successful jobs, verified objects, or non-complete backup rows` | `95d69f99`, `cfa66a17` | None |
| AC-41.4 Mobile and web show real health, quota, last verification, jobs, and errors | Automated pass | Both UI adversarial suites -> `renders <state> with honest copy`, `renders <state> job with <error> as an honest non-success state`, and `renders <state> backup state as <label>`; `diagnostics.test.ts` -> `derives current auth and quota issues from active job checkpoints` | `95d69f99`, `cfa66a17`, `7f6e348b` | Live-browser screenshots remain part of release QA, not criterion logic |
| AC-41.5 iCloud backup and fresh-install restore work on a physical iPhone | Open ops | Mobile `icloud-adapter.test.ts` -> `returns read-back evidence only after the data and metadata report uploaded` and `starts downloads before reading remote-only files on a fresh restore`; sync adversarial -> `account switch: iCloud identity-token change invalidates the destination and prevents writes to the new account` | `92b2cbd9` (WP-41C); `7f6e348b` | Apple iCloud entitlement, signed build, and physical iPhone backup plus fresh-install restore |
| AC-41.6 Google Drive backup and restore work on mobile and web through narrow auth | Open ops | `google-drive-conformance.test.ts` -> `probes the resumable session after a lost response and resumes from Drive committed bytes`; relay `oauth-broker.test.ts` -> `loads provider registration secrets from files and defaults Google to drive.file`; sync adversarial -> forged OAuth and revoked-auth tests | `e374ff4a`, `7f6e348b` | Real Google OAuth registration, consent, mobile and web sandbox or live backup and restore |
| AC-41.7 Dropbox, OneDrive, and Box pass mobile and web sandbox proof | Open ops | `dropbox-conformance.test.ts` -> `resumes a partially accepted finish from the session id and corrected offset`; `onedrive-conformance.test.ts` -> `resumes from nextExpectedRanges without authorizing the preauthorized upload URL`; `box-conformance.test.ts` -> `resumes from provider-listed immutable parts`; web session suites -> `requests fresh operation-bound tokens without browser persistence` | `9167a2a7` | Real Dropbox, Microsoft, and Box registrations plus physical/mobile and live-browser QA |
| AC-41.8 Generic iOS, Android, and supported web folders survive restart or honestly require reselection | Open ops | Sync adversarial -> `stale bookmark: disappeared permission reports auth_required, reselects, and resumes without unauthorized writes`; web `browser-database-adapter.test.ts` -> `survives a persist/reload cycle through the same IndexedDB key`; web `web-directory-adapter.test.ts` -> `fails closed when permission is revoked during a write job` | `95e29b72`, `92b2cbd9` (WP-41C) | Physical iOS bookmark and Android SAF restart matrix plus supported-browser restart QA |
| AC-41.9 WebDAV and S3 support the full health, quota, write, resume, list, checksum, read, delete, revoke, migrate, and restore contract | Open ops | `webdav-conformance.test.ts` -> `parses RFC 4331 quota properties and reports absent properties honestly`; `s3-conformance.test.ts` -> `resumes from server ListParts state, including a part beyond the stale cursor`; sync adversarial -> unsafe redirect, multipart ETag, outage, quota, conflict, and corruption tests | `01e17cc7`, `95d69f99`, `7f6e348b` | Physical per-provider QA against real WebDAV and S3-compatible services |
| AC-41.10 Hosted and connected storage are ciphertext-only and expose signed capability, health, usage, and deletion | Open ops | Relay adversarial -> all three named tenant, entitlement, and delete-retry tests; `hosted-storage-api.test.ts` -> `round-trips only encrypted backup locator fields`; `connected-server-conformance.test.ts` -> `authorizes only after descriptor, challenge, authenticated health, and quota in order` | `a89ccc61`, `81834321` | Deployed broker KMS, hosted object store, connected operator key, and live service QA |
| AC-41.11 Primary plus mirror reports partial failure without losing a valid copy | Automated pass | Sync adversarial -> `failure mode: a mirror outage reports partial while the verified primary remains complete`; `router.test.ts` -> `reports an exact mirror partial without invalidating the primary` | `95d69f99`, `7f6e348b` | None for the state-machine claim |
| AC-41.12 Restore validates, migrates, activates atomically, and preserves rollback | Automated pass | Sync adversarial -> `atomic-restore-into-staging: active rows and files are untouched until awaiting_activation` and six `rollback: activation failure at <boundary> produces rolled_back with prior data intact` cases; mobile `local-restore.test.ts` -> `rolls the prior database back after a crash between the two moves` | `95d69f99`, `95e29b72` | Physical fresh-install restore remains required by provider-specific criteria |
| AC-41.13 Revoke, account switch, sign-out, destination deletion, and account deletion remove credentials and stop work | Open ops | Sync adversarial -> revoked-auth, account-switch, and stale-bookmark tests; relay adversarial -> `account deletion interrupted after one physical block completes idempotently on retry`; `oauth-broker.test.ts` -> `account deletion removes every vault and its session bindings` | `e374ff4a`, `92b2cbd9` (WP-41C), `a89ccc61`, `7f6e348b` | Real-provider revoke, account-switch, sign-out, destination-delete, and complete-account-delete QA |
| AC-41.14 Store and privacy disclosures describe provider and broker metadata accurately | Open ops | Web `google-drive-session.test.ts` -> `discloses the broker token and encrypted-object trust boundary`; web `storage-ui-core.test.ts` -> `carries the not-a-default and encrypt-before-leaving copy` | `cfa66a17`, `e374ff4a`, `9167a2a7` | Final store copy, privacy publication, legal review, and release-ledger attachment |

## Negative criteria matrix

The sweep deliberately asserts only properties that can be proven from source structure. Runtime truth remains in the adversarial and existing conformance suites.

| Criterion | Status | Named evidence | Landed implementation |
|---|---|---|---|
| NC-41.1 No device private keys or private plaintext at an external destination | Pass | NC sweep -> `NC-41.1: router eligibility excludes device private keys and accepts ciphertext-only objects`; sync corruption cases exercise encrypted locator, manifest, database, object, and identity artifacts | `d795c979`, `95d69f99` |
| NC-41.2 No queued, uploaded, or locally written state is labeled backed up without remote verification | Pass | Both UI adversarial suites -> `never derives a backed-up claim from successful jobs, verified objects, or non-complete backup rows`; mobile `storage-ui-core.test.ts` -> `never shows a non-complete backup as done (NC-41.2)` | `95d69f99`, `cfa66a17` |
| NC-41.3 No refresh token, access token, WebDAV password, or S3 secret enters SQLite, logs, crash reports, or backups | Pass | NC sweep -> `NC-41.3: every SQLite credential_ref write has assertNotSecretLike at the schema seam`; relay `oauth-broker.test.ts` -> `audit logs contain no token canaries and remain safe through log redaction`; hosted API -> `keeps tokens, tenant ids, and ciphertext hashes out of failure logs` | `d795c979`, `e374ff4a`, `a89ccc61` |
| NC-41.4 No provider appears ready before real authorization and health checks | Pass | `router.test.ts` -> `does not claim verified read-write health before real adapter evidence`; connected conformance -> `authorizes only after descriptor, challenge, authenticated health, and quota in order`; UI adversarial authorization-pending and unverified-native cases | `95d69f99`, `81834321`, `cfa66a17` |
| NC-41.5 No restore failure partially replaces active data | Pass | Sync adversarial -> five corruption cases, atomic staging, and six rollback boundaries; mobile `local-restore.test.ts` -> crash-injection rollback tests | `95d69f99`, `95e29b72` |
| NC-41.6 No ETag is treated as a content hash without provider-specific proof | Pass | NC sweep -> `NC-41.6: WebDAV and S3 ETags remain versions and never populate ciphertextHash`; sync adversarial -> `failure mode: a multipart ETag remains a remote version and read-back verification supplies integrity evidence` | `01e17cc7` |
| NC-41.7 Hosted or first-party storage is never a silent default | Pass | NC sweep -> `NC-41.7: hosted remains last-party opt-in, ordered after user destinations, and absent from default policy rows`; web UI core -> `carries the not-a-default and encrypt-before-leaving copy` | `cfa66a17`, `a89ccc61` |
| NC-41.8 Unsupported platforms never render a provider as native support | Pass | NC sweep -> `NC-41.8: unsupported platform factories return null instead of rendering native support`; mobile registry -> `returns null for kinds unsupported or unwired on mobile`; web directory -> `returns null when the File System Access directory picker is unsupported` | `95e29b72`, `92b2cbd9` (WP-41C) |

## Failure Modes matrix

Every row in the Plan 41 Failure Modes table maps to a named test.

| Plan failure mode | Named test | Exact file | Landed implementation |
|---|---|---|---|
| Snapshot races with a write | `failure mode: snapshot races with a write are serialized before the router receives snapshot bytes` | Sync adversarial | `95e29b72` |
| iCloud account changes | `account switch: iCloud identity-token change invalidates the destination and prevents writes to the new account` | Sync adversarial | `92b2cbd9` (WP-41C) |
| Forged OAuth callback | `failure mode: forged OAuth callback state is returned as invalid_state and no vault is accepted` | Sync adversarial | `e374ff4a` |
| Refresh token revoked | `failure mode: revoked refresh authorization pauses the job and WP-41H rotation resumes it` | Sync adversarial | `e374ff4a`, `7f6e348b` |
| Large upload stops midway | `provider outage mid-backup persists a retry checkpoint, resumes, and never double-charges bytes` | Sync adversarial | `95d69f99` |
| Same ciphertext id maps to different bytes | `conflict: same object id with different ciphertext fails closed, marks corrupt, and leaves mirror untouched` | Sync adversarial | `95d69f99` |
| Remote quota full | `quota exhaustion stops before local or mirror deletion and surfaces exact required bytes` | Sync adversarial | `95d69f99` |
| File-provider permission disappears | `stale bookmark: disappeared permission reports auth_required, reselects, and resumes without unauthorized writes` | Sync adversarial | `92b2cbd9` (WP-41C); `7f6e348b` |
| WebDAV redirects to another host | `unsafe redirect: webdav cross-origin 3xx is refused and credentials are never forwarded` | Sync adversarial | `01e17cc7` |
| S3 multipart ETag is tempting as a hash | `failure mode: a multipart ETag remains a remote version and read-back verification supplies integrity evidence` | Sync adversarial | `01e17cc7` |
| Mirror fails after primary succeeds | `failure mode: a mirror outage reports partial while the verified primary remains complete` | Sync adversarial | `95d69f99`, `7f6e348b` |
| Restore chunk is corrupt | `corruption: one-bit database chunk fault returns exact typed failure, preserves active state, and marks rows honest` | Sync adversarial | `d795c979`, `95d69f99` |
| Process crashes during activation | Six `rollback: activation failure at <boundary> produces rolled_back with prior data intact` cases, plus `rolls the prior database back after a crash between the two moves` | Sync adversarial; mobile `local-restore.test.ts` | `95d69f99`, `95e29b72` |

## Additional Build Phase 9 matrix

| Adversarial requirement | Named evidence | Result |
|---|---|---|
| One-bit corruption in every artifact class | Five parameter cases: locator, manifest, database chunk, object chunk, identity chunk | Pass, exact typed errors, active data unchanged, honest corrupt or partial rows |
| Provider outage mid-backup and mid-restore | `provider outage mid-backup persists a retry checkpoint, resumes, and never double-charges bytes`; `provider outage mid-restore resumes from its checkpoint without staging or charging an object twice` | Pass |
| Revoked auth and credential rotation | `failure mode: revoked refresh authorization pauses the job and WP-41H rotation resumes it` | Pass |
| Quota exhaustion | `quota exhaustion stops before local or mirror deletion and surfaces exact required bytes` | Pass |
| Destination conflict | `conflict: same object id with different ciphertext fails closed, marks corrupt, and leaves mirror untouched` | Pass |
| Every restore-controller activation boundary | Six rollback parameter cases: `before_active_close`, `after_active_close`, `after_rollback_snapshot`, `after_active_swap`, `before_boot_verification`, `during_boot_verification` | Pass |
| Account switch | `account switch: iCloud identity-token change invalidates the destination and prevents writes to the new account` | Pass |
| Stale bookmark or disappeared permission | `stale bookmark: disappeared permission reports auth_required, reselects, and resumes without unauthorized writes` | Pass |
| Cross-origin redirect refusal | Three parameter cases for `webdav`, `s3`, and `connected` | Pass, one-origin transport log and no credential forwarding |
| MITM-equivalent tampering | `MITM: descriptor tamper, challenge tamper, wrong operator key, and read-back substitution all fail closed` | Pass |
| Multi-hundred-MiB streaming | `large object: a simulated 256 MiB object streams in bounded chunks without a whole-object allocation` | Pass, 1 MiB chunks and peak tracked allocation below 3 MiB |
| Restore only into staging | `atomic-restore-into-staging: active rows and files are untouched until awaiting_activation` | Pass |
| Hosted tenant attack and replay | Relay adversarial -> `tenant A tamper and replay attempts cannot read, overwrite, delete, or register tenant B objects and backups` | Pass |
| Entitlement expiry during upload | Relay adversarial -> `entitlement expiry mid-upload rejects the next block, preserves the cursor, and resumes after renewal` | Pass |
| Deletion job fault and retry | Relay adversarial -> `account deletion interrupted after one physical block completes idempotently on retry` | Pass |
| Honest ugly-state UI on mobile and web | Both UI adversarial suites: 18 cases each across destination, backup, and job states plus the no-false-completion invariant | Pass |

## Test Review Diagram trace

| Plan 41 review path | Proof chain |
|---|---|
| Snapshot -> encrypt chunks -> provider put -> read-back -> complete | Snapshot race serialization -> Backup Format v1 five-class corruption and 256 MiB streaming -> outage, resume, quota, redirect, and conflict injection -> checksum and substituted-body rejection -> router completion plus mobile/web no-false-`Backed up` invariant |
| Locator -> manifest -> decrypt and verify -> temporary DB migrate -> atomic activate | Locator and manifest one-bit tests -> database, object, and identity chunk verification -> wrong-key and MITM-equivalent rejection -> integrity, identity, and migration rehearsal state transitions -> staging-only restore plus six activation rollback boundaries and concrete mobile crash recovery |
| Authorize -> secure custody -> refresh -> revoke or delete | Forged OAuth state rejection -> NC-41.3 credential and log sweep plus KMS-envelope tests -> revoked refresh pauses and injected credential rotation resumes -> tenant-isolated, entitlement-gated, idempotent hosted deletion retry |

## Verification

| Command or focused battery | Result | Delta from supplied baseline |
|---|---|---|
| Sync adversarial plus NC sweep | 33 passed | +33 |
| `pnpm --filter @mylife/sync test` | 2,208 passed, 3 failed from 2,211 current tests. The three failures are the two existing `community-catalog` HTTP cases and one `lan-tcp-e2e` case after `listen EPERM 127.0.0.1`. | Expected unrestricted total 2,211, +33 from 2,178 |
| `pnpm --filter @mylife/sync typecheck` | Pass | No regression |
| Relay adversarial | 3 passed | +3 |
| `pnpm --filter @mylife/meerkat-relay test` | Sandbox observation: 938 passed, 326 failed, 172 skipped; all listener failures originate from `listen EPERM 127.0.0.1`. The new adversarial file passes. Total inventory is 1,436. | Expected unrestricted total 1,268 passed and 168 skipped, +3 from 1,265 |
| `pnpm --filter @mylife/meerkat-relay typecheck` | Pass | No regression |
| `pnpm --filter @mylife/meerkat-app test` | 1,286 passed | +18 from 1,268 |
| `pnpm --filter @mylife/meerkat-app typecheck` | Pass | No regression |
| `pnpm --filter meerkat-web test` | 826 passed and 14 existing listener-dependent tests failed from 840 current tests; every failure follows `listen EPERM 127.0.0.1`. | Expected unrestricted total 840, +18 from 822 |
| `pnpm --filter meerkat-web typecheck` | Pass | No regression |
| `node scripts/check-meerkat-parity.mjs` | Pass | Mobile and web storage core and product-law parity preserved |
| `pnpm gate:function --dir packages/meerkat-relay --tests src/__tests__/hosted-storage-adversarial.test.ts` | Pass | Relay lint, typecheck, and 3 focused tests pass |
| Non-Git packet artifact scan | Pass | 10 packet artifacts checked; no forbidden performance path and no file above 2 MiB |
| `pnpm check:generated-artifacts` | Not run | Its implementation invokes `git diff` and `git ls-files`; the packet explicitly forbids every Git command |

The required `open` attempt was made immediately after the self-contained HTML report was created. This environment returned `kLSExecutableIncorrectFormat` because no compatible desktop application is registered. That local artifact-viewer limitation is not counted as live-browser QA.

## Close criteria status

Plan 41 does not meet its Close Criteria yet and must remain in `docs/plans/queue/`.

- Automated destination, format, router, verification, outage, revocation, credential-custody, restore-atomicity, rollback, UI-truth, and negative-criteria evidence is linked here.
- Plan 40 now links this exact automated proof pack and explicitly records the remaining founder-ops evidence.
- Real provider, signed physical-device, deployed Plan 44 service, live-browser, security-operations, legal, store, and release-owner evidence is still missing.

The plan must not move to `docs/plans/done/` until those remaining evidence classes are complete.

## Founder and operator evidence still outstanding

None of the following is claimed complete:

1. Real Google, Dropbox, OneDrive, and Box OAuth registrations, consent screens, redirect allowlists, and narrow-scope verification.
2. Apple iCloud container entitlement, signed Meerkat build, physical iPhone backup, account-switch test, and fresh-install restore.
3. Deployed broker KMS and envelope-key custody proof, deployed hosted storage, operator-key custody, and production deletion-job proof.
4. Physical per-provider matrix covering auth, write, interruption and resume, read-back, list, quota, revoke, migration, restore, corruption, and outage behavior for every destination.
5. Browser QA on a live build for configuration, backup, diagnostics, restore, failure, revoke, and account-delete journeys.
6. Final store and privacy disclosures, legal review, release-owner sign-off, and exact Plan 40 release-ledger attachments.

These items remain release blockers. Automated fakes, conformance harnesses, and source scans do not substitute for them.

## Exact Plan 40 linkage lines

The following exact lines are added to `docs/plans/queue/40-meerkat-final-launch-plan.md` under the Release Evidence Ledger:

```markdown
Plan 41 storage evidence for this ledger:

- [WP-41I automated proof pack, 2026-07-14](../../reports/REPORT-meerkat-plan41-proof-pack-2026-07-14.md)
- Founder-ops provider, physical-device, broker KMS, signed iCloud, and live-browser evidence remains open and must be attached to the release evidence before GO.
```

## Testability seam

One small, behavior-neutral production seam was necessary:

- `StorageIngestOptions` now accepts optional `now?: () => number`, and `hosted-storage-api.ts` threads the same injected clock into direct and block-ingest entitlement verification. Production behavior remains `Date.now()` when the seam is absent. This lets the relay adversarial suite expire entitlement deterministically between upload blocks without a wall-clock wait or race.

No other source seam was added. The sync suite uses the existing router adapter injection, restore reducer, credential-rotation seam, and codec streaming API. The UI suites use the existing pure diagnostics and view-model cores.

## Judgment calls

1. "Real stack" means the production router, Backup Format v1 codec, restore controller, lifecycle helpers, schemas, and UI cores. Only provider transport and persistence edges are fake, because fault injection belongs at those boundaries.
2. The 256 MiB object is simulated as 256 deterministic 1 MiB chunks. Materializing 256 MiB would test the fixture allocator rather than the streaming contract. The allocation tracker proves no whole-object buffer and holds peak tracked allocation below 3 MiB.
3. The six restore-controller activation boundaries are parameterized at the controller contract. Existing mobile crash-injection tests provide the concrete filesystem move and durable-journal proof.
4. NC-41.3, NC-41.7, and NC-41.8 have useful static properties and are scanned. NC-41.2, NC-41.4, and NC-41.5 are runtime claims and stay in end-to-end tests rather than receiving vacuous grep assertions.
5. The relay clock seam is optional and defaults to existing behavior. It changes testability only, not authorization semantics.
6. Sandbox listener failures are reported rather than suppressed, skipped, or weakened. Focused proof suites do not open sockets and pass deterministically.
7. A test passing against a fake provider proves fail-closed product logic, not provider availability or provider policy. That is why the founder-ops column remains open.

## Files in this packet

Tests:

- `packages/sync/src/storage/__tests__/storage-adversarial-e2e.test.ts`
- `packages/sync/src/storage/__tests__/nc-sweep.test.ts`
- `packages/meerkat-relay/src/__tests__/hosted-storage-adversarial.test.ts`
- `apps/meerkat/app/(root)/data/storage-destinations/__tests__/storage-ui-adversarial.test.ts`
- `apps/meerkat-web/src/lib/storage/__tests__/storage-ui-adversarial.test.ts`

Behavior-neutral seam:

- `packages/meerkat-relay/src/storage-ingest.ts`
- `packages/meerkat-relay/src/hosted-storage-api.ts`

Evidence and records:

- `docs/reports/REPORT-meerkat-plan41-proof-pack-2026-07-14.md`
- `docs/reports/REPORT-meerkat-plan41-proof-pack-2026-07-14.html`
- `docs/plans/queue/40-meerkat-final-launch-plan.md`
- `docs/reports/README.md`
- `docs/README.md`
- `docs/sessions/2026-07-14-meerkat-plan41-wp41i.md`
- `memory.md`
- `errors_log.md`
