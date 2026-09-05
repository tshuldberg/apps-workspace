/**
 * Cross-module AI query engine types.
 *
 * All engine outputs are designed for on-device consumption.
 * No data leaves the device unless the user explicitly opts in.
 */

import type { ModuleSummary } from '@mylife/module-registry';

/** Result of correlating two metric series across modules. */
export interface CorrelationResult {
  /** Module A identifier. */
  moduleA: string;
  /** Module B identifier. */
  moduleB: string;
  /** Metric name from module A. */
  metricA: string;
  /** Human-readable label for metric A. */
  labelA: string;
  /** Metric name from module B. */
  metricB: string;
  /** Human-readable label for metric B. */
  labelB: string;
  /** Pearson correlation coefficient (-1 to 1). */
  coefficient: number;
  /** Number of overlapping data points used. */
  dataPoints: number;
  /** Strength classification. */
  strength: 'strong' | 'moderate' | 'weak' | 'none';
}

/** A single data point in a trend time series. */
export interface TrendPoint {
  date: string;
  value: number;
}

/** Result of querying a single metric's trend over time. */
export interface TrendResult {
  moduleId: string;
  metric: string;
  label: string;
  unit: string;
  points: TrendPoint[];
}

/** Aggregated summary across all permitted modules. */
export interface SummaryResult {
  modules: ModuleSummary[];
  totalModules: number;
}

/** An auto-generated insight from cross-module analysis. */
export interface InsightCard {
  /** Short human-readable title. */
  title: string;
  /** Longer descriptive explanation. */
  description: string;
  /** The underlying correlation data. */
  correlation: CorrelationResult;
  /** Which modules are involved. */
  modules: [string, string];
  /** Confidence level based on data points. */
  confidence: 'high' | 'medium' | 'low';
}

/** Minimum overlapping data points required for a meaningful correlation. */
export const MIN_CORRELATION_POINTS = 7;

/** Threshold for "interesting" correlations (absolute value). */
export const CORRELATION_THRESHOLD = 0.5;
