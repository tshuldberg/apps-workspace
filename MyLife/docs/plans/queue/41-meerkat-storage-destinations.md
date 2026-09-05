# Plan 41 - Meerkat User-Controlled Storage Destinations and Recovery

> Rewritten and engineering-locked on 2026-07-09. This plan replaces the initial
> 2026-07-07 draft. Users can choose, verify, migrate, mirror, restore, revoke, and
> delete encrypted Meerkat data across local, cloud, SaaS, and server destinations.

## Status

- **AUDIT REMEDIATION VERIFIED (2026-07-15).** The seven high-severity code findings
  from the independent completion audit are resolved in `f29ab80d` and integrated
  with Plan 43 at `6b70b994`. The combined tree passes 5,823 package tests, clean
  typechecks/lints, both production builds, the function gate, transport negative
  controls, Meerkat parity, full workspace parity, and the generated-artifact guard.
  See `docs/reports/REPORT-meerkat-plan41-completion-audit-2026-07-15.md`.
- **CODEABLE SCOPE COMPLETE (2026-07-14).** All ten packets WP-41A..WP-41I landed
  on `feature/meerkat-plan41-storage` (see the Status Delta packet board at the
  bottom for per-packet commits and evidence). Closing verification: sync 2,211,
  relay 1,268, mobile 1,286, web 840 tests, all typechecks, meerkat parity,
  generated-artifact guard, full workspace parity suite, all green.
- Proof pack: `docs/reports/REPORT-meerkat-plan41-proof-pack-2026-07-14.md`
  maps every AC-41.x, NC-41.x, and Failure-Mode row to named tests and commits.
- **Remaining is founder-ops evidence, never faked in code:** real provider OAuth
  registrations (Google, Dropbox, OneDrive, Box), Apple iCloud entitlement + a
  signed dev build, deployed OAuth/credential broker with server KMS, physical
  per-provider QA matrix, live-browser QA, store disclosures. Plan 41 does not
  move to done/ and the release decision stays NO-GO until that evidence lands
  per the Close Criteria.
- **Feeds:** Plan 40 final launch (evidence links wired).
- **Depends on:** Plan 42 scheduling and secure wake; Plan 44 PostgreSQL, object
  storage, OAuth broker deployment, observability, backup, and release controls.
- **Launch rule:** a destination is not supported until authorization, write,
  read-back verification, list, quota or capacity, revoke, migration, restore,
  corruption, and provider-outage evidence all pass.

## Product Outcome

Users can choose storage per data class:

- this device;
- iCloud Drive on Apple devices;
- Google Drive;
- Dropbox;
- Microsoft OneDrive;
- Box;
- an iOS Files or Android Storage Access Framework provider;
- WebDAV;
- S3-compatible storage;
- first-party hosted storage;
- a self-hosted or explicitly connected server advertising `storage:v1`.

Private data is encrypted before every external adapter receives it. Provider and
server operators may observe account, object sizes, timing, IP, and encrypted object
names. They do not receive Meerkat device private keys or private plaintext.

## What Already Exists

| Existing capability | Reuse decision |
|---|---|
| `ExpoBlobStore` and browser blob store | Wrap as the local object adapter. |
| Content-addressed objects and library pin classes | Reuse object ids, hashes, local budgets, and eviction. |
| Recovery key and encrypted identity bundle | Include as an optional encrypted backup component. Do not redesign key recovery. |
| `storage-ingest.ts` hosted block upload | Extend to full object CRUD, list, head, quota, delete, and manifest APIs. |
| Android Storage Access Framework export | Generalize into a persistent file-provider destination. |
| `expo-sqlite` serialize and backup APIs | Use for a consistent mobile database snapshot. |
| Web database export bytes | Use as the browser SQLite snapshot source. |
| Existing sync cryptography | Reuse HKDF and XSalsa20-Poly1305 secretbox for backup chunks. |
| Hosted billing and entitlements | Gate first-party managed storage capacity only. |

## Binding Architecture Decisions

1. Add a provider-neutral router in `@mylife/sync` and keep platform I/O in app or
   server adapters.
2. Backup format version 1 uses the existing recovery key, HKDF, random nonces,
   and XSalsa20-Poly1305 secretbox. No new cryptographic primitive is introduced.
3. Mobile SQLite snapshots use `expo-sqlite` `backupDatabaseAsync` or
   `serializeAsync` from the installed SDK, never a raw copy of a live WAL database.
4. iCloud automatic storage uses an app-owned ubiquity container through one owned
   Expo native module. Files-provider bookmarks remain a separate generic adapter.
5. Google Drive uses installed-app OAuth with PKCE on mobile, `drive.file` with the
   Google Picker where possible, and resumable upload for large objects.
6. Browser persistent OAuth uses a first-party or self-hosted storage OAuth broker.
   Refresh tokens are encrypted at rest by server KMS. The browser receives only
   short-lived provider sessions. This trust boundary is disclosed before connect.
