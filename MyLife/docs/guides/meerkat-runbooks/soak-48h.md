# Runbook: soak-48h (sustained-load soak + leak/growth detection)

Tool: `scripts/soak/soak-runner.mjs` (Plan 44 WP-7B). Satisfies the tooling half of
AC-44.12 (full 48-hour production-shaped staging soak).

> **Signal status.** The soak RUNNER is real: it drives the load harness at a
> configured background rate, samples its own memory + each target's `/metrics` and
> liveness at a fixed interval, and decides a fail-closed verdict from GROWTH
> THRESHOLDS. What stays **founder-ops** is the 48-HOUR RUN ITSELF: staging
> infrastructure, real 10x-forecast traffic shaping, and the two-day wall-clock
> window. Duration is a PARAMETER: CI proves a minutes-long soak mechanically here;
> the 48-hour production-shaped run is the SAME tool, pointed at staging, its NDJSON
> stream recorded through the same rehearsal CLI. A soak that was not run for 48
> hours against a representative target is not 48-hour evidence; the recorded proof
> attests to the stream, not to the infrastructure.

## What the soak proves

A leak or a runaway queue only shows up as a TREND over hours, not in one sample.
The runner samples at `--interval` for `--duration` and, per sample, records:

- its own process **RSS + heapUsed** (leak detection on the driver),
- each `--metrics` target's private `/metrics` (a minimal Prometheus text parse:
  `name{labels} value` lines summed per metric name), and
- each `--liveness` target's `/healthz` shape or `/readyz` answer.

Every sample is one NDJSON line; the whole stream plus one final verdict line is the
evidence. Memory is bounded: samples hold scalar summaries, never raw traffic.

## Governing honesty rule (verdict semantics)

The soak is a BINARY held-steady / failed decision; there is no soft pass. Exit code
IS the verdict (`0` held steady, `2` fail). Fail-closed order:

1. **Zero samples -> fail.** A soak that collected nothing verified nothing.
2. **Staleness -> fail.** A target that stops answering `/metrics` or liveness
   mid-run is a lost signal, not a healthy one.
3. **RSS / heap growth over ceiling -> fail** (`--rss-growth-ceiling`,
   `--heap-growth-ceiling`, percent, windowed mean of first vs last samples).
4. **Watched-metric growth over ceiling -> fail** (`--metric-growth name=pct`); a
   configured metric that was never seen also fails closed (you asked us to watch a
   queue depth; its absence is not a pass).
5. **Aggregate error rate at/above ceiling -> fail** (`--error-ceiling`).
6. Otherwise **ok / held_steady**.

Growth is a windowed mean (first `--window` samples vs last `--window`) so a single
GC dip or spike cannot fake or hide a trend. A metric growing from a zero baseline
is treated as unbounded growth (a breach), never silently ignored.

## First checks (real commands)

A minutes-long mechanical soak (what CI runs; proves the tooling end to end):

```bash
# Relay booted with a raised, clamped per-IP env budget so background load is not
# capped by the single-source-IP rate limit (see load-test.md for why).
RELAY_ENV_RATE=5000 RELAY_WINDOW_MS=1000 PORT=8787 HOST=127.0.0.1 \
  pnpm --filter @mylife/meerkat-relay start &

pnpm --filter @mylife/meerkat-relay soak:run -- \
  --duration 300 --interval 15 \
  --load-relay ws://127.0.0.1:8787 --load-relay-connections 10 --load-relay-rate 5 \
  --liveness relay=http://127.0.0.1:8787/healthz \
  --rss-growth-ceiling 25 --heap-growth-ceiling 25 --error-ceiling 0.01 \
  > soak-evidence.ndjson
# exit 0 = held steady, 2 = a breach (see the final line's `breaches`)
```

With a stateful service exposing private metrics (persona shown; `/metrics` is the
opt-in private listener from `MEERKAT_METRICS_PORT`, never the public port):

```bash
pnpm --filter @mylife/meerkat-relay soak:run -- \
  --duration 172800 --interval 30 \
  --load-relay ws://<relay-host>:8787 --load-relay-connections 40 --load-relay-rate 5 \
  --metrics persona=http://<persona-host>:9894/metrics \
  --liveness relay=http://<relay-host>:8787/healthz \
  --liveness persona=http://<persona-host>:8894/readyz \
  --rss-growth-ceiling 20 --heap-growth-ceiling 20 --error-ceiling 0.01 \
  --metric-growth persona:meerkat_inflight_requests=50 \
  --window 5 \
  > soak-48h-evidence.ndjson
# --duration 172800 = 48h. This is the founder-ops production-shaped run.
```

