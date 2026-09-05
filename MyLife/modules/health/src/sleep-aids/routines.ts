/**
 * Sleep aids: wind-down routine definitions and sleep hygiene tips.
 */

import type { RoutineDefinition, SleepHygieneTip } from '../types';

export const WIND_DOWN_ROUTINES: RoutineDefinition[] = [
  {
    type: 'wind_down',
    name: 'Evening Wind-Down',
    description: '15-minute stretch, breathe, and reflect routine',
    durationSeconds: 900,
    steps: [
      'Start with gentle neck rolls. 5 in each direction.',
      'Stretch your arms overhead and hold for 10 seconds.',
      'Roll your shoulders back 10 times.',
      'Stand and touch your toes gently. Hold for 15 seconds.',
      'Sit comfortably. Begin 4-7-8 breathing for 3 minutes.',
      'Continue breathing slowly and deeply.',
      'Think of 3 things that went well today.',
      'Let go of anything unfinished. It will be there tomorrow.',
      'Take a final deep breath. You are ready for rest.',
    ],
  },
  {
    type: 'wind_down',
    name: 'Quick Wind-Down',
    description: '5-minute breathing and body scan',
    durationSeconds: 300,
    steps: [
      'Sit or lie down comfortably.',
      'Take 5 slow, deep breaths.',
      'Scan from head to toes, releasing tension in each area.',
      'Let your body become heavy and relaxed.',
      'You are ready for sleep.',
    ],
  },
  {
    type: 'breathing',
    name: 'Sleep Breathing',
    description: '10-minute extended 4-7-8 breathing for sleep',
    durationSeconds: 600,
    steps: [
      'Lie in bed with your eyes closed.',
      'Breathe in through your nose for 4 seconds.',
      'Hold your breath for 7 seconds.',
      'Exhale slowly through your mouth for 8 seconds.',
      'Repeat this cycle. Let each exhale be longer and deeper.',
      'Continue until you feel deeply relaxed.',
      'If still awake, keep breathing at this rhythm.',
    ],
  },
];

export const AMBIENT_SOUNDS = [
  { id: 'rain', name: 'Rain', icon: '🌧️' },
  { id: 'ocean', name: 'Ocean Waves', icon: '🌊' },
  { id: 'white_noise', name: 'White Noise', icon: '📻' },
  { id: 'forest', name: 'Forest', icon: '🌲' },
  { id: 'wind', name: 'Wind', icon: '💨' },
  { id: 'crickets', name: 'Crickets', icon: '🦗' },
] as const;

export const SLEEP_HYGIENE_TIPS: SleepHygieneTip[] = [
  { id: 'screens', text: 'Avoid screens 1 hour before bed. Blue light suppresses melatonin.', category: 'habits' },
  { id: 'temperature', text: 'Keep your bedroom cool (65-68 F / 18-20 C).', category: 'environment' },
  { id: 'caffeine', text: 'No caffeine after 2 PM. It stays in your system for 6+ hours.', category: 'diet' },
  { id: 'schedule', text: 'Go to bed and wake up at the same time every day, even on weekends.', category: 'habits' },
  { id: 'exercise', text: 'Exercise regularly, but not within 3 hours of bedtime.', category: 'activity' },
  { id: 'alcohol', text: 'Alcohol disrupts REM sleep. Avoid it close to bedtime.', category: 'diet' },
  { id: 'naps', text: 'If you nap, keep it under 20 minutes and before 3 PM.', category: 'habits' },
  { id: 'dark', text: 'Make your bedroom as dark as possible. Use blackout curtains.', category: 'environment' },
  { id: 'bed_purpose', text: 'Use your bed only for sleep. Avoid working or scrolling in bed.', category: 'habits' },
  { id: 'wind_down', text: 'Create a wind-down routine 30 minutes before bed.', category: 'habits' },
];

export function getRoutineDefinition(name: string): RoutineDefinition | null {
  return WIND_DOWN_ROUTINES.find((r) => r.name === name) ?? null;
}

export function getTipOfTheDay(date: string): SleepHygieneTip {
  // Rotate through tips based on day of year
  const d = new Date(date + 'T00:00:00Z');
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
  const idx = dayOfYear % SLEEP_HYGIENE_TIPS.length;
  return SLEEP_HYGIENE_TIPS[idx];
}

/**
 * Calculate sleep quality correlation between routine and non-routine nights.
 * Returns the average quality difference (positive = routine nights are better).
 */
export function calculateRoutineCorrelation(
  routineNightQualities: number[],
  nonRoutineNightQualities: number[],
): number | null {
  if (routineNightQualities.length === 0 || nonRoutineNightQualities.length === 0) return null;
  const avgRoutine = routineNightQualities.reduce((a, b) => a + b, 0) / routineNightQualities.length;
  const avgNon = nonRoutineNightQualities.reduce((a, b) => a + b, 0) / nonRoutineNightQualities.length;
  return Math.round((avgRoutine - avgNon) * 10) / 10;
}
