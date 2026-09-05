# Meerkat runbooks (Plan 44 Phase 4 WP-4C)

One runbook per page defined in
`packages/meerkat-relay/deploy/observability/slo-definitions.json`. Each page-severity
alert names a file here. Runbooks assume the operator has:

- shell access to the service host (or `docker compose` / orchestrator equivalent),
- the compose topology in `packages/meerkat-relay/deploy/compose.production.yml`
  (public ports 8787 relay, 8890 community, 8891 directory, 8892 humanity, 8893 hosted,
  8894 persona; private metrics ports 9890-9894 on the internal network only),
- `psql` with the least-privilege role URL for the affected service, and
- the postgres CLIs shipped in `packages/meerkat-relay/bin/` (`meerkat-postgres-migrate`,
  `-role-grants`, `-state-import`, `-cutover`, `meerkat-release`, `meerkat-promotion`).

| Runbook | Page it serves |
|---|---|
| `readyz-down.md` | relay/service availability, readiness flap |
| `pool-saturation.md` | PostgreSQL pool saturation |
| `shadow-divergence.md` | shadow comparator divergence (migration window) |
| `referenced-missing.md` | reconciler referenced-missing / orphan sweep |
| `deletion-poison.md` | object deletion job poison |
| `backup-stale.md` | backup freshness / restore proof (founder-ops) |
| `healthz-shape-regression.md` | relay /healthz zero-knowledge shape regression |
| `release-promotion.md` | signed-release promotion ladder, canary gate, rollback (founder-ops) |

## Drill playbooks (Plan 44 Phase 7 WP-7C)

Rehearsal playbooks, not page responses. Each drives EXISTING tooling, states its
founder-ops boundary loudly, and records evidence into `ops.rehearsal_proofs` via
`rehearsal:postgres --record`. The honesty rule is the same throughout: a drill that
was not run is not evidence; a recorded drill proves the record, not the infrastructure.

| Runbook | What it rehearses |
|---|---|
| `failover-drill.md` | PostgreSQL primary loss, standby promotion, reconnect with backoff, fail-closed readiness |
| `dependency-outage-drill.md` | a hard dependency down: typed unavailability, fail-closed `/readyz`, bounded (no pileup), recovery |
| `secret-rotation.md` | rotate every secret family with the two-key-overlap requirement (no single-live-key turnover) |
| `migration-rollback-drill.md` | expand/migrate/contract, NC-44.5 (no destructive migration in the rollback window), mixed-version safety |
| `regional-object-recovery-drill.md` | object-store regional recovery: inventory rollup + reference-ledger reconciliation (extends `disaster-recovery-drill.md`) |
| `queue-backlog-drill.md` | a worker queue drains under a burst without unbounded growth, lease fencing intact |
| `load-test.md` | the load harness (relay ws + service HTTP) at configured 10x-forecast rates; records `load` |
| `soak-48h.md` | the soak runner with fail-closed growth thresholds; CI proves minutes, the 48-hour production-shaped run is founder-ops; records `soak` |
| `incident-drill.md` | a staffed incident rehearsal driving a failure through the escalation ladder and per-page runbooks |
| `canary-stop-rollback-drill.md` | a failing canary verdict REFUSES the promotion record; the honest rollback re-points images without un-writing the database (AC-44.11) |
| `disaster-recovery-drill.md` | end-to-end database recovery: restore a real backup, prove by semantic digest, record the proof (Plan 44 WP-5A) |

## Fleet-wide DO-NOTs (apply to every runbook)

- **Never restart a service into `postgres` mode without the cutover proof.** The cutover
  is a verified, digest-gated transition (`meerkat-postgres-cutover --verify`), not an env
  flip. Flipping `MEERKAT_STORE_BACKEND` by hand can split authority between two backends.
- **Never delete an object by hand.** The object deletion queue is the ONLY byte remover.
  A hand `rm`/`DELETE` on a bucket or ledger row corrupts reconciliation.
- **Never add a field to the relay `/healthz`** as a "debug aid". Its shape is a
  zero-knowledge guarantee; the shape synthetic will page.
- **Never echo a redeem token, session secret, connection string, or identity into an
  incident channel.** Copy the redacted NDJSON line, not raw payloads.

Escalation ladder (unless a runbook says otherwise): on-call operator -> service owner ->
founder-ops (for backup, object-store, DNS/TLS-edge, or database-provider actions).
