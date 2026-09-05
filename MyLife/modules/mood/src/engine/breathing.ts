import { BREATHING_PATTERNS, type BreathingPattern } from '../types';

export interface BreathingStep {
  phase: 'inhale' | 'hold' | 'exhale' | 'hold2';
  durationSeconds: number;
}

/**
 * Generate the sequence of breathing steps for one cycle of a pattern.
 * Pure function - no I/O.
 */
export function getBreathingCycleSteps(pattern: BreathingPattern): BreathingStep[] {
  const p = BREATHING_PATTERNS[pattern];
  const steps: BreathingStep[] = [
    { phase: 'inhale', durationSeconds: p.inhale },
  ];
  if (p.hold1 > 0) {
    steps.push({ phase: 'hold', durationSeconds: p.hold1 });
  }
  steps.push({ phase: 'exhale', durationSeconds: p.exhale });
  if (p.hold2 > 0) {
    steps.push({ phase: 'hold2', durationSeconds: p.hold2 });
  }
  return steps;
}

/**
 * Calculate the duration of a single breathing cycle in seconds.
 */
export function getCycleDuration(pattern: BreathingPattern): number {
  const p = BREATHING_PATTERNS[pattern];
  return p.inhale + p.hold1 + p.exhale + p.hold2;
}

/**
 * Calculate how many cycles fit within a target duration.
 */
export function getCyclesForDuration(pattern: BreathingPattern, targetSeconds: number): number {
  const cycleDuration = getCycleDuration(pattern);
  return Math.floor(targetSeconds / cycleDuration);
}
