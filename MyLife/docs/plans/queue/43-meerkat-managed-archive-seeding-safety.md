# Plan 43 - Meerkat Managed Archive, Automatic History, and Safety Operations

> Active production plan created 2026-07-09 from the adversarial launch audit.
> This plan turns local archive intentions and in-memory moderation seams into a
> durable, scanned, served, discoverable, removable, and operable product.

## Status

- **Integrated-candidate refresh, 2026-07-15:** WP-43A through WP-43D are integrated
  and WP-43E's HTTP component is present in `6b70b994`, but the production community
  binary does not construct or mount its `archiveIntake` dependencies. WP-43F, WP-43H,
  WP-43I, and WP-43J remain open. WP-43G is authored
  at `3af4ba99` on `worktree-wp43g` but is not an ancestor of the integrated candidate,
  so it remains open for review and integration. Founder-operated scanner, abuse-hash,
  NCMEC, DMCA, infrastructure, and soak evidence remains open.
- **Active queue plan. Execution started 2026-07-11 on `feature/meerkat-production-readiness-2026-07-09` under the execution contract below.**
- **Feeds:** Plan 40 final launch.

### Execution contract (2026-07-11)

Grounded in the code map. Substrate that already exists (Phase 2/3, do
NOT rebuild): the archive lifecycle state machine (created through
announced/removed), the object-store archive byte path with edge-first
promote ordering (a load-bearing safety property; the reference edge is
written before durable bytes so a crash yields a loud referenced_missing
finding, never a silent orphan deletion), the seeder node and HTTP
binding, the abuse-hash scan seam, and the NCMEC queue and DMCA intake
store contracts. Plan 43 adds the durable and operational layers on top.
Founder-ops (stated, never faked): licensed abuse-hash sources, a real
NcmecFilingClient behind CyberTipline vendor onboarding, a U.S.
Copyright Office DMCA registered agent, a real malware/AV scanner image,
real object storage and multi-node infra, and counsel sign-off.

1. **WP-43A, durable moderation store and scanner gating.** Replace the
   in-memory ArchiveModerationQueue with a durable store (memory, file,
   PostgreSQL triple + migration, verb-exact grants) whose lifecycle
   matches the lifecycle machine, a scanner worker that claims
   quarantined jobs under fenced leases and runs the real scan seam
   (malware/AV adapter + abuse-hash adapter, both honest and fail-closed
   when unconfigured), and quarantine gating so a pin record can be
   created ONLY after a committed clean-scan transaction. Nothing
   unscanned or non-clean is ever pinnable or serveable.
2. **WP-43B, pin reconciliation, takedown propagation, seeder quota.** A
   durable pin store reconciled against actual storage on startup and
   periodically (incremental cursor, never a full bucket list); takedown
   removes the serving-index entry BEFORE deleting bytes and preserves
   bytes still referenced by another active content reference (the
   reference ledger is authority); announce only active pins with valid
   current descriptors and refresh before TTL; a quota and retention
   controller. Depends on WP-43A's durable pin/scan state.
3. **WP-43C, NCMEC filing worker, DMCA config validation, operator
   alerts.** A real queued NCMEC worker that claims records under leases,
   validates fields, files once through the NcmecFilingClient seam with
   jittered retry on transient errors and an escalation queue for
   permanent validation failures, marking filed only on provider
   confirmation (the client itself is founder-ops). A DMCA validated
   configuration loader replacing the configured:false placeholder that
   fails first-party launch closed while any placeholder field remains,
   with deadline tracking and unresolved-item alerts. Operator alerts for
   the safety queues.
4. **WP-43D, automatic history helpers.** Pure @mylife/sync sealed
   host-registry helpers (community-secret-derived registry id, seal and
   open a host record, verify a descriptor), a private host registry
   record with no stable member identity, and an automatic client
   discovery and verify-then-commit import loop that falls back to manual
   import when no valid host is found. RN-safe, exported from both sync
   barrels, and typechecked under BOTH the relay Node lib set and the
   web/app DOM lib set (the WP-42 lesson: shared-package changes need the
   consumer typechecks).

