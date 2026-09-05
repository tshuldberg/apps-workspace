# Meerkat service contracts

Preserved from `MyLife/packages/meerkat-relay/CLAUDE.md` during the September 5, 2026 instruction reset. Paths in the retained text are relative to the originating project/package unless stated otherwise. Dated rollout notes are historical evidence, not current readiness claims. Consult the relevant contract when changing its implementation; generic agent workflow is governed by AGENTS.md.

## Zero-Knowledge Invariants (Critical)

- The relay pairs clients by OPAQUE ephemeral tokens and forwards ciphertext VERBATIM. It never parses `env` payloads, never logs envelopes, never sees device ids or plaintext. Tests assert this; keep them passing.
- Rendezvous records (`rec`) are equally opaque: one-time consume-on-resolve, TTL-bound, store-capped, per-connection rate-limited.
- Hosted nodes are zero-knowledge multi-tenant: per-tenant isolated stores + caps; the operator holds no decryption keys (proven in `hosted-node.test.ts`).


## Plan 51 verification-account layer + one-way wall (Critical)

- `bin/meerkat-account-service.mjs` is the verification-account service: a SEPARATE
  deployable in the persona-service lineage (needs `@mylife/sync`; NEVER merged into
  the slim ws+zod relay image). It owns Sign in with Apple / Google verification
  (`src/sso-token-verify.ts`, injected JWKS, fail-closed), accounts + entitlements +
  issuance quota (`src/account-store*.ts`, memory/file/PostgreSQL over migration 18),
  entitlement webhooks (fail-closed per rail), blind credential issuance
  (`src/account-service.ts` over `src/blind-credential-server.ts`; the RSABSSA
  protocol itself is `@mylife/sync` protocol/blind-credential.ts), renewal, and
  SSO-re-auth deletion. Design doc: `docs/designs/meerkat-account-verification-architecture.md`.
- THE WALL: no table, log line, or metric may hold both an account identifier and a
  persona/device-key identifier; the `account.` schema never holds a credential
  serial; the `credential.` bridge schema never holds an account/persona/device
  field. `src/postgres/__tests__/account-wall-guard.test.ts` (every migration, every
  role) and the log-hygiene canary's account-service leg enforce this. A credential
  serial may co-locate with persona identifiers on the moderation side ONLY.
- Blind issuance invariants: the issuer sees only the blinded message (never nonce,
  serial, or finished token); one credential per account per epoch, enforced by the
  `credential_issuance` primary-key insert AFTER eligibility (an ineligible or
  malformed request never burns the epoch slot); uniform 'refused' shape. Renewal
  presents the expiring credential; a revoked serial flags the account and the
  serial is DISCARDED, never persisted or logged.
- Presentation verification (`src/credential-verify.ts`) is local: epoch public key
  + serial revocation SELECT. No account-service call and no account-layer secret
  ever sits on a verifier surface. Surfaces accept `x-mk-credential` as the
  ALTERNATIVE to the humanity proof (community submit, persona registration,
  archive intake); a bad credential never falls back (no downgrade); a dead
  evidence/revocation sink fails closed. Operator enforcement:
  `revokeCredentialSerial` + `POST /api/actions/revoke-credential` (serial-only
  evidence in the console lane).
- No IP-based identity or bans anywhere in this layer; edge rate-limiting stays
  ephemeral and non-persisted.


## Deploy (relay vs seeder are TWO images)

- The relay image (`Dockerfile`) is ws+zod-only and stateless: no volume, no env
  secret (only PORT/HOST), no `@mylife/sync`. It compiles the relay graph to
  CommonJS and runs `bin/meerkat-relay-server.mjs`. `/healthz` exposes only
  `{ ok, connections }`; never add a field to it (zero-knowledge guarantee).
- The seeder/hosted node is a SEPARATE deployable: it needs `@mylife/sync` at
  runtime and a `DATA_DIR` volume with a storage cap. Do not merge it into the
  relay image. Building the seeder production image is deferred ops.
- The COMMUNITY NODE (`bin/meerkat-community-node.mjs`) is also a SEPARATE second
  image over the same codebase: it needs `@mylife/sync` at runtime and a `DATA_DIR`
  volume that holds `pieces/` (opaque snapshot + tail bytes) and `descriptors/`
  (the restart-safe revision ledger). Run it on its own `PORT` (e.g. 8890). Like
  the seeder image, do not merge it into the slim relay image. Building its
  production image is deferred ops; a short run note + the `start:community-node`
  script ship here.
