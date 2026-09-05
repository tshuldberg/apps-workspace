# Runbook: failover-drill

Prove the stateful fleet survives a PostgreSQL primary loss: the primary fails, a
standby is promoted (or the provider fails over), clients reconnect with backoff, and
readiness reflects the truth throughout. Records a `failover` rehearsal proof.

> **Honesty rule.** A drill that was NOT run is NOT evidence; a recorded drill proves
> the RECORD, not the infrastructure. This repository owns the pool's reconnect/backoff
> behavior, the fail-closed `/readyz` evaluation, and the proof row. The FAILOVER
> itself (killing the primary, promoting a standby, provider failover) is founder-ops
> against real infrastructure. The rehearsal CLI records the outcome an operator
> produced out of band; it never performs a failover and never fabricates a verdict.

## Preconditions

- A staging fleet deployed from an approved release (see `release-promotion.md`), with
  a primary and at least one standby (or a provider that offers managed failover).
- `psql` reachable with the `meerkat_observer` and `meerkat_ops` role URLs.
- The private `/readyz` reachable per service (metrics listener or compose healthcheck;
  see the fleet ports in `README.md`).
- A restore proof is fresh (`backup-stale.md` exit 0) so a failover that goes wrong has
  a known-good recovery point. Do NOT run a failover drill on a fleet whose backups are
  failing.

## Step 1 - Baseline (repo tooling)

Capture a pre-failover baseline so the recovery is measured against a real starting
point, not an assumption:

```bash
# Every service reports ready before the drill.
for svc in persona:8894 humanity:8892 hosted:8893 community:8890 directory:8891; do
  curl -fsS "http://<host>:${svc##*:}/readyz" | jq -c '{svc:"'"${svc%%:*}"'", ready}'
done
# A short load baseline (WP-7B harness), so latency/error deltas across the failover
# are measurable, not eyeballed.
pnpm --filter @mylife/meerkat-relay load:relay -- --target ws://<relay-host>:8787 \
  --duration 60 --rate <baseline-rate> > /drill/failover-baseline.ndjson
```

Record the wall-clock start (ISO UTC) for the RTO measurement:

```bash
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
```

## Step 2 - Induce the failure (FOUNDER-OPS)

**FOUNDER-OPS.** This repository hosts no provider failover configuration. Using the
provider console/CLI, the founder-ops operator either:

1. Stops/kills the current PostgreSQL primary, then promotes a standby to primary, or
2. Triggers the provider's managed failover.

Note the exact instant the primary became unavailable and the instant the new primary
began accepting writes. Those two timestamps bracket the observed outage window; the
tooling cannot infer them, so record them in the drill notes.

## Step 3 - Observe the handling (repo tooling)

During the failover window, readiness must fail CLOSED, never fabricate health:

```bash
# While the primary is down, required=postgres readiness is not-ready with a
# machine-readable class (never a fabricated 200). This is the honest-signal proof.
watch -n2 'curl -s -o /dev/null -w "%{http_code}" http://<host>:8894/readyz'
```

Expected: `503` while the database is unreachable, flipping back to `200` once the new
primary accepts connections and the pool reconnects with backoff. The pool's reconnect
and bounded-timeout behavior is the repo-owned contract proven by
`fault-handling.integration.test.ts` (typed unavailability + recovery) and
`service-health-postgres.integration.test.ts` (readyz flips down then up); the drill
confirms it on real infrastructure.

Run the load harness across the window to measure recovery, not just liveness:

```bash
pnpm --filter @mylife/meerkat-relay load:relay -- --target ws://<relay-host>:8787 \
  --duration <span-covering-failover> --rate <baseline-rate> \
  > /drill/failover-window.ndjson
```

## Decision criteria

- New primary accepts writes, every `/readyz` returns to `200`, and the load harness's
  final verdict line is not FAIL (error rate returns to baseline within the recovery
  budget) -> **PASS**. Record RPO/RTO from the founder-ops timestamps + the window run.
- Readiness reported `200` (healthy) at any point while the primary was truly down ->
  **FAIL** the drill: the signal lied. Do not record `passed`; treat as an incident
  (`incident-drill.md`).
- Clients did not reconnect (persistent errors after the new primary was live) ->
  **FAIL**: backoff/reconnect regressed. Record `failed` with the window evidence.
- The load harness reports zero completed requests or an unreachable target -> **FAIL**
  (a vacuous run is never a pass, by the harness's own verdict).

## Step 4 - Record the proof (repo tooling)

Attach the REAL drill outputs (the window load run and the readyz observations). A
`passed` verdict REQUIRES a non-vacuous evidence file:

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay rehearsal:postgres --record \
    --kind failover --verdict passed --operator '<you>' \
    --started-at "$STARTED_AT" \
    --evidence /drill/failover-window.ndjson
# exit 0 = drill recorded; nonzero = a refusal (e.g. a bare/vacuous passed claim) or contention.
```

For a failed drill, record `--verdict failed` with the same evidence file; a `failed`
verdict does not require the evidence to be non-vacuous, but attach it anyway so the
incident review has the numbers.

## Abort / rollback guidance

- If the standby cannot be promoted or the new primary is diverged, STOP: do not force
  the fleet onto a bad primary. Restore from the fresh backup into a scratch environment
  (`disaster-recovery-drill.md`) and reconcile before returning to service.
- A failover that required a restore is `aborted`, not `failed`: record
  `--verdict aborted` with the notes so the ledger reflects that the failover path did
  not complete on its own.

## Founder-ops boundary

| Step | Repo tooling (recorded + verifiable) | Founder-ops (real infrastructure) |
|---|---|---|
| Baseline readiness + load | `curl /readyz`, `load:relay` | point at real staging hosts |
| Kill primary / promote standby | — | provider console/CLI failover |
| Fail-closed readiness during outage | `service-health` `/readyz` (503) | observed on the real fleet |
| Reconnect with backoff | pool reconnect (proven in fault tests) | observed on the real fleet |
| Record the proof | `rehearsal:postgres --record --kind failover` | operator runs it after the real drill |
| Export to Plan 40 ledger | `rehearsal:postgres --export-evidence` | — |

See also `readyz-down.md` (readiness flap triage), `pool-saturation.md`, and
`backup-stale.md` (the backup gate this drill depends on).
