# Plan 44 - Meerkat Production State, Observability, Recovery, and Release Supply Chain

> Active production plan created 2026-07-09 from the adversarial launch audit.
> This plan makes first-party Meerkat services safe to run, recover, observe,
> reproduce, verify, and roll back under real production load.

## Status

- **Active queue plan. Phase 0 PostgreSQL foundation completed 2026-07-09. Phase 1 adapters and runtime wiring completed 2026-07-10 (`7b8fa151`). Phase 2 object storage completed 2026-07-10 (`c5e81b09`). Phase 3 import and cutover tooling completed 2026-07-10 (`ba46ab89`); staging exercises with production-shaped snapshots remain with the Phase 7 rehearsal evidence. Phase 4 observability completed 2026-07-10 (`5f11b1b8`). Phase 5 backup and recovery completed 2026-07-10 (`feb943e5`, hardened `b792a124`): digest snapshots under the SELECT-only backup role, restore smoke recording verified-only-on-complete-and-identical proofs into ops.backup_restore_proofs, the backup-freshness synthetic, the object-store backup inventory, and real backup plus disaster-recovery runbooks; WAL archive, base backups, PITR, and actual drills are founder-ops whose evidence lands in the proof rows. Phase 6 supply chain completed 2026-07-11 (`0ace4d39` signed release-images pipeline with SBOM, blocking+informational scans, SLSA provenance, Cosign keyless signing, digest-pinned bases; `9c7cce59` release-manifest schema and the NC-44.4 verify gate with tamper detection; `c229cf81` the lease-fenced release-promotion ladder, fail-closed canary verdict, honest rollback, checklist-rail workflows, and the release-promotion runbook); the first signed pipeline RUN, manifest recording/approval, deploys, canary cohorts, and rollback drills are founder-ops whose evidence lands in the release and promotion stores. Phase 7 production rehearsal completed 2026-07-11 (`f345e807` the ops.rehearsal_proofs evidence substrate with layered passed-requires-evidence honesty and the Plan 40 evidence-fragment export; `0922e39d` the dependency-free load/soak harness with fail-closed verdicts and the eight drill playbooks plus fault-handling and canary-stop mechanical proofs). ALL CODEABLE PHASES (0-7) ARE COMPLETE. What remains is founder-operated evidence recorded through the shipped stores into Plan 40's ledger: the first signed pipeline run, provider backups with the weekly restore-smoke cadence, staging/canary/rollback drills against a real fleet (AC-44.11), the 48-hour soak (AC-44.12), the drill ladder, and 10x-forecast load tests; see docs/sessions/2026-07-11-meerkat-plan44-phase7-complete.md for the exact list. The hosted reservation flow and archive lifecycle still lack runtime bin consumers.**
- **Feeds:** Plans 25, 40, 41, 42, and 43.
- **Applies to:** relay, community node, public directory, humanity, persona,
  hosted billing and storage, moderation console, push gateway, archive workers,
  seeders, and calls infrastructure.
- **Launch rule:** Meerkat is not production-ready while first-party mutable state
  depends only on one container volume, restore is untested, metrics are only
  liveness counts, or published images lack an SBOM, provenance, signature, and
  immutable release manifest.

## Current Code Grounding

### Real foundations to retain

- Stateful cores already use injected store interfaces. File stores exist for
  descriptors, publications, kills, reports, public posts, humanity, personas,
  billing, moderation, public directory, storage ingest, NCMEC, and DMCA.
- Most file writes use atomic rename or create semantics and have restart tests.
- `Dockerfile.platform` runs as an unprivileged user with a read-only production
  compose shape, dropped capabilities, internal networking, and health checks.
- `compose.production.yml` defines edge, relay, humanity, hosted, persona, and
  community services with required secret expressions.
- Services expose bounded `/healthz` responses and structured JSON logs.
- The slim relay is stateless and can remain horizontally replicated.
- GitHub Actions are pinned by commit and the existing image workflow publishes
  an immutable SHA tag in addition to mutable tags.

### Verified missing production controls

- File-backed state assumes one writer and one mounted volume. It does not support
  horizontally replicated stateful services or transactional changes across stores.
- The production PostgreSQL foundation and migration runner exist as of Phase 0.
  Production store adapters and first-party runtime wiring are complete as of
  Phase 1 (2026-07-10); the community node holds separate community and
  moderation role contexts.
- No object-storage backend, versioning policy, inventory reconciliation, or
  cross-region durable-byte recovery exists.
- No automated backup job, point-in-time recovery configuration, restore command,
  restore rehearsal, or backup-age alert exists.
- Health endpoints do not distinguish liveness from dependency readiness.
- No private metrics endpoint, distributed trace pipeline, SLO dashboard, paging
  policy, synthetic probe, or capacity alarm exists.
- The image workflow publishes only the slim relay image. It does not publish the
  complete platform topology.
- No SBOM, vulnerability gate, image signature, build attestation, release manifest,
  migration compatibility check, canary, or automated rollback proof exists.

## What Already Exists

| Foundation | Decision |
|---|---|
| Store interfaces and file adapters | Keep for self-host and use as conformance references. |
| Atomic file writes | Keep in file mode, but do not use as first-party HA state. |
| Slim stateless relay | Scale horizontally without PostgreSQL on its forwarding path. |
| Production Docker hardening | Extend to every image and worker. |
| Structured bounded logs | Standardize fields and export without message or identity data. |
| `/healthz` | Preserve compatibility, add `/livez` and `/readyz`. |
| Pinned GitHub Actions | Keep pins, add verification and release controls. |

## Binding Architecture Decisions

1. First-party production mutable service state uses PostgreSQL 17 or newer through
   the existing store interfaces. Self-hosted single-node installations may use
   file mode.
2. PostgreSQL access uses `pg` plus explicit SQL migrations. No new ORM is added.
3. Each service has a least-privilege database role and schema ownership boundary.
4. Content and archive bytes use versioned S3-compatible object storage with
   checksums. PostgreSQL stores metadata and references, not large blobs.
5. Redis is used only where the selected calls platform needs it and for no durable
   source of truth. Queue truth stays in PostgreSQL.
6. Production supports at least two stateless instances and at least two stateful
   API instances where the service contract is horizontally safe.
7. Schema changes use expand, migrate, contract ordering. A release must run with
   both old and new app versions during rollout.
8. Backups are incomplete until a separate restore environment proves them.
9. Logs, metrics, and traces contain no message content, file names, device public
   keys, personas, tokens, SDP, ICE, provider credentials, or raw IP addresses.