Order: WP-43A and WP-43D in parallel (relay vs sync, disjoint), then
WP-43B and WP-43C in parallel. Every package lands only after
adversarial review, consumer typechecks, and the full battery.
- **Depends on:** publication, archive-job, snapshot, host-registry, directory,
  community-node, hosted entitlement, and operator-console code already shipped.
- **Infrastructure dependency:** Plan 44 PostgreSQL, object storage, observability,
  backup, and release controls.
- **Launch rule:** Meerkat is not production-ready while archive jobs stop at a
  local `pending` row, history host discovery is manual, safety queues require
  export-only handling, or hosted bytes are not durably backed up and removable.

## Current Code Grounding

### Real foundations to reuse

- `packages/sync/src/protocol/public-archive.ts` defines signed archive rights and
  archive-job primitives.
- Mobile and web `public-publish.ts` persist `cm_archive_jobs`, rights, and a local
  pending moderation mirror after a public publish.
- `packages/meerkat-relay/src/storage-ingest.ts` performs entitlement-gated,
  hash-verified, cap-enforced, resumable block upload.
- `ArchiveModerationQueue` has a correct in-memory approval rule: only a real clean
  scan can make a candidate serveable or announceable.
- Community and public-directory nodes already persist publications, kill ledgers,
  reports, public posts, and snapshots through injected file stores.
- `FileSeederPieceStore`, host registry, public directory, and snapshot clients
  already implement hash-addressed pieces and signed discovery.
- `NcmecReportQueue` durably records evidence references and defines an
  `NcmecFilingClient` seam, but no real filing client or filing worker exists.
- DMCA notice intake, operator action, counter-notice capture, and audit rows exist,
  but `DMCA_REGISTERED_AGENT` is a hardcoded placeholder.
- The public submit scanner can use a static known-bad hash set, but the managed
  archive has no wired AV, malware, decompression, or industry abuse-hash pipeline.

### Verified missing code

- No managed archive intake API connects client job rows to hosted uploads.
- No durable archive moderation store or worker drives scan, approval, pin, and
  directory announcement.
- No client polling or callback path advances archive UI from pending to a real
  server decision.
- No automatic private community history-host catalog discovery exists.
- No production hosted seeder retention and reconciliation controller exists.
- No real `NcmecFilingClient`, automatic retry, provider reference storage, or
  failed-filing escalation exists.
- No environment-backed DMCA registered-agent configuration or startup gate exists.

## What Already Exists

| Problem | Existing solution | Plan decision |
|---|---|---|
| Signed publication and rights | `publication.ts`, `public-archive.ts` | Reuse exact signatures and domains. |
| Resumable bytes | `storage-ingest.ts` | Extend it with archive job binding and full object lifecycle. |
| Scan decision semantics | `ArchiveModerationQueue` | Preserve the state rules, replace in-memory storage with a store interface. |
| Content-addressed hosting | seeder piece store and host registry | Use as the serve and discovery layer after approval. |
| Kill and unpublish | descriptor kill, publication delete, directory kill ledger | Fan the same verified action through archive pins and object retention. |
| Operator workflows | operator console, NCMEC queue, DMCA lane | Add real workers, provider status, and alerting. |
| Hosted entitlement | hosted billing and storage feature | Use for managed retention and quotas, not for public viewing. |

## Binding Architecture Decisions

1. First-party managed archive bytes live in versioned S3-compatible object
   storage. PostgreSQL stores lifecycle state, leases, quotas, and references.
2. Uploads land in a quarantine namespace. Nothing in quarantine is public,
   seedable, or announced.
3. A worker performs type validation, decompression limits, malware scanning,
   industry abuse-hash matching, content hash verification, and policy checks.
4. Only an approved scan transaction creates a pin record. Only a confirmed pin
   transaction creates a directory announcement job.
5. Archive state is server-authoritative. Clients mirror signed or authenticated
   status results and never advance from a local timer.
6. Private community history discovery uses a community-secret-derived registry
   id and sealed host record. The registry sees only opaque ids and ciphertext.
7. Public archive host records use the existing public directory model.
8. Hosted seeders continuously reconcile database pin intent, object existence,
   active takedowns, and the serving index. Restart is safe and repeatable.
