import type { Prediction, PredictionCategory } from '../types';

/**
 * Prediction accuracy engine -- pure, input-is-output.
 *
 * Callers fetch rows via `listPredictions` and hand them in. The engine
 * groups by category and by (season, category) and returns a report
 * suitable for a stats dashboard. No SQL, no Date.now(), no I/O.
 */

export interface AccuracyBreakdown {
  category: PredictionCategory;
  settled: number;
  correct: number;
  /** correct / settled * 100; null when no rows are settled in this slice. */
  accuracyPct: number | null;
}

export interface SeasonAccuracyRow {
  season: string;
  breakdowns: AccuracyBreakdown[];
}

export interface PredictionAccuracyReport {
  /**
   * Aggregate across all settled rows. `category` carries no meaning at
   * the overall level and is always `'custom'` as a placeholder. Null
   * when no settled rows exist.
   */
  overall: AccuracyBreakdown | null;
  /** Per-category breakdowns, sorted alphabetically by category. */
  byCategory: AccuracyBreakdown[];
  /**
   * Per-season, per-category breakdowns. Seasons sorted descending
   * (lexicographic -- '2026' > '2025-26' > '2024-25'); categories within
   * each season sorted alphabetically.
   */
  bySeasonByCategory: SeasonAccuracyRow[];
}

function buildBreakdown(
  category: PredictionCategory,
  settledRows: readonly Prediction[],
): AccuracyBreakdown {
  const settled = settledRows.length;
  const correct = settledRows.filter((p) => p.was_correct === true).length;
  const accuracyPct =
    settled === 0 ? null : Math.round((correct / settled) * 10000) / 100;
  return { category, settled, correct, accuracyPct };
}

function groupByCategory(
  rows: readonly Prediction[],
): Map<PredictionCategory, Prediction[]> {
  const out = new Map<PredictionCategory, Prediction[]>();
  for (const row of rows) {
    const bucket = out.get(row.category);
    if (bucket) bucket.push(row);
    else out.set(row.category, [row]);
  }
  return out;
}

function sortedCategoryKeys(
  keys: Iterable<PredictionCategory>,
): PredictionCategory[] {
  return [...keys].sort((a, b) => a.localeCompare(b));
}

export function computePredictionAccuracy(
  predictions: readonly Prediction[],
): PredictionAccuracyReport {
  const settledOnly = predictions.filter((p) => p.was_correct !== null);

  // Overall
  const overallSettled = settledOnly.length;
  const overallCorrect = settledOnly.filter(
    (p) => p.was_correct === true,
  ).length;
  const overall: AccuracyBreakdown | null =
    overallSettled === 0
      ? null
      : {
          category: 'custom',
          settled: overallSettled,
          correct: overallCorrect,
          accuracyPct:
            Math.round((overallCorrect / overallSettled) * 10000) / 100,
        };

  // By category (alphabetical)
  const byCatGroups = groupByCategory(settledOnly);
  const byCategory: AccuracyBreakdown[] = sortedCategoryKeys(
    byCatGroups.keys(),
  ).map((cat) => buildBreakdown(cat, byCatGroups.get(cat) ?? []));

  // By season (desc), then by category (alpha)
  const bySeason = new Map<string, Prediction[]>();
  for (const row of settledOnly) {
    const bucket = bySeason.get(row.season);
    if (bucket) bucket.push(row);
    else bySeason.set(row.season, [row]);
  }
  const bySeasonByCategory: SeasonAccuracyRow[] = [...bySeason.keys()]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((season) => {
      const rows = bySeason.get(season) ?? [];
      const inner = groupByCategory(rows);
      const breakdowns = sortedCategoryKeys(inner.keys()).map((cat) =>
        buildBreakdown(cat, inner.get(cat) ?? []),
      );
      return { season, breakdowns };
    });

  return {
    overall,
    byCategory,
    bySeasonByCategory,
  };
}