10. Every deploy uses an image digest from a signed release manifest. Mutable tags
    are for discovery, never production pinning.

Official architecture anchors:

- PostgreSQL continuous archiving and point-in-time recovery:
  <https://www.postgresql.org/docs/17/continuous-archiving.html>
- GitHub build provenance attestations for container images:
  <https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations>
- Sigstore container signing:
  <https://docs.sigstore.dev/cosign/signing/signing_with_containers/>

## NOT in Scope

- Replacing the decentralized mesh with a central database is not part of this
  plan. PostgreSQL stores first-party service state only.
- Storing private message or private community plaintext on first-party services
  is forbidden and not part of this plan.
- Provider-specific product flows for calls, storage, push, and archive are owned
  by Plans 25, 41, 42, and 43. This plan supplies their production substrate.
- Business analytics, behavioral tracking, advertising telemetry, and third-party
  session replay are not part of observability.
- A file-mode self-host installation is not labeled highly available. Its backup
  and restore controls remain explicit and truthful.

## Production Topology

```text
Internet
   |
   v
CDN / DDoS control / TLS edge
   |
   +--------------------+--------------------+-------------------+
   |                    |                    |                   |
relay pool          stateful API pool     LiveKit SFU pool    public reads
(stateless WS)      (community, persona,   + Redis            (directory/seeder)
                    humanity, hosted,
                    push, moderation)
                           |
                           v
                    PostgreSQL primary
                      |           |
                      |           +-> hot standby
                      v
                 WAL archive + base backups
                           |
                           v
                 separate backup account

stateful APIs and workers -> versioned object storage
workers: archive scan, pin/announce, NCMEC filing, cleanup, backup verification

all services -> OpenTelemetry collector -> metrics, logs, traces, alerts
```

The public edge exposes only documented application routes. PostgreSQL, Redis,
object storage administration, metrics, and tracing receivers are private.

## PostgreSQL Design

### Structure

Add `packages/meerkat-relay/src/postgres/`:

- `pool.ts`: bounded pool, statement timeout, connect timeout, TLS, app name.
- `migrations/`: ordered forward migrations with checksums.
- `migrate.ts`: advisory-lock migration runner and schema version guard.
- `health.ts`: dependency readiness and replication-lag query.
- `stores/`: one adapter per existing store interface.
- `conformance/`: shared behavior suite for memory, file, and PostgreSQL.
- `import-file-state.ts`: dry-run and apply migration from existing file volumes.

### Service schemas

Use logical PostgreSQL schemas to make ownership and backup inspection clear:

| Schema | State |
|---|---|
| `community` | descriptors, publications, kills, reports, public posts, flood windows |
| `directory` | public publication index, kill ledger, host freshness |
| `humanity` | challenges, token hashes, spent markers, bounded counters |
| `persona` | claims, aliases, suspensions, release tombstones, sessions |
| `hosted` | billing bindings, entitlements, quota, storage object metadata |
| `moderation` | reports, decisions, audit, NCMEC queue, DMCA claims |
| `push` | encrypted provider tokens, capabilities, attempts |
| `archive` | jobs, scans, pins, worker leases, retention |
| `ops` | migration ledger, job leases, release and backup verification records |

### Transaction rules

- Security-sensitive first-bind, spend, redeem, alias claim, tombstone, kill,
  entitlement link, quota reservation, and worker claim operations use a single
  database transaction and unique constraints.
- Every externally retried mutation has an idempotency key and stored result.
- Revision updates compare expected prior revision in the same statement.
- Takedown disables serving before asynchronous byte deletion begins.
- Database time is authoritative for expiry and leases.
- All list endpoints use stable cursors and supporting indexes.
- Every query has a statement timeout and every transaction has a maximum age.

## File-to-PostgreSQL Migration

Build a repeatable migration command:

```text
discover files -> validate names and JSON -> map to typed records
      |
      v
dry-run counts, duplicates, invalid records, and content digests
      |
      v
write into empty target transaction batches
      |
      v
compare source and target semantic digests
      |
      v
start services in shadow-read mode in staging
      |
      v
maintenance cutover -> final import -> PostgreSQL source of truth
      |
      v
retain read-only file snapshot until restore window closes
```

Requirements:

- Never mutate source files.
- Reject unknown or corrupt security-sensitive records unless an explicit reviewed
  quarantine policy handles them.
- Produce a signed migration report with counts and semantic digests per store.
- Re-running the importer gives the same result.
- Test with fixtures from every historical file schema.
- Provide rollback to the pre-cutover release and read-only source snapshot before
  any new PostgreSQL-only write occurs. After new writes, rollback restores from
  PostgreSQL, not by silently returning to stale files.

## Object Storage

- Use separate quarantine, durable private, public archive, backup, and audit
  prefixes or buckets with least-privilege service roles.
- Enable versioning, default encryption, public-access block, access logging that
  excludes query secrets, retention, and lifecycle policy.
- Supply and verify explicit checksums for single and multipart uploads.
- Use immutable content-addressed keys. Mutable manifests are versioned.
- Maintain database reference counts and an object inventory reconciler.
- Quarantine is never served by the public origin.
- Deletes create a durable deletion job and verify object absence after retention
  policy allows removal.
- Cross-region replication is required for first-party durable paid storage and
  public managed archive.

## Backup and Disaster Recovery

### PostgreSQL

- Continuous WAL archive to a separate backup account.
- Encrypted daily base backup and provider-managed snapshots.
- Retention: 35 daily recovery points, 12 monthly recovery points, and the legally
  approved audit retention schedule.
- Alert on WAL archive delay, backup age, backup size anomaly, and failed checksum.
- Quarterly point-in-time recovery drill plus automated weekly restore smoke test.

### Object storage

- Versioning and cross-region replication.
- Inventory reports and checksum sampling.
- Deletion-marker and object-version restore drill.
- Backup account credentials are not available to application workloads.

### File-mode self-host

- Quiesced snapshot command that records service versions and store digests.
- Restore command into a new data directory, never over the only copy.
- Startup verification before changing the active symlink or volume.

### Recovery objectives

| Service class | RPO | RTO |
|---|---:|---:|
| Stateless relay | no durable state | 15 minutes |
| PostgreSQL service state | 5 minutes or less | 60 minutes |
| Managed paid storage and archive bytes | confirmed writes preserved | 4 hours regional recovery |
| Safety and legal queues | 5 minutes or less | 60 minutes |

RPO is maximum acceptable data loss. RTO is maximum acceptable time to restore
service. These targets are release gates and must be validated by drills.

