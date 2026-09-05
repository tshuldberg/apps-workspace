import { z } from 'zod';

// ── Types ──

export const ChallengeTypeSchema = z.enum([
  'gratitude_30',
  'cbt_starter',
  'stoic_week',
  'photo_month',
  'mood_tracker_14',
  'all_prompts',
]);
export type ChallengeType = z.infer<typeof ChallengeTypeSchema>;

export const ChallengeRequirementSchema = z.enum([
  'any_entry',
  'gratitude_prompt',
  'cbt_thought_record',
  'stoic_prompt',
  'entry_with_photo',
  'entry_with_mood',
  'reflection_prompt',
  'therapy_prompt',
]);
export type ChallengeRequirement = z.infer<typeof ChallengeRequirementSchema>;

export const ChallengeDefinitionSchema = z.object({
  type: ChallengeTypeSchema,
  name: z.string(),
  description: z.string(),
  durationDays: z.number().int(),
  dailyRequirement: ChallengeRequirementSchema,
});
export type ChallengeDefinition = z.infer<typeof ChallengeDefinitionSchema>;

export const ChallengeProgressSchema = z.object({
  type: ChallengeTypeSchema,
  startDate: z.string(),
  daysCompleted: z.number().int(),
  totalDays: z.number().int(),
  isComplete: z.boolean(),
  currentStreak: z.number().int(),
  completionRate: z.number(),
});
export type ChallengeProgress = z.infer<typeof ChallengeProgressSchema>;

// ── Challenge Definitions ──

export const CHALLENGE_DEFINITIONS: ChallengeDefinition[] = [
  {
    type: 'gratitude_30',
    name: '30 Days of Gratitude',
    description: 'Write a gratitude-prompted entry every day for 30 days. Build the habit of noticing what is good.',
    durationDays: 30,
    dailyRequirement: 'gratitude_prompt',
  },
  {
    type: 'cbt_starter',
    name: 'CBT Starter',
    description: 'Complete 7 CBT thought records in 14 days. Learn to identify and challenge distorted thinking.',
    durationDays: 14,
    dailyRequirement: 'cbt_thought_record',
  },
  {
    type: 'stoic_week',
    name: 'Stoic Week',
    description: 'Reflect on a Stoic prompt every day for 7 days. Practice what is within your control.',
    durationDays: 7,
    dailyRequirement: 'stoic_prompt',
  },
  {
    type: 'photo_month',
    name: 'Photo Journal Month',
    description: 'Include at least one photo in every journal entry for 30 days. Capture the visual texture of your life.',
    durationDays: 30,
    dailyRequirement: 'entry_with_photo',
  },
  {
    type: 'mood_tracker_14',
    name: '14-Day Mood Check',
    description: 'Tag every entry with your mood for 14 consecutive days. See your emotional patterns emerge.',
    durationDays: 14,
    dailyRequirement: 'entry_with_mood',
  },
  {
    type: 'all_prompts',
    name: 'Prompt Explorer',
    description: 'Use all 4 prompt categories (reflection, gratitude, therapy, stoic) within 7 days. Discover which style resonates.',
    durationDays: 7,
    dailyRequirement: 'any_entry',
  },
];

/**
 * Get a challenge definition by type.
 */
export function getChallengeDefinition(
  type: ChallengeType,
): ChallengeDefinition | undefined {
  return CHALLENGE_DEFINITIONS.find((c) => c.type === type);
}

/**
 * Check if a single day's requirement is met for a challenge.
 */
export function checkDayCompletion(
  requirement: ChallengeRequirement,
  dayData: {
    hasEntry: boolean;
    hasGratitudePrompt: boolean;
    hasThoughtRecord: boolean;
    hasStoicPrompt: boolean;
    hasPhoto: boolean;
    hasMood: boolean;
    hasReflectionPrompt: boolean;
    hasTherapyPrompt: boolean;
  },
): boolean {
  switch (requirement) {
    case 'any_entry':
      return dayData.hasEntry;
    case 'gratitude_prompt':
      return dayData.hasGratitudePrompt;
    case 'cbt_thought_record':
      return dayData.hasThoughtRecord;
    case 'stoic_prompt':
      return dayData.hasStoicPrompt;
    case 'entry_with_photo':
      return dayData.hasPhoto;
    case 'entry_with_mood':
      return dayData.hasMood;
    case 'reflection_prompt':
      return dayData.hasReflectionPrompt;
    case 'therapy_prompt':
      return dayData.hasTherapyPrompt;
    default:
      return false;
  }
}

/**
 * Compute challenge progress from a list of completed day flags.
 * completedDays is an array of booleans, one per day from startDate.
 */
export function computeChallengeProgress(
  type: ChallengeType,
  startDate: string,
  completedDays: boolean[],
): ChallengeProgress {
  const def = getChallengeDefinition(type);
  const totalDays = def?.durationDays ?? completedDays.length;
  const daysCompleted = completedDays.filter(Boolean).length;

  // Calculate current streak from the end
  let currentStreak = 0;
  for (let i = completedDays.length - 1; i >= 0; i--) {
    if (completedDays[i]) currentStreak++;
    else break;
  }

  // CBT starter has a special completion rule: 7 records in 14 days (not daily)
  const isComplete =
    type === 'cbt_starter'
      ? daysCompleted >= 7
      : daysCompleted >= totalDays;

  return {
    type,
    startDate,
    daysCompleted,
    totalDays,
    isComplete,
    currentStreak,
    completionRate:
      totalDays > 0
        ? Math.round((daysCompleted / totalDays) * 100) / 100
        : 0,
  };
}
