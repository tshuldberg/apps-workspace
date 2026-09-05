import type { Protocol } from './types';

/** The 8 preset fasting protocols, ordered by intensity */
export const PRESET_PROTOCOLS: Protocol[] = [
  {
    id: '16:8',
    name: 'Lean Gains (16:8)',
    fastingHours: 16,
    eatingHours: 8,
    description: 'Fast 16 hours, eat within an 8-hour window. Most popular protocol for beginners.',
    isCustom: false,
    isDefault: true,
    sortOrder: 1,
  },
  {
    id: '18:6',
    name: 'Daily 18:6',
    fastingHours: 18,
    eatingHours: 6,
    description: 'Fast 18 hours, eat within a 6-hour window. Moderate intensity.',
    isCustom: false,
    isDefault: false,
    sortOrder: 2,
  },
  {
    id: '5:2',
    name: '5:2 Method',
    fastingHours: 24,
    eatingHours: 0,
    description: 'Eat normally 5 days per week, restrict calories to 500-600 on 2 non-consecutive days. One of the most researched IF protocols.',
    isCustom: false,
    isDefault: false,
    sortOrder: 3,
  },
  {
    id: '20:4',
    name: 'Warrior (20:4)',
    fastingHours: 20,
    eatingHours: 4,
    description: 'Fast 20 hours, eat within a 4-hour window. One main meal with snacks.',
    isCustom: false,
    isDefault: false,
    sortOrder: 4,
  },
  {
    id: '23:1',
    name: 'OMAD (23:1)',
    fastingHours: 23,
    eatingHours: 1,
    description: 'One Meal A Day. Fast 23 hours, single eating hour.',
    isCustom: false,
    isDefault: false,
    sortOrder: 5,
  },
  {
    id: '36:0',
    name: 'Alternate Day (36h)',
    fastingHours: 36,
    eatingHours: 0,
    description: 'Full 36-hour fast. Skip an entire day of eating.',
    isCustom: false,
    isDefault: false,
    sortOrder: 6,
  },
  {
    id: '48:0',
    name: 'Extended (48h)',
    fastingHours: 48,
    eatingHours: 0,
    description: 'Full 48-hour fast. Two days without eating.',
    isCustom: false,
    isDefault: false,
    sortOrder: 7,
  },
  {
    id: '72:0',
    name: 'Extended (72h)',
    fastingHours: 72,
    eatingHours: 0,
    description: 'Full 72-hour fast. Three days without eating. For experienced fasters only.',
    isCustom: false,
    isDefault: false,
    sortOrder: 8,
  },
];

/**
 * Protocol progression path. Maps each protocol to its suggested "next level."
 * Used by suggestNextProtocol() after sustained adherence.
 *
 * Progression: 16:8 -> 18:6 -> 20:4 -> OMAD -> 36h -> 48h -> 72h
 * 5:2 is a lateral alternative (different style, not harder/easier).
 */
export const PROTOCOL_PROGRESSION: Record<string, string> = {
  '16:8': '18:6',
  '18:6': '20:4',
  '20:4': '23:1',
  '23:1': '36:0',
  '36:0': '48:0',
  '48:0': '72:0',
};