## Health, Metrics, Logs, and Traces

### Endpoints

- `/livez`: process event loop and fatal-state liveness only.
- `/readyz`: database, required key material, scanner freshness, object storage,
  and dependent service checks with bounded reason codes.
- `/healthz`: compatibility summary that remains safe for public probes.
- `/metrics`: private Prometheus format with authentication or network isolation.

### Required metrics

- Request rate, latency, response status, and active connections by route template.
- Database pool use, wait time, errors, transaction age, query timeout, and standby lag.
- Queue depth, oldest age, lease expiry, retries, failures, and throughput by kind.
- Object write and read latency, checksum failures, reconciliation drift, and bytes.
- Push provider acceptance and invalid-token rate.
- Archive scan time, definition age, result counts, and approval-to-pin latency.
- Seeder pin and announcement freshness.
- Backup age, WAL archive delay, last restore proof, and recovery drill duration.
- LiveKit room, participant, packet loss, jitter, reconnect, and egress job counts
  without stable participant identity.

### Log and trace rules

- Generate request ids and trace ids at the edge.
- Use route templates, never raw sensitive URLs.
- Hash IPs with a rotating operational salt only where abuse controls require it.
- Redact authorization, cookies, tokens, query secrets, payloads, SDP, ICE, file
  names, identities, and provider responses before logging.
- Set retention by data class and document access controls.
- Add automated log-safety tests using canary secret strings.

## SLOs and Alerts

An SLO is a measured service reliability target.

| User journey | Initial production SLO |
|---|---:|
| Relay connection and envelope forwarding | 99.95% monthly availability |
| Public feed read and community history pull | 99.9% monthly availability |
| Humanity, persona, hosted, and push APIs | 99.9% monthly availability |
| Successful accepted mutation latency | p95 under 750 ms excluding external provider time |
| Push provider submission | p95 under 2 seconds |
| Clean archive completion | p95 under 10 minutes for supported size ceiling |
| Confirmed backup freshness | 100% within configured window |

Page on multi-window SLO burn, security gate failure, queue age over target, backup
failure, scanner stale, database unavailable, replication lag, object checksum
failure, takedown propagation delay, and NCMEC filing delay. Create warning alerts
for capacity trends before they become pages.

Every page links one runbook with symptoms, dashboards, safe mitigations, rollback,
and escalation ownership.

## Release Supply Chain

### Images and artifacts

Publish separate images for:

- slim relay
- Meerkat platform API
- public directory
- seeder
- archive scanner worker
- operations worker
- calls token service or adapter if not part of platform API

Build Linux `amd64` and `arm64` images from the monorepo root with locked pnpm and
base image digests.

### Required workflow steps

1. Clean checkout and frozen install.
2. Lint, typecheck, tests, parity, generated-artifact check, and migration checks.
3. Build each image once.
4. Generate CycloneDX or SPDX SBOM for every image.
5. Scan OS and application dependencies. Block known exploitable critical findings
   unless a dated, owner-signed exception exists.
6. Push by immutable digest and semantic release tag.
7. Generate GitHub artifact provenance attestation.
8. Sign the image digest with keyless Cosign identity.
9. Verify signature, attestation, and SBOM from a separate release job.
10. Write `meerkat-release.json` containing git SHA, image digests, SBOM digests,
    migration range, mobile build numbers, web artifact digest, config schema,
    and rollback release.
11. Deploy the exact manifest to staging, run smoke, load, migration, backup, and
    security tests.
12. Promote the same digests to production through a canary and health gate.

Production compose, Kubernetes, Fly, or Render configurations must use image digests,
not `latest` or a locally built image.

## Deployment and Rollback

```text
release manifest
      |
      v
staging deploy -> migrations expand -> smoke/load/security/restore
      |
      v
production canary -> synthetic journeys + error budget check
      |
      +---- fail ----> stop rollout -> app rollback -> compatible schema remains
      |
      v
rolling promotion -> migration backfill -> compatibility window -> contract migration
```

- Migrations never depend on all processes updating at once.
- Canary traffic includes read, write, humanity, persona, push, archive, and history.
- Rollback is a tested command using the prior signed release manifest.
- Destructive contract migrations require a confirmed backup and restore proof,
  and run only after the old release is outside the rollback window.
- Secrets rotate independently of image deploy with overlapping verification keys.

## Build Phases

### Phase 0 - Store inventory, SQL schema, and migration runner (completed 2026-07-09)

- Completed: mapped every mutable store and security invariant.
- Completed: added PostgreSQL pool, migrations, roles, schema guard, and conformance harness.
- Completed: added CI migration, compatibility, empty-database, concurrency, recovery,
  role, and hostile-ACL tests against PostgreSQL 17.

### Phase 1 - PostgreSQL adapters

- Implement community, directory, humanity, persona, hosted, moderation, NCMEC,
  DMCA, push, archive, and operations adapters.
- Add transaction and concurrency tests for every security-sensitive mutation.
- Preserve file adapters and self-host selection.

#### Phase 1 execution contract (engineering review 2026-07-10)

Phase 1 is not a thin CRUD translation. It must replace process-local authority with
database-backed atomic operations so two service replicas have the same security and
lifecycle view. Work executes in this dependency order:

1. Add an immutable forward migration after schema version 2. Correct the archive
   protocol mismatch (`self_host`, deterministic text job IDs, and the signed whole-job
   envelope), add typed query columns, lifecycle checks, stable cursor indexes,
   request-bound idempotency, fenced leases, directory RID normalization, hosted quota
   reservations, and role grants for every new object.
2. Add one shared PostgreSQL store context. It owns bounded query and transaction
   timeouts, one checked-out client per transaction, nested callback client reuse,
   deterministic advisory transaction locks, safe JSON and timestamp decoding, and
   explicit unavailable errors. Transactions never use `pool.query` after `BEGIN`.
3. Refine existing memory and file contracts before adding PostgreSQL implementations.
   Atomic methods cover descriptor claims, live kill checks, capped report append,
   one-use humanity challenge consumption, capped issuance, persona lifecycle locking,
   conditional billing events, moderation decision plus triage, NCMEC export claims,
   and versioned DMCA transitions. All three backends run the same behavior suites.
4. Implement community and directory repositories. Serving paths query live kill state,
   publication mutations use compare-and-set or transaction locks, host announcer keys
   are keyed digests rather than raw network identifiers, expiry uses database time,
   discovery is bounded and indexed, and no warmed process map remains authoritative.