9. NCMEC filing is a real queued worker behind the existing interface. Provider
   credentials and exact filing fields are founder-operated configuration, but
   production launch cannot pass until a sandbox and live filing path are proven.
10. DMCA agent identity comes from validated environment or secret-manager config.
    First-party production refuses public launch mode while placeholder fields exist.

## NOT in Scope

- Scanning private mesh messages, private DMs, private community ciphertext, or
  personal backups is not part of this plan. Safety processing applies to public
  or explicitly managed-hosting bytes that the service is authorized to process.
- User-selected personal backup destinations are owned by Plan 41.
- General push delivery is owned by Plan 42. Plan 43 may enqueue a status wake
  after a real state change.
- PostgreSQL clustering, backups, and image provenance are owned by Plan 44.
- Replacing publication signatures, group keys, or the public directory protocol
  is not part of this plan.

## Product Flows

```text
Managed public archive

explicit consent + signed rights
             |
             v
create server archive job -> upload blocks to quarantine
             |                       |
             |                       v
             |                 hash and size verify
             |                       |
             +-----------------------+
                                     v
                         scan lease -> scanning
                                     |
                      +--------------+--------------+
                      |                             |
                      v                             v
                   rejected                 approved transaction
                                                    |
                                                    v
                                           durable object pin
                                                    |
                                                    v
                                        public directory announce
                                                    |
                                                    v
                                            signed client status

Automatic private history

community node announces sealed host record
             |
             v
registry stores opaque record with TTL
             |
             v
member sees partial channel history
             |
             v
resolve with community secret -> verify descriptor -> pull snapshot -> verify -> import
```

## Durable Lifecycle Model

Server state uses the Plan 44 migration runner.

```sql
CREATE TABLE archive_jobs (
  job_id uuid PRIMARY KEY,
  publication_id text NOT NULL,
  content_id text NOT NULL,
  owner_subject_hash bytea NOT NULL,
  tier text NOT NULL CHECK (tier IN ('self_hosted','managed')),
  status text NOT NULL CHECK (status IN (
    'created','uploading','quarantined','scanning','review_required','approved',
    'pinned','announced','rejected','takedown_pending','removed','failed'
  )),
  rights_json jsonb NOT NULL,
  rights_signature text NOT NULL,
  expected_bytes bigint NOT NULL,
  received_bytes bigint NOT NULL DEFAULT 0,
  last_error_code text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (publication_id, content_id)
);

CREATE TABLE archive_objects (
  content_id text NOT NULL,
  object_index integer NOT NULL,
  object_hash text NOT NULL,
  object_bytes bigint NOT NULL,
  quarantine_key text NOT NULL,
  durable_key text,
  storage_checksum text,
  status text NOT NULL,
  PRIMARY KEY (content_id, object_index)
);

CREATE TABLE archive_scans (
  scan_id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES archive_jobs ON DELETE CASCADE,
  engine text NOT NULL,
  engine_version text NOT NULL,
  definitions_version text,
  result text NOT NULL CHECK (result IN ('clean','malware','abuse_hash_match','flagged','error')),
  result_code text,
  started_at timestamptz NOT NULL,
  completed_at timestamptz
);

CREATE TABLE archive_pins (
  publication_id text NOT NULL,
  content_id text NOT NULL,
  host_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('pinning','active','removing','removed','error')),
  last_verified_at timestamptz,
  PRIMARY KEY (publication_id, host_id)
);

CREATE TABLE service_jobs (
  id uuid PRIMARY KEY,
  kind text NOT NULL,
  subject_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','leased','succeeded','retryable','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL,
  lease_owner text,
  lease_expires_at timestamptz,
  last_error_code text,
  payload jsonb NOT NULL,
  UNIQUE (kind, subject_id)
);
```

All state transitions use compare-and-set updates in a transaction. A worker lease
expires and can be reclaimed. A stale worker cannot commit after its lease is lost.

## Managed Archive API

