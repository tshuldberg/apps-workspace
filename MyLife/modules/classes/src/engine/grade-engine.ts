import type { AssignmentRow, CategoryWeights } from '../models/schemas';

/**
 * Pure-function grade engine. No DB access, no side effects.
 * Callers pass in already-loaded rows.
 *
 * P3-A: GPA, weighted class grades, what-if prediction, trend analysis.
 */

// -- Types --

export type GradeScale = 'standard' | 'plus_minus' | 'strict';

export interface CategoryRollup {
  earned: number;
  possible: number;
  percent: number | null;
}

export interface ClassGradeResult {
  percent: number | null;
  letter: string | null;
  by_category: Record<string, CategoryRollup>;
  graded_count: number;
}

export interface FinalPrediction {
  required_remaining_percent: number | null;
  achievable: boolean;
  gap_points: number;
}

export interface SemesterGPAClass {
  credits: number;
  letter: string | null;
}

export interface SemesterGPAResult {
  gpa: number | null;
  credit_hours: number;
  graded_credits: number;
}

export type TrendDirection = 'up' | 'down' | 'flat';
export type TrendConfidence = 'low' | 'medium' | 'high';

export interface TrendResult {
  direction: TrendDirection;
  slope_per_week: number;
  confidence: TrendConfidence;
}

// -- Constants --

const DEFAULT_CATEGORY_KEY = 'uncategorized';
const ACHIEVABLE_TOLERANCE_PERCENT = 105;
const FLAT_SLOPE_EPSILON = 0.05; // percent points per week
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// -- Letter scales --

interface LetterBand {
  letter: string;
  min: number; // inclusive
}

// Bands are ordered high -> low. First match wins.
const STANDARD_SCALE: LetterBand[] = [
  { letter: 'A', min: 90 },
  { letter: 'B', min: 80 },
  { letter: 'C', min: 70 },
  { letter: 'D', min: 60 },
  { letter: 'F', min: 0 },
];

const PLUS_MINUS_SCALE: LetterBand[] = [
  { letter: 'A+', min: 97 },
  { letter: 'A', min: 93 },
  { letter: 'A-', min: 90 },
  { letter: 'B+', min: 87 },
  { letter: 'B', min: 83 },
  { letter: 'B-', min: 80 },
  { letter: 'C+', min: 77 },
  { letter: 'C', min: 73 },
  { letter: 'C-', min: 70 },
  { letter: 'D+', min: 67 },
  { letter: 'D', min: 63 },
  { letter: 'D-', min: 60 },
  { letter: 'F', min: 0 },
];

const STRICT_SCALE: LetterBand[] = [
  { letter: 'A', min: 93 },
  { letter: 'B', min: 85 },
  { letter: 'C', min: 77 },
  { letter: 'D', min: 70 },
  { letter: 'F', min: 0 },
];

const SCALES: Record<GradeScale, LetterBand[]> = {
  standard: STANDARD_SCALE,
  plus_minus: PLUS_MINUS_SCALE,
  strict: STRICT_SCALE,
};

const LETTER_TO_GPA: Record<string, number> = {
  'A+': 4.0,
  A: 4.0,
  'A-': 3.7,
  'B+': 3.3,
  B: 3.0,
  'B-': 2.7,
  'C+': 2.3,
  C: 2.0,
  'C-': 1.7,
  'D+': 1.3,
  D: 1.0,
  'D-': 0.7,
  F: 0.0,
};

// -- Public functions --

export function letterFromPercent(percent: number, scale: GradeScale = 'standard'): string {
  if (!Number.isFinite(percent)) return 'F';
  const bands = SCALES[scale] ?? STANDARD_SCALE;
  for (const band of bands) {
    if (percent >= band.min) return band.letter;
  }
  return 'F';
}

export function gpaFromLetter(letter: string): number {
  const normalized = letter.trim().toUpperCase();
  return LETTER_TO_GPA[normalized] ?? 0;
}

/**
 * Normalize a CategoryWeights map so values sum to 100. Filters non-positive
 * weights. Returns null when no positive weights are present.
 */
function normalizeWeights(
  weights: CategoryWeights | null | undefined,
): Record<string, number> | null {
  if (!weights) return null;
  const positive: Record<string, number> = {};
  let total = 0;
  for (const [key, raw] of Object.entries(weights)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) continue;
    positive[key] = raw;
    total += raw;
  }
  if (total <= 0) return null;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(positive)) {
    out[key] = (raw / total) * 100;
  }
  return out;
}

