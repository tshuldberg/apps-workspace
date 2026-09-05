/**
 * Pure soak evaluators (Plan 44 WP-7B). Std-lib only; exported for unit tests.
 *
 * A soak run drives the load harness at a low background rate for a long duration
 * while sampling, at a fixed interval: the runner's own RSS/heap, each target's
 * private /metrics endpoint (a minimal Prometheus text parse), and each target's
 * /healthz or /readyz liveness. The verdict is decided by GROWTH THRESHOLDS,
 * fail-closed at every ambiguous edge, because a leak or a runaway queue only shows
 * up as a TREND over hours, not as a single bad sample:
 *
 *   - rssGrowthPct / heapGrowthPct : the process's own memory growth from a
 *     baseline window to a final window. Over the ceiling = fail (a harness or
 *     target that leaks under sustained load must not pass a soak).
 *   - errorRate : the aggregate load error rate over the whole soak. At/above the
 *     ceiling = fail.
 *   - per-metric growth ceilings : an operator names a metric (e.g. a queue-depth
 *     gauge) and a max growth percent; exceeding it = fail. This is how a queue
 *     that never drains is caught.
 *   - staleness : a target that STOPS answering /metrics or liveness mid-soak is a
 *     fail (a dead metric source is not a healthy one; a soak that lost its signal
 *     proves nothing).
 *
 * ZERO samples is a hard fail (never a vacuous pass): a soak that collected nothing
 * verified nothing. An unknown/malformed sample never lifts the verdict.
 */

/**
 * Parse Prometheus text exposition minimally: `name{labels} value` and `name value`
 * lines, skipping `# HELP`/`# TYPE`/blank lines. Returns a map of metric name -> the
 * SUM of its sample values (labels collapsed), which is the right aggregate for a
 * growth check on a counter or a summed gauge. Malformed value lines are skipped
 * (not thrown): a scrape with one bad line still yields the rest. PURE.
 */
export function parsePrometheusText(text) {
  const out = new Map();
  if (typeof text !== 'string') return out;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    // Split the metric identifier (name + optional {labels}) from the value.
    const lastSpace = line.lastIndexOf(' ');
    if (lastSpace === -1) continue;
    const idPart = line.slice(0, lastSpace);
    const valuePart = line.slice(lastSpace + 1).trim();
    const value = Number(valuePart);
    if (!Number.isFinite(value)) continue;
    const brace = idPart.indexOf('{');
    const name = (brace === -1 ? idPart : idPart.slice(0, brace)).trim();
    if (!name) continue;
    out.set(name, (out.get(name) ?? 0) + value);
  }
  return out;
}

/**
 * Percent growth from a baseline to a final value. A zero (or negative) baseline is
 * handled honestly: any positive final over a zero baseline is +Infinity growth
 * (unbounded relative growth), which a ceiling check treats as a breach; final <=
 * baseline is 0 (no growth). Returns a finite percent otherwise. PURE.
 */
export function growthPct(baseline, final) {
  const b = Number(baseline);
  const f = Number(final);
  if (!Number.isFinite(b) || !Number.isFinite(f)) return null;
  if (b <= 0) return f > 0 ? Infinity : 0;
  if (f <= b) return 0;
  return ((f - b) / b) * 100;
}

/**
 * The baseline value is the MEAN of the first `window` samples; the final value is
 * the MEAN of the last `window` samples. Averaging a small window instead of taking
 * single endpoints keeps a lone GC dip or spike from faking (or hiding) a trend.
 * Returns null when there are too few samples to form both windows. PURE.
 */
export function windowedGrowthPct(values, window = 3) {
  if (!Array.isArray(values)) return null;
  const nums = values.filter((v) => Number.isFinite(v));
  const w = Math.max(1, Math.floor(window));
  if (nums.length < w * 2) return null;
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const baseline = mean(nums.slice(0, w));
  const final = mean(nums.slice(-w));
  return growthPct(baseline, final);
}

/**
 * Aggregate all soak samples into ONE verdict. PURE and exported for tests. Input:
 *   samples      array of per-interval samples, each:
 *                { rssBytes, heapUsedBytes, metrics: Map|object, live: boolean,
 *                  loadAttempted, loadCompleted, loadErrors }
 *   thresholds   { rssGrowthPctCeiling, heapGrowthPctCeiling, errorRateCeiling,
 *                  metricGrowthCeilings: [{ name, maxGrowthPct }],
 *                  window, requireLiveness }
 * Returns { verdict:'ok'|'degraded'|'fail', reason, breaches, computed }.
 *
 * Fail-closed order: zero samples -> fail; any staleness (a sample where the target
 * stopped answering) -> fail; rss/heap/metric growth over ceiling -> fail; error
 * rate over ceiling -> fail; else ok. There is no 'degraded' soak verdict by
 * default: a soak is a binary "held steady / did not", and a soft-pass would be the
 * vacuous outcome this gate exists to prevent. (A caller may still map exit codes.)
 */