Note `--metric-growth` names are prefixed by the metrics-target name
(`persona:<metric>`), matching how the runner namespaces each target's scrape.

## Threshold configuration guidance

| Threshold | Flag | Honest default | Tightening guidance |
|---|---|---|---|
| RSS growth | `--rss-growth-ceiling` | 25% | Tighten to ~15-20% for a 48h run; a real leak trends monotonically up |
| Heap growth | `--heap-growth-ceiling` | 25% | Same; watch heap independently of RSS (fragmentation vs true leak) |
| Error rate | `--error-ceiling` | 0.01 | The route's SLO error budget |
| Queue/inflight growth | `--metric-growth name=pct` | none (opt-in) | Name any gauge that must not grow unbounded (queue depth, inflight, mailbox) |
| Sample window | `--window` | 3 | Larger window (5-10) over a long run smooths transient GC noise |
| Sample interval | `--interval` | required | 15-30s over 48h keeps the stream readable and bounded |

## 10x-forecast parameters (CONFIG)

The background load (`--load-relay-connections`, `--load-relay-rate`) should shape
to the SAME 10x-forecast numbers as the load test (see the table in
`load-test.md`). The soak differs only in that it holds that load for the full
duration while watching for growth, rather than reporting peak latency. The forecast
is an operator input; nothing here is a hardcoded traffic claim.

## Interpretation

- `fail` / `no_samples` -> the runner collected nothing (target never reachable,
  duration/interval misconfigured). Fix before drawing any conclusion.
- `fail` / `staleness` with `deadSamples > 0` -> a target went dark mid-soak. Treat
  as an outage during the window; the run is not valid soak evidence until re-run.
- `fail` / `rss_growth` or `heap_growth` -> a genuine leak trend. Capture a heap
  snapshot and investigate before launch; do not launch on a leaking soak.
- `fail` / `metric_growth` -> a named metric (e.g. queue depth) grew past its
  ceiling: a backlog that never drained. `fail` / `metric_missing` -> the metric was
  never scraped; verify the metrics port/name and re-run.
- `fail` / `error_rate` -> sustained errors under load; correlate with the load
  harness output.
- `ok` / `held_steady` -> memory, watched metrics, and error rate stayed within
  ceilings across the full duration with the signal never lost. Record it.

## Recording the 48-hour soak as durable evidence

The whole NDJSON stream is the evidence; attach it in full:

```bash
MEERKAT_POSTGRES_URL='postgres://meerkat_ops:<pw>@<host>/<db>' \
  pnpm --filter @mylife/meerkat-relay rehearsal:postgres -- --record \
    --kind soak --verdict passed --operator "$(whoami)" \
    --started-at "<ISO instant the soak began>" \
    --evidence soak-48h-evidence.ndjson --release-id <release-id>
# A `passed` soak REQUIRES the evidence file; a bare passed claim is refused, and
# the CLI attaches the full NDJSON stream (every sample), not a summary.
```

Record `--verdict passed` ONLY when the runner exited 0. A soak that breached is
recorded with `--verdict failed` and its stream, honestly.

## DO-NOT

- Do NOT record a `passed` soak from a run shorter than the intended window and call
  it the 48-hour proof. Duration is in the evidence; a 5-minute stream is a
  5-minute proof.
- Do NOT relabel a breached soak up to passed. The verdict in the proof must equal
  the runner's exit verdict.
- Do NOT scrape the PUBLIC service port for `/metrics`; the metrics listener is the
  private, opt-in port (`MEERKAT_METRICS_PORT`) and must never be the public one.
- Do NOT add a field to relay `/healthz` to enrich the soak; liveness reads the
  existing two-field shape only.

## Escalation

The 48-hour wall-clock run, the staging infrastructure, and the real
production-shaped traffic are founder-ops. The runner, its fail-closed growth
evaluators, and the recording path ship here; the RUN is escalated to founder-ops
and its recorded proof lands in Plan 40's evidence ledger. Until that proof exists
and is recent, AC-44.12's infrastructure half is honestly open.
