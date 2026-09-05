/**
 * Bounded-memory latency statistics for the load harness (Plan 44 WP-7B). No
 * dependencies beyond the Node standard library: this runs in the same slim
 * container the relay does, and a stats/histogram library would only widen the
 * supply chain Phase 4 hardened.
 *
 * The load harness measures per-operation round-trip latency at a configured rate
 * for a configured duration. At 10x-forecast traffic that is millions of samples,
 * so we MUST NOT keep an array of every sample and sort it at the end (unbounded
 * heap, and a soak that OOMs the harness proves nothing about the relay). Two
 * bounded estimators, both fixed-memory regardless of sample count:
 *
 *   1. HistogramLatency  - the DEFAULT. A fixed set of exponential (base-2 sub-
 *      bucketed) boundaries in milliseconds. Every sample increments exactly one
 *      bucket counter; memory is the bucket count (a few hundred numbers), never
 *      the sample count. Percentiles are read by walking the cumulative counts.
 *      The reported value is the bucket's UPPER bound, so the estimate is a
 *      conservative (never-optimistic) upper bound on the true percentile: a load
 *      gate must not under-report tail latency.
 *
 *   2. ReservoirLatency  - an OPTIONAL exact-within-reservoir cross-check. A
 *      fixed-size uniform (Vitter Algorithm R) reservoir sample; percentiles are
 *      exact over the retained sample. Used by the unit tests to bound the
 *      histogram's error against a known distribution, and available via
 *      --estimator reservoir for an operator who wants the reservoir instead.
 *
 * Both expose the SAME interface: record(ms), count, percentile(q in [0,1]),
 * min, max, mean. A percentile of an empty estimator is null (never 0): zero
 * samples is an honest "unknown", and the verdict layer treats zero completed
 * operations as a hard fail, never a vacuous p95 of 0.
 */

/**
 * Build the histogram bucket UPPER boundaries (ms), ascending. Exponential decade
 * coverage from sub-millisecond to ~5 minutes with linear sub-buckets inside each
 * power-of-two band, so resolution stays fine where relay latencies live (single-
 * to double-digit ms) while still bounding a pathological multi-second tail. A
 * terminal +Infinity bucket catches anything above the top finite bound so a
 * runaway sample is counted (in the overflow bucket), never dropped.
 */
export function buildLatencyBoundaries() {
  const boundaries = [];
  // 32 sub-buckets per power-of-two band keeps relative error small (~2%) across
  // the whole range while the band exponent bounds total bucket count.
  const SUB = 32;
  // 2^-2 ms (0.25ms) up to 2^18 ms (~262s ~= 4.4min): 20 bands * 32 = 640 buckets.
  for (let exp = -2; exp < 18; exp += 1) {
    const lo = 2 ** exp;
    const hi = 2 ** (exp + 1);
    const step = (hi - lo) / SUB;
    for (let i = 1; i <= SUB; i += 1) {
      boundaries.push(lo + step * i);
    }
  }
  return boundaries;
}

const SHARED_BOUNDARIES = buildLatencyBoundaries();

/**
 * Fixed-memory histogram latency estimator. Memory is O(bucketCount), independent
 * of the number of samples recorded.
 */
export class HistogramLatency {
  constructor(boundaries = SHARED_BOUNDARIES) {
    this.boundaries = boundaries;
    // One counter per finite boundary plus one terminal overflow bucket.
    this.counts = new Array(boundaries.length + 1).fill(0);
    this.n = 0;
    this._min = Infinity;
    this._max = -Infinity;
    this._sum = 0;
  }

