// Pure difficulty scoring engine for trail classification.

import type { TrailDifficulty, DifficultyFactors } from '../types';
import { TR_DIFFICULTY } from '../ui/tokens';

function distanceScore(meters: number): number {
  if (meters < 3000) return 0;
  if (meters < 8000) return 1;
  if (meters < 16000) return 2;
  return 3;
}

function elevationScore(meters: number): number {
  if (meters < 100) return 0;
  if (meters < 400) return 1;
  if (meters < 800) return 2;
  return 3;
}

function gradeScore(percent: number): number {
  if (percent < 8) return 0;
  if (percent < 15) return 1;
  if (percent < 25) return 2;
  return 3;
}

function mapToDifficultyWithGrade(total: number): TrailDifficulty {
  if (total <= 2) return 'easy';
  if (total <= 4) return 'moderate';
  if (total <= 6) return 'hard';
  return 'expert';
}

function mapToDifficultyWithoutGrade(total: number): TrailDifficulty {
  if (total <= 1) return 'easy';
  if (total <= 3) return 'moderate';
  if (total <= 4) return 'hard';
  return 'expert';
}

/**
 * Calculate full difficulty scoring breakdown.
 *
 * Distance: 0 (<3km), 1 (3-8km), 2 (8-16km), 3 (>16km)
 * Elevation: 0 (<100m), 1 (100-400m), 2 (400-800m), 3 (>800m)
 * Grade: 0 (<8%), 1 (8-15%), 2 (15-25%), 3 (>25%). null = not scored
 *
 * With grade: 0-2=easy, 3-4=moderate, 5-6=hard, 7+=expert
 * Without grade: 0-1=easy, 2-3=moderate, 4=hard, 5+=expert
 */
export function calculateDifficultyScore(
  distanceMeters: number,
  elevationGainMeters: number,
  maxGradePercent: number | null,
): DifficultyFactors {
  const ds = distanceScore(distanceMeters);
  const es = elevationScore(elevationGainMeters);
  const gs = maxGradePercent !== null ? gradeScore(maxGradePercent) : null;

  const total = ds + es + (gs ?? 0);
  const difficulty =
    gs !== null
      ? mapToDifficultyWithGrade(total)
      : mapToDifficultyWithoutGrade(total);

  return {
    distanceScore: ds,
    elevationScore: es,
    gradeScore: gs,
    totalScore: total,
    suggestedDifficulty: difficulty,
  };
}

/**
 * Convenience function that returns just the difficulty classification.
 */
export function calculateDifficulty(
  distanceMeters: number,
  elevationGainMeters: number,
  maxGradePercent: number | null,
): TrailDifficulty {
  return calculateDifficultyScore(distanceMeters, elevationGainMeters, maxGradePercent)
    .suggestedDifficulty;
}

/**
 * Returns a hex color for a difficulty level.
 */
export function difficultyColor(difficulty: TrailDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return TR_DIFFICULTY.easy;
    case 'moderate':
      return TR_DIFFICULTY.moderate;
    case 'hard':
      return TR_DIFFICULTY.hard;
    case 'expert':
      return TR_DIFFICULTY.expert;
  }
}
