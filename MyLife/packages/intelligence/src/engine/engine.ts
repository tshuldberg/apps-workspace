/**
 * Cross-module AI query engine.
 *
 * Powers cross-module insights using on-device statistical analytics.
 * All queries respect AI permissions: unpermitted modules are invisible.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleDefinition } from '@mylife/module-registry';
import type { CorrelationDataPoint, CorrelationSeries } from '@mylife/module-registry';
import { getPermittedModules } from '../permissions/operations';
import type {
  CorrelationResult,
  TrendResult,
  SummaryResult,
  InsightCard,
} from './types';
import { MIN_CORRELATION_POINTS, CORRELATION_THRESHOLD } from './types';

/**
 * Filter modules to only those the AI is permitted to access.
 */
function filterPermitted(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
): ModuleDefinition[] {
  const permitted = new Set(getPermittedModules(db));
  return modules.filter((m) => permitted.has(m.id));
}

/**
 * Compute Pearson correlation coefficient between two data point arrays.
 * Aligns by date, only using overlapping dates.
 */
export function pearson(
  seriesA: CorrelationDataPoint[],
  seriesB: CorrelationDataPoint[],
): { coefficient: number; dataPoints: number } {
  // Build a map for seriesB by date
  const bMap = new Map<string, number>();
  for (const p of seriesB) {
    bMap.set(p.date, p.value);
  }

  // Find overlapping dates
  const pairs: { a: number; b: number }[] = [];
  for (const p of seriesA) {
    const bVal = bMap.get(p.date);
    if (bVal !== undefined) {
      pairs.push({ a: p.value, b: bVal });
    }
  }

  if (pairs.length < 2) {
    return { coefficient: 0, dataPoints: pairs.length };
  }

  const n = pairs.length;
  const sumA = pairs.reduce((s, p) => s + p.a, 0);
  const sumB = pairs.reduce((s, p) => s + p.b, 0);
  const sumAB = pairs.reduce((s, p) => s + p.a * p.b, 0);
  const sumA2 = pairs.reduce((s, p) => s + p.a * p.a, 0);
  const sumB2 = pairs.reduce((s, p) => s + p.b * p.b, 0);

  const denom = Math.sqrt(
    (n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB),
  );

  if (denom === 0) return { coefficient: 0, dataPoints: n };

  const r = (n * sumAB - sumA * sumB) / denom;
  return {
    coefficient: Math.round(r * 1000) / 1000,
    dataPoints: n,
  };
}

/**
 * Classify correlation strength by absolute value.
 */
function classifyStrength(r: number): CorrelationResult['strength'] {
  const abs = Math.abs(r);
  if (abs >= 0.7) return 'strong';
  if (abs >= 0.5) return 'moderate';
  if (abs >= 0.3) return 'weak';
  return 'none';
}

/**
 * Correlate two specific modules' metric series.
 *
 * Returns all pairwise correlations between series from moduleA and moduleB.
 * Only queries permitted modules; returns empty array if either is not permitted.
 */
export function queryCorrelation(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
  moduleAId: string,
  moduleBId: string,
): CorrelationResult[] {
  const permitted = filterPermitted(db, modules);
  const modA = permitted.find((m) => m.id === moduleAId);
  const modB = permitted.find((m) => m.id === moduleBId);

  if (!modA || !modB) return [];
  if (!modA.crossModule?.getCorrelationData || !modB.crossModule?.getCorrelationData) return [];

  let datasetA, datasetB;
  try {
    datasetA = modA.crossModule.getCorrelationData(db);
    datasetB = modB.crossModule.getCorrelationData(db);
  } catch {
    return [];
  }

  if (datasetA.series.length === 0 || datasetB.series.length === 0) return [];

  const results: CorrelationResult[] = [];

  for (const sA of datasetA.series) {
    for (const sB of datasetB.series) {
      const { coefficient, dataPoints } = pearson(sA.data, sB.data);
      if (dataPoints < MIN_CORRELATION_POINTS) continue;

      results.push({
        moduleA: moduleAId,
        moduleB: moduleBId,
        metricA: sA.metric,
        labelA: sA.label,
        metricB: sB.metric,
        labelB: sB.label,
        coefficient,
        dataPoints,
        strength: classifyStrength(coefficient),
      });
    }
  }

  return results;
}

/**
 * Get trend data for a specific module's metric over time.
 *
 * Filters data points to the requested number of days.
 * Returns null if the module is not permitted or has no correlation data.
 */
