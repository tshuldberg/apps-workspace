# Runbook: load-test (relay + service HTTP load harness)

Tools: `scripts/load/load-relay.mjs`, `scripts/load/load-http.mjs` (Plan 44 WP-7B).

> **Signal status.** The load HARNESS is real: `load-relay.mjs` speaks the actual
> relay wire protocol (pairs two ws clients on an opaque token, forwards opaque
> `env` frames, measures real round-trips) and `load-http.mjs` drives the real
> service HTTP surfaces. What stays **founder-ops** is the INFRASTRUCTURE: a
> production-shaped target fleet, the real 10x-forecast traffic numbers, and the
> staging environment the harness points at. A load run that was not executed
> against a representative target is not capacity evidence. The harness computes
> its verdict from what it measured; it never claims a pass it did not measure.

## What each harness proves

- `load-relay.mjs` exercises the pairing table, the per-connection/per-IP rate
  limiter, and the verbatim `env` forwarding path under real concurrency. It
  measures per-frame round-trip latency in BOUNDED memory (a fixed histogram, never
  an array of every sample) and emits one final NDJSON verdict.
- `load-http.mjs` drives GET load across route templates, each asserting the RIGHT
  invariant per kind: the relay two-field `/healthz` zero-knowledge shape (an added
  field reads as an ERROR, not a pass), the `/readyz` walk (200 ready / 503
  not-ready are both valid answers), and arbitrary `get=` templates (2xx = success).

## Governing honesty rule (verdict semantics)

Both harnesses fail-closed. The exit code IS the verdict:

- **fail (exit 2):** zero completed operations, an unreachable target, or an error
  rate at/above `--error-ceiling`. "I completed nothing" and "everything errored"
  are never a pass.
- **degraded (exit 1):** every answered operation was healthy but a latency
  percentile exceeded its configured `--p*-budget-ms`.
- **ok (exit 0):** completed > 0, error rate under ceiling, latencies within budget.

A configured latency budget that could not be measured degrades (never silently
passes). A malformed `--route` spec is a hard fail: coverage you asked for and did
not get must stop the run, not shrink it.

## First checks (real commands)

Relay WebSocket load (rate is frames/sec PER PAIR; duration in seconds):

```bash
pnpm --filter @mylife/meerkat-relay load:relay -- \
  --target ws://<relay-host>:8787 \
  --connections 50 --rate 15 --duration 60 \
  --error-ceiling 0.01 --p95-budget-ms 250 --p99-budget-ms 500
# exit 0 ok, 1 degraded (latency over budget), 2 fail (unreachable / no completes / errors)
```

Service HTTP load (`--route` is repeatable; `--rate` is total req/sec round-robined):

```bash
node packages/meerkat-relay/scripts/load/load-http.mjs \
  --rate 100 --duration 60 \
  --route healthz=http://<relay-host>:8787/healthz \
  --route readyz=http://<persona-host>:8894/readyz \
  --route http://<persona-host>:8894/livez \
  --error-ceiling 0.01 --p95-budget-ms 100
```

## Binding relay cap: the per-IP env rate limit

The relay's `env` rate limit is keyed by **client IP**, not per connection
(`src/hub.ts`, `RELAY_LIMITS.rateMaxPerWindow` per `rateWindowMs`, default 200 per
10s = ~20 env/sec per IP). A round trip is TWO relayed frames (initiator -> peer,
peer echo -> initiator), so all pairs sharing one source IP draw on one ~20/sec
budget. Consequences for a load run:

- A local (single-IP) run above ~10 frames/sec/pair aggregate will hit
  `rate_limited` err frames, which the harness counts honestly as errors and
  surfaces in the final line's `errorCodes`. That is a REAL finding about
  single-NAT clients, not a harness bug.
- To load-test raw throughput, either run the relay with a raised, clamped budget
  (`RELAY_ENV_RATE` is clamped to `[10, 5000]`, `RELAY_WINDOW_MS` to `[1000,
  60000]` in `src/protocol.ts`) or drive traffic from multiple source IPs so each
  draws its own budget (closer to production, where clients are many distinct IPs).

