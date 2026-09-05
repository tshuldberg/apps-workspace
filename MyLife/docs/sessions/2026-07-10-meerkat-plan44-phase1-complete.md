# 2026-07-10 Meerkat Plan 44 Phase 1 Completion

**Branch:** `feature/meerkat-production-readiness-2026-07-09` (local, not pushed)

**Commits this session:** `5f78c9e8`, `a40e90ea`, `7b8fa151` (plus this docs commit)

**Launch status:** Production NO-GO (unchanged; Phase 1 closes one dependency, not the launch gate)

## What was done

All ten Phase 1 checkpoint edges from the 2026-07-10 checkpoint report are now closed. Work was orchestrated across three implementation work packages executed by Opus 4.8 agents, with planning, specification, adversarial review, and gate verification done by the lead session. Codex (gpt-5.5) was originally assigned WP-A and WP-C but hit its usage limit before any work; both packages were reassigned to Opus rather than stalling, per the standing model-selection guidance.

### WP-A (`5f78c9e8`): migration 7, grants, exports

- Migration 7 (`community_private_state`) registered in the immutable migration list; `MEERKAT_POSTGRES_SCHEMA_VERSION` now derives to 7. All version expectations were already dynamic except the inventory id list assertion, which was updated.
- `meerkat_community` role gained least-privilege grants for the seven `community.private_*` tables. Review verified every granted verb against the adapter's actual SQL: `private_states` gets SELECT and INSERT plus column-level UPDATE on exactly the six columns touched by the `commitPublish` upsert; the six secondary tables get the SELECT/INSERT/DELETE verbs they each actually execute; the two bigserial sequences (`private_tail_tail_id_seq`, `private_rate_hits_hit_id_seq`) are granted and were proven correct by the live grant test.
- `PostgresCommunityPrivateStateStore` and its contract types are exported from both package barrels, with a `community.private-state` store-inventory entry.

### WP-C (`a40e90ea`): mixed-version old-writer push proof

- New live test `push-mixed-version-old-writer.integration.test.ts`: after full migration, a pre-v5 writer's INSERT (pre-migration column shapes only) succeeds because the migration 5 `push_attempts_legacy_classifier` BEFORE INSERT trigger nulls authority fields, derives the 32-byte replay hash, normalizes `provider_status`, and lands the row `legacy_unbound`.
- The test asserts the raw-SQL layer preserves the row without invented authority, while every store adapter path (`getStatus`, `list`, `stats`, `claim`, including after lease expiry and database-time advancement) excludes it, and a control attempt inserted through the adapter on the same database stays visible and claimable.
- Review confirmed the trigger semantics directly against migrations 0002 and 0005 rather than trusting the test's own comments.

### WP-B (`7b8fa151`): community node two-context PostgreSQL wiring

- `bin/meerkat-community-node.mjs` resolves two least-privilege PostgreSQL contexts in first-party mode: `community` (`MEERKAT_POSTGRES_URL`, `meerkat_community` role) for descriptors, private state, publications, kills, reports, and public posts; `moderation` (`MEERKAT_MODERATION_POSTGRES_URL`, `meerkat_moderation` role) for the operator console, NCMEC queue, and DMCA intake. Neither role ever holds the other's grants.
- Real durability fix discovered during implementation: the bin never passed `privateStateStore` to `CommunityNode`, so private feed state (challenges, rate windows, publish stages, sealed tail) ran on the in-memory default even for file self-hosters. File mode now wires `FileCommunityPrivateStateStore`; postgres mode wires the PostgreSQL adapter.
- Every fatal path after pool open routes through a `fatalExit` that closes both pools; shutdown drains both HTTP listeners then closes both pools and exits nonzero on any failure. The seeder piece store stays file/volume-backed in both modes (no PostgreSQL piece contract exists).
- `deploy/compose.production.yml` community service now carries first-party profile, both role database URLs as required variables, verify-full TLS, and the CA secret. Compose parse verified.
- New `community-service-bin-state-authority.test.ts`: file self-host boot and clean stop, fail-closed first-party file mode, fail-closed missing community URL, fail-closed missing moderation URL, TLS CA failure without leaking either database password, a two-context source lock (moderation adapters can never be constructed from the community context), and a gated live tier proving two-pool boot, signal cleanup, least-privilege grants, and startup-failure pool cleanup.

### Review findings (fixed before commit)

1. The fail-closed bin spawns leaked `./.meerkat-community/post-receipt.seed` into the package root because `isolatedEnvironment` cleared `DATA_DIR` without a replacement, and the bin persists its post-receipt seed before the state authority resolves. Fixed by defaulting `DATA_DIR` to a per-process temp path in the helper; verified no recreation.
2. The implementing agent's report claimed its tests could not recreate the debris; the review reproduced it and corrected the claim.

## Verification (run by the lead, not delegated)

| Gate | Result |
|---|---|
| Relay lint | Passed |
| Relay typecheck | Passed |
| Full relay suite | 134 files passed, 13 skipped; 856 tests passed, 79 skipped |
| Live PostgreSQL 17 suite (port 55444 container) | 16 files, 79 tests, all passed |
| New bin suite (default mode) | 6 passed, 2 skipped (live tier gated) |
| Production compose parse | Passed with generated required-variable env file |
| Pre-commit staged function gate | Passed on all three commits |

## Remaining work

- Plan 44 Phases 2 through 7: object storage, import and cutover, HA and recovery, observability, release supply chain, canary and soak.
- The live bin test tier needs CI-provisioned `meerkat_community` and `meerkat_moderation` LOGIN role URLs to run its least-privilege assertions.
- Plans 42, 43, 41, 25, Plan 40 residuals, and all external launch evidence per the Blackglass runbook. Meerkat remains production NO-GO.