- Templates: `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/fly.toml`,
  `deploy/render.yaml`, `deploy/.env.example`. TLS lives at the edge, never on
  the relay. Smoke + log hygiene: `pnpm --filter @mylife/meerkat-relay smoke` and
  `scripts/smoke-relay.mjs` boot the real bin and carry a real session.


## Env-configurable fair-use caps (Plan 20, Phase 2)

- `resolveRelayLimits(env)` (`src/protocol.ts`) overrides 8 operational caps from
  env and CLAMPS each to a safe `[min,max]`: `RELAY_MAX_CONNECTIONS`,
  `RELAY_MAX_PER_CLIENT`, `RELAY_MAX_PEERS_PER_TOKEN`, `RELAY_ENV_RATE`,
  `RELAY_RENDEZVOUS_RATE`, `RELAY_WINDOW_MS`, `RELAY_MAILBOX_MAX`,
  `RELAY_MAILBOX_TTL_MS`. Unset env reproduces `RELAY_LIMITS` exactly. Clamping is
  the security property (no amplifier-high, no self-DoS-low); the schema/size
  bounds are NOT env-tunable.
- `startRelayServer` resolves limits ONCE: explicit `options.limits` (tests,
  embedders) win and are trusted as-is; otherwise it reads the clamped
  `process.env`. The slim bin is unchanged (it runs `startRelayServer`, which
  reads `process.env`) so the relay-image-deps invariant + Dockerfile rewrite
  stay intact. The resolved caps flow into `RelayHub` AND the two formerly
  un-wired module-level reads (`maxFrameBytes`, `maxConnections`) in `server.ts`.
  Operator preset table + the direct-exposure `X-Forwarded-For` caveat:
  `docs/guides/deploy-a-meerkat-relay.md`. `/healthz` is never extended.
- `X-Forwarded-For` is trusted ONLY behind a trusted TLS edge/proxy (Render / Fly
  / Caddy all qualify). If the relay is exposed DIRECTLY with no edge in front,
  `X-Forwarded-For` is spoofable, so per-client caps then key off the proxy/socket
  IP by design. Never trust a client-supplied forwarded header on a bare port.
- Two invariants that outrank any cap tuning: **never add a field to `/healthz`**
  (it exposes only `{ ok, connections }`; anything more leaks metadata and breaks
  the zero-knowledge guarantee), and the schema/size frame bounds are NOT
  env-tunable (only the 8 operational caps above are, each clamped).


## Host companion (`host/`, Plan 20)

The one-tap desktop companion that lets a non-technical operator run and expose a
relay (and optionally a community node) from their own computer. It owns no
cryptography: it drives the SAME bins and reuses `@mylife/sync`'s connection-card
codec. Honesty here is encoded, not just documented.

- `host/server.ts` - `createHostServer`: a `node:http` **control panel bound to
  `127.0.0.1` ONLY** (`listen()` hardcodes the loopback host). It is an admin
  surface, never a public listener. `/api/status` counts come ONLY from the real
  `/healthz {ok, connections}`; the community node + seeder report liveness only,
  so their count is `null` (never a fabricated 0). A service is `live` ONLY after
  its real `{event:'listening',port}` stdout line arrives.
- `host/reachability.ts` - `gateReachability`: the dashboard shows a connection
  card + QR ONLY after a REAL **off-host** round-trip confirms the public URL
  answers from outside the machine. A self-fetch (`vantage: 'self'`) is rejected
  (NAT hairpinning / a tunnel edge answering locally would false-positive). Before
  a verified round-trip the state is `unverified` and the card is WITHHELD.
  Reachability is CURRENT, not a one-time boot fact: a verified `reachable` is
  trusted for a short TTL, then `/api/card` lazily re-probes; if the tunnel child
  EXITS mid-session the card resets to `unverified` at once, so a silently-dead
  public URL stops surfacing a card even while the relay process stays alive.
- Adapters (the exposure rungs the wizard/dashboard offer): `host/tunnel.ts`,
  `host/lan.ts` (same-network, honestly labeled same-network), `host/domain.ts`
  (BYO domain), plus `host/process-supervisor.ts` + `host/spawn.ts` +
  `host/service-specs.ts` (spawn/track the real bins), `host/off-host-probe.ts`,
  `host/qr.ts`, and `host/ui-view-model.ts`. Static UI: `host/ui/wizard.html`,
  `host/ui/dashboard.html`, `host/ui/index.html`.
- Boundary: a desktop host is reachable ONLY while the app is open and the
  computer is awake; the card response carries that banner. This companion is NOT
  the always-on first-party node (that is a separate cloud deploy: relay image +
  community node). Packaging `host/` + the bins into a per-OS executable
  (`host/build/`) is founder-ops.


