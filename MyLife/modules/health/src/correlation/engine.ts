/**
 * Cross-domain correlation engine.
 * Computes Pearson correlation between any two health time series.
 * Pure functions, no side effects.
 *
 * Use cases:
 *   - "How does fasting affect my sleep quality?"
 *   - "Does my readiness score correlate with medication adherence?"
 *   - "Is there a relationship between meditation and mood?"
 *
 * Aligns time series by date, computes Pearson r, and provides
 * human-readable interpretation with significance testing.
 */

export interface TimeSeriesPoint {
  date: string;
  value: number;
}

export type CorrelationStrength = 'strong' | 'moderate' | 'weak' | 'none';
export type CorrelationDirection = 'positive' | 'negative' | 'none';

export interface CorrelationResult {
  coefficient: number;
  strength: CorrelationStrength;
  direction: CorrelationDirection;
  sampleSize: number;
  significance: 'significant' | 'not_significant';
  interpretation: string;
}

export interface CorrelationPair {
  domainA: string;
  domainB: string;
  result: CorrelationResult;
}

const MIN_SAMPLE_SIZE = 7;

/**
 * Align two time series by date, returning only dates present in both.
 */
export function alignSeries(
  a: TimeSeriesPoint[],
  b: TimeSeriesPoint[],
): { alignedA: number[]; alignedB: number[] } {
  const mapB = new Map<string, number>();
  for (const point of b) {
    mapB.set(point.date, point.value);
  }

  const alignedA: number[] = [];
  const alignedB: number[] = [];
  for (const point of a) {
    const bValue = mapB.get(point.date);
    if (bValue !== undefined) {
      alignedA.push(point.value);
      alignedB.push(bValue);
    }
  }

  return { alignedA, alignedB };
}

/**
 * Compute Pearson correlation coefficient between two aligned arrays.
 * Returns 0 if arrays are too short or have zero variance.
 */
export function pearson(x: number[], y: number[]): number {
  const n = x.length;
  if (n < MIN_SAMPLE_SIZE) return 0;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

/**
 * Approximate significance using t-test for Pearson correlation.
 * Returns true if p < 0.05 (two-tailed).
 */
export function isSignificant(r: number, n: number): boolean {
  if (n < MIN_SAMPLE_SIZE) return false;
  if (Math.abs(r) >= 1) return n >= MIN_SAMPLE_SIZE;
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  // Approximate critical t-value for p=0.05 two-tailed with df = n-2
  // For df >= 5: t_crit ~ 2.57 (df=5), 2.23 (df=10), 2.09 (df=20), 1.98 (df=100)
  // Simple approximation: t_crit ~ 2.0 + 3.0 / (n - 2)
  const df = n - 2;
  const tCrit = df >= 30 ? 2.0 : 2.0 + 3.0 / df;
  return Math.abs(t) > tCrit;
}

export function classifyStrength(r: number): CorrelationStrength {
  const abs = Math.abs(r);
  if (abs >= 0.7) return 'strong';
  if (abs >= 0.4) return 'moderate';
  if (abs >= 0.2) return 'weak';
  return 'none';
}

export function classifyDirection(r: number): CorrelationDirection {
  if (Math.abs(r) < 0.2) return 'none';
  return r > 0 ? 'positive' : 'negative';
}

export function interpretCorrelation(
  domainA: string,
  domainB: string,
  r: number,
  significant: boolean,
): string {
  const strength = classifyStrength(r);
  const direction = classifyDirection(r);

  if (strength === 'none' || !significant) {
    return `No meaningful correlation found between ${domainA} and ${domainB}.`;
  }

  const dirLabel = direction === 'positive'
    ? 'tends to increase with'
    : 'tends to decrease as';

  return `${strength.charAt(0).toUpperCase() + strength.slice(1)} ${direction} correlation: ${domainA} ${dirLabel} ${domainB} (r = ${r.toFixed(2)}).`;
}

/**
 * Compute cross-domain correlation between two health time series.
 */
export function correlate(
  seriesA: TimeSeriesPoint[],
  seriesB: TimeSeriesPoint[],
  domainA = 'Series A',
  domainB = 'Series B',
): CorrelationResult {
  const { alignedA, alignedB } = alignSeries(seriesA, seriesB);
  const n = alignedA.length;

  if (n < MIN_SAMPLE_SIZE) {
    return {
      coefficient: 0,
      strength: 'none',
      direction: 'none',
      sampleSize: n,
      significance: 'not_significant',
      interpretation: `Insufficient data: need at least ${MIN_SAMPLE_SIZE} overlapping days, found ${n}.`,
    };
  }

  const r = Math.round(pearson(alignedA, alignedB) * 100) / 100;
  const significant = isSignificant(r, n);

  return {
    coefficient: r,
    strength: classifyStrength(r),
    direction: classifyDirection(r),
    sampleSize: n,
    significance: significant ? 'significant' : 'not_significant',
    interpretation: interpretCorrelation(domainA, domainB, r, significant),
  };
}

/**
 * Run correlations across multiple domain pairs.
 */
export function correlateAll(
  domains: { name: string; series: TimeSeriesPoint[] }[],
): CorrelationPair[] {
  const results: CorrelationPair[] = [];
  for (let i = 0; i < domains.length; i++) {
    for (let j = i + 1; j < domains.length; j++) {
      const result = correlate(
        domains[i].series,
        domains[j].series,
        domains[i].name,
        domains[j].name,
      );
      // Only include meaningful correlations
      if (result.strength !== 'none' && result.significance === 'significant') {
        results.push({
          domainA: domains[i].name,
          domainB: domains[j].name,
          result,
        });
      }
    }
  }
  // Sort by absolute correlation strength descending
  results.sort((a, b) => Math.abs(b.result.coefficient) - Math.abs(a.result.coefficient));
  return results;
}
