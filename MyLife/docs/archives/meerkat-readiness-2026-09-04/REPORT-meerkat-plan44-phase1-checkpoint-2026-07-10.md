# Meerkat Plan 44 Phase 1 Checkpoint

**Date:** 2026-07-10

**Status:** Safely committed checkpoint, Phase 1 still in progress

**Branch:** `feature/meerkat-production-readiness-2026-07-09`

**Starting commit:** `b9ac0246c67a8cb846ef4df987b23ef17c67d0b7`

**Checkpoint commit:** `02b77f89b9fa5fde19f7ce31962ed56275e36326`

**Push status:** Not pushed

**Launch status:** Production NO-GO

## Outcome

Plan 44 Phase 1 now has a safely committed, gate-passing implementation checkpoint. It adds the shared PostgreSQL runtime, additive migrations, state contracts, file and PostgreSQL adapters, replica concurrency tests, and first-party runtime selection for humanity, persona, directory, and hosted billing.

This checkpoint is not the completion of Plan 44 or Phase 1. Private community state still needs migration registration, least-privilege grants, package inventory and exports, and community process wiring. Push migration 5 still needs one explicit live mixed-version test that performs old-writer inserts after the migration. The later Plan 44 object-storage, cutover, reliability, observability, recovery, and release-supply-chain work also remains.

## Startup and planning completed

The session began by verifying the expected worktree, branch, and starting commit. The following required project documents were read before substantial edits:

- `AGENTS.md`
- `CLAUDE.md`
- `.claude/settings.local.json`
- `.claude/skills-available.md`
- `.claude/plugins.md`
- `memory.md`
- Plan 42, Plan 43, and Plan 44 queue documents

The Plan 44 engineering execution contract was expanded with a dependency-ordered implementation sequence. The implementation followed this order:

1. Additive schema and rolling-compatibility work.
2. Shared PostgreSQL context and explicit runtime selection.
3. Shared memory and file contracts plus conformance suites.
4. Community and directory state adapters.
5. Humanity, persona, hosted billing, moderation, NCMEC, and DMCA adapters.
6. Push and archive lifecycle contracts plus fenced PostgreSQL adapters.
7. Hosted quota and storage metadata boundaries.
8. First-party process wiring and shutdown cleanup.
9. Two-pool PostgreSQL 17 concurrency and migration verification.

The `plan-eng-review` workflow informed the dependency order and acceptance boundaries. CodeRabbit was unavailable in the local environment, so a separate local adversarial review was used as the fallback. That review produced concrete migration, authorization, lease, and compatibility corrections listed below.

## Implemented and committed

### Shared PostgreSQL authority

- Added one shared store context with transaction-scoped client reuse.
- Added deterministic advisory transaction locks with bounded lock inputs.
- Added explicit unavailable errors so database failures cannot masquerade as empty or missing state.
- Added strict file or PostgreSQL runtime selection.
- Made first-party configuration fail closed without PostgreSQL, schema readiness, and production TLS requirements.
- Preserved the complete file-backed path for self-hosted use.

### Additive migrations

- Migration 3 adds adapter contracts for community, directory, humanity, persona, hosted, moderation, archive, push, and operations state.
- Migration 4 adds the durable persona and humanity registration recovery workflow.
- Migration 5 adds push token generations, address binding, hashed replay keys, cancellation triggers, and rolling compatibility classification.
- Migration 6 adds signed archive identity and explicit legacy metadata classification.
- Migration 7 defines private community state tables and indexes, but is intentionally not registered in the main migration list at this checkpoint.

### Store and runtime matrix

| Surface | Work in this checkpoint | Checkpoint state |
|---|---|---|
| Community public state | PostgreSQL descriptors, publications, kills, reports, posts, freezes, blocks, and submit windows | Adapter complete and live-tested |
| Community private state | Shared authority contract, memory, file, PostgreSQL adapter, staged publication recovery, challenge and rate state | Implemented and tested, runtime registration still pending |
| Public directory | PostgreSQL publications, kills, host announcements, database-time expiry, authoritative health statistics | Adapter and first-party runtime complete |
| Humanity | Atomic challenges, issuance, spend, registration redemption, pruning | Adapter and first-party runtime complete |
| Persona | Registry lifecycle, sessions, tombstones, revocations, durable registration attempts | Adapter and first-party runtime complete |
| Hosted billing | Subscription, purchase, link, and persona-binding state | Adapter and first-party runtime complete |
| Hosted storage metadata | Tenant policies, reservations, activation, deletion receipts, manifests, reconciliation | Adapter complete, first-party object composition belongs to remaining work |
| Moderation | Operator audit and triage state | Adapter complete, community console runtime still file-backed |
| NCMEC | Bounded evidence queue with durable claim and status transitions | Adapter complete, community runtime still file-backed |
| DMCA | Durable claims and versioned lifecycle transitions | Adapter complete, community runtime still file-backed |
| Push | Registration, token-generation, capability, attempt, retry, cancellation, and fencing contracts | File and PostgreSQL adapters complete and live-tested |
| Archive | Signed job identity, object metadata, scan, pin, lease, serving, and legacy readiness contracts | File and PostgreSQL adapters complete and live-tested |
| Operations | Durable idempotency and fenced job leases | PostgreSQL adapter complete and live-tested |

