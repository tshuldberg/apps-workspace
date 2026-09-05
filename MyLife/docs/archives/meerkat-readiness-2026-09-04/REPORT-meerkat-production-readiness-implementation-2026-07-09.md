# Meerkat Production Readiness Implementation Report

**Date:** 2026-07-09

**Branch:** `feature/meerkat-production-readiness-2026-07-09`

**Verified starting commit:** `f7920118e5a4cf7fd90364fceb64b32c186274ee`

**Implementation commit:** `16957020`

**Outcome:** Plan 44 Phase 0 is complete and verified. Meerkat remains a production NO-GO while the remaining dependency queue is active.

## Executive Summary

The first dependency in the comprehensive Meerkat launch plan is now implemented.
The relay package has a production-grade PostgreSQL 17 foundation that inventories
all first-party mutable stores, defines their SQL contracts and security boundaries,
runs versioned and checksummed migrations, reconciles least-privilege service roles,
verifies runtime schema readiness, and exercises the contracts against a live pinned
PostgreSQL 17 image.

This work completes Plan 44 Phase 0 only. It does not claim production launch
readiness or complete the PostgreSQL adapters, object storage, cutover, observability,
backup, recovery, release supply chain, native transport, archive, storage provider,
call, or integrated evidence work listed below.

## Startup Verification and Required Reading

The implementation began by verifying the isolated worktree, branch, and commit.
The primary checkout had unrelated work and was not modified.

| Check | Verified result |
|---|---|
| Worktree | `.claude/worktrees/meerkat-production-readiness-2026-07-09` |
| Branch | `feature/meerkat-production-readiness-2026-07-09` |
| Starting commit | `f7920118e5a4cf7fd90364fceb64b32c186274ee` |
| Working state at start | Clean target worktree |
| Push state | Local only, not pushed |

Required project and execution documents read before substantial edits:

- `AGENTS.md` and `CLAUDE.md`
- `.claude/settings.local.json` from the primary workspace
- `.claude/skills-available.md` and `.claude/plugins.md`
- `memory.md`
- Plan 40, the master final launch plan
- Plan 44, production state, observability, recovery, and release supply chain
- The 2026-07-09 production plan coverage session and relevant audit findings

The local execution environment did not expose an Open Brain connector. No external
memory capture was performed, and all durable records were written into this repository.

## Dependency-Ordered Execution Plan

The plan was ordered around the shared production dependencies rather than file order:

1. Plan 44 Phase 0, PostgreSQL inventory, contracts, migrations, roles, and CI.
2. Plan 44 Phases 1 through 7, adapters, object storage, cutover, observability,
   recovery, supply chain, and soak.
3. Plan 42, native nearby transport, push, and background lifecycle.
4. Plan 43, managed archive, seeding, scanning, pinning, and safety operations.
5. Plan 41, storage destinations, provider clients, and atomic restore.
6. Plan 25, direct calls, rooms, LiveKit, TURN, recording, and native call UI.
7. Plan 40 residual R1 through R3 and stale truth reconciliation.
8. Integrated production, provider, store, physical-device, failure, and recovery evidence.

This session implemented and closed item 1. Items 2 through 8 remain active.

## Implementation Completed

### Mutable-State Inventory and SQL Contracts

- Added a typed inventory of 20 first-party mutable state contracts.
- Separated security-sensitive state such as directory kills, community kills,
  directory host freshness, and hosted seeder manifests.
- Defined logical PostgreSQL schemas for community, directory, humanity, persona,
  hosted, moderation, push, archive, and operations state.
- Added complete push registration, capability, delivery-attempt, lease, generation,
  expiry, and idempotency contracts needed by Plan 42.
- Added content-global archive objects, publication jobs, scans, and pins needed by
  Plan 43, including safe shared-object retention across job deletion.

### Migration and Readiness Safety

- Added explicit, checksummed, contiguous SQL migrations and an owner-controlled
  permanent migration ledger.
- Added a session advisory lock so concurrent first-run migrators serialize safely.
- Added transactional batches and online migration verification plus recovery SQL.
- Added strict validation for ledger shape, constraints, owner, schema owner,
  persistence, `PUBLIC` schema creation, table ACLs, column ACLs, and PostgreSQL 17
  `MAINTAIN` privileges.
- Added readiness checks that validate all known migrations and allow only contiguous,
  additive future versions.
- Added store conformance helpers for memory, file, and PostgreSQL implementations.

### Connections, Roles, and Operations

- Added a bounded `pg` pool with verified TLS by default, explicit CA support,
  query timeout ordering, statement timeout, transaction timeout, lock timeout,
  idle transaction timeout, application naming, and parameter-free managed URLs.
