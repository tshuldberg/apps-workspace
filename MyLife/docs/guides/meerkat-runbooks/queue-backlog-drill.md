# Runbook: queue-backlog-drill

Prove a worker queue drains under a burst and does not grow without bound: inject a
backlog, confirm workers process it with lease fencing intact, watch queue depth trend
DOWN (not up), and confirm no lease is double-processed. Records a `queue_backlog`
rehearsal proof.

> **Honesty rule.** A drill that was NOT run is NOT evidence; a recorded drill proves
> the RECORD, not the infrastructure. This repository owns the lease-fenced queue
> (`ops.job_leases`, claim/renew/release with fencing tokens) and the load/soak harness
> that drives and samples it. Running the burst against a real staging fleet with real
> workers is founder-ops. The tooling never fabricates a depth sample or a drain
> verdict.

## What the repo already proves

Exactly-once processing under a crashed worker is proven in CI by
`src/postgres/__tests__/fault-handling.integration.test.ts`: a claimed lease with a
short `leaseMs` expires, a second worker re-claims it exactly once with an ADVANCED
fencing token, and the crashed holder's `renewJobLease` + `releaseJobLease` are refused.
This DRILL confirms the same fencing holds when a REAL backlog is drained by real
workers, and that depth trends down rather than piling up. Do not re-derive the fencing
contract by hand.

## Signal note

No dedicated queue-depth SLO alert or Prometheus counter is wired for the job queue
today (the `service-health` registry supports a lazy `collect()` gauge, but no
production worker publishes queue depth yet). So depth is observed directly from the
`ops.job_leases` table with the observer role and sampled by the soak harness's
queue-depth growth threshold. State this in the drill notes; do not invoke a
non-existent depth probe.

## Preconditions

- A staging fleet from an approved release with the target worker(s) running.
- `psql` with the `meerkat_observer` + `meerkat_ops` role URLs.
- A queue you can safely enqueue synthetic work into (e.g. a rehearsal-only queue, or a
  bounded burst on a real queue you can drain).

## Step 1 - Baseline depth (repo tooling)

```bash
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
# Live lease rows per queue: the current in-flight + pending depth.
psql "$MEERKAT_OBSERVER_URL" -c \
  "select queue, count(*) as depth, count(*) filter (where leased_until > clock_timestamp()) as active
   from ops.job_leases group by queue order by queue;"
```

## Step 2 - Inject a backlog (repo tooling + founder-ops)

Drive a burst that exceeds the workers' instantaneous drain rate so a backlog actually
forms (a drill that never built a backlog proved nothing). Use the load harness at a
burst rate above steady-state:

```bash
pnpm --filter @mylife/meerkat-relay load:relay -- --target ws://<relay-host>:8787 \
  --rate <burst-rate-above-drain> --duration <burst-seconds> \
  > /drill/queue-burst.ndjson
```

For a worker-queue backlog specifically (not the WebSocket path), enqueue the synthetic
jobs the target worker consumes; the exact enqueue path is the worker's own API and is
**founder-ops** to trigger against the real fleet.

## Step 3 - Watch it drain (repo tooling)

Sample depth repeatedly; it must trend DOWN after the burst ends:

```bash
watch -n5 'psql "$MEERKAT_OBSERVER_URL" -c \
  "select queue, count(*) as depth from ops.job_leases group by queue order by queue;"'
```

Run the soak harness across the drain window so the queue-depth GROWTH threshold is
evaluated fail-closed (a queue that grows past the configured ceiling is a FAIL, not a
pass):

```bash
pnpm --filter @mylife/meerkat-relay soak:run -- \
  --load-relay ws://<relay-host>:8787 \
  --duration <drain-window> --interval 15 \
  --metrics <service>=http://<service-host>:<metrics-port>/metrics \
  --metric-growth '<service>:<queue-depth-metric>=<max-growth-pct>' \
  > /drill/queue-soak.ndjson
# The queue-depth threshold is only evaluated when --metrics AND --metric-growth are
# wired (metric names are PREFIXED target:metric); a missing metric fails closed as
# metric_missing. No first-party queue-depth metric is wired today (pending_signal):
# until one ships, the psql depth watch above is the drain evidence, and the soak run
# covers memory/liveness only - say so honestly in the recorded evidence.
```

Confirm fencing held during the drain: no job was processed twice. The fencing token on
each lease strictly advances on re-claim (proven in the fault-handling test); a
double-process would show as two workers acting on the same `(queue, job_id)` with the
same token, which the store forbids.

## Decision criteria

- Depth peaked during the burst then trended DOWN to baseline within the drain budget,
  the soak harness's queue-depth growth threshold did NOT trip, and no job was
  double-processed -> **PASS**.
- Depth kept CLIMBING after the burst ended (workers cannot keep up even at steady
  state) -> **FAIL**: the queue is under-provisioned or a worker is stuck. Record
  `failed`; a failing provider must not cause an unbounded worker pileup (the Capacity
  requirement).
- The soak harness reports zero samples or an unreachable target -> **FAIL** (a vacuous
  run is never a pass, by the harness's own verdict).
- Any job was processed twice (fencing violated) -> **FAIL**: a fencing regression.
  Record `failed` and file against the lease store.

## Step 4 - Record the proof (repo tooling)

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<ops-host>/<db>' \
  pnpm --filter @mylife/meerkat-relay rehearsal:postgres --record \
    --kind queue_backlog --verdict passed --operator '<you>' \
    --started-at "$STARTED_AT" \
    --evidence /drill/queue-soak.ndjson
```

Evidence: the soak NDJSON stream (depth samples + final verdict) plus the psql depth
snapshots. A `passed` verdict requires non-vacuous evidence.

## Abort / rollback guidance

- If depth grows without bound and threatens the database or worker memory, STOP the
  injection immediately and let the queue drain before it exhausts capacity. A drill
  must never become a self-inflicted outage.
- A drill you had to abort to protect the fleet is `aborted`, not `failed`, unless the
  abort itself revealed the queue cannot drain (then `failed`).

## Founder-ops boundary

| Step | Repo tooling (recorded + verifiable) | Founder-ops (real infrastructure) |
|---|---|---|
| Baseline + drain depth | `psql` over `ops.job_leases` | observed on the real fleet |
| Inject the burst | `load:relay` (WS path) | enqueue worker jobs on the real fleet |
| Fail-closed depth-growth threshold | `soak:run` queue-depth threshold | observed on the real fleet |
| Exactly-once fencing | proven in `fault-handling.integration.test.ts` | observed on the real fleet |
| Record the proof | `rehearsal:postgres --record --kind queue_backlog` | operator runs it after the real drill |

See also `pool-saturation.md`, `readyz-down.md`, `soak-48h.md` (the soak harness this
drill reuses).