5. Implement humanity, persona, hosted billing, moderation, NCMEC, and DMCA adapters.
   Cross-service workflows use durable idempotent saga records where a database
   transaction cannot include a remote provider call.
6. Implement the complete Plan 42 push contracts and Plan 43 archive lifecycle
   contracts before their PostgreSQL adapters. Token generations overlap safely,
   provider tokens stay encrypted, signed archive identity remains byte-compatible,
   retry claims are fenced, and stale workers cannot commit.
7. Split hosted storage into PostgreSQL quota and manifest metadata plus the Plan 44
   object-store contract. External byte writes use expiring reservations, staged
   activation, checksum verification, and reconciliation. File storage remains the
   complete self-host implementation while the first-party composition uses the real
   object adapter delivered by Phase 2.
8. Centralize runtime selection with explicit `file` and `postgres` modes. First-party
   configuration fails closed unless PostgreSQL, TLS verification, least-privilege
   service roles, and schema readiness all pass. Self-host mode keeps file durability.
   Community, directory, operator, GDPR, and worker processes must select the same
   authority and close all pools on shutdown.
9. Prove the implementation with separate pools and service instances. Required races
   include conflicting descriptor revisions, kills during warm reads, report caps,
   post replay and freeze, directory owner and host caps, one-use humanity challenges,
   final issuance allowance, persona registration and deletion, billing event order,
   link redemption, NCMEC export, DMCA lifecycle, push and archive lease fencing, and
   object activation reconciliation.

Engineering-review invariants:

- A PostgreSQL outage returns a service-unavailable result. It is never translated into
  missing data, an empty list, an unspent token, a 404, or a malformed client frame.
- Security-sensitive reads and writes use database time and one transaction boundary.
- Every high-cardinality list is bounded and uses a stable indexed keyset cursor.
- PostgreSQL stores metadata and references, not large byte payloads.
- No generic adapter may accept caller-supplied schema or table names.
- Production readiness means behavior across multiple processes, not persistence alone.

### Phase 2 - Object storage

- Implement object store contract, S3 adapter, checksum and multipart handling,
  reference accounting, reconciliation, versioning, and deletion jobs.
- Migrate hosted and archive bytes behind the contract.

#### Phase 2 execution contract (2026-07-10)

Grounded in the code map of the current byte paths. The external byte boundary
already exists: `HostedStorageObjectStore` (createUploadTarget, observeObject,
deleteObject) with observe-compare fencing and deletion receipts consumed by the
hosted metadata store, and the archive quarantine-to-durable move with
`storageChecksum` verification. Phase 2 extends that boundary; it does not
parallel-wire a second one.

Dependency-ordered work packages:

1. **WP-2A, contract foundation.** One `MeerkatObjectStore` contract satisfying
   every expectation the hosted metadata store and archive lifecycle already
   place on bytes (sha256 hex checksums, observe before transition, deletion
   receipts, quarantine and durable keys, cap enforcement before write, verify
   before serve). Memory and file adapters plus a `StoreConformanceSuite`
   conformance and function-gate tests. File mode preserves current layouts.
2. **WP-2B, S3 adapter.** Contract implementation with multipart upload,
   checksum enforcement, versioning, bounded retries, and a pinned MinIO image
   for live integration tests plus the CI job, mirroring the pinned
   PostgreSQL 17 pattern. Depends on WP-2A.
3. **WP-2C, reference accounting, reconciliation, deletion jobs.** Inventory
   reconciler (orphan object quarantined, missing object surfaces an exact
   unavailable state), fenced deletion jobs on the Phase 1 operations-store
   lease pattern, archive shared-object refcount preserved. Depends on WP-2A.
4. **WP-2D, hosted byte migration.** Hosted ingest and service compose the
   object store in first-party mode; file self-host unchanged. Depends on
   WP-2A and WP-2B.
5. **WP-2E, archive byte migration.** Archive workers and seeder serving behind
   the contract with verify-before-serve and corrupted-piece refusal intact.
   Depends on WP-2A and WP-2B.

Every package lands only after adversarial review and the full gate battery
(lint, typecheck, full suite, live PostgreSQL, live MinIO once WP-2B exists,
compose parse).

### Phase 3 - Import and cutover tooling

- Build dry-run, import, semantic digest, shadow-read, cutover, and rollback tools.
- Exercise with production-shaped snapshots in staging.

#### Phase 3 execution contract (2026-07-10)

Grounded in the code map: 18 file store classes, three enumeration gaps
(seeder pieces, NCMEC queue, deletion jobs need direct directory scans),
four one-at-a-time stores needing upfront id enumeration, per-store
semantic identity tuples, the migrate-cli NDJSON idiom, and the
operations-store idempotency machinery for resumable jobs. Cutover today
is an env-flip restart; no shadow mechanism exists.

1. **WP-3A, import engine, importers, digest, dry-run.** A shared
   enumeration layer covering every file store (contract methods where
   they exist, documented direct scans for the three gap stores, upfront
   id iteration for the one-at-a-time stores). Importers write through
   the PostgreSQL adapters wherever the contract can express the record;
   any dedicated insert path is owned by the importer with identical
   validation and stated per store. Resumable batches under
   operations-store idempotency claims. One import CLI in the
   migrate-cli idiom with per-store selection, a dry-run mode
   (enumerate, validate, digest, zero writes), and a semantic digest
   plus verify command comparing file and PostgreSQL state through the
   identity tuples, never byte serialization.
2. **WP-3B, shadow read.** A generic comparator wrapper constructing
   both backends, returning primary reads while deep-comparing shadow
   results and emitting divergence events, selectable per service as an
   explicit backend mode requiring both file and PostgreSQL config.
   Depends on WP-3A only for digest confirmation of parity claims.
3. **WP-3C, cutover and rollback orchestration.** A cutover CLI and
   runbook: writer freeze, final delta import, digest verification gate,
   env flip, post-boot digest, durable cutover proof through the
   operations store; rollback flips back to the untouched file state and
   records the rollback window plus digest delta honestly, never
   pretending post-cutover PostgreSQL writes survive a rollback.
   Depends on WP-3A.

Every package lands only after adversarial review and the full gate
battery, including live PostgreSQL and MinIO suites.

### Phase 4 - Observability and SLOs

- Add live and ready endpoints, private metrics, trace export, log redaction tests,
  dashboards, synthetics, pages, and runbooks.

#### Phase 4 execution contract (2026-07-10)