### Security and correctness corrections

- Legacy push and archive leases are revoked and refenced during migration so stale workers cannot commit.
- Legacy archive jobs and objects remain readable for reconciliation without invented signatures, hashes, or byte counts.
- Incompatible legacy rows are classified `legacy_unbound` and excluded from claim, serve, promotion, deletion, and active-host paths.
- Legacy hosted tenants receive explicit conservative policies. Incompatible hosted objects remain quarantined from active metadata reads.
- Push registration, capability, and provider-token revocation cancels nonterminal attempts in both file and PostgreSQL modes.
- Push claim revalidates the complete registration, capability, provider, and token graph using database time.
- Operations lease release and replay-claim abandon preserve durable fencing history instead of deleting rows.
- Persona alias reservations expire after 24 hours and recover durable `humanity_verified` attempts after a process crash.
- Humanity and persona HTTP boundaries map authority outages to HTTP 503.
- Persona and community processes share one bounded humanity redeem client with HTTPS by default, explicit trusted-network HTTP opt-in, a five-second deadline, and a 16 KiB response ceiling.
- NCMEC evidence is bounded to 256 hashes and 64 KiB at shared and database boundaries.
- Hosted role grants no longer allow cascade deletion of tenant, policy, reservation, object, subscription, purchase, or link roots.
- Directory health statistics now count distinct unexpired host RIDs from PostgreSQL. A restarted replica no longer reports a false zero.
- PostgreSQL regular-expression checks avoid unsupported large repetition bounds.

## Verification evidence

| Gate | Result |
|---|---|
| Relay lint | Passed |
| Relay TypeScript typecheck | Passed |
| Full relay unit and process suite | 133 files passed, 12 skipped; 850 tests passed, 76 skipped |
| Fresh PostgreSQL 17 integration suite | 15 files passed; 78 tests passed |
| Focused corrected push suites | 2 files passed; 10 tests passed |
| Staged function quality gate | 51 files passed, 12 skipped; 387 tests passed, 76 skipped |
| Mobile consumer typecheck | Passed |
| Web consumer typecheck and route generation | Passed |
| Full parity gate | Passed |
| Generated artifact guard | Passed |
| Production compose parse | Passed with required values supplied |
| `git diff --check` | Passed |
| Pre-commit hook | Passed |

The first fresh PostgreSQL run found two push issues before the final pass:

1. A joined registration-revocation trigger used ambiguous fencing and lifecycle columns. The target alias is now explicit.
2. The v5 migration test still expected the earlier unsafe behavior of inventing registration and token authority for a legacy attempt. The test now requires null authority fields, the original legacy lookup key, a 32-byte derived replay hash, and `legacy_unbound` classification.

After both corrections, the focused push suites passed 10 of 10 tests and the full PostgreSQL suite passed 78 of 78 tests.

## Remaining work

### Phase 1 checkpoint edges

1. Register migration 7 in the immutable migration list and update schema-version expectations.
2. Add exact community-role grants for private-state tables and the `bigserial` sequences used by tail and rate rows.
3. Export and inventory the PostgreSQL private community state adapter through the supported package barrels.
4. Wire the community process to a community-role PostgreSQL context for private and public state.
5. Wire operator, NCMEC, and DMCA state to a separate moderation-role PostgreSQL context in the community process.
6. Close both community and moderation pools on startup failure and every shutdown path.
7. Add first-party community and moderation database URLs plus TLS material to production compose.
8. Add community state-authority bin tests for file self-host mode, first-party fail-closed behavior, two PostgreSQL contexts, least-privilege boot, and pool cleanup.
9. Add a live mixed-version push test that migrates to v5 and then performs inserts using the old v2 registration, capability, and attempt shapes. The expected attempt must remain readable and nonclaimable.
10. Run the final Phase 1 adversarial diff review after these wiring changes.

### Later Plan 44 work

- Phase 2: production object storage, multipart upload, checksums, versioning, reference accounting, reconciliation, and deletion jobs.
- Phase 3: import, semantic digest, shadow read, cutover, and rollback tooling.
- Phase 4: PostgreSQL high availability, point-in-time recovery, backup, and regional recovery evidence.
- Phase 5: liveness, readiness, metrics, structured logging, dashboards, and multi-window alerts.
- Phase 6: SBOM, vulnerability results, provenance, image signatures, and release manifests.
- Phase 7 and later release evidence: staging canary, production canary, rollback, load tests, and the 48-hour production-shaped soak.

### Launch and external evidence

- Production databases, credentials, certificate authorities, and service-role provisioning.
- Production object-store credentials and policies.
- Provider, moderation, NCMEC, DMCA, backup, recovery, and security-operation evidence.
- Real network, device, push, background, and failure-recovery evidence required by the linked Meerkat plans.

## Resume point

Resume from commit `02b77f89` on `feature/meerkat-production-readiness-2026-07-09`. The append-only external context checkpoint is:

`/Users/trey/.gstack/projects/checkpoints/20260710-143611-meerkat-plan44-phase1-paused-checkpoint.md`

No push was performed. The local PostgreSQL 17 container `meerkat-pg-phase1` remains available on port 55444 for the next live verification pass.
