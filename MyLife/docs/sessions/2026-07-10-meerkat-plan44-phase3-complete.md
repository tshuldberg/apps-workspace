# 2026-07-10 Meerkat Plan 44 Phase 3 Completion

**Branch:** `feature/meerkat-production-readiness-2026-07-09` (local, not pushed)

**Commits:** `4f2575b3` (execution contract), `97088957` (WP-3A), `9834c586` + `b7e5b67e` + `54b2141c` (WP-3D), `9bbb8362` (WP-3B), `957c282c` + `ba46ab89` (WP-3C), plus this docs commit

**Launch status:** Production NO-GO (unchanged; Phase 3 delivers the migration tooling, not the launch gate)

## What was done

Plan 44 Phase 3 (import, semantic digest, shadow read, cutover, rollback) is code-complete across four work packages implemented by two Opus 4.5 agents with lead-run specs, adversarial reviews, and gate batteries.

### WP-3A (`97088957`): state import engine

Substrate enumerators cover every importable file store (documented directory scans for the gap stores, upfront id discovery for one-at-a-time stores, bounded keyset SQL over each PostgreSQL table since most stores expose no full enumeration). Per-enumerator drift guards cross-check the raw SQL against each store contract's own reads; building them immediately caught the moderation stores projecting status into dedicated columns outside the payload jsonb, which would have made status-only mutations digest as identical. Importers converge idempotently through natural-key inserts preserving historical and terminal states, batched under operations-store idempotency claims. One NDJSON CLI: dry-run, import, digest-compare with typed divergence verdicts.

### WP-3D (`9834c586`, `b7e5b67e`, `54b2141c`): the cutover security blocker

Import review surfaced that file mode stores blocks only as sha256(lower(pubkey)) while PostgreSQL keyed on the raw pubkey, so cutover would have silently unblocked banned personas. Migration 9 backfills the hash for every existing row before moving the primary key onto it; enforcement hashes incoming pubkeys with file-identical semantics; the importer materializes hash-only rows; live tests prove a file-mode block stays enforced after import, converges idempotently, that a target-side unblock is caught as divergence, and that the backfill preserves every pre-migration block. A useful confirmed property: blocking is append-only; no unblock path exists in the tree.

### WP-3B (`9bbb8362`): shadow-read comparator

`MEERKAT_STORE_BACKEND=shadow` runs a service with file as primary authority and PostgreSQL as a mirrored shadow: classified calls forward to primary, race the shadow under a bounded timeout, deep-compare through per-method normalizers, and emit digest-bounded divergence, fault, and sampled agreement events. The shadow can never affect caller behavior; skips are explicit and auditable; shadow mode is forbidden in the first-party profile. Review fix applied by the lead: the unclassified-method guard now precedes the primary invocation so a misconfiguration cannot execute a side effect and then error the caller.

### WP-3C (`957c282c`, `ba46ab89`): cutover and rollback orchestration

Migration 10 adds ops.cutover_proofs, a fenced state machine whose CHECK constraints force each phase to carry its evidence. Preflight requires a writer-freeze attestation, dry-run-enumerates every source root, and fails on any live probe; execute runs the final delta import and a fail-closed digest gate (exit 2, no state advance, on any divergence); verify requires the post-boot digest to match; a per-cutover operations-store job lease makes a concurrent second run an explicit contended loser; rollback records the window, the per-store loss statement, and that orphaned post-flip PostgreSQL rows are retained for forensics while file authority resumes. Operator runbook at docs/guides/meerkat-postgres-cutover-runbook.md includes the shadow-mode confidence step.

## Review findings this phase

1. Drift guards (required at review) caught the moderation status-column digest gap before it shipped.
2. The blocked-persona representation mismatch was a genuine silent-unblock security risk, resolved as WP-3D.
3. The shadow comparator's unclassified guard ran after the primary side effect; fixed to precede it.
4. WP-3C's in-flight migration rewrite interleaved with older store code in commit `957c282c` and passed the pre-commit gate because live-gated suites skip in the hook; the agent flagged it and `ba46ab89` reconciled. Process lesson recorded in the error ledger.

## Verification (final battery, lead-run)

| Gate | Result |
|---|---|
| Relay lint / typecheck | Passed |
| Full relay suite | 955 tests passed, 129 skipped |
| Live PostgreSQL 17 (55444) | 118 tests passed, 22 files (migration chain 1 to 10, cutover proofs, drift guards, round-trips, shadow live) |
| Live MinIO suites | Green earlier this phase (10 tests, unchanged files) |

## Honest boundaries

- Phase 3's "exercise with production-shaped snapshots in staging" remains open: it requires real staging infrastructure and belongs with the Phase 7 rehearsal evidence.
- The cutover tool records attestations; it cannot prove writers are stopped.
- Rollback preserves nothing written to PostgreSQL after the flip; the loss statement makes this explicit per store.

## Remaining Plan 44 work

Phase 4 (observability and SLOs), Phase 5 (backup and recovery), Phase 6 (supply chain), Phase 7 (production rehearsal). Meerkat remains production NO-GO.