Grounded in the code map. Hard boundaries: the slim relay is untouched
(its two-field `/healthz` is the entire surface; hub stats beyond the
connection count stay private), metric names and labels never carry
identities, tokens, or content addresses, readiness never fakes a
capability whose gate is missing, and any correlation identifier is
opaque to the relay and never propagated through envelopes.

1. **WP-4A, endpoints and private metrics.** Every stateful service
   (community, directory, humanity, persona, hosted) gains `/livez`
   (process liveness) and `/readyz` (honest dependency readiness:
   schema guard, pool health, object-store availability, humanity
   verifier reachability where configured), plus a Prometheus-format
   `/metrics` endpoint bound to a separate private listener, exporting
   existing bounded stats, pool metrics, shadow divergence counters,
   and reconciler finding counters with static label sets. Compose
   healthchecks move to the new endpoints; the relay keeps `/healthz`.
2. **WP-4B, redaction codification.** A shared redaction helper for
   the NDJSON out() paths, the log-hygiene canary-secret E2E pattern
   generalized to every service bin, and CI wiring so a leaked token,
   connection string, or identity blocks release.
3. **WP-4C, SLOs, synthetics, runbooks, trace design.** Machine-readable
   SLO and alert definitions derived from the failure-modes table and
   existing thresholds; synthetic probe scripts for the public
   endpoints; one runbook per page with symptoms, dashboards, safe
   mitigations, and escalation; and the correlation-identifier design
   doc that respects the zero-knowledge constraints (per-service
   request ids only, never crossing the relay). Hosting dashboards and
   pagers is founder-ops and is stated as such, never faked.

Every package lands only after adversarial review and the full battery.

### Phase 5 - Backup and recovery

- Configure WAL archive, base backups, object versioning, inventory, and separate
  backup credentials.
- Automate restore smoke and execute full disaster-recovery drills.

#### Phase 5 execution contract (2026-07-10)

Grounded in the code map. Structural fact: PostgreSQL is an external
managed database (no compose service), so WAL archiving, base backups,
and PITR are founder-ops provider configuration. The repository owns
everything that can verify and prove: digest snapshots, restore smoke,
proof recording into the existing `ops.backup_restore_proofs`, backup
freshness against the SLO, the read-only digest credential, and drill
runbooks with exact commands.

**WP-5A, restore verification and backup evidence tooling** (one
package):

1. A digest-snapshot command capturing a per-store semantic reference
   digest from a live database through the state-import engine,
   recorded as a durable dated artifact.
2. A restore-smoke CLI: pointed at a RESTORED database, it re-digests
   every store, compares against the reference snapshot, measures
   restore timing, and records a `BackupRestoreProof` row (verified
   true only on identical digests; divergences recorded, never
   swallowed) in the migrate-cli NDJSON idiom under operations-store
   fencing.
3. A backup-freshness check script (synthetics idiom, dependency-free)
   reading the latest proof rows against the SLO thresholds, exit
   0/1/2, feeding the backup-stale page honestly.
4. An object-store backup inventory job producing per-prefix counts
   and digest rollups through listInventory and the reference ledger,
   recorded durably for restore comparison.
5. A `meerkat_backup_digest` read-only role in the manifest (SELECT
   only, verb-exact, proven by the live grant test) so production
   digest snapshots never run as a writer role.
6. Runbooks: backup-stale.md upgraded from placeholder to real
   commands; a disaster-recovery drill runbook (restore to scratch,
   smoke, proof, decision) with provider steps clearly marked
   founder-ops; object-versioning guidance noting the adapter needs no
   bucket versioning for correctness.

Drills against real provider backups are founder-ops evidence recorded
via the same proof rows; the tooling never pretends a drill ran.

### Phase 6 - Supply chain and complete images

- Publish all platform images with SBOM, scan, attestation, Cosign signature, and
  release manifest.
- Add staging, canary, promotion, and rollback workflows.

#### Phase 6 execution contract (2026-07-10)

Grounded in the terrain map. Structural facts: four production Dockerfiles
exist (`Dockerfile` slim relay, `Dockerfile.platform` stateful services,
`Dockerfile.hosted`, `Dockerfile.verification`); bases are tag-pinned, not
digest-pinned. CI today is `publish-relay-image.yml` (relay only, build+push,
no supply chain) and `ci.yml` (OSV lockfile scan, relay smoke build).
`ops.release_manifests` exists with immutable insert, CAS approval on
`lifecycle_version`, `supersedes_release_id`, and cursor listing. There is NO
sbom/scan/provenance/signing tooling anywhere in the repo. Binding criteria:
AC-44.9, AC-44.10, AC-44.11, NC-44.4. Honest boundary: workflow and manifest
DEFINITIONS are repo-owned and testable; actually running signed releases
against a real registry with a real signing identity, and choosing canary
cohorts, is founder-ops evidence recorded through the same stores.

Hard boundaries binding every work package:

- The slim relay image invariants are untouchable: ws+zod-only runtime,
  `bin/meerkat-relay-server.mjs` entrypoint, two-field `/healthz`. The ONLY
  permitted Dockerfile change is base-image digest pinning;
  `relay-image-deps.test.ts` must stay green unmodified.
- Zero new package runtime dependencies. SBOM, scan, provenance, and signing
  run as CI steps via third-party actions PINNED TO FULL COMMIT SHAS, never as
  package deps.
- Tooling never fakes: a manifest row records what was built and signed; a
  promotion row records a transition an operator actually performed; a canary
  verdict comes from real synthetic probe exits. No step simulates registry
  pushes, deploys, or drills.
- `/metrics` stays on the internal network; `/healthz` is never extended.

**WP-6A, image supply chain in CI** (owns `.github/workflows/`, the four
Dockerfiles, root `.dockerignore` if needed):

1. Digest-pin all four Dockerfile base images (`node:<tag>@sha256:...`,
   comment records the resolved tag for humans). Relay Dockerfile changes stop
   there.
2. A `release-images.yml` workflow (workflow_dispatch + `release-v*` tags)
   building ALL FOUR images from their correct contexts, tagged by immutable
   git SHA (never `latest`), pushing to GHCR, and for EACH image: SPDX SBOM
   (syft action), vulnerability scan (grype action) failing on non-allowlisted
   findings against a repo-owned exception file with per-entry justification
   and expiry, SLSA provenance attestation, and Cosign keyless (GitHub OIDC)
   signature. Every third-party action pinned to a full commit SHA.
3. The workflow's final job emits a draft release-manifest JSON artifact
   (schema from WP-6B) carrying every image digest and its SBOM/scan/
   attestation/signature references, the git SHA, and the migration range.
   Recording it into PostgreSQL is operator-run (founder-ops), not CI-run.