7. Dropbox, OneDrive, and Box receive direct adapters for reliable web and mobile
   support. OS file-provider access remains an additional path, not a substitute.
8. WebDAV and S3 credentials live in SecureStore on mobile. Browser persistence uses
   the explicit OAuth or credential broker. Credentials never enter SQLite.
9. S3 uses Signature Version 4, multipart upload, explicit checksums, and path or
   virtual-host style capability detection. Temporary credentials are preferred.
10. Restore is staged into a temporary database and object area, verified completely,
    migrated, and atomically activated. The current install remains recoverable until
    the new state boots successfully.

Official capability anchors:

- Google installed-app OAuth with PKCE:
  <https://developers.google.com/identity/protocols/oauth2/native-app>
- Google Drive narrow `drive.file` scope:
  <https://developers.google.com/workspace/drive/api/guides/api-specific-auth>
- Google Drive resumable uploads:
  <https://developers.google.com/workspace/drive/api/guides/manage-uploads>
- Apple iCloud identity and ubiquity container access:
  <https://developer.apple.com/documentation/foundation/filemanager/ubiquityidentitytoken>
- S3 multipart checksums:
  <https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html>

## NOT in Scope

- Device private keys are not exported as plaintext or uploaded to any provider.
- Public published blobs remain governed by publication, archive, and takedown rules
  in Plan 43, not personal backup defaults.
- An explicit plaintext download remains an export action and is never treated as an
  encrypted background backup.
- Provider sync icons or local write completion are not treated as remote durability
  proof without a provider read-back or checksum result.
- Centralizing normal mesh replication in a cloud drive is not part of this plan.

## Data Classes

| Data class | Eligible destinations | Key and restore rule |
|---|---|---|
| Device private keys | OS secure storage only | never external |
| Encrypted recovery bundle | all user-selected backup destinations | recovery key required |
| SQLite app snapshot | all backup destinations | recovery key plus manifest verification |
| Attachment and library objects | local, cloud, hosted, connected server | object DEK remains client-controlled |
| Destination credentials | SecureStore or broker vault only | never part of backup |
| Public publication bytes | Plan 43 hosts | personal settings do not override public policy |
| Plaintext downloads | explicit file destination only | user action, no background copy |

## Architecture

```text
Settings and storage policy
          |
          v
mk_storage_policies -> StorageDestinationRouter
          |                    |
          |                    +-> encrypted backup snapshot builder
          |                    +-> encrypted object writer
          |                    +-> migration and restore controller
          v
configured destinations
  | local | iCloud | Drive | Dropbox | OneDrive | Box |
  | file provider | WebDAV | S3 | hosted | connected server |
          |
          v
authorize -> health -> quota -> put -> read-back verify -> list -> restore -> revoke

Web provider auth

browser -> explicit consent -> OAuth broker -> provider
   |                           |
   | short-lived session       +-> encrypted refresh token in KMS-backed vault
   v
encrypted objects only
```

## Shared Contracts

Add `packages/sync/src/storage/` and export from both barrels.

```ts
export type StorageDestinationKind =
  | 'local_device' | 'icloud_drive' | 'google_drive' | 'dropbox'
  | 'onedrive' | 'box' | 'file_provider' | 'webdav' | 's3'
  | 'hosted_storage' | 'connected_server';

export interface StorageCapabilities {
  backgroundWrite: boolean;
  resumableUpload: boolean;
  list: boolean;
  delete: boolean;
  quota: boolean;
  serverChecksum: boolean;
  maximumObjectBytes: number;
}

export interface StorageDestinationAdapter {
  authorize(input: StorageAuthorizationInput): Promise<StorageAuthorizationResult>;
  revoke(options: { deleteRemoteData: boolean }): Promise<void>;
  capabilities(): Promise<StorageCapabilities>;
  health(): Promise<StorageHealth>;
  quota(): Promise<StorageQuota>;
  putObject(input: EncryptedStorageObject, resume?: StorageResumeToken): Promise<StorageWriteResult>;
  headObject(ref: StorageObjectRef): Promise<StorageObjectMetadata | null>;
  getObject(ref: StorageObjectRef, range?: StorageByteRange): Promise<Uint8Array | null>;
  listObjects(cursor?: string): Promise<StorageObjectPage>;
  deleteObject(ref: StorageObjectRef): Promise<StorageDeleteResult>;
}
```

The router owns policy and jobs. Adapters own provider protocol only. No adapter can
set UI state directly.

## Local Schema

Add matching mobile and web migrations:

```sql
CREATE TABLE mk_storage_destinations (
  id text PRIMARY KEY,
  kind text NOT NULL,
  label text NOT NULL,
  account_hint text,
  credential_ref text,
  root_ref text,
  state text NOT NULL CHECK (state IN ('authorizing','ready','degraded','revoked','error')),
  capability_json text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE mk_storage_policies (
  data_class text PRIMARY KEY,
  primary_destination_id text NOT NULL,
  mirror_destination_id text,
  local_cache_bytes integer NOT NULL,
  retention_json text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE mk_storage_objects (
  object_id text NOT NULL,
  destination_id text NOT NULL,
  data_class text NOT NULL,
  ciphertext_hash text NOT NULL,
  plaintext_hash_encrypted text,
  encrypted_bytes integer NOT NULL,
  remote_ref text,
  remote_version text,
  state text NOT NULL CHECK (state IN ('queued','writing','verifying','verified','missing','deleting','deleted','error')),
  last_verified_at text,
  PRIMARY KEY (object_id, destination_id)
);

CREATE TABLE mk_storage_jobs (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('backup','restore','move','mirror','verify','delete','repair')),
  destination_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('queued','running','paused','cancelled','succeeded','partial','failed')),
  cursor_json text,
  total_objects integer NOT NULL,
  completed_objects integer NOT NULL,
  total_bytes integer NOT NULL,
  completed_bytes integer NOT NULL,
  attempts integer NOT NULL,
  last_error_code text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE mk_storage_health (
  destination_id text PRIMARY KEY,
  state text NOT NULL,
  used_bytes integer,
  cap_bytes integer,
  verified_read_write integer NOT NULL,
  checked_at text NOT NULL,
  error_code text
);

CREATE TABLE mk_storage_backups (
  backup_id text NOT NULL,
  destination_id text NOT NULL,
  manifest_ref text NOT NULL,
  manifest_ciphertext_hash text NOT NULL,
  schema_version integer NOT NULL,
  object_count integer NOT NULL,
  encrypted_bytes integer NOT NULL,
  state text NOT NULL CHECK (state IN ('writing','verifying','complete','corrupt','deleted')),
  completed_at text,
  PRIMARY KEY (backup_id, destination_id)
);
```

`credential_ref` points to SecureStore or a broker-side vault id. It is not a token.
All `mk_` tables remain device-local.

## Backup Format Version 1

One logical backup contains:

```text
MeerkatBackup/
  locator.json                 non-secret version, backup id, encrypted manifest hash
  manifest.mkmanifest          encrypted signed inner manifest
  database/000000.mkchunk      encrypted SQLite snapshot chunks
  identity/recovery.mkchunk    optional existing encrypted recovery bundle
  objects/<cipher-id>/...      encrypted attachment or library chunks
```

### Cryptographic construction

- Generate `backupId` randomly.
- Parse and checksum-validate the existing 256-bit recovery key.
- Derive `backupRootKey = HKDF(recoveryKey, "meerkat-storage-backup-v1:" + backupId)`.
- Derive one key per manifest and chunk with purpose, object id, and chunk index.
- Encrypt each chunk using the existing XSalsa20-Poly1305 secretbox with a random
  24-byte nonce.
- Hash ciphertext for remote integrity and include plaintext hashes only inside the
  encrypted manifest.
- Sign the canonical inner manifest with the current device identity. On restore,
  verify signature and recovered keypair consistency before activation.
- Never reuse nonce and key, and never derive a provider credential from recovery key.

### Snapshot consistency

- Mobile uses the installed `expo-sqlite` backup or serialize API while writes are
  coordinated through the database provider.
- Web exports current SQL database bytes through the adapter after queued writes
  complete.
- Run SQLite `integrity_check` on the snapshot before encryption.
- Record schema, migration, app, backup format, object list, sizes, hashes, and data
  class versions in the encrypted manifest.

## Job State Machine

```text
queued -> running -> writing -> verifying -> succeeded
            |           |            |
            v           v            v
          paused      retryable     corrupt
            |           |            |
            +--------> running     failed

cancelled is terminal for new writes, but already written verified objects remain
tracked until explicit remote deletion.
```

Rules:

- Jobs checkpoint after each bounded object or chunk.
- A retry reuses provider upload sessions where valid.
- A changed destination default affects future writes only. Existing data moves only
  through an explicit job.
- Success requires read-back or provider checksum verification of every required
  object and manifest.
- Partial lists exact missing or failed objects.
- One destination failure does not delete a verified mirror.

## Provider Implementations

### Local device

- Wrap current blob storage and local database snapshot export.
- Show real used bytes, budget, pin classes, and eviction state.
- Support local folder or file backup export and import.
- Web uses File System Access API on secure supported browsers. Otherwise it uses
  explicit download and upload with honest non-persistent copy.

### iCloud Drive

Create `packages/meerkat-icloud-storage/` as an Expo module:

- add iCloud Documents entitlement and app ubiquity container through config plugin;
- resolve `url(forUbiquityContainerIdentifier:)` and detect account changes;
- coordinate writes, downloads, conflict versions, and reachability;
- distinguish local container write, ubiquitous upload pending, downloaded, conflict,
  quota or account unavailable, and verified read-back;