export function queryTrends(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
  moduleId: string,
  metric: string,
  days: number,
): TrendResult | null {
  const permitted = filterPermitted(db, modules);
  const mod = permitted.find((m) => m.id === moduleId);
  if (!mod || !mod.crossModule?.getCorrelationData) return null;

  let dataset;
  try {
    dataset = mod.crossModule.getCorrelationData(db);
  } catch {
    return null;
  }

  const series = dataset.series.find((s: CorrelationSeries) => s.metric === metric);
  if (!series) return null;

  // Filter to requested time window
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const points = series.data
    .filter((p: CorrelationDataPoint) => p.date >= cutoffStr)
    .map((p: CorrelationDataPoint) => ({ date: p.date, value: p.value }));

  return {
    moduleId,
    metric: series.metric,
    label: series.label,
    unit: series.unit,
    points,
  };
}

/**
 * Aggregate getDataSummary() from all permitted modules.
 *
 * Modules without getDataSummary or that throw errors are silently skipped.
 */
export function querySummary(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
): SummaryResult {
  const permitted = filterPermitted(db, modules);
  const summaries = [];

  for (const mod of permitted) {
    if (!mod.crossModule?.getDataSummary) continue;
    try {
      summaries.push(mod.crossModule.getDataSummary(db));
    } catch {
      // Skip failing modules
    }
  }

  return {
    modules: summaries,
    totalModules: summaries.length,
  };
}

/**
 * Auto-detect interesting correlations across all permitted modules.
 *
 * Scans all pairwise module combinations, runs Pearson on every metric pair,
 * and returns InsightCards for correlations above the threshold.
 */
export function discoverInsights(
  db: DatabaseAdapter,
  modules: ModuleDefinition[],
): InsightCard[] {
  const permitted = filterPermitted(db, modules);

  // Collect correlation datasets from all permitted modules that support it
  const datasets: { mod: ModuleDefinition; series: CorrelationSeries[] }[] = [];
  for (const mod of permitted) {
    if (!mod.crossModule?.getCorrelationData) continue;
    try {
      const dataset = mod.crossModule.getCorrelationData(db);
      if (dataset.series.length > 0) {
        datasets.push({ mod, series: dataset.series });
      }
    } catch {
      // Skip failing modules
    }
  }

  const insights: InsightCard[] = [];

  // Compare each pair of modules
  for (let i = 0; i < datasets.length; i++) {
    for (let j = i + 1; j < datasets.length; j++) {
      const a = datasets[i];
      const b = datasets[j];

      for (const sA of a.series) {
        for (const sB of b.series) {
          const { coefficient, dataPoints } = pearson(sA.data, sB.data);
          if (dataPoints < MIN_CORRELATION_POINTS) continue;
          if (Math.abs(coefficient) < CORRELATION_THRESHOLD) continue;

          const correlation: CorrelationResult = {
            moduleA: a.mod.id,
            moduleB: b.mod.id,
            metricA: sA.metric,
            labelA: sA.label,
            metricB: sB.metric,
            labelB: sB.label,
            coefficient,
            dataPoints,
            strength: classifyStrength(coefficient),
          };

          insights.push(buildInsightCard(correlation, a.mod.name, b.mod.name, sA, sB));
        }
      }
    }
  }

  // Sort by absolute correlation strength descending
  insights.sort((a, b) => Math.abs(b.correlation.coefficient) - Math.abs(a.correlation.coefficient));

  return insights;
}

/**
 * Build a human-readable InsightCard from a correlation result.
 */
function buildInsightCard(
  correlation: CorrelationResult,
  moduleAName: string,
  moduleBName: string,
  seriesA: CorrelationSeries,
  seriesB: CorrelationSeries,
): InsightCard {
  const r = correlation.coefficient;
  const direction = r > 0 ? 'positively' : 'negatively';
  const strength = correlation.strength;

  const title = `${seriesA.label} and ${seriesB.label} are ${direction} correlated`;
  const description =
    `${strength === 'strong' ? 'Strong' : 'Moderate'} ${direction} correlation ` +
    `between ${moduleAName}'s ${seriesA.label.toLowerCase()} and ` +
    `${moduleBName}'s ${seriesB.label.toLowerCase()} ` +
    `(r=${r.toFixed(2)}, ${correlation.dataPoints} days of data)`;

  let confidence: InsightCard['confidence'];
  if (correlation.dataPoints >= 60) {
    confidence = 'high';
  } else if (correlation.dataPoints >= 30) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    title,
    description,
    correlation,
    modules: [correlation.moduleA, correlation.moduleB],
    confidence,
  };
}
