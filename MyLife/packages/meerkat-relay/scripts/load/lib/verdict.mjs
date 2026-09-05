/**
 * Pure load-verdict evaluator for the load harness (Plan 44 WP-7B). Std-lib only.
 *
 * The single honesty rule this file encodes: a load run may NEVER pass vacuously.
 * The verdict is computed from the measured outcome against operator-configured
 * ceilings, fail-closed at every ambiguous edge:
 *
 *   - fail (exit 2): zero completed operations, an unreachable target (recorded as
 *     zero completed + a transport error class), or an error rate at/above the
 *     configured errorRateCeiling. "I completed nothing" and "everything errored"
 *     are exactly the lies a load gate must refuse to call green.
 *   - degraded (exit 1): every operation the target answered was healthy, but a
 *     latency percentile exceeded its configured budget (the target works but is
 *     slower than the SLO).
 *   - ok (exit 0): completed > 0, error rate under ceiling, latencies within budget.
 *
 * Thresholds are CONFIG passed in, never hardcoded claims. The 10x-forecast
 * parameters live in the runbook as configuration guidance, not as constants here.
 */

export const EXIT_OK = 0;
export const EXIT_DEGRADED = 1;
export const EXIT_FAIL = 2;

/**
 * Evaluate one load run. PURE and exported for the unit tests. Inputs:
 *   attempted            operations started
 *   completed            operations that produced a measured latency
 *   errors               operations that failed (transport, timeout, protocol)
 *   latency              { p50Ms, p95Ms, p99Ms, ... } (nulls when no samples)
 *   thresholds           {
 *                          errorRateCeiling   (0..1, at/above -> fail),
 *                          p50BudgetMs?, p95BudgetMs?, p99BudgetMs? (over -> degraded),
 *                        }
 *   unreachable          true when the target could not be reached at all
 *
 * Returns { verdict, reason, errorRate, breaches }.
 */
export function evaluateLoadRun(input) {
  const attempted = Number(input?.attempted ?? 0);
  const completed = Number(input?.completed ?? 0);
  const errors = Number(input?.errors ?? 0);
  const latency = input?.latency ?? {};
  const thresholds = input?.thresholds ?? {};
  const unreachable = input?.unreachable === true;

  // An unreachable target is a hard fail regardless of counters: a gate that never
  // reached the target has verified nothing.
  if (unreachable) {
    return { verdict: 'fail', reason: 'target_unreachable', errorRate: 1, breaches: [] };
  }

  // Zero completed operations is a hard fail (never a vacuous pass), even if
  // `attempted` is also zero: a load run that measured nothing proves nothing.
  if (!Number.isFinite(completed) || completed <= 0) {
    return { verdict: 'fail', reason: 'no_completed_operations', errorRate: attempted > 0 ? 1 : null, breaches: [] };
  }

  // Error rate over the total attempted (errors / (completed + errors) when
  // attempted is unreliable). Denominator is the max of attempted and observed
  // outcomes so a miscounted attempted can never hide errors.
  const denom = Math.max(attempted, completed + errors, 1);
  const errorRate = errors / denom;

  const ceiling = numberOr(thresholds.errorRateCeiling, 0.01);
  if (errorRate >= ceiling) {
    return { verdict: 'fail', reason: 'error_rate_exceeded', errorRate, breaches: [] };
  }

  // Abandoned operations: attempts that neither completed nor errored (they
  // vanished, e.g. an in-flight request the run tore down before it resolved). A
  // small in-flight tail at the final snapshot is tolerated, but a large gap means
  // the run silently lost operations and a zero error rate over the few that
  // finished is not evidence the target held. Fail-closed above the ceiling.
  const abandoned = Math.max(0, attempted - completed - errors);
  const abandonedCeiling = numberOr(thresholds.abandonedRatioCeiling, 0.02);
  if (attempted > 0 && abandoned / attempted > abandonedCeiling) {
    return { verdict: 'fail', reason: 'abandoned_operations', errorRate, abandoned, breaches: [] };
  }

  // Latency budgets (optional): a percentile OVER budget degrades the run. Fail-
  // closed on a configured budget with a null measured percentile (a budget was
  // set but we could not measure it) -> degraded, never silently ok. An overflow
  // FLOOR percentile (the true value is at least the top histogram bucket and the
  // estimator cannot bound it above) is treated as a breach against any configured
  // budget: trusting the floor label would let a runaway tail pass a budget set
  // above it.
  const breaches = [];
  for (const [key, budgetKey, floorKey] of [
    ['p50Ms', 'p50BudgetMs', 'p50Floor'],
    ['p95Ms', 'p95BudgetMs', 'p95Floor'],
    ['p99Ms', 'p99BudgetMs', 'p99Floor'],
  ]) {
    const budget = thresholds[budgetKey];
    if (budget == null) continue;
    const measured = latency[key];
    if (measured == null) {
      breaches.push({ percentile: key, budgetMs: budget, measuredMs: null, reason: 'unmeasured' });
      continue;
    }
    if (latency[floorKey] === true) {
      breaches.push({ percentile: key, budgetMs: budget, measuredMs: measured, reason: 'overflow_floor' });
      continue;
    }
    if (measured > budget) {
      breaches.push({ percentile: key, budgetMs: budget, measuredMs: measured, reason: 'over_budget' });
    }
  }
  if (breaches.length > 0) {
    return { verdict: 'degraded', reason: 'latency_over_budget', errorRate, breaches };
  }

  return { verdict: 'ok', reason: 'within_budgets', errorRate, breaches: [] };
}

/** Map a verdict string to its exit code (ok 0, degraded 1, anything else 2). */
export function verdictExitCode(verdict) {
  if (verdict === 'ok') return EXIT_OK;
  if (verdict === 'degraded') return EXIT_DEGRADED;
  return EXIT_FAIL;
}

/** A finite number, else the fallback. Rejects NaN/Infinity/non-number config. */
export function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