- store automatic backups under the app container;
- support a fresh install selecting and restoring the encrypted manifest.

iCloud direct support is Apple-platform only. Web and Android do not show it as a
native provider.

### Google Drive

- Mobile installed-app OAuth with PKCE and secure refresh token storage.
- Web OAuth broker with `drive.file`, Google Picker, and short-lived browser session.
- App-created `Meerkat` root folder plus hidden stable file ids in local mapping.
- Resumable upload over 5 MiB or when network interruption risk is high.
- Conflict and duplicate detection by ciphertext hash and app properties.
- Token revoke, account change, provider error mapping, list, delete, and restore.

### Dropbox, OneDrive, and Box

- Implement direct OAuth adapters with the provider's narrow app-folder or selected
  folder scope where available.
- Use mobile PKCE and SecureStore. Use the web OAuth broker for refresh tokens.
- Support resumable or upload-session APIs, provider revisions, list, delete, quota,
  conflict, revoke, and read-back.
- Also support the providers through iOS Files and Android file-provider UI for
  explicit user-selected folder access.

### Generic file provider

- iOS uses `UIDocumentPickerViewController` and security-scoped bookmarks through
  the native storage module.
- Android uses persistent URI permission from the Storage Access Framework.
- Validate permission at every background job and surface revoke accurately.
- Do not claim provider cloud upload status when only a local provider write is known.

### WebDAV

- Support HTTPS only by default, with an explicit local-network self-host exception.
- Implement capability probe, `PUT`, `GET`, `HEAD`, `PROPFIND`, `DELETE`, ETag or
  checksum handling, quota where exposed, auth revoke, and TLS error states.
- Protect against redirect credential leakage and server-side path traversal.

### S3-compatible

- Support AWS S3 and compatible endpoints through Signature Version 4.
- Prefer temporary credentials. Store long-lived mobile credentials only in
  SecureStore. Web persistence uses broker vault.
- Implement region, endpoint, bucket, prefix, path style, multipart, abort, list,
  head, version, delete, checksum, and quota estimate.
- Never treat multipart ETag as the full object hash.

### Hosted storage

Extend the existing hosted upload route to a full versioned API:

- create or complete upload, head, ranged get, list, delete, quota, health, backup
  manifest list, and account deletion;
- all writes require real entitlement and tenant auth;
- server stores ciphertext only for personal backup or private objects;
- server metadata and bytes use Plan 44 PostgreSQL and object storage.

### Connected server

Define a signed `storage:v1` descriptor:

```ts
interface StorageCapabilityDescriptor {
  version: 1;
  endpoint: string;
  operatorKey: string;
  supportedOperations: string[];
  maximumObjectBytes: number;
  quotaBytes: number | null;
  retention: string;
  authDomain: 'meerkat-storage-auth-v1';
  issuedAt: string;
  expiresAt: string;
  signature: string;
}
```

Verify signature, TLS, expiry, challenge response, actual health, and quota before
selection. Reachability alone never authorizes upload.

## OAuth and Credential Broker

Add a provider broker to the hosted platform and self-host package:

- state and PKCE validation;
- exact redirect URI allowlist;
- provider token exchange and refresh;
- KMS envelope encryption for refresh tokens;
- short-lived browser storage sessions restricted to one destination and operation;
- token revoke and user deletion;
- provider account hint without exposing full email where avoidable;
- audit events without access or refresh token values;
- per-provider OAuth verification and consent-screen readiness.

The connect screen states that the selected broker can access the provider token and
encrypted Meerkat objects. Users may select a self-hosted broker.

## Atomic Restore

```text
select destination -> list locator records -> choose backup
        |
        v
download encrypted manifest and chunks to temporary area
        |
        v
ciphertext hash -> recovery key -> decrypt -> signature -> plaintext hashes
        |
        v
SQLite integrity_check -> migration rehearsal -> object inventory validation
        |
        v
show exact restore summary and identity replacement warning
        |
        v
close active DB -> preserve rollback snapshot -> activate restored DB and objects
        |
        v
boot verification -> success deletes rollback after retention window
```

Restore requirements:

- Wrong key, corrupt chunk, missing chunk, invalid signature, failed integrity check,
  or failed migration cannot modify active state.
- Identity restore reuses existing keypair consistency validation.
- A restore can select database only, objects only, or complete backup when the
  manifest supports it, with dependency warnings.
- Fresh install can restore without developer tools.
- Restore from one provider can migrate to another after activation.

## Build Phases

### Phase 0 - Protocol, schema, backup format, and test vectors

- Add shared contracts, migrations, state reducers, canonical backup format, crypto
  test vectors, and a provider conformance harness.
- Add fixture backups for current and future migration tests.

### Phase 1 - Router, jobs, settings, and local destination