```bash
# Relay booted for a throughput run (raised, still-clamped per-IP env budget):
RELAY_ENV_RATE=5000 RELAY_WINDOW_MS=1000 PORT=8787 HOST=0.0.0.0 \
  pnpm --filter @mylife/meerkat-relay start
```

## 10x-forecast parameters (CONFIG, not hardcoded)

The Performance and Capacity section of Plan 44 requires load at **10x forecast
launch traffic**. The forecast is an operator input, not a constant in the harness.
Fill this table from the current launch forecast before a capacity run and pass the
values as flags:

| Parameter | Flag | Guidance |
|---|---|---|
| Concurrent relay pairs | `--connections` | 10x forecast peak simultaneous paired sessions |
| Frames/sec per pair | `--rate` | 10x forecast per-session message rate |
| HTTP req/sec | `--rate` (load-http) | 10x forecast peak req/sec per launch-critical route |
| Duration | `--duration` | Long enough to reach steady state (>= a few rate windows) |
| Error ceiling | `--error-ceiling` | The route's SLO error budget (e.g. 0.01) |
| p95 / p99 budget | `--p95-budget-ms` / `--p99-budget-ms` | The route's latency SLO |

Bounded memory is guaranteed regardless of scale: latency samples go into a fixed
histogram, and in-flight sends are capped (`--max-in-flight`), so a slow target
applies backpressure instead of growing the harness heap.

## Interpretation

- `fail` / `target_unreachable` -> the target did not answer; the run verified
  nothing. Check the target is up and the URL/port are right before drawing any
  capacity conclusion.
- `fail` / `error_rate_exceeded` with `errorCodes.rate_limited > 0` -> the relay
  shed load at its per-IP cap. Expected on a single-IP local run; on a multi-IP or
  raised-budget run it means the configured rate exceeds relay capacity.
- `degraded` / `latency_over_budget` -> the target keeps up but is slower than SLO;
  the `breaches` array names which percentile and by how much.
- `ok` -> completed > 0, errors under ceiling, latencies within budget at the tested
  scale. Record it (below) so it counts as evidence.

## Recording a load result as durable evidence

A load verdict is only capacity evidence once recorded through the rehearsal proof
store (WP-7A). Capture the harness output and attach the FULL stream:

```bash
node packages/meerkat-relay/scripts/load/load-relay.mjs --target ws://<host>:8787 \
  --connections 50 --rate 15 --duration 60 > load-evidence.ndjson

MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<host>/<db>' \
  pnpm --filter @mylife/meerkat-relay rehearsal:postgres -- --record \
    --kind load --verdict passed --operator "$(whoami)" \
    --started-at "$(date -u +%FT%TZ)" \
    --evidence load-evidence.ndjson --release-id <release-id>
# A `passed` verdict REQUIRES the evidence file; a bare passed claim is refused.
```

Only record `--verdict passed` when the harness itself exited 0. A degraded or
failed run is recorded with its real verdict, never relabeled up.

## DO-NOT

- Do NOT record a `passed` load drill from a run that exited 1 or 2. The verdict in
  the proof must match the verdict the harness computed.
- Do NOT treat a single-IP local run's `rate_limited` errors as a relay defect; it
  is the documented per-IP env cap. Re-run with a raised budget or multiple IPs.
- Do NOT add a field to `/healthz` to make load metrics richer. The two-field shape
  is the zero-knowledge invariant; the `load-http healthz` route asserts exactly it.
- Do NOT claim a capacity number from a run whose target was not production-shaped.
  The infrastructure half is founder-ops.

## Escalation

Standing up the production-shaped target fleet, sourcing the real 10x-forecast
traffic numbers, and running from representative client IP diversity are
founder-ops. The harness, its verdict semantics, and the recording path ship here;
the capacity RUN against real infrastructure is escalated to founder-ops, and its
recorded proof lands in Plan 40's evidence ledger.
