#!/usr/bin/env node
/**
 * Load harness: service HTTP routes (Plan 44 WP-7B). Std-lib only (node:http/https);
 * no dependency beyond the standard library, matching the synthetics probe idiom.
 *
 * Drives GET requests at a configured rate for a configured duration across one or
 * more route templates and measures per-request latency with a bounded histogram
 * estimator (lib/stats.mjs), never an unbounded array of samples. Each route
 * asserts the RIGHT invariant per kind (lib/http-route.mjs):
 *   - healthz  the relay two-field zero-knowledge shape (a leak = an error),
 *   - readyz   the /readyz walk (200 ready / 503 not-ready are both valid answers),
 *   - get      an arbitrary GET template (2xx = success).
 *
 * HONESTY (lib/verdict.mjs): zero completed requests or an unreachable target is a
 * hard FAIL (exit 2); an error rate at/above --error-ceiling is FAIL; a latency
 * percentile over budget is degraded (exit 1); otherwise ok (exit 0).
 *
 * Usage:
 *   node load-http.mjs --rate 50 --duration 30 \
 *     --route healthz=http://127.0.0.1:8787/healthz \
 *     --route readyz=http://127.0.0.1:8894/readyz \
 *     --route http://127.0.0.1:8894/livez \
 *     [--error-ceiling 0.01] [--p95-budget-ms 100] [--timeout 3000] \
 *     [--concurrency 64] [--progress-interval 5]
 *
 * --rate is requests-per-second TOTAL across all routes (round-robined). --route is
 * repeatable. Exit: 0 ok, 1 degraded, 2 fail. One final NDJSON verdict line:
 * { probe:'load-http', verdict, attempted, completed, errors, errorRate, p50Ms,
 * p95Ms, p99Ms, perRoute:{...} }.
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { parseArgs, asArray, emit, emitFinal, nowMs } from './lib/args.mjs';
import { makeLatencyEstimator, summarizeLatency } from './lib/stats.mjs';
import { evaluateLoadRun, verdictExitCode, numberOr } from './lib/verdict.mjs';
import { parseRouteSpec, evaluateHttpResponse } from './lib/http-route.mjs';

/** GET a url under a bounded timeout. Resolves { status, body, elapsedMs } or rejects. */
export function getBounded(url, timeoutMs) {
  const target = new URL(url);
  const client = target.protocol === 'https:' ? https : http;
  const startedAt = nowMs();
  return new Promise((resolve, reject) => {
    const req = client.request(target, { method: 'GET', timeout: timeoutMs }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size <= 64 * 1024) chunks.push(chunk); // bound the buffered body
      });
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), elapsedMs: nowMs() - startedAt });
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rate = Math.max(0.001, numberOr(args.rate, 20));
  const durationS = Math.max(1, numberOr(args.duration, 15));
  const timeoutMs = Math.max(100, Math.floor(numberOr(args.timeout, 3000)));
  const concurrency = Math.max(1, Math.floor(numberOr(args.concurrency, 64)));
  const progressIntervalS = Math.max(1, numberOr(args['progress-interval'], 5));
  const thresholds = {
    errorRateCeiling: numberOr(args['error-ceiling'], 0.01),
    p50BudgetMs: args['p50-budget-ms'] != null ? numberOr(args['p50-budget-ms'], undefined) : undefined,
    p95BudgetMs: args['p95-budget-ms'] != null ? numberOr(args['p95-budget-ms'], undefined) : undefined,
    p99BudgetMs: args['p99-budget-ms'] != null ? numberOr(args['p99-budget-ms'], undefined) : undefined,
  };
  const estimator = makeLatencyEstimator(args.estimator, numberOr(args['reservoir-size'], 4096));

  // Parse routes. A malformed --route is a hard fail: an operator who typoed a
  // route asked for coverage they did not get; do not silently shrink the set.
  const rawRoutes = asArray(args.route);
  const routes = [];
  for (const spec of rawRoutes) {
    const parsed = parseRouteSpec(spec);
    if (!parsed) {
      emitFinal(
        { probe: 'load-http', verdict: 'fail', reason: 'bad_route_spec', spec: String(spec) },
        verdictExitCode('fail'),
      );
      return;
    }
    routes.push(parsed);
  }
  if (routes.length === 0) {
    emitFinal(
      { probe: 'load-http', verdict: 'fail', reason: 'no_routes_requested', attempted: 0, completed: 0, errors: 0, errorRate: null },
      verdictExitCode('fail'),
    );
    return;
  }

  const stats = { attempted: 0, completed: 0, errors: 0 };
  const perRoute = routes.map((r) => ({ kind: r.kind, url: r.url, completed: 0, errors: 0, notReady: 0 }));
  let inFlight = 0;
  let unreachable = 0;
  let reachable = 0;

  emit({ probe: 'load-http', event: 'start', rate, durationS, routes: routes.map((r) => `${r.kind}=${r.url}`) });

  async function fireOne(routeIndex) {
    const route = routes[routeIndex];
    const rt = perRoute[routeIndex];
    stats.attempted += 1;
    inFlight += 1;
    try {
      const res = await getBounded(route.url, timeoutMs);
      reachable += 1;
      const verdict = evaluateHttpResponse(route.kind, res.status, res.body);
      estimator.record(res.elapsedMs);
      // completed and errors are MUTUALLY EXCLUSIVE (like load-relay): counting an
      // application-level error as completed too would double it into the verdict
      // denominator and dilute the error rate below its ceiling (a shape-leaking
      // /healthz at ~1% real errors would read as 0.99% and pass a 1% gate).
      if (verdict.outcome === 'error') {
        stats.errors += 1;
        rt.errors += 1;
      } else {
        stats.completed += 1;
        rt.completed += 1;
        if (verdict.notReady) rt.notReady += 1;
      }
    } catch (err) {
      // A transport failure/timeout is an error AND evidence the target may be
      // unreachable; track both so an all-unreachable run fails as unreachable.
      if (err && (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.message === 'timeout')) {
        unreachable += 1;
      }
      stats.errors += 1;
      rt.errors += 1;
    } finally {
      inFlight -= 1;
    }
  }

  const tickMs = 20;
  const perTick = (rate * tickMs) / 1000;
  let credit = 0;
  let rr = 0;
  const startedAt = nowMs();
  const endAt = startedAt + durationS * 1000;
  let lastProgress = startedAt;

  await new Promise((resolve) => {
    const interval = setInterval(() => {
      const t = nowMs();
      credit += perTick;
      const whole = Math.floor(credit);
      if (whole > 0) {
        credit -= whole;
        for (let i = 0; i < whole; i += 1) {
          // Bounded concurrency: if we are saturated, count the drop as an error
          // (the target is not keeping up) rather than growing unbounded requests.
          if (inFlight >= concurrency) {
            stats.attempted += 1;
            stats.errors += 1;
            continue;
          }
          void fireOne(rr % routes.length);
          rr += 1;
        }
      }
      if (t - lastProgress >= progressIntervalS * 1000) {
        lastProgress = t;
        const snap = summarizeLatency(estimator);
        emit({
          probe: 'load-http',
          event: 'progress',
          elapsedS: Math.round((t - startedAt) / 100) / 10,
          attempted: stats.attempted,
          completed: stats.completed,
          errors: stats.errors,
          p50Ms: snap.p50Ms,
          p95Ms: snap.p95Ms,
          p99Ms: snap.p99Ms,
        });
      }
      if (t >= endAt) {
        clearInterval(interval);
        resolve();
      }
    }, tickMs);
  });

  // Drain in-flight requests under a bounded window.
  const drainUntil = nowMs() + Math.min(timeoutMs, 3000);
  while (inFlight > 0 && nowMs() < drainUntil) {
    await new Promise((r) => setTimeout(r, 25));
  }

  const latency = summarizeLatency(estimator);
  // Target is unreachable only if EVERY response was a transport failure and none
  // reached the target. A partial refusal is a high error rate, not "unreachable".
  const isUnreachable = reachable === 0 && unreachable > 0;
  const evaluated = evaluateLoadRun({
    attempted: stats.attempted,
    completed: stats.completed,
    errors: stats.errors,
    latency,
    thresholds,
    unreachable: isUnreachable,
  });

  emitFinal(
    {
      probe: 'load-http',
      verdict: evaluated.verdict,
      reason: evaluated.reason,
      rate,
      durationS,
      attempted: stats.attempted,
      completed: stats.completed,
      errors: stats.errors,
      errorRate: evaluated.errorRate,
      breaches: evaluated.breaches,
      perRoute,
      ...latency,
    },
    verdictExitCode(evaluated.verdict),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    emitFinal(
      { probe: 'load-http', verdict: 'fail', reason: 'harness_error', detail: String(err?.message ?? err) },
      verdictExitCode('fail'),
    );
  });
}