- Build destination router, policy, jobs, health, storage screen, diagnostics,
  local snapshot, export, restore, and mirror behavior on mobile and web.

### Phase 2 - Apple storage

- Build the iCloud and generic iOS file-provider native module, entitlements,
  bookmarks, state monitoring, backup, and fresh-install restore.

### Phase 3 - Google Drive and OAuth broker

- Build mobile Google OAuth, web broker, Google Picker, Drive adapter, resumable
  upload, revoke, restore, and provider verification.

### Phase 4 - Dropbox, OneDrive, and Box

- Build direct adapters, broker integrations, selected folder UX, upload sessions,
  conflict handling, health, quota, revoke, migrate, and restore.

### Phase 5 - Android and web file providers

- Complete persistent Android SAF and supported web directory destination behavior.
- Add permission revoke, provider disappearance, and non-persistent fallback states.

### Phase 6 - WebDAV and S3

- Build secure credential storage, capability probe, all object operations,
  multipart, checksums, redirect hardening, revoke, migrate, and restore.

### Phase 7 - Hosted and connected servers

- Complete hosted storage API, connected `storage:v1` descriptor, challenge auth,
  quotas, deletion, account recovery, and self-host deployment.

### Phase 8 - Scheduling, retention, repair, and multi-destination

- Wire Plan 42 best-effort scheduling, manual run, retention, mirrors, missing-object
  repair, destination change, credential rotation, and account deletion.

### Phase 9 - Adversarial proof and release

- Run corruption, provider outage, revoked auth, quota, conflict, rollback, account
  switch, stale bookmark, redirect, MITM, restore, and large-object tests.
- Complete browser QA, physical-provider QA, store disclosure, runbooks, and Plan 40 evidence.

## Failure Modes

| Failure | Handling | Test | User-visible result |
|---|---|---|---|
| Snapshot races with a write | database backup API and write coordinator produce consistent snapshot | integration | backup retries if coordination fails |
| iCloud account changes | identity token invalidates destination and jobs | physical device | reconnect iCloud, never current |
| OAuth callback is forged | state, PKCE, redirect, and session binding reject | security integration | connection failed |
| Refresh token is revoked | stop jobs and mark auth required | provider sandbox | reconnect provider |
| Large upload stops midway | persist provider session and resume cursor | fault injection | paused or retrying with progress |
| Same ciphertext id has different bytes | fail closed as corruption | conformance test | corruption warning |
| Remote quota becomes full | stop before deleting local or mirror | sandbox or local server | quota exceeded with required bytes |
| File-provider permission disappears | health fails and job pauses | device test | reselect folder |
| WebDAV redirects to another host | refuse credential forwarding | security test | unsafe redirect blocked |
| S3 multipart ETag is treated as hash | explicit checksum path prevents it | adapter test | no false verification |
| One mirror fails after primary verifies | job becomes partial, primary remains valid | integration | backup partial with exact mirror error |
| Restore has one corrupt chunk | active state unchanged | restore fault test | backup corrupt with chunk id |
| App crashes during activation | rollback snapshot restores prior state | crash injection | prior data returns on boot |

Every failure has a test, typed error, and honest user or operator state.

## Test Review Diagram

```text
[snapshot] -> [encrypt chunks] -> [provider put] -> [read-back] -> [complete]
     |               |                |               |              |
 DB integration   crypto vectors    conformance    provider E2E    UI state

[locator] -> [manifest] -> [decrypt/verify] -> [temp DB migrate] -> [atomic activate]
    |             |              |                    |                   |
  list test    corrupt test    wrong-key test       migration test      crash test

[authorize] -> [secure custody] -> [refresh] -> [revoke/delete]
      |               |               |              |
  OAuth test      vault test       provider test   account E2E
```

Required tests:

- Backup canonical encoding and cross-platform golden vectors.
- HKDF purpose separation, nonce uniqueness, wrong key, tamper, truncation, and
  chunk-order tests.
- SQLite snapshot consistency under concurrent writes and integrity checks.
- Destination store and adapter conformance against local, fake, and real sandbox.
- OAuth state, PKCE, redirect, token encryption, rotation, revoke, and deletion tests.
- Provider-specific auth, quota, list, put, resume, head, get, checksum, conflict,
  delete, outage, and restore tests.
- Job pause, cancel, retry, mirror partial, crash resume, retention, and repair tests.
- Restore atomicity and rollback at every activation fault point.
- Browser five-state QA and mobile physical provider matrix.
- Fresh-install restore on iPhone, Android, and supported desktop browsers.
- Multi-gigabyte object and full-library capacity test within documented limits.

## Performance and Capacity Requirements

- Stream encryption and upload by bounded chunks. Never load a large backup into one
  JavaScript buffer.
- Use provider upload sessions and controlled parallelism with backpressure.
- Health probes are cached briefly and manually refreshable.
- List and restore candidates use cursors and bounded pages.
- Local cache eviction never removes the only verified copy without explicit policy.
- Measure encryption throughput, snapshot pause, upload, download, verification,
  memory, battery, and data use on representative devices.
