# Runbook: dependency-outage-drill

Prove a stateful service degrades HONESTLY when a hard dependency (its PostgreSQL
store, the object store, or a downstream service) is unreachable: the store call
surfaces a typed unavailability, `/readyz` fails closed, the user path returns an exact
unavailable state (never fabricated data), and the service recovers when the dependency
returns. Records a `dependency_outage` rehearsal proof.

> **Honesty rule.** A drill that was NOT run is NOT evidence; a recorded drill proves
> the RECORD, not the infrastructure. This repository OWNS the handling contract: a
> pool pointed at a dead dependency yields `PostgresStoreUnavailableError` inside its
> bounded connection timeout (never a hang), `/readyz` reports `unavailable`
> fail-closed, and the service recovers against the live database. That contract is
> proven mechanically by `fault-handling.integration.test.ts`. TAKING the real
> dependency down in staging (a network partition, a paused database, a blocked egress
> route) is founder-ops. The CLI records the outcome; it never induces the outage.

## What this drill proves vs. what the tests already prove

The repo-owned handling is already proven in CI by
`src/postgres/__tests__/fault-handling.integration.test.ts`:

- a store call against a dead port (`127.0.0.1:1`) rejects with the TYPED
  `PostgresStoreUnavailableError` inside the connection-timeout budget, and
- the readiness probe over that dead pool evaluates fail-closed
  (`{ ok:false, detailClass:'unavailable' }`, `ready:false`), then
- both a store call and readiness recover against the live database.

This DRILL confirms the same contract holds for a REAL dependency outage on a deployed
staging fleet, where the failure mode is a paused/partitioned provider rather than a
closed loopback port. Run the drill; do not re-derive the unit contract by hand.

## Preconditions

- A staging fleet from an approved release, one service you will isolate (e.g. persona).
- `psql` with `meerkat_observer` + `meerkat_ops` URLs; the private `/readyz` reachable.
- A fresh backup proof (`backup-stale.md` exit 0) before you partition anything stateful.

## Step 1 - Baseline (repo tooling)

```bash
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
curl -fsS http://<host>:8894/readyz | jq -c '{ready, checks}'   # expect ready:true
```

## Step 2 - Induce the outage (FOUNDER-OPS)

**FOUNDER-OPS.** Using the provider/orchestrator, isolate the target dependency for
the chosen service ONLY:

- database outage: pause the service's PostgreSQL instance or block its egress to the
  database host, or
- object-store outage: block egress to the object-store endpoint, or
- downstream-service outage: stop the dependency service (e.g. humanity, which persona
  calls) and observe the caller's fail-closed behavior.

Record the instant the dependency became unreachable.

## Step 3 - Observe honest degradation (repo tooling)

```bash
# Readiness fails CLOSED with a machine-readable class, never a fabricated 200.
curl -s -o /dev/null -w "%{http_code}\n" http://<host>:8894/readyz   # expect 503
curl -fsS http://<host>:8894/readyz | jq -c '.checks'
#   -> the affected required check reports ok:false with detailClass
#      "unavailable" | "timeout" | "faulted" (never a free-form string or identity).
```

The user path must return an EXACT unavailable state, not empty data masquerading as
success. A store read that fails is mapped to the typed unavailability at the boundary
(the `deletion-poison.md` / `referenced-missing.md` runbooks cover the object-reference
variant); confirm the user-facing response is an honest unavailable, not a silent
empty result.

Bounded, not hung: the connection/statement timeouts mean each request FAILS FAST
rather than piling up workers. A failing dependency must not cause an unbounded request
or worker pileup (the Performance and Capacity requirement); confirm request latency is
bounded to the timeout budget, not climbing without limit.

## Step 4 - Restore the dependency + confirm recovery (FOUNDER-OPS + repo tooling)

**FOUNDER-OPS.** Un-pause / un-block the dependency. Then confirm the service recovers
without a restart:

```bash
curl -fsS http://<host>:8894/readyz | jq -c '{ready}'   # expect ready:true again
```

The pool reconnects with backoff; no manual restart should be required for a transient
outage. If a restart WAS required, that is a finding: record it and file against the
reconnect path.

## Decision criteria

- Readiness flipped to `503` during the outage, the user path returned an honest
  unavailable state, requests stayed bounded (no pileup), and readiness returned to
  `200` after the dependency recovered -> **PASS**.
- Readiness reported healthy while the dependency was truly down, OR the user path
  returned fabricated/empty-as-success data -> **FAIL** (the signal or the boundary
  lied). Record `failed`; treat as an incident (`incident-drill.md`).
- Requests piled up unbounded or the service needed a manual restart to recover ->
  **FAIL**: a timeout/backoff regression.

## Step 5 - Record the proof (repo tooling)

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay rehearsal:postgres --record \
    --kind dependency_outage --verdict passed --operator '<you>' \
    --started-at "$STARTED_AT" \
    --evidence /drill/dependency-outage-<svc>.ndjson
```

The evidence file is the drill's OWN outputs: the readyz JSON captured during the
outage window and the recovery confirmation (append them as NDJSON lines). A `passed`
verdict requires non-vacuous evidence.

## Abort / rollback guidance

- If the dependency does not come back cleanly, STOP treating this as a drill and open
  an incident (`incident-drill.md`). Do not force the service into a half-degraded
  state to "finish" the drill.
- A drill you could not complete honestly is `aborted`, not `passed`.

## Founder-ops boundary

| Step | Repo tooling (recorded + verifiable) | Founder-ops (real infrastructure) |
|---|---|---|
| Typed unavailability from a store call | proven in `fault-handling.integration.test.ts` | observed on the real fleet |
| Fail-closed `/readyz` | `service-health` `/readyz` (503 + detailClass) | observed on the real fleet |
| Bounded, no pileup | pool statement/connection timeouts | observed on the real fleet |
| Induce / restore the outage | — | pause/partition, then restore the dependency |
| Record the proof | `rehearsal:postgres --record --kind dependency_outage` | operator runs it after the real drill |

See also `readyz-down.md`, `pool-saturation.md`, `deletion-poison.md`,
`referenced-missing.md`.