function isGraded(a: AssignmentRow): boolean {
  if (a.grade === null || a.grade === undefined) return false;
  if (a.max_grade === null || a.max_grade === undefined || a.max_grade <= 0) return false;
  return Number.isFinite(a.grade) && Number.isFinite(a.max_grade);
}

function categoryKey(a: AssignmentRow): string {
  // category_weights keys are matched against assignment.type. Fallback bucket
  // keeps un-mapped types from disappearing into the void.
  return a.type ?? DEFAULT_CATEGORY_KEY;
}

/**
 * calculateClassGrade: weighted percent across categories. Un-graded
 * assignments are excluded. When no categoryWeights are provided, falls back
 * to a simple points-earned / points-possible ratio.
 */
export function calculateClassGrade(
  assignments: AssignmentRow[],
  categoryWeights: CategoryWeights | null,
): ClassGradeResult {
  const graded = assignments.filter(isGraded);

  // Roll up per category regardless of weight presence.
  const by_category: Record<string, CategoryRollup> = {};
  for (const a of graded) {
    const key = categoryKey(a);
    const earned = (a.grade as number) / (a.max_grade as number) * (a.max_grade as number);
    const bucket = by_category[key] ?? { earned: 0, possible: 0, percent: null };
    bucket.earned += a.grade as number;
    bucket.possible += a.max_grade as number;
    by_category[key] = bucket;
    void earned;
  }
  for (const key of Object.keys(by_category)) {
    const b = by_category[key];
    b.percent = b.possible > 0 ? (b.earned / b.possible) * 100 : null;
  }

  if (graded.length === 0) {
    return { percent: null, letter: null, by_category, graded_count: 0 };
  }

  const normalized = normalizeWeights(categoryWeights);

  // No usable weights: simple points ratio across all graded work.
  if (!normalized) {
    const totalEarned = graded.reduce((s, a) => s + (a.grade as number), 0);
    const totalPossible = graded.reduce((s, a) => s + (a.max_grade as number), 0);
    const percent = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : null;
    return {
      percent,
      letter: percent === null ? null : letterFromPercent(percent),
      by_category,
      graded_count: graded.length,
    };
  }

  // Weighted: only categories that (a) have weight AND (b) have graded work
  // contribute. Re-normalize across the contributing subset so a missing
  // category does not silently drop the ceiling below 100.
  const contributing: Array<{ key: string; weight: number; percent: number }> = [];
  for (const [key, weight] of Object.entries(normalized)) {
    const bucket = by_category[key];
    if (!bucket || bucket.possible <= 0 || bucket.percent === null) continue;
    contributing.push({ key, weight, percent: bucket.percent });
  }
  if (contributing.length === 0) {
    return { percent: null, letter: null, by_category, graded_count: graded.length };
  }
  const weightSum = contributing.reduce((s, c) => s + c.weight, 0);
  const percent =
    contributing.reduce((s, c) => s + c.percent * c.weight, 0) / weightSum;

  return {
    percent,
    letter: letterFromPercent(percent),
    by_category,
    graded_count: graded.length,
  };
}

/**
 * predictFinalGrade: given the current graded assignments + category weights,
 * compute what average percent the *un-graded* (remaining) assignments must
 * achieve in aggregate to reach `targetPercent` overall.
 */