- Load and soak tests cover provider throttling, token refresh storms, and mirror backlog.

## Parallel Work Lanes

| Lane | Modules | Depends on |
|---|---|---|
| A: contracts and router | sync storage package, app schemas | Phase 0 |
| B: local and restore | mobile and web database or object adapters | Phase 0 |
| C: Apple native storage | iCloud package and mobile config | Phase 0 |
| D: OAuth broker and Google | relay hosted service, mobile, web | Phase 0 and Plan 44 DB |
| E: Dropbox, OneDrive, Box | provider adapters and broker | broker contract |
| F: WebDAV, S3, connected | sync adapters, app, relay | Phase 0 |
| G: QA and release | tests, tickets, runbooks | merged A through F |

Run B, C, D, and F in parallel after A locks contracts. E follows the broker contract
but can run alongside Google implementation. One owner coordinates settings UI,
schema migrations, and app config. G is sequential.

## Acceptance Criteria

- AC-41.1: A user can configure every listed destination without developer tools.
- AC-41.2: No external adapter receives private plaintext or a device private key.
- AC-41.3: A backup becomes complete only after every required object and manifest
  passes read-back or provider checksum verification.
- AC-41.4: Mobile and web show real destination health, quota or capacity, last
  verification, jobs, and errors.
- AC-41.5: iCloud Drive backup and fresh-install restore work on a physical iPhone.
- AC-41.6: Google Drive backup and restore work on mobile and web through narrow auth.
- AC-41.7: Dropbox, OneDrive, and Box direct adapters pass mobile and web sandbox proof.
- AC-41.8: Generic iOS, Android, and supported web folder destinations survive restart
  or accurately require reselection.
- AC-41.9: WebDAV and S3 support health, quota where available, write, resume, list,
  checksum, read, delete, revoke, migrate, and restore.
- AC-41.10: Hosted and connected server storage store ciphertext only and expose real
  signed capability, health, usage, and deletion.
- AC-41.11: Primary plus mirror policy reports partial failure without losing a valid copy.
- AC-41.12: Restore validates, migrates, and activates atomically while preserving rollback.
- AC-41.13: Revoke, account switch, sign-out, destination deletion, and complete account
  deletion remove credentials and stop work without false current status.
- AC-41.14: Store and privacy disclosures describe provider and broker metadata accurately.

## Negative Criteria

- NC-41.1: No external destination stores device private keys or private plaintext.
- NC-41.2: No queued, uploaded, or locally written state may be labeled backed up
  without remote verification.
- NC-41.3: No refresh token, access token, WebDAV password, or S3 secret may enter SQLite,
  logs, crash reports, or backup files.
- NC-41.4: No provider may appear ready before real authorization and health checks.
- NC-41.5: No restore failure may partially replace active data.
- NC-41.6: No provider ETag may be treated as a content hash without provider-specific proof.
- NC-41.7: No hosted or first-party destination becomes a silent default.
- NC-41.8: No unsupported platform may render a provider as native support.

## Required Gates

- Function test scaffolds and `pnpm gate:function:changed`.
- Sync, mobile, web, relay, entitlements, parity, and generated-artifact suites.
- Crypto golden vectors and restore fixture compatibility.
- Provider conformance plus Google, Dropbox, OneDrive, Box, WebDAV, S3, hosted,
  connected-server, iCloud, and file-provider integration proof.
- OAuth and credential-custody security review.
- Browser QA and signed physical-device provider matrix.
- Plan 44 database, object storage, observability, backup, image, canary, and rollback gates.
- Store disclosure and account deletion review.

## Close Criteria

Plan 41 moves to `docs/plans/done/` only after every named destination is implemented
and proven, backup and restore are atomic across fresh installs, credentials and
private data follow the negative criteria, provider outages and revocations are
honest, operational services pass Plan 44, and Plan 40 links the exact automated,
provider, physical-device, security, legal, and release evidence.

## Status Delta (2026-07-14, execution start + packet board)

Founder decision: BUILD Plan 41 in full. This resolves the open build-vs-scope-cut
question; no scope reduction, per the MyLife Scope And Completeness mandate.

Execution moved to `feature/meerkat-plan41-storage` (worktree
`/Users/trey/Desktop/Apps-wt-41-meerkat-storage`), branched from `origin/main` tip
`2607ca5c` (Plan 41 is independent of the in-flight Plan 25 and Plan 43 branches).
Baseline gates green before any change: full `check:parity`, meerkat parity, sync
typecheck, sync 1,812 tests, relay 1,190 tests.