4. Upgrade `publish-relay-image.yml` to the same supply-chain bar or retire it
   into `release-images.yml` (no second unsigned publish path may remain).
5. Workflow lint gate: actionlint if available, else a YAML-parse check; the
   relay-image invariant suite and full battery stay green.

**WP-6B, release manifest schema and verification CLI** (owns
`src/release/`, `src/postgres/cli/release-cli.ts`, `bin/meerkat-release.mjs`,
release tests):

1. A zod schema for the `ops.release_manifests.manifest` jsonb: per-image
   entries (name, repository, immutable digest, sbomRef, scanResultRef,
   attestationRef, signatureRef), gitSha, migrationRange (lowest and highest
   applied migration id), configSchemaDigest, mobileBuild and webArtifact
   slots (explicitly nullable with an honest `founderSupplied` marker, never
   fabricated), and rollbackReleaseId. Schema validation rejects a tag-only
   image reference (NC-44.4).
2. `meerkat-release` CLI in the migrate-cli NDJSON idiom: `--record`
   (validate + compute manifestDigestHex + immutable insert), `--approve`
   (CAS on lifecycle_version, refuses re-approval), `--verify` (the NC-44.4
   gate: given a release id or manifest file plus the deploy's image refs,
   exit 0 only when every image is digest-pinned, signature-referenced, and
   present in an APPROVED manifest; divergences enumerated, never swallowed),
   `--status`.
3. Function-gate tests for schema and verify logic; live-postgres integration
   tests for record/approve/verify including duplicate immutability and CAS
   conflict; CLI arg-validation tests with secret-leak assertions.

**WP-6C, promotion, canary, and rollback** (owns a new migration,
`src/postgres/stores/` additions, `src/postgres/cli/promotion-cli.ts`,
`bin/meerkat-promotion.mjs`, canary synthetic, staging/canary/rollback
workflow definitions, runbooks; depends on WP-6B):

1. A `ops.release_promotions` proof table (next free migration id) in the
   cutover-proof idiom: immutable rows, a state machine
   (staging -> staging_canary -> production_canary -> production, any state
   -> rolled_back), CHECK-constrained transitions, lease-fenced writes via the
   operations-store job-lease idiom, every row referencing an APPROVED
   release manifest id (NC-44.4) and carrying operator, evidence jsonb, and
   database timestamps.
2. A promotion CLI recording each transition with its evidence (canary
   verdict outputs, probe exit codes, operator id). The CLI never performs
   the deploy; it records the transition the operator performed and re-probes
   what is verifiable. Rollback transitions must reference an earlier
   APPROVED manifest as the target, record what is honestly NOT undone
   (PostgreSQL writes after the flip, per the NC-44.5 rollback window rule),
   and never claim data reversal.
3. A `canary-verdict.mjs` synthetic (std-lib + existing probe lib) that runs
   the existing synthetics (relay-healthz-shape, service-readyz,
   backup-freshness) against a canary host set and emits one NDJSON verdict
   with exit 0/1/2; the promotion CLI consumes its output as evidence.
4. Workflow definitions (`deploy-staging.yml`, `promote-canary.yml`,
   `rollback-release.yml`): workflow_dispatch, founder-triggered, actions
   SHA-pinned, each step honest about what CI does (build/verify/record)
   versus what the operator does (the actual deploy target actions).
5. Runbook `docs/guides/meerkat-runbooks/release-promotion.md` covering the
   full ladder, canary decision criteria, rollout stop, emergency rollback,
   and the founder-ops boundary table; update the runbook index if one
   exists.
6. Live-postgres integration tests for the promotion state machine
   (legal/illegal transitions, lease fencing, manifest-approval gate) and
   unit tests for the canary verdict evaluator.

Verification battery per package and before every commit: relay lint +
typecheck + full test suite; live PostgreSQL suite; live S3 suites; docker
compose production config; workflow YAML validation. AC-44.9 and AC-44.10 are
satisfiable to the workflow-definition level in-repo; the first RUN of the
signed release pipeline and AC-44.11's tested canary/rollback against real
infrastructure are founder-ops evidence to be recorded via the release and
promotion stores and Plan 40's ledger (Phase 7 rehearsal territory).

### Phase 7 - Production rehearsal

- Run load, failover, dependency outage, secret rotation, migration rollback,
  backup restore, regional object recovery, queue backlog, and incident drills.
- Record evidence in Plan 40.

#### Phase 7 execution contract (2026-07-11)

Grounded in the terrain map. Structural facts: the proof-table substrate
(backup_restore_proofs, cutover_proofs, release_promotions), the
operations-store job-lease idiom, the NDJSON CLI idiom, and the
synthetics library all exist; migration 11 is the highest. NO load,
soak, or bench tooling exists anywhere in the package. Plan 40's
evidence ledger is `docs/releases/meerkat/<release-id>/evidence.json`
(references and results, never secrets). Binding criteria: AC-44.11,
AC-44.12, NC-44.5, and the Failure Modes rows for failover, backup
fault, restore smoke, reconciliation, deletion fault, deployment
rehearsal. Honest boundary: the repository owns drill TOOLING, fault
TESTS, evidence RECORDING, and runbooks; running drills against real
provider infrastructure (staging failover, regional recovery, the
48-hour soak, secret rotation with live credentials, incident staffing)
is founder-ops whose results land through the same rehearsal store into
Plan 40's ledger. A drill that was not run is not evidence; a recorded
drill proves the record, not the infrastructure.

Hard boundaries binding every work package: zero new package
dependencies (the load harness uses node stdlib + the existing ws
dependency); the slim relay invariants and two-field /healthz are
untouchable; no tool simulates a drill, fakes a metric source, or
records a verdict it did not compute; correlation ids never cross the
relay; readiness fail-closed semantics are asserted, never weakened.

**WP-7A, rehearsal evidence substrate** (owns migration 0012, a new
rehearsal store, `src/postgres/cli/rehearsal-cli.ts`,
`bin/meerkat-rehearsal.mjs`, one package.json script line, tests):

1. `ops.rehearsal_proofs` (migration 0012), proof idiom: drill_id PK,
   drill_kind CHECK-constrained to (load, soak, failover,
   dependency_outage, secret_rotation, migration_rollback,
   backup_restore, regional_object_recovery, queue_backlog, incident,
   canary_stop_rollback), nullable release_id, operator, started_at and
   recorded_at from database time, verdict CHECK (passed, failed,
   aborted), evidence jsonb object, seq total order, immutable rows,
   lease-fenced insert (queue 'rehearsal', jobId = drillId) via the
   operations-store idiom.