export function aggregateSoak(input) {
  const samples = Array.isArray(input?.samples) ? input.samples : [];
  const thresholds = input?.thresholds ?? {};
  const window = Math.max(1, Math.floor(numberOr(thresholds.window, 3)));
  const requireLiveness = thresholds.requireLiveness !== false; // default ON

  if (samples.length === 0) {
    return { verdict: 'fail', reason: 'no_samples', breaches: [], computed: {} };
  }

  const breaches = [];

  // Staleness: any sample that recorded the target as not-live is a lost signal.
  // A soak whose target went dark mid-run is a hard fail regardless of memory.
  if (requireLiveness) {
    const deadSamples = samples.filter((s) => s.live === false).length;
    if (deadSamples > 0) {
      breaches.push({ kind: 'staleness', deadSamples });
    }
  }

  // RSS + heap growth over the run.
  const rssSeries = samples.map((s) => Number(s.rssBytes)).filter(Number.isFinite);
  const heapSeries = samples.map((s) => Number(s.heapUsedBytes)).filter(Number.isFinite);
  const rssGrowth = windowedGrowthPct(rssSeries, window);
  const heapGrowth = windowedGrowthPct(heapSeries, window);
  const rssCeiling = numberOr(thresholds.rssGrowthPctCeiling, 25);
  const heapCeiling = numberOr(thresholds.heapGrowthPctCeiling, 25);
  // FAIL-CLOSED on too-few samples: a soak that cannot compute memory growth has
  // not proven memory held steady. null growth here (fewer than window*2 finite
  // samples) is a breach, exactly like the per-metric metric_missing path below -
  // otherwise a 5-sample soak with an 800% RSS ramp would pass as held_steady.
  if (rssGrowth === null) {
    breaches.push({ kind: 'insufficient_samples', series: 'rss', seen: rssSeries.length, needed: window * 2 });
  } else if (rssGrowth > rssCeiling) {
    breaches.push({ kind: 'rss_growth', growthPct: rssGrowth, ceiling: rssCeiling });
  }
  if (heapGrowth === null) {
    breaches.push({ kind: 'insufficient_samples', series: 'heap', seen: heapSeries.length, needed: window * 2 });
  } else if (heapGrowth > heapCeiling) {
    breaches.push({ kind: 'heap_growth', growthPct: heapGrowth, ceiling: heapCeiling });
  }

  // Per-metric growth ceilings.
  const metricGrowth = {};
  const ceilings = Array.isArray(thresholds.metricGrowthCeilings) ? thresholds.metricGrowthCeilings : [];
  for (const spec of ceilings) {
    if (!spec || typeof spec.name !== 'string') continue;
    const series = samples.map((s) => readMetric(s.metrics, spec.name)).filter((v) => v !== null);
    if (series.length < window * 2) {
      // A metric ceiling was configured but the metric was never (or rarely) seen:
      // fail-closed. An operator who asked us to watch a queue depth must not get a
      // silent pass because the metric was absent.
      breaches.push({ kind: 'metric_missing', name: spec.name, seen: series.length });
      continue;
    }
    const g = windowedGrowthPct(series, window);
    metricGrowth[spec.name] = g;
    const cap = numberOr(spec.maxGrowthPct, 0);
    if (g !== null && g > cap) {
      breaches.push({ kind: 'metric_growth', name: spec.name, growthPct: g, ceiling: cap });
    }
  }

  // Aggregate load error rate across the whole soak.
  const attempted = samples.reduce((a, s) => a + numberOr(s.loadAttempted, 0), 0);
  const completed = samples.reduce((a, s) => a + numberOr(s.loadCompleted, 0), 0);
  const errors = samples.reduce((a, s) => a + numberOr(s.loadErrors, 0), 0);
  const denom = Math.max(attempted, completed + errors, 1);
  const errorRate = errors / denom;
  const errorCeiling = numberOr(thresholds.errorRateCeiling, 0.01);
  if (attempted > 0 && errorRate >= errorCeiling) {
    breaches.push({ kind: 'error_rate', errorRate, ceiling: errorCeiling });
  }

  const computed = {
    samples: samples.length,
    rssGrowthPct: rssGrowth,
    heapGrowthPct: heapGrowth,
    metricGrowthPct: metricGrowth,
    errorRate,
    attempted,
    completed,
    errors,
  };

  if (breaches.length > 0) {
    return { verdict: 'fail', reason: breaches[0].kind, breaches, computed };
  }
  return { verdict: 'ok', reason: 'held_steady', breaches: [], computed };
}

/** Read a metric value from a Map or plain object of name->value. Null when absent. */
export function readMetric(metrics, name) {
  if (!metrics) return null;
  if (metrics instanceof Map) return metrics.has(name) ? Number(metrics.get(name)) : null;
  if (typeof metrics === 'object' && name in metrics) {
    const v = Number(metrics[name]);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

/** Map a soak verdict to an exit code (ok 0, anything else 2). No soft-pass. */
export function soakExitCode(verdict) {
  return verdict === 'ok' ? 0 : 2;
}

/** A finite number, else the fallback. */
export function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