export function predictFinalGrade(
  assignments: AssignmentRow[],
  categoryWeights: CategoryWeights | null,
  targetPercent: number,
): FinalPrediction {
  const current = calculateClassGrade(assignments, categoryWeights);

  // Estimate remaining weight share. With category weights we look at how
  // much weight comes from categories that have un-graded work; without them
  // we approximate via (ungraded points / total points).
  const normalized = normalizeWeights(categoryWeights);
  const graded = assignments.filter(isGraded);
  const ungraded = assignments.filter((a) => !isGraded(a));

  let remainingWeightShare: number; // 0..1
  let earnedShare: number; // 0..1 of current contribution

  if (normalized) {
    const remainingCategories = new Set<string>();
    for (const a of ungraded) remainingCategories.add(categoryKey(a));

    let weightRemaining = 0;
    let weightDone = 0;
    for (const [key, w] of Object.entries(normalized)) {
      const hasGraded = graded.some((a) => categoryKey(a) === key);
      const hasUngraded = remainingCategories.has(key);
      if (hasUngraded && !hasGraded) {
        weightRemaining += w;
      } else if (hasUngraded && hasGraded) {
        // Split a category that is partially graded by point-share.
        const cat = graded.filter((a) => categoryKey(a) === key);
        const catUn = ungraded.filter((a) => categoryKey(a) === key);
        const totalPossible =
          cat.reduce((s, a) => s + (a.max_grade as number), 0) +
          catUn.reduce((s, a) => s + (a.max_grade ?? 0), 0);
        const remainPossible = catUn.reduce((s, a) => s + (a.max_grade ?? 0), 0);
        const share = totalPossible > 0 ? remainPossible / totalPossible : 0;
        weightRemaining += w * share;
        weightDone += w * (1 - share);
      } else if (hasGraded) {
        weightDone += w;
      }
    }
    const total = weightRemaining + weightDone;
    if (total <= 0) {
      // Nothing graded, nothing to grade -> target unreachable by definition.
      return {
        required_remaining_percent: null,
        achievable: false,
        gap_points: targetPercent,
      };
    }
    remainingWeightShare = weightRemaining / total;
    earnedShare =
      current.percent === null ? 0 : (current.percent / 100) * (weightDone / total);
  } else {
    const gradedPossible = graded.reduce((s, a) => s + (a.max_grade as number), 0);
    const ungradedPossible = ungraded.reduce((s, a) => s + (a.max_grade ?? 0), 0);
    const total = gradedPossible + ungradedPossible;
    if (total <= 0) {
      return {
        required_remaining_percent: null,
        achievable: false,
        gap_points: targetPercent,
      };
    }
    remainingWeightShare = ungradedPossible / total;
    const earnedPoints = graded.reduce((s, a) => s + (a.grade as number), 0);
    earnedShare = total > 0 ? earnedPoints / total : 0;
  }

  // Already done (no remaining work): cannot move; achievable iff current >= target.
  if (remainingWeightShare <= 0) {
    const cur = current.percent ?? 0;
    return {
      required_remaining_percent: null,
      achievable: cur + 1e-9 >= targetPercent,
      gap_points: targetPercent - cur,
    };
  }

  const required = (targetPercent / 100 - earnedShare) / remainingWeightShare * 100;
  const achievable = required <= ACHIEVABLE_TOLERANCE_PERCENT;
  const cur = current.percent ?? 0;

  return {
    required_remaining_percent: required,
    achievable,
    gap_points: targetPercent - cur,
  };
}

/**
 * calculateSemesterGPA: credit-weighted GPA over classes whose `letter` is
 * non-null. Ungraded classes contribute to credit_hours but not graded_credits
 * or the GPA average.
 */
export function calculateSemesterGPA(
  classes: Array<SemesterGPAClass>,
): SemesterGPAResult {
  let totalCredits = 0;
  let gradedCredits = 0;
  let weightedPoints = 0;

  for (const c of classes) {
    if (!Number.isFinite(c.credits) || c.credits < 0) continue;
    totalCredits += c.credits;
    if (c.letter && c.credits > 0) {
      gradedCredits += c.credits;
      weightedPoints += gpaFromLetter(c.letter) * c.credits;
    }
  }

  return {
    gpa: gradedCredits > 0 ? weightedPoints / gradedCredits : null,
    credit_hours: totalCredits,
    graded_credits: gradedCredits,
  };
}

/**
 * calculateTrend: linear regression of percent over time. Slope is normalized
 * to "percent points per week". Confidence is sample-size driven:
 * < 4 = low, < 8 = medium, >= 8 = high.
 */
export function calculateTrend(
  history: Array<{ date: string; percent: number }>,
): TrendResult {
  const cleaned = history
    .filter(
      (h) =>
        typeof h.date === 'string' &&
        Number.isFinite(h.percent) &&
        !Number.isNaN(new Date(h.date).getTime()),
    )
    .map((h) => ({ t: new Date(h.date).getTime(), y: h.percent }))
    .sort((a, b) => a.t - b.t);

  if (cleaned.length < 2) {
    return { direction: 'flat', slope_per_week: 0, confidence: 'low' };
  }

  const n = cleaned.length;
  const meanT = cleaned.reduce((s, p) => s + p.t, 0) / n;
  const meanY = cleaned.reduce((s, p) => s + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of cleaned) {
    const dt = p.t - meanT;
    num += dt * (p.y - meanY);
    den += dt * dt;
  }
  const slopePerMs = den === 0 ? 0 : num / den;
  const slopePerWeek = slopePerMs * MS_PER_WEEK;

  let direction: TrendDirection = 'flat';
  if (slopePerWeek > FLAT_SLOPE_EPSILON) direction = 'up';
  else if (slopePerWeek < -FLAT_SLOPE_EPSILON) direction = 'down';

  let confidence: TrendConfidence = 'low';
  if (n >= 8) confidence = 'high';
  else if (n >= 4) confidence = 'medium';

  return { direction, slope_per_week: slopePerWeek, confidence };
}