Packets follow the Plan 25/43 landing ritual: implementation (codex for clear-spec
crypto/protocol/server/adapter work, taste-tier models for user-facing UI),
adversarial review against the Negative Criteria, Fable verification against primary
evidence (code + passing tests, never worker claims), function gate + sync/relay/
app/web typechecks + full battery for touched packages + `check-meerkat-parity` +
`check:generated-artifacts`, then one Conventional-Commits commit per packet.

### Work packet board

| Packet | Plan phase / lane | Scope | State |
|---|---|---|---|
| WP-41A | Phase 0 / lane A | Shared contracts (`packages/sync/src/storage/`), `mk_storage_*` schema single source of truth (ensure-tables pattern), pure job state machine reducer, Backup Format v1 canonical encode/decode over recovery key + HKDF + secretbox with cross-checked crypto test vectors, provider conformance harness (fakes), fixture backups, both barrels wired RN-safe | LANDED `d795c979` (2026-07-14). 16 files, +4,598 lines, 71 storage tests; sync 1,883 green, typecheck, meerkat parity, artifact guard. Golden vectors cross-checked vs an independent inline RFC 5869 implementation; NC-41.2 typed verification evidence (`'none'` can never verify); NC-41.3 assertNotSecretLike at the credential_ref write seam. Fable review added a required streaming contract: createBackupEncoder (descriptors-only retention, key zeroization) + openBackupManifest/verifyAndDecryptBackupChunk streaming decode sharing batch internals, byte-equivalence proven against unchanged vectors |
| WP-41B | Phase 1 / lanes A+B | Destination router + policy + jobs + health engine, storage settings screen + diagnostics (mobile + web byte-twin), local device adapter, local snapshot, export, restore, mirror | CORE LANDED `95d69f99` (2026-07-14): router/policy/jobs/health + pure staged restore controller + diagnostics fold, 35 tests, sync 1,918 green. Evidence-gated verification (checksum match or byte-equal read-back only), mirror partials never invalidate a verified primary, move deletes source only after target verify + remote-absence confirm, activation type-gated on complete evidence. COMPLETE. UI packet WP-41B3 LANDED `cfa66a17` (2026-07-14, opus taste-tier): storage hub / add-destination / destination detail / backup / restore wizard on mobile + web over the diagnostics read model only; byte-twin storage-ui-core now LOCKED by the meerkat parity gate together with the product-law copy strings; hosted never a default (NC-41.7); broker disclosure verbatim (AC-41.14); restore summary + identity warning + current-data-untouched failure reassurance; mobile 1,266 + web 820 green. B2 platform packet LANDED `95e29b72` (2026-07-14): local device adapter (read-back evidence, real accounting), WAL-safe backupDatabaseAsync snapshots (integrity-checked, bounded 4 MiB chunks into the streaming encoder), three-phase journaled atomic activation (journal survives until boot verification; pre-open crash recovery rolls back conservatively; rollback retained until explicit release), web twin with persistent-storage-grant-gated durability, byte-twin cores, destination registry (unsupported kinds null, NC-41.8); +73 tests |
| WP-41C | Phases 2+5 / lane C | `packages/meerkat-icloud-storage` Expo native module (ubiquity container, entitlement plugin, conflict/reachability states), iOS Files security-scoped bookmarks, Android SAF persistent provider, web directory picker + honest non-persistent fallback; lazy-load, honest-null, UNVERIFIED-until-dev-build headers | LANDED `92b2cbd9` (2026-07-14). Owned Expo module (Swift ubiquity container, coordinated writes, conflicts, account-change events, bookmarks) + config plugin; iCloud durability evidence only after real ubiquitous upload + coordinated read-back (local write stays `none`); SAF/bookmark permission validated every operation; web FS-Access adapter with honest non-persistent fallback; mobile+web directory cores byte-identical; 24 tests; app 1,183 + web 758 + native 6 green, parity green. Native behavior UNVERIFIED pending signed dev build + physical QA (founder-ops) |
| WP-41D | Phase 3 / lane D | OAuth/credential broker on relay/hosted platform (state+PKCE, exact redirect allowlist, KMS-envelope refresh tokens, short-lived browser sessions, audit without token values) + Google Drive adapter (mobile PKCE, web broker, drive.file + Picker, resumable upload, revoke, restore); built against fakes/conformance | LANDED `e374ff4a` (2026-07-14). Broker: hashed single-use state (consumed on ANY first completion outcome), S256 PKCE, exact redirect allowlist with parameterized trick rejections, KMS-envelope refresh tokens (AAD-bound, data-key zeroized, rows proven token-free), 10-min operation-bound sessions, rotation re-encrypted, idempotent revoke, account deletion into the WP-41G path, tokenless audits, migration 14, file mode honestly broker_unavailable. Drive adapter: resumable + 308 recovery, sha256Checksum-preferred evidence (md5 fallback vs router-computed hash), conformance green. +86 tests; relay 1,238 + sync 2,022 + app 1,192 + web 765 + parity green. Real Google registrations = founder-ops |
| WP-41E | Phase 4 / lane E | Dropbox + OneDrive + Box direct adapters (app-folder scopes, upload sessions, revisions, quota, conflict, revoke, read-back) over the broker contract | LANDED `9167a2a7` (2026-07-14). Dropbox content_hash + OneDrive QuickXorHash verified against independent inline implementations with pinned known answers; Box sha1 evidence only because Box validates at commit; broker registry + PKCE/web token sources per provider; +100 tests; combined battery sync 2,089 + relay 1,247 + app 1,240 + web 814 + parity green. Report: docs/sessions/2026-07-14-meerkat-plan41-wp41e.html |
| WP-41F | Phase 6 / lane F | WebDAV adapter (capability probe, PUT/GET/HEAD/PROPFIND/DELETE, ETag/checksum, HTTPS-only default, redirect credential-forwarding refusal) + S3 adapter (SigV4, multipart + abort, explicit checksums, path/virtual-host detection, never multipart-ETag-as-hash); fully conformance-testable without provider accounts | LANDED `01e17cc7` (2026-07-14). +65 tests; SigV4 proven against the official AWS golden vectors + RFC 4231 HMAC vectors; cross-origin redirect refusal asserts Authorization absence via transport log; both adapters pass the Phase 0 conformance harness; sync battery + parity green |
| WP-41G | Phase 7 / lane F | Hosted storage full versioned API extending `storage-ingest.ts` (create/complete upload, head, ranged get, list, delete, quota, health, manifest list, account deletion; entitlement + tenant auth; ciphertext only) + connected-server signed `storage:v1` descriptor + challenge auth | HOSTED API LANDED `a89ccc61` (2026-07-14): /api/storage/v1 create/complete (server block re-verify + sha512 evidence), head, ranged get, list, idempotent delete via deletion jobs, quota, tenant health, backup locators, account deletion; PostgreSQL migration 13 metadata + object-store bytes; file self-host honestly legacy-only; relay 1,207 green. Fable fix: bin ready-log referenced block-scoped storageApiHandler and crashed every boot; caught by real-bin process-boundary tests, let-hoisted. COMPLETE. Descriptor packet WP-41G2 LANDED `81834321` (2026-07-14): signed storage:v1 descriptor with canonical byte builder + fail-closed verification, pinned-operator-key trust (self-signed is never an anchor), single-use bounded challenge nonces bound to endpoint/key/lifetime, credentials withheld until descriptor + challenge verify, reachable-but-unsigned never authorizes (test-pinned gate order), conformance-green client adapter, TTL-bounded relay issuing on hosted + community node; +61 tests; sync 2,132 + relay 1,265 green incl. real-bin tests |
| WP-41H | Phase 8 | Plan 42 best-effort scheduling + manual run, retention, mirrors, missing-object repair, destination change migration, credential rotation, account deletion. Plus the WP-41B3 handoff gap: locator-at-destination discovery for cross-device fresh-install restore | LANDED `7f6e348b` (2026-07-14). Retention never deletes the last verified complete backup (adversarial all-corrupt-except-one matrix) and never touches a mirror for a primary failure; scheduling rides the Plan 42 background-sync discipline (honest last-run, manual always available); repair from any verified copy with exact reports; credential rotation resumes paused jobs; idempotent account deletion with exact counts wired into delete-my-data; locators + manifest refs now stored AT every destination and discovered by the restore wizard (cross-device gap closed, wizard + parity-locked copy updated together); sync 2,178 + app 1,268 + web 822 + parity green |
| WP-41I | Phase 9 / lane G | Adversarial proof pack: corruption, provider outage, revoked auth, quota, conflict, rollback, account switch, stale bookmark, unsafe redirect, MITM, large-object, atomic-restore-into-staging; browser QA; Plan 40 evidence links | LANDED `9458f596` (2026-07-14). 72-test adversarial proof pack with AC/NC and failure-mode evidence matrix; founder-operated provider/device/browser/publication evidence remains open. |

### Binding invariants enforced per packet (from Negative Criteria)

Encrypt-before-adapter always; no plaintext device private key export ever; durability
claimed only after read-back or provider checksum; Backup Format v1 introduces no new
primitive; credentials never in SQLite/logs/backups (SecureStore or broker vault only);
atomic staged restore with rollback preserved; fail closed; no Simulated adapter as a
live destination; no adapter bypasses router policy/jobs; WebDAV/S3 cross-host redirects
refuse credential forwarding; no unsupported platform renders native provider support.

### Founder-ops remainder (never faked in code)

Real provider OAuth client registrations (Google, Dropbox, OneDrive, Box) and consent
screens; Apple iCloud entitlement + signed dev build; deployed OAuth/credential broker
with server KMS; physical per-provider QA matrix (authorize, write, read-back, list,
quota, revoke, migrate, restore, corruption, outage on real accounts and devices).
Release decision stays NO-GO until close criteria plus this evidence are met.