| Method and path | Result |
|---|---|
| `POST /v1/archive/jobs` | verify publication, rights, entitlement, quota, and create idempotent job |
| `PUT /v1/archive/jobs/:jobId/objects/:index` | resumable quarantine upload with hash, size, and job binding |
| `POST /v1/archive/jobs/:jobId/complete` | verify full manifest and enqueue scan |
| `GET /v1/archive/jobs/:jobId` | authenticated authoritative status and exact error |
| `DELETE /v1/archive/jobs/:jobId` | owner cancel or takedown request |
| `GET /v1/archive/publications/:publicationId/hosts` | approved active public hosts only |
| `POST /v1/archive/internal/scan-results` | authenticated worker result, lease-bound |

The client stores no server-issued `approved` or `archived` state unless this API
returned it for the matching publication, content id, rights signature, and job id.

## Scanner Pipeline

Every object passes these checks before approval:

1. Recompute content hash and compare with the signed manifest.
2. Detect file type from bytes and compare with declared type.
3. Enforce per-file, aggregate, archive-entry count, nesting, and expansion-ratio caps.
4. Reject path traversal, symlink, device file, and ambiguous polyglot cases.
5. Run malware and AV scan with pinned engine and definitions versions.
6. Run configured known-bad abuse-hash provider for eligible media.
7. Record only result codes and evidence references. Do not log content.
8. Move clean bytes from quarantine to the durable namespace with object-store
   checksum validation.
9. Securely remove rejected quarantine objects according to the evidence policy.

If any required scanner is unavailable, the job stays non-serveable and retries.
After the bounded retry window it enters `review_required` or `failed`; it never
advances to approved.

## Seeding and History Discovery

### Private community host registry

Add pure helpers in `@mylife/sync`:

```ts
deriveCommunityHistoryRegistryId(communitySecret: Uint8Array): string;
sealCommunityHistoryHost(communitySecret: Uint8Array, record: HistoryHostRecord): string;
openCommunityHistoryHost(communitySecret: Uint8Array, ciphertext: string): HistoryHostRecord | null;
verifyHistoryHostDescriptor(record: HistoryHostRecord, descriptor: SignedCommunityDescriptor): boolean;
```

The record contains a short-lived URL, descriptor revision, supported snapshot
version, maximum object size, and expiry. It contains no stable member identity.

### Automatic client behavior

- When a joined channel reports partial history, resolve its host registry once
  per bounded refresh interval.
- Verify the sealed record, TLS URL, signed community descriptor, current member
  status, snapshot scope, epoch, manifest signature, and every piece hash.
- Import into a temporary batch. Commit messages and cursor only after the entire
  snapshot verifies.
- Fetch the warm tail after the snapshot cursor.
- Fall back to manual import and clear error details when no valid host exists.
- Cache only verified hosts until their TTL. Re-resolve after failure or expiry.

### Always-on hosted seeder

- Announce only active pins and community snapshots with valid current descriptors.
- Refresh announcements before TTL expiry.
- Reconcile pins on startup and periodically.
- Remove serving index entries before deleting bytes on takedown.
- Preserve bytes shared by another active content reference.
- Enforce tenant quota, global reserve, retention, and low-disk emergency policy.
- Expose bounded counts, bytes, oldest job age, scan backlog, pin drift, and
  announcement freshness through private metrics.

## Safety Filing and Legal Configuration

### NCMEC filing worker

- Extend `NcmecReportRecord` with provider reference, filing attempts, last error,
  and filed time through a backward-compatible store migration.
- Implement a production `NcmecFilingClient` adapter after founder vendor onboarding.
- Build a worker that claims queued records, validates required fields, files once,
  stores the provider reference, and marks `filed` only on provider confirmation.
- Use an idempotency key based on the existing stable evidence id.
- Retry transport and provider temporary errors with jitter.
- Route permanent validation failures to a human escalation queue without changing
  the source record to filed.
- Keep manual export available as a documented emergency path, with audit rows.

### DMCA configuration

- Replace `DMCA_REGISTERED_AGENT` with a validated configuration loader.
- First-party production requires real name, entity, address, email, phone, and
  effective registration date.
- Self-host mode can run without a registered-agent claim, but the endpoint must
  label that state accurately.
- Add notification deadlines, counter-notice deadlines, unresolved-item alerts,
  and immutable operator audit references.

