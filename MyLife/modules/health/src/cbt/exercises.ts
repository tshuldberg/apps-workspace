/**
 * CBT exercise definitions.
 * Static data: 6 exercise types with guided prompts.
 */

import type { CbtExerciseType, CbtExerciseDefinition, CbtStats, CbtEntry } from '../types';

export const CBT_EXERCISES: CbtExerciseDefinition[] = [
  {
    type: 'thought_record',
    name: 'Thought Record',
    description: 'Identify and challenge negative automatic thoughts',
    estimatedMinutes: 5,
    prompts: [
      'What situation triggered your negative thought?',
      'What automatic thought came up?',
      'What evidence supports this thought?',
      'What evidence contradicts it?',
      'What is a more balanced way to see this?',
    ],
  },
  {
    type: 'behavioral_activation',
    name: 'Behavioral Activation',
    description: 'Plan pleasurable activities when feeling low',
    estimatedMinutes: 3,
    prompts: [
      'What have you been avoiding or putting off?',
      'Name one small, pleasurable activity you could do today.',
      'When will you do it, and for how long?',
    ],
  },
  {
    type: 'cognitive_restructuring',
    name: 'Cognitive Restructuring',
    description: 'Reframe distorted thinking patterns',
    estimatedMinutes: 5,
    prompts: [
      'What negative thought is bothering you right now?',
      'Which thinking trap does it fall into? (e.g., catastrophizing, all-or-nothing, mind reading)',
      'How would you advise a friend who had this thought?',
      'Write a more realistic and balanced version of the thought.',
    ],
  },
  {
    type: 'gratitude',
    name: 'Gratitude Practice',
    description: 'Focus on positive aspects of life',
    estimatedMinutes: 2,
    prompts: [
      'Name three things you are grateful for today.',
      'Why does each one matter to you?',
      'How can you carry this gratitude into the rest of your day?',
    ],
  },
  {
    type: 'worry_time',
    name: 'Worry Time',
    description: 'Scheduled worry with containment strategy',
    estimatedMinutes: 5,
    prompts: [
      'Write down everything you are worried about right now.',
      'For each worry, is it something you can control?',
      'For controllable worries, what is one small action step?',
      'For uncontrollable worries, write a brief letting-go statement.',
      'Set a time tomorrow for your next worry session. Worrying is done for now.',
    ],
  },
  {
    type: 'values_clarification',
    name: 'Values Clarification',
    description: 'Connect actions to personal values',
    estimatedMinutes: 4,
    prompts: [
      'What matters most to you in life? (e.g., family, creativity, health, growth)',
      'How did your actions today align with those values?',
      'What is one thing you could do tomorrow to better align with your values?',
    ],
  },
];

export function getExercisePrompts(type: CbtExerciseType): string[] {
  const exercise = CBT_EXERCISES.find((e) => e.type === type);
  return exercise ? exercise.prompts : [];
}

export function getExerciseDefinition(type: CbtExerciseType): CbtExerciseDefinition | null {
  return CBT_EXERCISES.find((e) => e.type === type) ?? null;
}

export function getCbtStats(entries: CbtEntry[]): CbtStats {
  if (entries.length === 0) {
    return { totalExercises: 0, averageMoodImprovement: null, favoriteType: null };
  }

  // Favorite type
  const counts = new Map<CbtExerciseType, number>();
  for (const e of entries) {
    counts.set(e.exercise_type, (counts.get(e.exercise_type) ?? 0) + 1);
  }
  let favoriteType: CbtExerciseType | null = null;
  let maxCount = 0;
  for (const [t, c] of counts) {
    if (c > maxCount) { maxCount = c; favoriteType = t; }
  }

  // Average mood improvement
  const deltas: number[] = [];
  for (const e of entries) {
    if (e.mood_before !== null && e.mood_after !== null) {
      deltas.push(e.mood_after - e.mood_before);
    }
  }
  const averageMoodImprovement = deltas.length > 0
    ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10
    : null;

  return { totalExercises: entries.length, averageMoodImprovement, favoriteType };
}
