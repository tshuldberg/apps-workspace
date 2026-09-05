import type { RecordEmotion, EmotionalImpact, DistortionFrequency, DistortionType } from './types';

/**
 * Calculate the emotional impact score from a completed thought record.
 * Emotional impact = average(intensity_before - intensity_after) across all emotions.
 * Positive value = improvement. Can be negative (rare but valid).
 */
export function calculateEmotionalImpact(emotions: RecordEmotion[]): EmotionalImpact {
  const emotionDetails = emotions.map((e) => ({
    name: e.emotionName,
    before: e.intensityBefore,
    after: e.intensityAfter,
    reduction: e.intensityAfter !== null ? e.intensityBefore - e.intensityAfter : null,
  }));

  const withAfter = emotionDetails.filter((e) => e.reduction !== null);
  const averageReduction =
    withAfter.length > 0
      ? withAfter.reduce((sum, e) => sum + e.reduction!, 0) / withAfter.length
      : 0;

  return {
    averageReduction: Math.round(averageReduction * 100) / 100,
    emotions: emotionDetails,
  };
}

/**
 * Calculate the belief reduction percentage.
 * Returns the difference between before and after belief ratings.
 */
export function calculateBeliefReduction(
  beliefBefore: number | null,
  beliefAfter: number | null,
): number | null {
  if (beliefBefore === null || beliefAfter === null) {
    return null;
  }
  return beliefBefore - beliefAfter;
}

/**
 * Compute distortion frequency from a flat list of distortion types
 * across multiple thought records. Returns sorted by frequency descending.
 */
export function computeDistortionFrequency(
  distortionTypes: DistortionType[],
): DistortionFrequency[] {
  const counts = new Map<DistortionType, number>();

  for (const type of distortionTypes) {
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([distortionType, count]) => ({ distortionType, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Validate that a distortion type is one of the 15 allowed values.
 */
export function isValidDistortionType(type: string): type is DistortionType {
  const VALID_TYPES = new Set<string>([
    'all_or_nothing', 'overgeneralization', 'mental_filter',
    'disqualifying_positive', 'mind_reading', 'fortune_telling',
    'magnification', 'minimization', 'emotional_reasoning',
    'should_statements', 'labeling', 'personalization',
    'blame', 'always_being_right', 'fallacy_of_fairness',
  ]);
  return VALID_TYPES.has(type);
}