This plan does not decide legal facts. Counsel and the founder provide the legal
identity, provider account, evidence policy, retention policy, and response targets.
Code validates and enforces the configured workflow.

## Build Phases

### Phase 0 - Durable contracts and migrations

- Add archive store, job store, scan store, pin store, and worker lease contracts.
- Add file adapters for self-host conformance and PostgreSQL adapters for production.
- Add the state transition reducer and transition matrix tests.

### Phase 1 - Archive intake and client synchronization

- Add the managed job API and bind existing resumable block ingest to a job.
- Wire mobile and web publish flows to create, upload, complete, poll, cancel, and
  display server-authoritative state.
- Add authenticated status wake through Plan 42 when configured.

### Phase 2 - Scanner and quarantine

- Build the isolated scanner worker image and file-safety pipeline.
- Wire malware, AV, and abuse-hash adapters.
- Add definition freshness checks and fail-closed readiness.

### Phase 3 - Pin, serve, and announce

- Promote clean objects using object-store checksums.
- Pin through the existing seeder contract.
- Announce only after active pin confirmation.
- Reconcile restart, missing object, duplicate object, and drift cases.

### Phase 4 - Takedown and deletion propagation

- Drive owner unpublish, operator kill, DMCA action, GDPR delete, and entitlement
  expiry through serving index removal, directory removal, reference accounting,
  object deletion, and audit state.
- Prove a restart cannot resurrect removed content.

### Phase 5 - Automatic history and hosted seeding

- Add the sealed private history registry and host announce loop.
- Add automatic client discovery, snapshot import, warm tail, and recovery.
- Add hosted seeder retention, quota, and freshness controllers.

### Phase 6 - Safety operations

- Implement and wire the real NCMEC filing adapter and worker.
- Replace DMCA placeholders with validated runtime configuration.
- Add operator alerts, escalation states, and legal workflow health.

### Phase 7 - Adversarial proof and release

- Run malicious archive, decompression, hash collision, stale lease, takedown race,
  host spoofing, queue replay, and restart tests.
- Run a multi-node soak with real object storage, PostgreSQL, scanners, seeder,
  directory, and clients.
- Update runbooks, store disclosures, pricing copy, and Plan 40 evidence.

## Failure Modes

| Failure | Handling | Test | User-visible result |
|---|---|---|---|
| Upload completes but manifest is incomplete | completion refuses and lists missing pieces | API integration | upload incomplete with retry |
| Scanner process crashes | lease expires; job retries; never serves | worker crash test | scanning delayed with timestamp |
| AV definitions are stale | readiness fails; no approvals | configuration test | scanning unavailable, not archived |
| Worker loses lease after scan | stale result update rejected | concurrency test | no duplicate or false approval |
| Object promotion succeeds before DB commit fails | reconciliation finds orphan and removes or adopts only by exact job | fault injection | job retries without duplicate charge |
| Pin active but announcement fails | announcement job retries; pin remains unlisted | integration test | hosted but discovery pending |
| Takedown races with approval | takedown state wins and blocks pin or announce | concurrency test | removed, never resurrected |
| Shared object has two publications | reference count preserves bytes until last active reference ends | integration test | each publication state remains correct |
| Fake private history host is returned | seal, descriptor, membership, and TLS checks reject | adversarial test | manual import fallback |
| NCMEC provider is unavailable | retry and escalation, never mark filed | sandbox fault test | operator sees overdue filing |
| Placeholder DMCA agent in production | startup or readiness refuses | startup test | deployment blocked before traffic |

No failure may create a serveable object without a clean scan, leave killed content
in the serving index, or mark a legal filing complete without provider confirmation.

## Test Review Diagram

```text
[signed job] -> [quarantine upload] -> [scan] -> [pin] -> [announce]
     |                 |                |        |          |
   unit             integration       worker   seeder     directory E2E

[kill/unpublish] -> [serve gate off] -> [directory off] -> [object GC]
       |                   |                  |                |
  race tests          live request         lookup test      ref-count test

[partial history] -> [sealed resolve] -> [snapshot verify] -> [atomic import]
       |                    |                   |                  |
     UI E2E            adversarial          crypto tests       DB test
```

