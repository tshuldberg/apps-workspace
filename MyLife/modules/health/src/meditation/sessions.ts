/**
 * Guided meditation definitions and session utility functions.
 * 7 guided types + custom timer. Text-based prompts only (no audio).
 */

import type { MeditationType, MeditationDefinition, MeditationStats, MeditationSession } from '../types';

export const MEDITATION_TYPES: MeditationDefinition[] = [
  {
    type: 'body_scan',
    name: 'Body Scan',
    description: 'Progressive body awareness from head to toe',
    defaultDurationSeconds: 600,
    prompts: [
      'Close your eyes and take three deep breaths.',
      'Bring your attention to the top of your head.',
      'Notice any sensations in your forehead and temples.',
      'Let your awareness flow down to your shoulders.',
      'Feel your arms, hands, and fingertips.',
      'Notice your chest rising and falling with each breath.',
      'Bring awareness to your stomach and lower back.',
      'Feel your hips, legs, and feet.',
      'Now hold your entire body in awareness.',
      'Gently bring your awareness back to the room.',
    ],
  },
  {
    type: 'loving_kindness',
    name: 'Loving Kindness',
    description: 'Compassion meditation for self and others',
    defaultDurationSeconds: 420,
    prompts: [
      'Settle into a comfortable position. Close your eyes.',
      'Think of yourself. Repeat: May I be happy. May I be healthy. May I be safe.',
      'Think of someone you love. Send them the same wishes.',
      'Think of a neutral person. Extend kindness to them.',
      'Think of someone difficult. Try to wish them well.',
      'Expand your kindness to all beings everywhere.',
      'Rest in this feeling of universal compassion.',
    ],
  },
  {
    type: 'mindful_awareness',
    name: 'Mindful Awareness',
    description: 'Present-moment attention and observation',
    defaultDurationSeconds: 300,
    prompts: [
      'Sit comfortably and close your eyes.',
      'Focus on your breath. Notice each inhale and exhale.',
      'When thoughts arise, simply notice them and return to your breath.',
      'Expand awareness to sounds around you.',
      'Notice any sensations in your body.',
      'Rest in open awareness, observing without judgment.',
    ],
  },
  {
    type: 'stress_relief',
    name: 'Stress Relief',
    description: 'Tension release and calming practice',
    defaultDurationSeconds: 420,
    prompts: [
      'Take a deep breath in through your nose, out through your mouth.',
      'Tense your shoulders up to your ears. Hold. Now release.',
      'Clench your fists tightly. Hold. Now release.',
      'Scrunch your face muscles. Hold. Now release.',
      'Tense your entire body. Hold for five seconds. Release everything.',
      'Feel the wave of relaxation washing over you.',
      'Rest in this calm. You are safe.',
    ],
  },
  {
    type: 'sleep_prep',
    name: 'Sleep Prep',
    description: 'Pre-sleep wind-down meditation',
    defaultDurationSeconds: 600,
    prompts: [
      'Lie down comfortably. Let your body sink into the bed.',
      'Take slow, deep breaths. In for four, out for eight.',
      'Let go of everything from today. It is done.',
      'Imagine a warm, golden light starting at your feet.',
      'The light slowly moves up through your legs, melting tension.',
      'It flows through your torso, arms, and shoulders.',
      'The light fills your neck, face, and head with warmth.',
      'Your entire body is warm, heavy, and deeply relaxed.',
      'Let yourself drift. There is nothing to do.',
      'Sleep will come. You are ready.',
    ],
  },
  {
    type: 'focus',
    name: 'Focus',
    description: 'Concentration and mental clarity practice',
    defaultDurationSeconds: 300,
    prompts: [
      'Sit upright with your eyes softly closed.',
      'Choose a single point of focus: your breath at the nostrils.',
      'Count each exhale. One, two, three... up to ten.',
      'If you lose count, gently start again at one.',
      'Notice how your focus sharpens with each cycle.',
      'Carry this clarity into your next task.',
    ],
  },
  {
    type: 'gratitude',
    name: 'Gratitude',
    description: 'Appreciation and thankfulness reflection',
    defaultDurationSeconds: 180,
    prompts: [
      'Close your eyes and take three centering breaths.',
      'Think of one person you are grateful for. Feel that gratitude.',
      'Think of one experience today that was good, even small.',
      'Think of one thing about yourself you appreciate.',
      'Hold all three in your heart. Let gratitude fill you.',
    ],
  },
  {
    type: 'custom_timer',
    name: 'Custom Timer',
    description: 'Unguided meditation with bell',
    defaultDurationSeconds: 300,
    prompts: [],
  },
];

export function getMeditationPrompts(type: MeditationType): string[] {
  const def = MEDITATION_TYPES.find((m) => m.type === type);
  return def ? def.prompts : [];
}

export function getMeditationDefinition(type: MeditationType): MeditationDefinition | null {
  return MEDITATION_TYPES.find((m) => m.type === type) ?? null;
}

export function getMeditationStats(sessions: MeditationSession[]): MeditationStats {
  if (sessions.length === 0) {
    return { totalSessions: 0, totalMinutes: 0, favoriteType: null, currentStreak: 0, averageMoodImprovement: null };
  }

  const totalMinutes = Math.round(sessions.reduce((s, e) => s + e.duration_seconds, 0) / 60);

  // Favorite type
  const counts = new Map<MeditationType, number>();
  for (const s of sessions) {
    counts.set(s.meditation_type, (counts.get(s.meditation_type) ?? 0) + 1);
  }
  let favoriteType: MeditationType | null = null;
  let maxCount = 0;
  for (const [t, c] of counts) {
    if (c > maxCount) { maxCount = c; favoriteType = t; }
  }

  // Mood improvement
  const deltas: number[] = [];
  for (const s of sessions) {
    if (s.mood_before !== null && s.mood_after !== null) {
      deltas.push(s.mood_after - s.mood_before);
    }
  }
  const averageMoodImprovement = deltas.length > 0
    ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10
    : null;

  return { totalSessions: sessions.length, totalMinutes, favoriteType, currentStreak: 0, averageMoodImprovement };
}

/**
 * Calculate meditation streak (consecutive days with at least one session).
 * Sessions must be sorted by created_at descending (most recent first).
 */
export function getMeditationStreak(sessions: MeditationSession[]): number {
  if (sessions.length === 0) return 0;

  const dates = new Set<string>();
  for (const s of sessions) {
    dates.add(s.created_at.slice(0, 10));
  }

  const sorted = [...dates].sort().reverse();
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const curr = new Date(sorted[i - 1] + 'T00:00:00Z');
    const prev = new Date(sorted[i] + 'T00:00:00Z');
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