2. A rehearsal store with recordDrill (typed refusals: malformed
   evidence, unknown kind; a duplicate drill id reports the DURABLE row
   and exits accordingly, never re-labels), listDrills by kind and
   release, latestDrill per kind.
3. `meerkat-rehearsal` CLI (NDJSON idiom, redacted fatals): --record
   (--kind, --verdict, --operator, --evidence <file> attached in FULL
   with the same NDJSON handling as promotion-cli; recording a `passed`
   verdict REQUIRES evidence, a bare passed claim is refused),
   --status, --history, and --export-evidence (--release-id: emit the
   Plan 40 evidence.json FRAGMENT for the drill sections - soak,
   canary, rollback, backup, incident sign-off - from the DURABLE
   rows, with explicit nulls and a missingDrills list for kinds with no
   passed proof, never fabricated entries).
4. Live-postgres integration tests (record/duplicate/refusals/lease
   fence/export honesty including the missing-drills list) and CLI
   arg-validation tests with secret-leak assertions.

**WP-7B, load and soak harness** (owns `scripts/load/`,
`scripts/soak/`, two runbooks, unit tests; consumes WP-7A's CLI in
documented commands only):

1. A dependency-free load harness (node stdlib + existing ws):
   scenario runners for the relay WebSocket path (connect, pair via
   ephemeral tokens, forward opaque frames, measure round-trip) and for
   service HTTP routes (healthz shape, readyz walks, and configurable
   route templates), each with configurable target rate, connection
   count, duration, and bounded in-process memory; NDJSON metrics
   output (attempted, completed, error rate, p50/p95/p99 latency) with
   an honest verdict line (zero completed requests or an unreachable
   target is FAIL, never an empty pass). 10x-forecast parameters are
   CONFIG, documented in the runbook, never hardcoded claims.
2. A soak runner (`scripts/soak/soak-runner.mjs`): drives the load
   harness at a configured background rate for a configured duration,
   samples the private /metrics endpoints and its own process memory at
   a configured interval, evaluates GROWTH THRESHOLDS fail-closed
   (heap/RSS growth, error-rate ceiling, queue-depth growth, metric
   staleness - each configurable, each with an honest default), and
   emits one NDJSON evidence stream + final verdict consumable by
   `meerkat-rehearsal --record`. Duration is a parameter: CI can prove
   a minutes-long soak mechanically; the 48-hour production-shaped run
   (AC-44.12) is founder-ops evidence recorded through the same tool.
3. Unit tests for the pure evaluators (threshold math, verdict
   aggregation, zero-sample fail-closed) in the synthetics-test idiom;
   a live smoke test that boots the real relay bin and runs a
   seconds-long load scenario against it (smoke-relay idiom).
4. Runbooks: `load-test.md` and `soak-48h.md` (thresholds, commands,
   decision criteria, evidence recording, founder-ops boundary).

**WP-7C, drill playbooks and fault-handling proofs** (owns the
remaining runbooks, the runbooks README index, fault-injection
integration tests; depends on WP-7A for recording commands):

1. Runbooks, each with the honesty rule block, exact commands using
   EXISTING tooling (backup-cli, promotion-cli, canary-verdict,
   release-cli, rehearsal-cli), decision criteria, and founder-ops
   markers: `failover-drill.md`, `dependency-outage-drill.md`,
   `secret-rotation.md` (two-key overlap requirement stated),
   `migration-rollback-drill.md` (expand/migrate/contract + NC-44.5
   window), `regional-object-recovery-drill.md` (extends, never
   duplicates, disaster-recovery-drill.md), `queue-backlog-drill.md`,
   `incident-drill.md`, `canary-stop-rollback-drill.md` (an
   intentionally failing canary verdict must refuse promotion and the
   rollback path records honestly). Update the runbooks README index.
2. Fault-handling INTEGRATION TESTS that prove the handling paths the
   drills rely on, against the live test containers: dependency outage
   (a pool pointed at a dead port yields typed unavailability and a
   fail-closed readiness evaluation, then recovers against the live
   database), queue lease fencing under worker crash (a claimed lease
   expiring mid-job is re-claimed exactly once, the expired holder's
   write is fenced), and canary-stop (a failing verdict file refuses
   promotion-cli recording; the refusal is the proof). No test
   pretends to be a provider drill; each proves the repo-owned
   handling contract.
3. Plan and memory close-out: after WP-7C lands, update this plan's
   status, Plan 40 cross-references, and memory.md to state EXACTLY
   which founder-operated evidence remains before any GO decision.

Verification battery per package and before every commit: relay lint +
typecheck + full suite; live PostgreSQL suite; live S3 suites;
production compose config; YAML checks where workflows change. AC-44.11
and AC-44.12 are satisfiable in-repo to the tooling-and-tests level;
their INFRASTRUCTURE halves (real staging failover, the real 48-hour
soak, real canary stop against a deployed fleet) are founder-ops
evidence recorded via `ops.rehearsal_proofs` into Plan 40's ledger.

## Failure Modes

| Failure | Handling | Test | Operator outcome |
|---|---|---|---|
| Two services claim the same security mutation | unique constraint and transaction allow one result | concurrency integration | one success, one typed conflict |
| Migration process crashes | migration transaction or resumable checkpoint, lock released | fault injection | rollout stops before readiness |
| PostgreSQL primary fails | provider failover or promoted standby, clients reconnect with backoff | staging failover drill | SLO page and bounded recovery |
| WAL archive stops | alert before local WAL fills | backup fault test | operator runbook before outage |
| Backup exists but cannot restore | weekly restore job fails the release health gate | restore smoke | page and launch block |
| Object exists but DB reference is missing | inventory reconciler quarantines orphan | reconciliation test | no accidental public serving |
| DB points to missing object | readiness and user path return exact unavailable state | deletion fault test | restore or repair job |
| Log statement includes a token | redaction plus canary-secret test fails CI | log-safety test | release blocked |
| New image is vulnerable or unsigned | verification job refuses manifest | workflow test | no deploy |
| Canary error rate rises | automated rollout stop and prior manifest rollback | deployment rehearsal | reduced blast radius |
| Old app meets contracted schema too early | compatibility test blocks contract migration | mixed-version E2E | rollout remains safe |

Every listed failure has a test, explicit handling, and an operator-visible signal.

## Test Review Diagram