Required tests:

- State transition table and property tests for every legal and illegal transition.
- Store conformance suite against memory, file, and PostgreSQL adapters.
- API tests for auth, entitlement, quota, resume, conflict, cancel, and revoke.
- Scanner corpus covering safe files, malware fixtures, archive bombs, traversal,
  malformed containers, MIME mismatch, and provider outage.
- Worker lease, retry, duplicate, and stale-result concurrency tests.
- End-to-end clean publish to public discovery and rejected publish never served.
- Takedown tests at every lifecycle state and across service restart.
- History host privacy, spoof, expiry, old descriptor, removed member, corrupt
  snapshot, partial tail, and atomic import tests.
- NCMEC sandbox filing, duplicate evidence, temporary failure, permanent failure,
  manual emergency export, and provider-reference tests.
- Browser and mobile five-state QA for archive status and automatic history.
- Physical client plus hosted-node soak for at least 48 hours.

## Performance and Capacity Requirements

- Upload chunks, archive expansion, scanner memory, scanner time, and object counts
  are bounded per job and per tenant.
- Worker concurrency is configurable and backpressure follows queue age and storage.
- Public serving never reads quarantine.
- History resolution and host announcement use TTL caches with jitter to prevent a
  synchronized refresh storm.
- Seeder reconciliation is incremental and cursor-based, not a full bucket list on
  every interval.
- Load tests cover 10 times forecast upload rate, scan backlog, directory announce,
  takedown bursts, and history pulls.

## Parallel Work Lanes

| Lane | Modules | Depends on |
|---|---|---|
| A: archive state and API | sync protocol, relay API, DB migrations | Plan 44 DB foundation |
| B: scanner worker | relay worker and deploy artifacts | Phase 0 contracts |
| C: client archive UX | mobile and web | Phase 0 contracts; mocked API |
| D: seeder and history | sync node, relay seeder, mobile and web history | Phase 0 contracts |
| E: safety operations | relay legal queues and operator console | Phase 0 contracts |
| F: end-to-end QA | tests, scripts, runbooks | merged A through E |

Launch B, C, D, and E after Phase 0 while Lane A finishes production adapters.
Coordinate shared edits in `packages/meerkat-relay/src/index.ts`, deploy compose,
and app providers. Merge all lanes before Lane F.

## Acceptance Criteria

- AC-43.1: A managed archive job uploads all bytes, receives a real clean scan,
  pins, announces, and becomes readable from a fresh client.
- AC-43.2: Malware, abuse-hash, malformed, oversized, and scanner-unavailable jobs
  are never served or announced.
- AC-43.3: Client archive state comes from the matching server job and survives
  reinstall through authenticated lookup.
- AC-43.4: Owner unpublish, operator kill, DMCA action, and GDPR delete remove
  serving and discovery, survive restart, and preserve required audit evidence.
- AC-43.5: Shared content deduplication does not delete bytes still referenced by
  another active publication.
- AC-43.6: A joined member with partial history automatically finds a valid host,
  imports a verified snapshot, and catches up the warm tail.
- AC-43.7: A removed member or spoofed host cannot resolve or import new history.
- AC-43.8: Hosted seeder restarts reconcile every pin, object, takedown, and
  announcement without manual repair.
- AC-43.9: A real NCMEC sandbox and live-configured path can file idempotently and
  records the provider confirmation before `filed`.
- AC-43.10: Production DMCA endpoints publish validated founder-supplied agent data.
- AC-43.11: Operator alerts cover overdue scans, takedowns, filings, queue age,
  scanner freshness, and seeder drift.

## Negative Criteria

- NC-43.1: No pending, scanning, review-required, or failed object is serveable.
- NC-43.2: No client timer or local job row may claim archived or approved.
- NC-43.3: No private mesh content is uploaded or scanned without explicit managed
  hosting authorization.
- NC-43.4: No takedown may be acknowledged before the serving index is disabled.
- NC-43.5: No NCMEC record may be marked filed from manual export or a queued request.
- NC-43.6: No placeholder legal identity may run in first-party production mode.
- NC-43.7: No stable member or device identity may enter the private history registry.

## Required Gates

