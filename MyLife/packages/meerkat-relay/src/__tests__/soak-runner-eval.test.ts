/**
 * Drives the soak runner's pure evaluators (scripts/soak/lib/soak-eval.mjs, Plan 44
 * WP-7B).
 *
 * The honesty assertions: a soak is a binary held-steady/failed decision, fail-
 * closed at every edge. Zero samples is a hard FAIL; a lost signal (a stale metric
 * scrape or a dead liveness probe) is a FAIL; rss/heap/per-metric growth over the
 * configured ceiling is a FAIL; a configured metric that was never seen is a FAIL
 * (never a silent pass). We also prove the minimal Prometheus text parse and the
 * zero-baseline growth math.
 */
import { describe, expect, it } from 'vitest';
import {
  parsePrometheusText,
  growthPct,
  windowedGrowthPct,
  aggregateSoak,
  soakExitCode,
  // @ts-expect-error -- importing the .mjs harness lib for its exported pure helpers.
} from '../../scripts/soak/lib/soak-eval.mjs';

describe('parsePrometheusText (minimal exposition parse)', () => {
  it('parses name{labels} value and name value, skipping HELP/TYPE/blank', () => {
    const text = [
      '# HELP meerkat_relay_connections current connections',
      '# TYPE meerkat_relay_connections gauge',
      'meerkat_relay_connections{service="relay"} 42',
      'meerkat_queue_depth 7',
      '',
      'meerkat_requests_total{service="persona",outcome="ok"} 100',
      'meerkat_requests_total{service="persona",outcome="err"} 5',
    ].join('\n');
    const m = parsePrometheusText(text);
    expect(m.get('meerkat_relay_connections')).toBe(42);
    expect(m.get('meerkat_queue_depth')).toBe(7);
    // Labelled samples of the same metric name collapse to their SUM.
    expect(m.get('meerkat_requests_total')).toBe(105);
  });

  it('skips malformed value lines rather than throwing', () => {
    const m = parsePrometheusText('good 1\nbad_no_value\nother notanumber\nfine 3');
    expect(m.get('good')).toBe(1);
    expect(m.get('fine')).toBe(3);
    expect(m.has('other')).toBe(false);
  });
});

describe('growth math', () => {
  it('treats any positive growth over a zero baseline as unbounded (a breach)', () => {
    expect(growthPct(0, 5)).toBe(Infinity);
    expect(growthPct(0, 0)).toBe(0);
  });

  it('computes finite percent growth and clamps no-growth to 0', () => {
    expect(growthPct(100, 150)).toBeCloseTo(50);
    expect(growthPct(100, 90)).toBe(0);
  });

  it('averages windows so a lone spike does not fake a trend', () => {
    // First window mean 100, last window mean 110 -> 10% growth.
    expect(windowedGrowthPct([100, 100, 100, 110, 110, 110], 3)).toBeCloseTo(10);
    // Too few samples to form both windows -> null.
    expect(windowedGrowthPct([100, 110], 3)).toBeNull();
  });
});

describe('aggregateSoak (fail-closed)', () => {
  const steady = () => Array.from({ length: 8 }, () => ({
    rssBytes: 100_000_000,
    heapUsedBytes: 50_000_000,
    metrics: new Map([['relay:meerkat_queue_depth', 3]]),
    live: true,
    loadAttempted: 100,
    loadCompleted: 100,
    loadErrors: 0,
  }));

  it('fails closed when there are too few samples to compute memory growth (adversarial-review P1)', () => {
    // 5 samples with an 800% RSS ramp, window 3 (needs 6): the growth is
    // uncomputable, and uncomputable must be a breach, never held_steady.
    const samples = [100, 200, 400, 600, 900].map((mb) => ({
      rssBytes: mb * 1024 * 1024,
      heapUsedBytes: mb * 1024 * 1024,
      metrics: {},
      live: true,
      loadAttempted: 10,
      loadCompleted: 10,
      loadErrors: 0,
    }));
    const result = aggregateSoak({
      samples,
      thresholds: { rssGrowthPctCeiling: 25, heapGrowthPctCeiling: 25, window: 3 },
    });
    expect(result.verdict).toBe('fail');
    expect(result.breaches.some((b: { kind: string }) => b.kind === 'insufficient_samples')).toBe(true);
  });

  it('fails hard on zero samples (never a vacuous pass)', () => {
    expect(aggregateSoak({ samples: [], thresholds: {} })).toMatchObject({ verdict: 'fail', reason: 'no_samples' });
  });

  it('passes a steady run within all ceilings', () => {
    expect(aggregateSoak({ samples: steady(), thresholds: { rssGrowthPctCeiling: 25, heapGrowthPctCeiling: 25 } })).toMatchObject({
      verdict: 'ok',
      reason: 'held_steady',
    });
  });

  it('fails on RSS growth over the ceiling', () => {
    const samples = steady();
    // Ramp RSS from 100MB to 200MB over the run (100% growth).
    for (let i = 0; i < samples.length; i += 1) samples[i].rssBytes = 100_000_000 + i * 14_000_000;
    expect(aggregateSoak({ samples, thresholds: { rssGrowthPctCeiling: 25 } })).toMatchObject({ verdict: 'fail', reason: 'rss_growth' });
  });

  it('fails on a dead liveness sample (a lost signal is not health)', () => {
    const samples = steady();
    samples[4].live = false;
    expect(aggregateSoak({ samples, thresholds: {} })).toMatchObject({ verdict: 'fail', reason: 'staleness' });
  });

  it('fails on a watched-metric growth over its ceiling', () => {
    const samples = steady();
    for (let i = 0; i < samples.length; i += 1) {
      samples[i].metrics = new Map([['relay:meerkat_queue_depth', 3 + i * 10]]); // queue never drains
    }
    const r = aggregateSoak({
      samples,
      thresholds: { metricGrowthCeilings: [{ name: 'relay:meerkat_queue_depth', maxGrowthPct: 50 }] },
    });
    expect(r).toMatchObject({ verdict: 'fail', reason: 'metric_growth' });
  });

  it('fails closed when a configured watched metric was never seen', () => {
    const r = aggregateSoak({
      samples: steady(),
      thresholds: { metricGrowthCeilings: [{ name: 'relay:nonexistent_metric', maxGrowthPct: 10 }] },
    });
    expect(r).toMatchObject({ verdict: 'fail', reason: 'metric_missing' });
  });

  it('fails on an aggregate error rate at/above the ceiling', () => {
    const samples = steady();
    for (const s of samples) s.loadErrors = 5; // 5% error rate
    expect(aggregateSoak({ samples, thresholds: { errorRateCeiling: 0.01 } })).toMatchObject({ verdict: 'fail', reason: 'error_rate' });
  });

  it('maps the soak verdict to an exit code with no soft pass', () => {
    expect(soakExitCode('ok')).toBe(0);
    expect(soakExitCode('fail')).toBe(2);
    expect(soakExitCode('anything-else')).toBe(2);
  });
});