  record(ms) {
    if (!Number.isFinite(ms) || ms < 0) return; // a non-finite/negative sample is not a latency
    this.n += 1;
    this._sum += ms;
    if (ms < this._min) this._min = ms;
    if (ms > this._max) this._max = ms;
    // Binary search for the first boundary >= ms; that bucket owns the sample.
    let lo = 0;
    let hi = this.boundaries.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.boundaries[mid] < ms) lo = mid + 1;
      else hi = mid;
    }
    this.counts[lo] += 1;
  }

  get count() {
    return this.n;
  }

  get min() {
    return this.n === 0 ? null : this._min;
  }

  get max() {
    return this.n === 0 ? null : this._max;
  }

  get mean() {
    return this.n === 0 ? null : this._sum / this.n;
  }

  /**
   * The q-quantile (q in [0,1]) as the UPPER bound of the bucket that contains the
   * rank-th sample. Returns null on zero samples (honest unknown) and on an
   * out-of-range q. The overflow bucket reports the top finite boundary as a
   * floor label with no false precision above it.
   */
  percentile(q) {
    if (this.n === 0) return null;
    if (!(q >= 0 && q <= 1)) return null;
    // Rank uses ceil(q*n) clamped to [1,n]: p100 -> the max bucket, p0 -> the min.
    const target = Math.min(this.n, Math.max(1, Math.ceil(q * this.n)));
    let cumulative = 0;
    for (let i = 0; i < this.counts.length; i += 1) {
      cumulative += this.counts[i];
      if (cumulative >= target) {
        // The finite buckets report their upper boundary; the terminal overflow
        // bucket reports the top finite boundary (a floor: "at least this").
        return i < this.boundaries.length ? this.boundaries[i] : this.boundaries[this.boundaries.length - 1];
      }
    }
    return this._max;
  }

  /**
   * True when the q-quantile lands in the terminal overflow bucket, so the value
   * reported by percentile(q) is a FLOOR (the real quantile is at least the top
   * finite boundary and cannot be bounded above). A verdict must never trust a
   * floor label against a latency budget set above it.
   */
  percentileIsOverflow(q) {
    if (this.n === 0 || !(q >= 0 && q <= 1)) return false;
    const target = Math.min(this.n, Math.max(1, Math.ceil(q * this.n)));
    let cumulative = 0;
    for (let i = 0; i < this.counts.length; i += 1) {
      cumulative += this.counts[i];
      if (cumulative >= target) return i >= this.boundaries.length;
    }
    return false;
  }
}

/**
 * Fixed-size reservoir latency estimator (Vitter Algorithm R). Percentiles are
 * exact over the retained uniform sample; memory is O(reservoirSize). Used mainly
 * to bound the histogram error in tests and offered as an alternate estimator.
 */
export class ReservoirLatency {
  constructor(size = 4096, rng = Math.random) {
    this.size = Math.max(1, Math.floor(size));
    this.rng = rng;
    this.sample = [];
    this.n = 0;
    this._min = Infinity;
    this._max = -Infinity;
    this._sum = 0;
  }

  record(ms) {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.n += 1;
    this._sum += ms;
    if (ms < this._min) this._min = ms;
    if (ms > this._max) this._max = ms;
    if (this.sample.length < this.size) {
      this.sample.push(ms);
      return;
    }
    // Replace an existing slot with probability size/n (Algorithm R).
    const j = Math.floor(this.rng() * this.n);
    if (j < this.size) this.sample[j] = ms;
  }

  get count() {
    return this.n;
  }

  get min() {
    return this.n === 0 ? null : this._min;
  }

  get max() {
    return this.n === 0 ? null : this._max;
  }

  get mean() {
    return this.n === 0 ? null : this._sum / this.n;
  }

  percentile(q) {
    if (this.n === 0 || this.sample.length === 0) return null;
    if (!(q >= 0 && q <= 1)) return null;
    const sorted = [...this.sample].sort((a, b) => a - b);
    const rank = Math.min(sorted.length, Math.max(1, Math.ceil(q * sorted.length)));
    return sorted[rank - 1];
  }
}

/** Build the configured estimator by name. Unknown names fall back to histogram. */
export function makeLatencyEstimator(kind, reservoirSize) {
  if (kind === 'reservoir') return new ReservoirLatency(reservoirSize);
  return new HistogramLatency();
}

/**
 * Summarize an estimator into the numeric fields every load verdict reports. All
 * are null on zero samples (honest unknown), rounded to 3 decimals otherwise.
 */
export function summarizeLatency(est) {
  const round = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
  // An estimator with no overflow concept (the exact reservoir) reports no floors.
  const isFloor = (q) =>
    typeof est.percentileIsOverflow === 'function' ? est.percentileIsOverflow(q) : false;
  return {
    samples: est.count,
    minMs: round(est.min),
    p50Ms: round(est.percentile(0.5)),
    p95Ms: round(est.percentile(0.95)),
    p99Ms: round(est.percentile(0.99)),
    maxMs: round(est.max),
    meanMs: round(est.mean),
    // Per-percentile FLOOR flags: the reported value is a lower bound (overflow
    // bucket), so a verdict treats it as a breach against any configured budget.
    p50Floor: isFloor(0.5),
    p95Floor: isFloor(0.95),
    p99Floor: isFloor(0.99),
  };
}
