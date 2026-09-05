/**
 * Drives the load harness's bounded-memory latency estimators (scripts/load/lib/
 * stats.mjs, Plan 44 WP-7B).
 *
 * The critical property: percentiles are estimated in FIXED memory (a histogram of
 * a few hundred buckets, or a fixed reservoir), never by keeping every sample. We
 * prove the histogram's estimate is a conservative upper bound close to the true
 * percentile on a known distribution, that empty estimators return null (an honest
 * unknown, never a vacuous p95 of 0), and that memory does not grow with sample
 * count.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- importing the .mjs harness lib for its exported pure helpers.
import { HistogramLatency, ReservoirLatency, buildLatencyBoundaries, summarizeLatency } from '../../scripts/load/lib/stats.mjs';

/** The exact percentile of a sorted numeric array (ceil-rank, matching the impl). */
function exactPercentile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil(q * sorted.length)));
  return sorted[rank - 1]!;
}

describe('HistogramLatency (bounded memory)', () => {
  it('returns null for every percentile/min/max on zero samples (honest unknown)', () => {
    const h = new HistogramLatency();
    expect(h.count).toBe(0);
    expect(h.percentile(0.5)).toBeNull();
    expect(h.percentile(0.95)).toBeNull();
    expect(h.min).toBeNull();
    expect(h.max).toBeNull();
    expect(h.mean).toBeNull();
  });

  it('estimates percentiles within a few percent of exact on a known distribution', () => {
    const h = new HistogramLatency();
    const values: number[] = [];
    // A skewed distribution: most samples 5-15ms, a tail out to ~400ms.
    for (let i = 0; i < 100_000; i += 1) {
      const v = i % 50 === 0 ? 100 + (i % 300) : 5 + (i % 10);
      values.push(v);
      h.record(v);
    }
    for (const q of [0.5, 0.95, 0.99]) {
      const exact = exactPercentile(values, q);
      const est = h.percentile(q)!;
      // The histogram reports the bucket UPPER bound, so it is >= exact and within
      // the bucket's relative width (~3%) of it. Conservative, never optimistic.
      expect(est).toBeGreaterThanOrEqual(exact);
      expect(est).toBeLessThan(exact * 1.06 + 1);
    }
  });

  it('keeps fixed memory regardless of sample count (bucket count is constant)', () => {
    const boundaries = buildLatencyBoundaries();
    const h = new HistogramLatency();
    for (let i = 0; i < 500_000; i += 1) h.record((i % 200) + 1);
    // The internal counts array is exactly boundaries.length + 1, independent of
    // the half-million samples recorded.
    expect(h.counts.length).toBe(boundaries.length + 1);
  });

  it('counts a runaway sample in the overflow bucket rather than dropping it', () => {
    const h = new HistogramLatency();
    h.record(10);
    h.record(10_000_000); // far above the top finite boundary
    expect(h.count).toBe(2);
    expect(h.max).toBe(10_000_000);
    // p100 falls in the overflow bucket, reported as the top finite boundary floor.
    expect(h.percentile(1)).toBeGreaterThan(0);
    // ...and is flagged as a floor so a verdict never trusts it against a budget.
    expect(h.percentileIsOverflow(1)).toBe(true);
    expect(h.percentileIsOverflow(0)).toBe(false);
  });

  it('flags every percentile as a floor when all samples overflow the top bucket', () => {
    const h = new HistogramLatency();
    for (let i = 0; i < 100; i += 1) h.record(600_000); // ~10 min, above the top bound
    const summary = summarizeLatency(h);
    expect(summary.p99Floor).toBe(true);
    expect(summary.p95Floor).toBe(true);
    // maxMs is tracked exactly and exceeds the reported floor percentiles.
    expect(summary.maxMs).toBe(600_000);
    expect(summary.p99Ms).toBeLessThan(summary.maxMs);
  });

  it('ignores non-finite and negative samples (not latencies)', () => {
    const h = new HistogramLatency();
    h.record(Number.NaN);
    h.record(-5);
    h.record(Infinity);
    expect(h.count).toBe(0);
  });
});

describe('ReservoirLatency (fixed reservoir, exact within sample)', () => {
  it('is exact when all samples fit in the reservoir', () => {
    const r = new ReservoirLatency(1000);
    const values: number[] = [];
    for (let i = 1; i <= 500; i += 1) {
      values.push(i);
      r.record(i);
    }
    expect(r.percentile(0.5)).toBe(exactPercentile(values, 0.5));
    expect(r.percentile(0.99)).toBe(exactPercentile(values, 0.99));
  });

  it('caps memory at the reservoir size even with far more samples', () => {
    const r = new ReservoirLatency(256);
    for (let i = 0; i < 100_000; i += 1) r.record(i % 500);
    expect(r.sample.length).toBe(256);
    expect(r.count).toBe(100_000);
  });

  it('returns null percentiles on an empty reservoir', () => {
    expect(new ReservoirLatency(16).percentile(0.9)).toBeNull();
  });
});

describe('summarizeLatency', () => {
  it('nulls every field on zero samples (never a vacuous 0)', () => {
    expect(summarizeLatency(new HistogramLatency())).toEqual({
      samples: 0,
      minMs: null,
      p50Ms: null,
      p95Ms: null,
      p99Ms: null,
      maxMs: null,
      meanMs: null,
      p50Floor: false,
      p95Floor: false,
      p99Floor: false,
    });
  });
});