## Plan 19 P9 public archive / serving (key behaviors)

- `src/community-node.ts` `registerPublication`: a TERMINAL owner takedown (unpublished/killed, `verifyOwnerTakedown` against the stored predecessor) is accepted WITHOUT revision adjacency and stops serving (status-gated) + un-pins. `removeContentIfUnreferenced` REFCOUNTS the deduped contentId (scans `publicationStore.list()`) so a republish-then-takedown can't wipe a victim sharing the bytes (wave-1 C3). `getPublicationPage` is the FF2 warm-tail page route.
- `src/public-directory-node.ts` `recordUnpublish`: persists the takedown as a pruned, boot-re-seeded TOMBSTONE (`takedowns` map); `storePublication` rejects a replayed descriptor at revision <= the takedown revision, so a third-party replay can't resurrect a removed publication (wave-1 C2).
- `src/storage-ingest.ts` (`POST /api/storage/upload`) + `src/archive-moderation.ts` (`ArchiveModerationQueue`: pending -> real-scan -> approved is the ONLY served+announced state; honest scan state).


## Plan 43 WP-43A durable moderation store + scanner worker (key behaviors)

- The DURABLE moderation store is the existing archive lifecycle triple (`src/archive-lifecycle.ts`
  memory, `src/archive-lifecycle-store-file.ts` file, `src/postgres/stores/archive-lifecycle-store.ts`
  PostgreSQL). The `archive.scans` row plus the fenced `completeScan` transition (scanning ->
  clean=approved / malware|abuse_hash_match|flagged=rejected / error=quarantined-retry) IS the
  moderation decision, and `activatePin` refuses to pin without a COMMITTED clean scan row. Nothing
  unscanned or non-clean is ever pinnable or serveable. Do NOT rebuild this as a parallel store.
- `src/archive-malware-scan.ts`: the malware/AV seam. `MalwareScanner` interface + `MalwareScanEngine`
  provenance; `FakeMalwareScanner` (real hash-set matcher for tests/self-host); `UnavailableMalwareScanner`
  (the honest fail-closed default -- throws, so an unconfigured deploy NEVER fabricates a clean verdict).
- `src/archive-scanner-worker.ts` (`ArchiveScannerWorker`): the pure core. Claims quarantined jobs AND
  expired-lease `scanning` jobs (a crashed worker's stranded claim is re-scanned, never stuck forever;
  a live lease is never double-claimed) under the store's fenced lease (`claimJobs` -> `scanning`),
  reads each object's quarantined bytes via an injected `QuarantineByteSource` (object-store
  `read(quarantineKey)` in the bin) under a per-object scan-memory cap
  (`MEERKAT_ARCHIVE_MAX_SCAN_OBJECT_BYTES`, default 128 MiB; an over-cap object is terminally `flagged`
  with `object_exceeds_scan_cap`, never loaded whole and never error-retried forever), runs BOTH rails
  (malware/AV + abuse-hash), and records the decision with fenced `completeScan`. Precedence: malware hit
  -> abuse-hash hit -> scanner-outage fail closed (`error`, job stays quarantined and retries). On an
  abuse-hash hit the NCMEC evidence is enqueued BEFORE the terminal reject commit (crash-window
  durability: a rejected job is never re-claimed, so commit-then-enqueue could silently drop the report;
  the evidence id is tuple-derived, so a re-scan or lease-lost racer re-enqueues the SAME row
  idempotently). A stale worker whose lease was reclaimed cannot double-decide (completeScan is fenced
  on jobId+workerId+fencingToken+live-lease).
- `bin/meerkat-archive-scanner.mjs` (`pnpm --filter @mylife/meerkat-relay start:archive-scanner`): the
  deployable drain worker. SEPARATE image (needs `@mylife/sync` + object byte path); NOT the slim relay
  image; owns NO public listener. The malware rail defaults to the fail-closed `UnavailableMalwareScanner`
  until a real AV image adapter is wired (FOUNDER-OPS); the ready log names the rail state honestly.
- Grants: the scanner shares the `meerkat_archive` role. That role already covered archive.jobs/objects/pins
  (SELECT/INSERT/UPDATE) + archive.scans (SELECT/INSERT); WP-43A adds SELECT+INSERT on
  `moderation.ncmec_reports` (append-only CSAM evidence enqueue on an abuse-hash hit -- NO update columns,
  it never files/exports; dmca_claims stays SELECT-only). Proven live in `postgres-integration.test.ts`.
  No new migration is needed: the moderation store IS the archive-lifecycle store.
