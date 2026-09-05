import type { A1cConfidence, A1cInterpretation } from '../models/a1c';

/**
 * Get confidence level based on reading count in 90-day window.
 */
export function getA1cConfidence(readingCount: number): A1cConfidence {
  if (readingCount >= 30) return 'high';
  if (readingCount >= 15) return 'medium';
  return 'low';
}

/**
 * Interpret an A1c value according to ADA guidelines.
 */
export function interpretA1c(value: number): A1cInterpretation {
  if (value < 5.7) return { label: 'Normal', color: '#30D158' };
  if (value < 6.5) return { label: 'Prediabetes Range', color: '#FFD60A' };
  if (value <= 7.0) return { label: 'Well-Controlled', color: '#FF9F0A' };
  if (value <= 8.0) return { label: 'Fair Control', color: '#FF6723' };
  return { label: 'Needs Improvement', color: '#FF453A' };
}

/**
 * Calculate Glucose Management Indicator from CGM average glucose.
 * GMI = 3.31 + (0.02392 * average_mg_dL)
 * This differs from eA1c (ADAG formula) -- GMI is CGM-specific.
 */
export function calculateGMI(averageGlucoseMgDl: number): number {
  return Math.round((3.31 + 0.02392 * averageGlucoseMgDl) * 10) / 10;
}
