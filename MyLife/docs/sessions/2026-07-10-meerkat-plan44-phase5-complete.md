# 2026-07-10 Meerkat Plan 44 Phase 5 Completion

**Branch:** `feature/meerkat-production-readiness-2026-07-09` (pushed to origin)

**Commits:** `6a1b66f8` (execution contract), `feb943e5` (WP-5A), plus this docs commit

**Launch status:** Production NO-GO (unchanged)

## What was done

Plan 44 Phase 5 (backup and recovery) is code-complete as one package. The structural fact from the terrain map shaped everything: PostgreSQL is an external managed database with no compose service, so WAL archiving, base backups, and PITR are founder-ops provider configuration. The repository now owns everything that can verify and prove.

### WP-5A (`feb943e5`): restore verification and backup evidence tooling

- A backup CLI captures per-store semantic digest snapshots through the state-import digest engine, connecting under the new `meerkat_backup_digest` role: SELECT-only across every managed table, proven by the live grant-coverage test, with role identity verified via `current_user` rather than trusted assertion.
- Restore smoke re-digests a restored database against a reference snapshot and records into the existing `ops.backup_restore_proofs`: `verified` is true only when every reference store is present AND identical, so a truncated restore can never verify; divergences record their exact per-store mismatch, never a bare false. Snapshots are dated artifacts deliberately not recorded as proofs, because a snapshot proves nothing about restore.
- The dependency-free backup-freshness synthetic reads proof age and RPO against the SLO thresholds (with documented defaults) and exits 0/1/2 for the backup-stale page.
- An object-store backup inventory subcommand rolls up per-prefix counts and digest rollups through the bounded inventory and reference ledger.
- Runbooks: backup-stale.md upgraded from placeholder to real commands; a new disaster-recovery drill runbook marks provider steps founder-ops and states plainly that a drill that was not run is not evidence.

## Verification (lead-run)

| Gate | Result |
|---|---|
| Relay lint / typecheck | Passed |
| Full relay suite | 1048 tests passed, 135 skipped (one transient GC flake on the roles memory-budget gate; passed in isolation and on the clean full re-run; per errors-log rules transient flakes are not logged) |
| Live PostgreSQL 17 (55444) | 124 tests passed, including the 5-test restore-smoke round trip: snapshot, restore-equivalent verify true, mutated-record verify false with divergence recorded |
| WP-5A suites re-run by lead | 23 unit + 5 live green |

## Honest boundaries

- WAL archive, base backups, PITR configuration, and real drills are founder-ops; the proof rows are where their evidence lands.
- The freshness synthetic requires a reachable ops database with recorded proofs; absent proofs exit as failure, never as unknown-is-fine.

## Remaining Plan 44 work

Phase 6 (supply chain and complete images), Phase 7 (production rehearsal). Meerkat remains production NO-GO.

## Addendum: adversarial-review hardening (`b792a124`)

A Codex adversarial review of WP-5A (run per founder instruction after completion) surfaced seven P1 honesty/correctness defects and two P2s; all were fixed and re-verified against the full battery (typecheck, 1053 unit, 125 live PostgreSQL, 10 live S3, compose config):

1. The restore smoke accepted the ops database itself as the "restored" target; it now refuses a restored-url whose host:port/db equals the ops-url and records `restoredTarget` provenance into the proof digests.
2. Proof attribution was unbound: `--release-sha` must now match the reference snapshot, and a future `--backup-timestamp` (which would zero the RPO) is rejected against the ops database clock.
3. A replayed proof id printed this attempt's verdict and could exit 0 while the durable row said `verified=false`; duplicates now report the DURABLE row and exit on its verdict.
4. The job lease did not fence the proof INSERT; an expired holder could land stale evidence. The insert is now lease-fenced (queue, job id, owner, fencing token, still live) and reports `contended` when the lease was lost.
5. A future-dated proof clamped to age 0 and stayed "fresh"; freshness (both the TS evaluator and the synthetic) now hard-fails it.
6. A missing or malformed SLO file silently fell back to permissive defaults; the synthetic now hard-fails (`slo_unreadable`).
7. `buildProofDigests` trusted a caller-supplied comparison; it now recomputes internally, and records `rtoMeasures: digest_verification_only` so the rto is never mistaken for provider restore time.
8. CLI fatal output now runs through `redactErrorDetail` (connection-string leakage).

The earlier statement that the synthetic carries "documented defaults" is superseded: thresholds come strictly from `slo-definitions.json` or the probe fails.