- FOUNDER-OPS remainder for WP-43A: a real malware/AV scanner image + adapter (replacing
  `UnavailableMalwareScanner`) and a licensed industry abuse-hash DB (feeding `MEERKAT_ARCHIVE_ABUSE_HASH_FILE`
  or a real matcher). Until both land the rail is honestly fail-closed and no managed job can be approved.


## Plan 43 WP-43B pin reconciliation + takedown propagation + seeder quota (key behaviors)

- The archive lifecycle store (`src/archive-lifecycle.ts` + file + PostgreSQL) already owns the pin
  state machine and takedown metadata (requestTakedown disables pins first; markObjectDeleted returns
  `shared` while another live job references the content; confirmRemoval finalizes). WP-43B adds the
  ORCHESTRATION on top and a cross-host pin enumeration; it does NOT rebuild the state machine.
- `listPinsForHost(hostId, {cursor, limit})` (NEW pin-store method, all three adapters): pages every
  pin a host holds (any state), publicationId-ordered and cursor-resumable, so the reconciler can
  repair drift in both directions. `listObjectsForContent(contentId)` (NEW): lists a content's object
  rows without a jobId, for the byte-presence probe (a pin carries contentId, not jobId).
- `src/archive-pin-reconciler.ts`: `ArchivePinReconciler` (pure core) reconciles a seeder's serving
  index against pin INTENT: an active pin with present bytes but not served -> `serving_added`; a
  non-active pin still served -> `serving_removed` (takedown residue, restart-safe); an active pin
  whose durable bytes are MISSING -> a loud `pin_bytes_missing` finding, pulled from serving, NEVER
  silently served. `findServingOrphans` removes a served publication with no pin record.
  `LeasedArchivePinReconciler` wraps it in a FENCED ops.job_leases lease + resumable cursor (mirrors
  WP-2C `LeasedObjectReconciler`): two racers -> one winner (`contended`), crash -> resume in place.
  The seeder bin persists that cursor durably via `PostgresPinReconcileCursorStore` over migration 14
  (`ops.archive_pin_reconcile_runs`, jsonb cursor), so a restart or a host with more pins than one
  tick's bound resumes where the fenced winner left off instead of restarting from page one.
- `src/archive-takedown-propagator.ts`: `ArchiveTakedownPropagator` drives a terminal takedown in the
  load-bearing order (NC-43.4/AC-43.5): requestTakedown -> serving-index entry removed FIRST ->
  release THIS publication's reference edge -> a byte another live publication references SURVIVES
  (untouched edge) -> a sole-referenced byte routes through the WP-2C deletion queue (the ONLY byte
  remover, never inline) -> markObjectDeleted with a REAL absence proof -> confirmRemoval. Idempotent
  and restart-safe; a lost fenced lease yields `lease_lost`, never a wrong deletion.
- `src/archive-announcement-scheduler.ts` (pure): `planAnnouncements` re-announces only
  active+serveable pins with a CURRENT descriptor, before TTL (`now >= last + ttl - lead`), bounded
  per tick, with deterministic per-pin jitter to avoid a fleet refresh storm.
- `src/seeder-quota-controller.ts` (pure): `admitPin` refuses a new pin honestly with the exact
  over-node/over-tenant state (never a silent drop); `planEviction` evicts only UNPINNED,
  UNREFERENCED, past-retention objects, oldest first, down to the reclaim target, and is honestly
  `stillOverQuota` when nothing safe is left (a pinned or referenced object is NEVER evicted).
- `bin/meerkat-archive-seeder.mjs` (`pnpm --filter @mylife/meerkat-relay start:archive-seeder`): the
  always-on deployable that runs the fenced pin-reconcile loop + takedown drain over the durable
  substrate. SEPARATE image (needs `@mylife/sync` + object byte path + a fenced operations store);
  NOT the slim relay image; owns NO public listener. Fenced leases require PostgreSQL, so it refuses
  to start in self-host file mode (no safe single-writer lease -- honest, never faked). Grants: the
  NEW `meerkat_archive_seeder` role (verb-exact) over archive jobs/objects/pins (SELECT/INSERT/UPDATE),
  archive.scans (SELECT), ops.job_leases (fenced reconcile lease), object_reference_keys/edges +
  object_deletion_jobs (takedown byte reclamation). Appended at the END of the role list so the
  positional role indices the grant test pins stay stable.
- FOUNDER-OPS remainder for WP-43B: building the per-OS seeder image and wiring the real
  public-directory announce client + the real seeder serving transport (the announce scheduler and
  quota controller are pure and tested; the loops and byte reclamation ship and are proven by the
  unit + live-Postgres tests, but the always-on image + real object storage are Plan 44 infra).