- Added transactional role reconciliation with complete managed-schema revocation,
  explicit table and sequence grants, column-level update grants, immutable evidence
  boundaries, and fail-closed infrastructure role validation.
- Added root-runnable migration and role-grant CLIs with structured, redacted errors.
- Added a signal-aware local TypeScript runner that forwards termination signals and
  preserves child exit semantics.

### CI and Test Coverage

- Added PostgreSQL 17 integration CI using an immutable image digest.
- Included root lockfile changes in the relay CI path filter.
- Added destructive-test opt-in and database-name guards.
- Added live tests for concurrent migration, malformed and unlogged ledgers,
  hostile `PUBLIC` table, column, and `MAINTAIN` grants, online-index recovery,
  transaction rollback, schema readiness, least-privilege roles, CLI behavior,
  and shared archive object retention.

## Review and Remediation

The uncommitted implementation received maintainability, testing, security and
migration, adversarial, red-team, and five Codex verification passes. Every actionable
finding was fixed before the implementation commit. Important corrections included:

- full ledger table and column ACL enforcement, permanent persistence, and
  PostgreSQL 17 `MAINTAIN` rejection;
- complete `PUBLIC` and service-role revocation before exact grants;
- infrastructure role validation without superuser-only mutation;
- correct public-post deletion with immutable tombstones;
- push capability normalization and registration-secret hashing;
- content-global archive objects without job-cascade data loss;
- PostgreSQL 17 transaction timeout and safe client/server timeout ordering;
- safe wrapper signal forwarding and child-process shutdown;
- CI triggering for lockfile-only PostgreSQL dependency changes.

The final focused review found no unresolved issue after the `MAINTAIN` regression was
implemented and verified against live PostgreSQL 17.

## Verification Evidence

| Verification | Result |
|---|---|
| Relay full suite | 102 files passed, 1 skipped; 656 tests passed, 10 skipped |
| Live PostgreSQL 17 suite | 1 file passed; 10 tests passed |
| Changed-function quality gate | Passed; 48 focused tests passed, 10 live tests skipped in non-database gate mode |
| Relay lint | Passed |
| Relay typecheck | Passed |
| Repository typecheck | 130 of 130 tasks successful |
| Full parity gate | Passed |
| Generated artifact guard | Passed |
| Staged diff whitespace check | Passed |
| Pre-commit hook | Passed |

The integration database used the same pinned PostgreSQL 17 Alpine image digest now
declared in CI. Test containers were removed after verification.

## Files and Surfaces Changed

- `packages/meerkat-relay/src/postgres/`: inventory, pool, migrations, roles,
  readiness guard, conformance suite, CLIs, exports, and tests.
- `packages/meerkat-relay/bin/`: executable migration, role-grant, and signal-aware
  TypeScript wrapper entry points.
- `packages/meerkat-relay/package.json` and `pnpm-lock.yaml`: PostgreSQL runtime and
  operator command wiring.
- `.github/workflows/ci.yml`: pinned live PostgreSQL 17 verification and path coverage.
- `errors_log.md`: real failures and their resolutions recorded during implementation.
- Plan 40, Plan 44, `memory.md`, and this report set: completion boundary and remaining
  execution truth.

## Remaining Work

| Order | Remaining scope | Completion condition |
|---:|---|---|
| 1 | Plan 44 Phase 1 | Every mutable store has a production PostgreSQL adapter with transaction and concurrency proof while file/self-host modes remain supported. |
| 2 | Plan 44 Phases 2 through 7 | Object storage, import and cutover, observability and SLOs, backup and recovery, signed release supply chain, deployment, load, and soak all pass. |
| 3 | Plan 42 | Owned Nearby and BLE implementation, APNs/FCM/Web Push, and terminated/background physical-device evidence pass. |
| 4 | Plan 43 | Managed archive, scanning, quarantine, pinning, seeding, NCMEC, DMCA, takedown, and history proof pass. |
| 5 | Plan 41 | All storage destinations, provider credentials, corruption cases, migration, and fresh-install atomic restore pass. |
| 6 | Plan 25 | Direct and room calls, TURN, LiveKit, recording, moderation, native call UI, load, and physical-device proof pass. |
| 7 | Plan 40 residual work | Share Inbox routing, placeholders, stale truth, and all remaining R1 through R3 findings close. |
| 8 | Integrated launch evidence | Live infrastructure, provider, store, device, failover, restore, canary, rollback, load, soak, legal, moderation, and founder-operated gates are green. |

Meerkat remains a production NO-GO until this full queue and its external evidence are
complete. The next implementation step is Plan 44 Phase 1, beginning with PostgreSQL
adapters and conformance for the security-sensitive stores.