- Function test scaffolds and `pnpm gate:function:changed`.
- Sync, relay, mobile, web, entitlements, and parity suites.
- Store conformance against file and PostgreSQL.
- Scanner corpus and isolated-worker security review.
- Object-storage integration, checksum, versioning, and deletion tests.
- Browser and mobile QA across all archive and history states.
- Multi-service soak, restart, failover, and takedown drills.
- `pnpm check:generated-artifacts` and `pnpm check:parity --quiet`.
- Counsel and founder confirmation of legal configuration and evidence policy.

## Close Criteria

Plan 43 moves to `docs/plans/done/` only after the clean and rejected end-to-end
flows are proven, automatic history works on fresh clients, takedowns survive
restart, a real managed seeder is healthy, NCMEC filing is provider-confirmed,
DMCA identity is configured, operational alerts are active, and Plan 40 links the
exact code, infrastructure release, QA evidence, and founder-owned approvals.

## Status Delta (2026-07-12, branch consolidation + packet board)

### Branch and state consolidation

- Execution moved to `feature/meerkat-plan43` (dispatch-board branch naming),
  branched from merged main `6f8e6545` and merging
  `feature/meerkat-production-readiness-2026-07-09` (Plan 42 codeable tail +
  the execution contract `5b0de929` + WP-43A `ea3c2fe8`).
- In-flight uncommitted work from the prior session was recovered and absorbed
  onto this branch, none of it lost: WP-43D (sync sealed history registry +
  auto-sync loop + barrel wiring, authored in the main tree) and WP-43B/WP-43C
  (relay pin/takedown/announce/quota + NCMEC filing/DMCA config/operator
  alerts, authored uncommitted in the production-readiness worktree; snapshot
  preserved in the session scratchpad before absorption).
- The merge also untracked `node_modules` and `apps/yearn/node_modules`: both
  had been committed to main as self-referential symlinks, breaking every
  `pnpm install` (ELOOP). `.gitignore` now uses `node_modules` (no trailing
  slash) so a symlink cannot be committed again.

### Baseline on this branch (2026-07-12, all verified live)

- Relay: typecheck green; full battery 178 files / 1276 tests green (one
  non-reproducible flake under parallel-suite load on the first run).
- Sync: typecheck green; 153 files / 1840 tests green, including the 28 new
  WP-43D tests.
- Consumer typechecks green (meerkat-web DOM libs, meerkat mobile) - the
  WP-42 lesson applied.
- The 2026-07-12 auto-logged relay failures in errors_log.md were stale-tree
  artifacts from the pre-integration dowork checkout; re-verified green here.

### Re-grounding corrections to "Verified missing code"

Now EXISTS on this branch (was "missing" when the plan was written):
- Durable archive lifecycle store (memory/file/PostgreSQL triple, migration
  0006) with fenced leases - the moderation decision IS the archive.scans row
  (WP-43A decision; no parallel moderation store).
- Scanner worker + malware/AV seam + abuse-hash rail, fail-closed
  (`UnavailableMalwareScanner` throws; unconfigured deploys can never approve).
- Object-store boundary (file/S3/memory), reference ledger, deletion-jobs
  queue, leased reconciler (Plan 44 WP-2A/B/C).
- Pin reconciler, takedown propagator (serving-index-first ordering),
  announcement scheduler, seeder quota controller, seeder + NCMEC filing bins,
  NCMEC filing lifecycle (migration 0015), DMCA env config loader wired into
  the community node, operator alert evaluators (WP-43B/C, absorbed, pending
  review + commit).
- DMCA intake, NCMEC queue, storage ingest, community/directory node
  persistence (verified shipped pre-plan).

Now also exists: the WP-43E managed archive job intake API binding verified publication,
rights, entitlement, quota, resumable quarantine upload, completion, status, cancel,
and approved-host discovery into the community-node HTTP surface.

Still missing on the integrated candidate (drives the open packets below): client
server-authoritative archive status sync + UI; the community-node sealed
history-host announce loop; mobile/web automatic-history wiring + UI;
operator-console surfacing of the new alert evaluators; the Phase 7
adversarial proof pack.

### Work packet board