## Plan 43 WP-43C NCMEC filing worker + DMCA config + operator alerts (key behaviors)

- `src/ncmec-queue.ts`: the queue record now carries a filing lifecycle. `NcmecReportStatus` gains
  `escalated` (a durable dead-letter). The store contract adds `claimQueuedForFiling` (fenced lease,
  distinct verb from the manual export path) + `completeFiling` (terminal resolution: `filed` with a
  provider ref / `escalated` / transient `retry` with a rescheduled next-attempt). `filed` REQUIRES a
  provider ref + filed time (validated); a provider ref without `filed` is rejected. The vendor seam is
  `NcmecFilingClient` with `UnavailableNcmecFilingClient` (honest fail-closed default: always transient
  `client_unavailable`, so an unconfigured deploy NEVER fabricates a filed) and `FakeNcmecFilingClient`
  (deterministic test/self-host double).
- `src/ncmec-filing-worker.ts` (`NcmecFilingWorker`): the pure core. Claims due queued records under the
  store's fenced lease, validates required evidence (a permanent defect escalates WITHOUT contacting the
  provider), files ONCE through the client, and commits the fenced resolution. Jittered exponential
  backoff on transient errors; a bounded attempt cap escalates rather than retrying forever. A stale
  worker whose lease was reclaimed gets `lease_lost` from completeFiling (fenced double-claim -> one
  filer). Marks `filed` ONLY on provider confirmation.
- `bin/meerkat-ncmec-filing-worker.mjs` (`pnpm --filter @mylife/meerkat-relay start:ncmec-filing-worker`):
  the deployable drain worker over the `meerkat_moderation` role. SEPARATE image (needs `@mylife/sync`);
  NOT the slim relay image; owns NO public listener. Defaults to `UnavailableNcmecFilingClient` until the
  real CyberTipline adapter is wired (FOUNDER-OPS); the ready log names the rail state honestly. Exports
  identity-free queue-count gauges only.
- `src/dmca-config.ts`: `resolveDmcaAgentConfigFromEnv` / `loadDmcaAgentConfig` replace the hardcoded
  `DMCA_REGISTERED_AGENT` placeholder with a validated config. First-party production
  (`MEERKAT_DEPLOYMENT_PROFILE=first_party`) THROWS `DmcaAgentConfigError` listing the exact missing/
  placeholder fields, so the community node refuses to launch (NC-43.6). Self-host runs without an agent
  and serves an honest unconfigured block (never a fabricated identity). Carries the notification +
  counter-notice deadline policy the alert evaluator reads. Env: `MEERKAT_DMCA_AGENT_NAME/_ORG/_ADDRESS/
  _EMAIL/_PHONE/_REGISTRATION_DATE`, `MEERKAT_DMCA_NOTIFICATION_DEADLINE_DAYS`,
  `MEERKAT_DMCA_COUNTER_NOTICE_DEADLINE_DAYS`. Wired into `bin/meerkat-community-node.mjs` (the DMCA-serving
  bin); the validated block flows to `startCommunityNodeHttp`'s new `dmcaAgent` option and `GET
  /public/dmca/agent` serves it.
- `src/operator-alerts.ts`: `evaluateOperatorAlerts` (pure) + `evaluateDmcaDeadlines`. Turns aggregated
  safety-queue counts into typed alert records against thresholds (NCMEC escalations + filing backlog,
  DMCA unresolved past deadline + open counter-notice windows, scanner backlog). Payloads carry ONLY a
  kind, severity, measured count, and threshold -- NO identities/evidence (NC-42.3). Wired into the
  community-node metrics registry as an identity-free `meerkat_operator_alert_active` gauge.
- Migration 15 (`0015-ncmec-filing.ts`) EXPANDS `moderation.ncmec_reports`: `provider_ref`, `filed_at`,
  `filing_attempt_count`, `last_filing_error_code`, `next_filing_attempt_at`, the `escalated` status, and
  a `moderation_ncmec_filed_coherent` CHECK (filed <=> provider_ref + filed_at). The `meerkat_moderation`
  role gains column-scoped UPDATE on those columns (verb-exact; still SELECT+INSERT on the table).
- FOUNDER-OPS remainder for WP-43C: the real `NcmecFilingClient` (CyberTipline API adapter behind vendor
  onboarding + credentials), and the U.S. Copyright Office DMCA registered-agent registration (the founder/
  counsel-supplied identity the config loader validates). Until the client lands, records stay queued and
  no filing is ever marked complete.
