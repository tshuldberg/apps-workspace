/**
 * Drives the load harness verdict evaluator + HTTP route evaluators (scripts/load/
 * lib/verdict.mjs + http-route.mjs, Plan 44 WP-7B).
 *
 * The honesty assertions: a load run NEVER passes vacuously. Zero completed ops,
 * an unreachable target, and an error rate at/above the ceiling are all hard FAILs;
 * a latency percentile over budget degrades; only completed>0 within budgets is ok.
 * The route evaluators enforce the relay two-field /healthz shape (a leak = error)
 * and the /readyz 200/503 answer contract.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- importing the .mjs harness lib for its exported pure helpers.
import { evaluateLoadRun, verdictExitCode } from '../../scripts/load/lib/verdict.mjs';
// @ts-expect-error -- importing the .mjs harness lib for its exported pure helpers.
import { parseRouteSpec, evaluateHttpResponse } from '../../scripts/load/lib/http-route.mjs';

const budgets = { errorRateCeiling: 0.01, p95BudgetMs: 250, p99BudgetMs: 500 };

describe('evaluateLoadRun (pure, fail-closed)', () => {
  it('fails hard on zero completed operations (never a vacuous pass)', () => {
    expect(evaluateLoadRun({ attempted: 100, completed: 0, errors: 100, latency: {}, thresholds: budgets })).toMatchObject({
      verdict: 'fail',
      reason: 'no_completed_operations',
    });
  });

  it('fails on an unreachable target regardless of counters', () => {
    expect(evaluateLoadRun({ attempted: 0, completed: 0, errors: 0, latency: {}, thresholds: budgets, unreachable: true })).toMatchObject({
      verdict: 'fail',
      reason: 'target_unreachable',
    });
  });

  it('fails when the error rate reaches the ceiling', () => {
    const r = evaluateLoadRun({
      attempted: 1000,
      completed: 990,
      errors: 10, // 1% == ceiling -> fail (at/above is a breach)
      latency: { p95Ms: 20, p99Ms: 30 },
      thresholds: budgets,
    });
    expect(r).toMatchObject({ verdict: 'fail', reason: 'error_rate_exceeded' });
  });

  it('degrades when a latency percentile exceeds its budget', () => {
    const r = evaluateLoadRun({
      attempted: 1000,
      completed: 1000,
      errors: 0,
      latency: { p50Ms: 10, p95Ms: 300, p99Ms: 400 },
      thresholds: budgets,
    });
    expect(r).toMatchObject({ verdict: 'degraded', reason: 'latency_over_budget' });
    expect(r.breaches[0]).toMatchObject({ percentile: 'p95Ms', budgetMs: 250, measuredMs: 300 });
  });

  it('degrades fail-closed when a configured budget could not be measured', () => {
    const r = evaluateLoadRun({
      attempted: 10,
      completed: 10,
      errors: 0,
      latency: { p95Ms: null },
      thresholds: { errorRateCeiling: 0.5, p95BudgetMs: 100 },
    });
    expect(r).toMatchObject({ verdict: 'degraded' });
    expect(r.breaches[0]).toMatchObject({ percentile: 'p95Ms', reason: 'unmeasured' });
  });

  it('passes only when completed>0, errors under ceiling, latencies within budget', () => {
    expect(evaluateLoadRun({
      attempted: 1000,
      completed: 1000,
      errors: 0,
      latency: { p50Ms: 8, p95Ms: 40, p99Ms: 90 },
      thresholds: budgets,
    })).toMatchObject({ verdict: 'ok', reason: 'within_budgets' });
  });

  it('maps verdicts to exit codes and fails closed on an unknown verdict', () => {
    expect(verdictExitCode('ok')).toBe(0);
    expect(verdictExitCode('degraded')).toBe(1);
    expect(verdictExitCode('fail')).toBe(2);
    expect(verdictExitCode('mystery')).toBe(2);
  });

  it('fails a run that abandoned most of its attempts even with zero errors', () => {
    // 1 of 10000 completed, 0 errors: 9999 attempts vanished. A zero error rate
    // over the one that finished is not evidence the target held.
    expect(evaluateLoadRun({
      attempted: 10000,
      completed: 1,
      errors: 0,
      latency: { p95Ms: 10 },
      thresholds: { errorRateCeiling: 0.01, p95BudgetMs: 100 },
    })).toMatchObject({ verdict: 'fail', reason: 'abandoned_operations', abandoned: 9999 });
  });

  it('tolerates a small in-flight tail below the abandoned ceiling', () => {
    expect(evaluateLoadRun({
      attempted: 100,
      completed: 98,
      errors: 1,
      latency: { p95Ms: 10 },
      thresholds: { errorRateCeiling: 0.05, p95BudgetMs: 100 },
    })).toMatchObject({ verdict: 'ok', reason: 'within_budgets' });
  });

  it('breaches a budget against an overflow-floor percentile it cannot bound above', () => {
    // The estimator reported p99 as a floor (the true tail is unbounded above the
    // top bucket): trusting the floor label would let a runaway tail pass a budget
    // set above it.
    expect(evaluateLoadRun({
      attempted: 100,
      completed: 100,
      errors: 0,
      latency: { p99Ms: 262144, p99Floor: true },
      thresholds: { errorRateCeiling: 0.01, p99BudgetMs: 300000 },
    })).toMatchObject({
      verdict: 'degraded',
      reason: 'latency_over_budget',
      breaches: [{ percentile: 'p99Ms', reason: 'overflow_floor' }],
    });
  });
});

describe('parseRouteSpec + evaluateHttpResponse (pure)', () => {
  it('parses kind=url and bare url (default get), rejects malformed/unknown kinds', () => {
    expect(parseRouteSpec('healthz=http://h/healthz')).toEqual({ kind: 'healthz', url: 'http://h/healthz' });
    expect(parseRouteSpec('http://h/livez')).toEqual({ kind: 'get', url: 'http://h/livez' });
    expect(parseRouteSpec('bogus=http://h/x')).toBeNull();
    expect(parseRouteSpec('healthz=not-a-url')).toBeNull();
    expect(parseRouteSpec('')).toBeNull();
  });

  it('enforces the relay two-field /healthz shape (an extra field is an error)', () => {
    expect(evaluateHttpResponse('healthz', 200, JSON.stringify({ ok: true, connections: 0 }))).toMatchObject({ outcome: 'success' });
    // A leaked extra field must read as an error even at HTTP 200.
    expect(evaluateHttpResponse('healthz', 200, JSON.stringify({ ok: true, connections: 0, tokens: 3 }))).toMatchObject({
      outcome: 'error',
      class: 'shape_violation',
    });
    expect(evaluateHttpResponse('healthz', 200, JSON.stringify({ ok: false, connections: 0 }))).toMatchObject({ class: 'ok_not_true' });
    expect(evaluateHttpResponse('healthz', 500, '')).toMatchObject({ outcome: 'error' });
  });

  it('treats /readyz 200 and 503 as valid answers, other statuses as errors', () => {
    expect(evaluateHttpResponse('readyz', 200, JSON.stringify({ ready: true, checks: [] }))).toMatchObject({ outcome: 'success', class: 'ready' });
    expect(evaluateHttpResponse('readyz', 503, JSON.stringify({ ready: false, checks: [] }))).toMatchObject({ outcome: 'success', class: 'not_ready', notReady: true });
    expect(evaluateHttpResponse('readyz', 500, JSON.stringify({ ready: false }))).toMatchObject({ outcome: 'error' });
    expect(evaluateHttpResponse('readyz', 200, 'not json')).toMatchObject({ outcome: 'error', class: 'malformed_json' });
  });

  it('treats a generic GET 2xx as success and non-2xx as error', () => {
    expect(evaluateHttpResponse('get', 204, '')).toMatchObject({ outcome: 'success' });
    expect(evaluateHttpResponse('get', 404, '')).toMatchObject({ outcome: 'error' });
  });
});
