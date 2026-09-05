# 2026-07-11 Meerkat Plan 44 Phase 7 Completion (Plan 44 codeable scope complete)

**Branch:** `feature/meerkat-production-readiness-2026-07-09` (pushed to origin)

**Commits:** `6828f7f5` (execution contract), `f345e807` window (app-name fix + WP-7A + catches), `0922e39d` window (WP-7B + WP-7C + catches)

**Launch status:** Production NO-GO (unchanged)

## What was done

Plan 44 Phase 7 (production rehearsal) is code-complete in three work packages, each built by a fresh Opus agent against the committed execution contract, lead-reviewed, adversarially reviewed, hardened, and battery-verified before commit.

### WP-7A: rehearsal evidence substrate

- `ops.rehearsal_proofs` (migration 12): 11 drill kinds, immutable rows, seq total order, a layered passed-requires-evidence honesty gate (deep-vacuity check at the CLI pre-connect and the store, `jsonb_strip_nulls` CHECK backstop at the database), strict ISO started_at bounded by a 2025 project floor and the database clock.
- The `meerkat-rehearsal` CLI records drill outcomes it never produces, distinguishes idempotent replays from conflicts by canonical digest, and `--export-evidence` emits the Plan 40 evidence fragment from DURABLE rows only, surfacing `releaseApproved` per drill with an explicit `missingDrills` list.

### WP-7B: load and soak harness

- Dependency-free: `load-relay.mjs` drives real ws pairs through the actual token-pairing protocol; `load-http.mjs` walks healthz-shape/readyz/GET routes. Bounded-memory percentile estimation (fixed exponential histogram, conservative upper bounds). Fail-closed verdicts throughout.
- `soak-runner.mjs` samples memory, target metrics, and liveness against fail-closed growth thresholds; duration is a parameter (CI proves minutes; the 48-hour production-shaped run is founder-ops evidence through the same tool).
- Real-protocol finding surfaced honestly: relay env rate limits key per client IP; the harness tallies `rate_limited` errors instead of hiding them, and the runbook documents the property.

### WP-7C: drill playbooks and fault-handling proofs

- Eight playbooks (failover, dependency outage, secret rotation with the two-key-overlap failure rule, migration rollback under NC-44.5, regional object recovery, queue backlog, incident, canary stop/rollback) plus the index; every command verified against shipped tooling flags.
- Fault-handling integration proofs: typed unavailability + fail-closed readiness with live recovery; lease fencing under worker crash (single re-claim, advanced fencing token, crashed holder refused); and the canary-stop mechanical proof through the real promotion bin (failing/degraded verdicts refuse with no row landed; passing records) — AC-44.11's rollout-stop contract.

## Adversarial reviews

Codex was rate-limited this session, so independent Opus adversarial reviewers with live-database confirmation substituted (findings all live-confirmed before fixing):

- WP-7A: 1 P1 (vacuous-evidence bypass of passed-requires-evidence, e.g. `{a:null}` recording a passed drill exit 0) + 5 P2 (export dropped the stamped releaseApproved flag, loose started_at parsing, reused refusal reason, digest nuance, test gaps). All fixed with regression tests.
- WP-7B/7C: 3 P1 (load-http error-rate dilution via double-counting; soaks under window*2 samples passing an 800% RSS ramp as held_steady; three runbooks invoking the harness with nonexistent flags) + 3 P2 (one refuted with reasoning: the claimed metricSnapshot prefix mismatch does not exist). All real findings fixed with regression tests and live verification.
- **Open item:** a consolidated Codex adversarial pass over the full Phase 7 diff is owed when the Codex usage window resets, per the standing founder instruction. The Opus reviews covered the same ground with live confirmation in the interim.

## Latent bug fixed in committed Phase 5/6 code

The WP-7A agent discovered every live read path in `backup-cli`, `promotion-cli`, and `release-cli` fataled: the bracket application-name convention (`[meerkat_ops]`) is rejected by the pool validator. Reproduced live, all seven names fixed to `:` separators, all three CLIs verified answering against the live database.

## Verification (lead-run before every commit)

| Gate | Result |
|---|---|
| Relay typecheck | Passed |
| Full relay suite | 1149 passed, 164 skipped |
| Live PostgreSQL 17 (55444) | 153 passed, including rehearsal, fault-handling, and canary-stop suites |
| Live S3 (MinIO 55490) | 10 passed |
| Production compose config | Passed |
| Live end-to-end | rehearsal record/refuse/export, load-relay ok verdict against the real bin, load-http fail on an all-shape-leak service, soak staleness fail on a killed target |

## Founder-operated evidence remaining before any GO decision (Plan 44 scope)

Plan 44's codeable scope (Phases 0-7) is complete. The following can only be produced by founder-operated infrastructure, recorded via `meerkat-rehearsal` / the proof stores into Plan 40's ledger (`docs/releases/meerkat/<release-id>/evidence.json`):

1. First RUN of the signed release pipeline (`release-images.yml`) against GHCR with real OIDC; record + approve the resulting manifest via `meerkat-release`.
2. Provider backup provisioning (WAL archive, base backups, PITR) and the weekly restore-smoke cadence recording verified `ops.backup_restore_proofs` rows (NC-44.3 turns green only then).
3. Staging deploy, staging/production canary, rollout stop, and rollback drills against a real fleet (AC-44.11 infrastructure half) via the promotion ladder.
4. The 48-hour production-shaped soak (AC-44.12) via `soak:run` at forecast-derived parameters.
5. The drill ladder: failover, dependency outage, secret rotation (two-key overlap), migration rollback, regional object recovery, queue backlog, incident tabletop — each recorded with real evidence.
6. Load tests at 10x forecast traffic once the traffic forecast exists.
7. Phase 3 staging exercises with production-shaped snapshots (carried from Phase 3 into rehearsal scope).

Also still open from earlier phases: hosted reservation flow and archive lifecycle runtime bin consumers, TLS PostgreSQL test fixture, CI moderation-role URLs, and the correlation-id implementation package. Beyond Plan 44: Plans 42, 43, 41, 25, Plan 40 residuals, and the Blackglass founder-ops runbook remain before any GO decision.