| Packet | Scope | State |
|---|---|---|
| WP-43A | Scanner worker gating pins on durable clean scan | LANDED `ea3c2fe8`; post-hoc opus review PASS; its HIGH (NCMEC evidence lost in the reject-commit crash window), 2 MEDIUMs (stranded scanning jobs never reclaimed; unbounded per-object scan read), and LOW fixed + test-pinned in `e9c1f68e` |
| WP-43B | Pin reconcile, takedown propagation, announce scheduler, seeder quota + seeder bin | LANDED (opus PASS); review MEDIUM fixed: bin cursor persistence is real via migration 16 + PostgresPinReconcileCursorStore; seeder-role grant assertions + live-PG shared-byte-survival test added |
| WP-43C | NCMEC filing worker + bin, migration 0015, DMCA config loader, operator alerts | LANDED (opus PASS, no code findings) |
| WP-43D | Sealed history-host registry + automatic history sync loop (sync package, both barrels) | LANDED (opus PASS); review MEDIUM fixed: throwing injected wiring now degrades per candidate instead of rejecting the pass; 33 tests |
| WP-43E | Managed archive job intake API on the community node HTTP surface: create job (verify publication + rights + entitlement + quota, idempotent), bind resumable storage-ingest upload to the job, complete -> verify manifest -> enqueue scan, authenticated status GET (exact error/state), owner cancel/takedown DELETE, approved-hosts GET. Server-authoritative; no client-writable status. | HTTP COMPONENT LANDED `9eab3d8b`; present in `6b70b994` with 26 current intake tests, but `meerkat-community-node.mjs` does not construct/pass `archiveIntake`; production composition and bin proof remain open |
| WP-43F | Client archive sync, byte-twin mobile+web: publish flow creates the server job, uploads, completes, polls authenticated status; local `cm_archive_jobs` mirrors ONLY server-returned state (NC-43.2 guard: no local timer advancement); archive status UI states (pending/uploading/scanning/approved+announced/rejected/failed) with honest copy; parity guards in the same commit. | To author -> sonnet implements (user-facing) |
| WP-43G | Community-node sealed history-host announce loop: env-gated (`ANNOUNCE_RELAY_URL` + descriptor set), announces `sealCommunityHistoryHost` records under `deriveCommunityHistoryRegistryId` with TTL refresh before expiry and jitter; serves the existing snapshot pull path; never announces without current descriptor + serveable snapshot. | AUTHORED `3af4ba99` on separate `worktree-wp43g`; not present in `6b70b994`, so review, integration, and combined-tree gates remain open |
| WP-43H | Automatic history client wiring, byte-twin mobile+web: partial-history detection triggers `runAutomaticHistorySync` with injected resolver (relay registry lookup by derived rid), puller (`pullCommunityFeed` full verification), committer (atomic batch + cursor), TTL host cache; manual-import fallback UX with honest reasons; bounded refresh interval; parity guards same commit. | To author -> sonnet implements (user-facing) |
| WP-43I | Operator console safety lanes: surface `evaluateOperatorAlerts` + `evaluateDmcaDeadlines` (scan backlog, filing overdue/escalations, DMCA deadlines, seeder drift) on the operator console; identity-free payloads only. | To author -> codex implements |
| WP-43J | Phase 7 adversarial proof pack: e2e clean publish -> discovery and rejected -> never served; takedown at every lifecycle state + across restart (no resurrection); host spoof/expiry/removed-member history negatives; queue replay; restart reconcile drill. Closes with QA evidence + Plan 40 ledger links. | To author -> codex implements, fable verifies |

Founder-ops (unchanged, never faked in code): licensed abuse-hash sources,
real NcmecFilingClient vendor onboarding, U.S. Copyright Office DMCA agent
registration, real malware/AV image, real object storage + multi-node infra,
counsel sign-off, 48h soak.

Landing rule per packet: opus adversarial review + fable verification against
primary evidence, function gate + relay/sync/consumer typechecks + full
battery + `check:parity` green, transport-honesty invariants intact
(DEFAULT_RELAY_URL stays `''`, no fabricated status, no simulated capability),
byte-twin web/mobile parity + guards in the same commit for client packets.
