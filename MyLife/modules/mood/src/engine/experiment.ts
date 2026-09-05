import type { Experiment, ExperimentStatus } from '../types';
import { pearsonCorrelation } from './streak';

// ── Date Utilities ────────────────────────────────────────────────────

export function computeDateRanges(
  baselineStart: string,
  periodDays: number,
): { baselineEnd: string; interventionStart: string; interventionEnd: string } {
  const bStart = new Date(baselineStart + 'T00:00:00Z');

  const bEnd = new Date(bStart);
  bEnd.setUTCDate(bEnd.getUTCDate() + periodDays - 1);
  const baselineEnd = bEnd.toISOString().slice(0, 10);

  const iStart = new Date(bEnd);
  iStart.setUTCDate(iStart.getUTCDate() + 1);
  const interventionStart = iStart.toISOString().slice(0, 10);

  const iEnd = new Date(iStart);
  iEnd.setUTCDate(iEnd.getUTCDate() + periodDays - 1);
  const interventionEnd = iEnd.toISOString().slice(0, 10);

  return { baselineEnd, interventionStart, interventionEnd };
}

// ── State Machine ─────────────────────────────────────────────────────

export function transitionExperiment(
  experiment: Experiment,
  today: string,
): ExperimentStatus {
  const { status, baselineStart, baselineEnd, interventionEnd } = experiment;

  // Only draft, baseline, intervention can transition
  if (status === 'completed' || status === 'abandoned' || status === 'analyzing') {
    return status;
  }

  if (status === 'draft') {
    if (today >= baselineStart) {
      // May need to catch up through multiple states
      if (today > baselineEnd) {
        if (today > interventionEnd) {
          return 'analyzing';
        }
        return 'intervention';
      }
      return 'baseline';
    }
    return 'draft';
  }

  if (status === 'baseline') {
    if (today > baselineEnd) {
      if (today > interventionEnd) {
        return 'analyzing';
      }
      return 'intervention';
    }
    return 'baseline';
  }

  if (status === 'intervention') {
    if (today > interventionEnd) {
      return 'analyzing';
    }
    return 'intervention';
  }

  return status;
}

// ── Analysis ──────────────────────────────────────────────────────────

export interface ExperimentAnalysis {
  baselineAvg: number | null;
  interventionAvg: number | null;
  baselineEntryCount: number;
  interventionEntryCount: number;
  scoreDiff: number | null;
  percentChange: number | null;
  pearsonR: number | null;
  isSignificant: boolean;
  conclusion: string;
}

export function analyzeExperiment(
  experiment: Experiment,
  baselineScores: number[],
  interventionScores: number[],
): ExperimentAnalysis {
  const baselineEntryCount = baselineScores.length;
  const interventionEntryCount = interventionScores.length;

  if (baselineEntryCount === 0) {
    return {
      baselineAvg: null,
      interventionAvg: null,
      baselineEntryCount: 0,
      interventionEntryCount,
      scoreDiff: null,
      percentChange: null,
      pearsonR: null,
      isSignificant: false,
      conclusion: 'No baseline data logged. Experiment cannot be analyzed.',
    };
  }

  if (interventionEntryCount === 0) {
    const baselineAvg = average(baselineScores);
    return {
      baselineAvg,
      interventionAvg: null,
      baselineEntryCount,
      interventionEntryCount: 0,
      scoreDiff: null,
      percentChange: null,
      pearsonR: null,
      isSignificant: false,
      conclusion: 'No intervention data logged. Experiment cannot be analyzed.',
    };
  }

  const baselineAvg = average(baselineScores);
  const interventionAvg = average(interventionScores);
  const scoreDiff = round2(interventionAvg - baselineAvg);
  const percentChange = baselineAvg !== 0 ? round2((scoreDiff / baselineAvg) * 100) : null;

  // Build arrays for Pearson: 0 = baseline period, 1 = intervention period
  const allScores = [...baselineScores, ...interventionScores];
  const periodLabels = [
    ...baselineScores.map(() => 0),
    ...interventionScores.map(() => 1),
  ];

  const pearsonR = pearsonCorrelation(periodLabels, allScores);
  const isSignificant = isSignificantExperiment(pearsonR, baselineEntryCount + interventionEntryCount);

  const conclusion = generateConclusion(
    experiment.hypothesis,
    scoreDiff,
    percentChange,
    pearsonR,
    isSignificant,
    baselineEntryCount + interventionEntryCount,
  );

  return {
    baselineAvg: round2(baselineAvg),
    interventionAvg: round2(interventionAvg),
    baselineEntryCount,
    interventionEntryCount,
    scoreDiff,
    percentChange,
    pearsonR,
    isSignificant,
    conclusion,
  };
}

// ── Significance Check ────────────────────────────────────────────────

export function isSignificantExperiment(r: number | null, totalEntries: number): boolean {
  if (r === null) return false;
  return Math.abs(r) >= 0.3 && totalEntries >= 20;
}

// ── Conclusion Generator ──────────────────────────────────────────────

export function generateConclusion(
  hypothesis: string,
  scoreDiff: number,
  percentChange: number | null,
  pearsonR: number | null,
  isSignificant: boolean,
  totalEntries: number,
): string {
  const diffDirection = scoreDiff > 0 ? 'higher' : scoreDiff < 0 ? 'lower' : 'unchanged';
  const pctStr = percentChange !== null ? `${Math.abs(percentChange)}%` : '';

  if (totalEntries < 10) {
    return `Preliminary results with limited data (${totalEntries} entries). Your mood was ${diffDirection} during the intervention. Log more consistently for reliable results.`;
  }

  if (!isSignificant) {
    return `No significant correlation found. Your mood averaged ${diffDirection} during the intervention${pctStr ? ` by ${pctStr}` : ''}, but the difference was not statistically meaningful. The hypothesis "${hypothesis}" is not supported by this experiment.`;
  }

  if (pearsonR !== null && pearsonR > 0) {
    return `Positive result! Your mood was ${pctStr ? `${pctStr} ` : ''}higher during the intervention (${scoreDiff > 0 ? '+' : ''}${scoreDiff} points). The data supports the hypothesis: "${hypothesis}".`;
  }

  if (pearsonR !== null && pearsonR < 0) {
    return `Unexpected result. Your mood was ${pctStr ? `${pctStr} ` : ''}lower during the intervention (${scoreDiff} points). The data does not support the hypothesis: "${hypothesis}".`;
  }

  return `The experiment concluded with no clear direction. Your mood was ${diffDirection} during the intervention.`;
}

// ── Correlation Strength ──────────────────────────────────────────────

export function correlationStrength(r: number | null): string {
  if (r === null) return 'none';
  const abs = Math.abs(r);
  if (abs >= 0.7) return 'strong';
  if (abs >= 0.3) return 'moderate';
  if (abs >= 0.1) return 'weak';
  return 'none';
}

// ── Helpers ───────────────────────────────────────────────────────────

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