```text
[store interface] -> [PostgreSQL adapter] -> [multi-instance API]
       |                     |                       |
   conformance          concurrency/fault         load/failover

[live writes] -> [WAL + object versions] -> [restore environment] -> [proof]
      |                    |                         |                 |
 integration          backup monitors             weekly job       release gate

[source SHA] -> [image] -> [SBOM/scan] -> [attest/sign] -> [canary] -> [rollback]
     |            |            |               |              |           |
   CI pin      reproducible   policy gate     verify job     synthetics   rehearsal
```

Required tests:

- Store conformance for every adapter.
- Transaction isolation and high-contention security mutation tests.
- Migration from every supported prior schema and file-store fixture.
- Mixed old and new service version compatibility tests.
- Object checksum, multipart, version restore, reference, and inventory tests.
- Database primary failover, pool exhaustion, slow query, and timeout tests.
- Weekly automated restore smoke and quarterly full recovery drill.
- Metrics cardinality, log redaction, trace sampling, and canary-secret tests.
- Image reproducibility comparison where toolchains support it.
- SBOM, vulnerability exception, signature, attestation, and release manifest tests.
- Canary stop and rollback rehearsal with an intentionally bad build.
- Full 48-hour production-shaped staging soak.

## Performance and Capacity Requirements

- Size database pools from database connection capacity, not instance count alone.
- Load test every public route and worker queue at 10 times forecast launch traffic.
- Prove bounded memory for WebSocket connections, scanners, object multipart, and
  database result sets.
- Index every production cursor and high-cardinality lookup with query-plan evidence.
- Establish disk, database, WAL, object, egress, and queue growth forecasts with
  alerts at 60, 75, and 90 percent of safe capacity.
- Use dependency timeouts, bounded retries, and jitter. A failing provider must not
  cause an unbounded request or worker pileup.

## Parallel Work Lanes

| Lane | Modules | Depends on |
|---|---|---|
| A: PostgreSQL core and stores | relay PostgreSQL package and migrations | Phase 0 |
| B: object storage | relay object-store package and workers | Phase 0 contracts |
| C: observability | service HTTP wrappers, deploy, dashboards | Phase 0 metric names |
| D: backup and recovery | infrastructure, scripts, runbooks | A and B interfaces |
| E: supply chain | workflows, Dockerfiles, deploy manifests | image inventory |
| F: cutover and rehearsal | staging, migration, QA, runbooks | merged A through E |

Run A, B, C, and E in parallel after the inventory and contracts land. Lane D can
start against test infrastructure once A and B stabilize. Lane F is sequential.
Assign one owner to shared compose and workflow files.

## Acceptance Criteria

- AC-44.1: Every first-party mutable store has a PostgreSQL adapter passing the
  same conformance suite as file mode.
- AC-44.2: Two stateful API instances safely process concurrent security-sensitive
  mutations without double spend, duplicate claim, or lost update.
- AC-44.3: File-state import produces matching semantic digests and a reversible
  cutover rehearsal.
- AC-44.4: Managed bytes use checksummed, versioned, private object storage and
  survive a regional recovery drill.
- AC-44.5: PostgreSQL point-in-time recovery meets the documented RPO and RTO.
- AC-44.6: Backup freshness and restore proof are visible and alerting.
- AC-44.7: Every service exposes correct liveness, readiness, private metrics, and
  redacted structured logs.
- AC-44.8: SLO dashboards and multi-window alerts exist for every launch-critical
  journey.
- AC-44.9: Every production image has a verified SBOM, vulnerability result,
  provenance attestation, Cosign signature, and immutable digest.
- AC-44.10: One signed release manifest identifies every server image, mobile build,
  web artifact, migration range, configuration schema, and rollback release.
- AC-44.11: Staging canary, production canary, rollout stop, and rollback are tested.
- AC-44.12: A 48-hour production-shaped soak completes without unbounded state,
  queue, memory, storage, or error growth.

## Negative Criteria

- NC-44.1: No first-party production stateful service may rely on a single local
  container filesystem as its only durable source of truth.
- NC-44.2: No private payload or stable identity may enter logs, metrics, or traces.
- NC-44.3: No backup may be labeled healthy without a recent restore proof.
- NC-44.4: No production deploy may use `latest`, an unsigned digest, or an image
  not present in the release manifest.
- NC-44.5: No destructive schema migration may run inside the rollback window.
- NC-44.6: No object may be publicly readable from quarantine or a private prefix.
- NC-44.7: No Redis data may become the sole durable record of a user or legal action.

## Required Gates

- Function test scaffolds and `pnpm gate:function:changed`.
- Full relay, sync, entitlements, app, web, parity, and generated-artifact gates.
- SQL migration lint, empty install, upgrade, mixed-version, and rollback tests.
- Store conformance and high-contention integration suites.
- Object storage, PostgreSQL failover, backup, restore, and disaster drills.
- Security review of roles, secrets, network policy, logs, and supply chain.
- SBOM, vulnerability, attestation, Cosign, and release manifest verification.
- Staging load, canary, rollback, and 48-hour soak evidence.

## Close Criteria

Plan 44 moves to `docs/plans/done/` only after PostgreSQL and object storage are the
proven first-party sources of truth, file mode remains honest and tested, backups
restore within objectives, observability and pages are live, every image is signed
and attested, a complete release manifest deploys and rolls back successfully, and
Plan 40 records the exact recovery and release evidence.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope and strategy | 0 | Not run | Existing approved production mandate and Plans 40 through 44 already fix the full-function scope. |
| Codex Review | `/codex review` | Independent second opinion | 1 | Complete | Read-only outside review converged on request-bound idempotency, one-client transactions, additive migrations, fail-closed runtime selection, object-store separation, and real two-pool tests. |
| Eng Review | `/plan-eng-review` | Architecture and tests (required) | 2 | Clear | 10 execution issues incorporated; 0 unresolved decisions and 0 remaining critical plan gaps. |
| Design Review | `/plan-design-review` | UI and UX gaps | 0 | Not applicable | Backend persistence and runtime work has no visual surface. |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | Not run | Runtime configuration and operator documentation are covered by the implementation and release phases. |

- **UNRESOLVED:** 0 plan decisions. Implementation evidence remains required before any phase is marked complete.
- **CROSS-MODEL CONSENSUS:** The engineering review and independent Codex review agreed on the Phase 1 dependency order and multi-instance correctness boundary.
- **VERDICT:** ENG CLEARED. The dependency-ordered Phase 1 implementation may proceed.
