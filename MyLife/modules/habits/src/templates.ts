import type { HabitType, Frequency, TimeOfDay } from './types';

export interface HabitTemplate {
  name: string;
  icon: string;
  color: string;
  habitType: HabitType;
  frequency: Frequency;
  timeOfDay: TimeOfDay;
  targetCount: number;
  unit: string | null;
  areaName: string;
}

export const HABIT_TEMPLATES: HabitTemplate[] = [
  // Health
  { name: 'Drink 8 Glasses Water', icon: '\uD83D\uDCA7', color: '#3B82F6', habitType: 'measurable', frequency: 'daily', timeOfDay: 'anytime', targetCount: 8, unit: 'glasses', areaName: 'Health' },
  { name: 'Take Vitamins', icon: '\uD83D\uDC8A', color: '#22C55E', habitType: 'standard', frequency: 'daily', timeOfDay: 'morning', targetCount: 1, unit: null, areaName: 'Health' },
  { name: 'Floss', icon: '\uD83E\uDDB7', color: '#14B8A6', habitType: 'standard', frequency: 'daily', timeOfDay: 'evening', targetCount: 1, unit: null, areaName: 'Health' },
  { name: 'Skincare Routine', icon: '\u2728', color: '#EC4899', habitType: 'standard', frequency: 'daily', timeOfDay: 'evening', targetCount: 1, unit: null, areaName: 'Health' },
  // Fitness
  { name: 'Morning Stretch', icon: '\uD83E\uDDD8', color: '#22C55E', habitType: 'timed', frequency: 'daily', timeOfDay: 'morning', targetCount: 600, unit: null, areaName: 'Fitness' },
  { name: '10K Steps', icon: '\uD83D\uDEB6', color: '#F97316', habitType: 'measurable', frequency: 'daily', timeOfDay: 'anytime', targetCount: 10000, unit: 'steps', areaName: 'Fitness' },
  { name: 'Plank 1 Min', icon: '\uD83D\uDCAA', color: '#EF4444', habitType: 'timed', frequency: 'daily', timeOfDay: 'morning', targetCount: 60, unit: null, areaName: 'Fitness' },
  { name: '30 Min Workout', icon: '\uD83C\uDFC3', color: '#EF4444', habitType: 'timed', frequency: 'daily', timeOfDay: 'anytime', targetCount: 1800, unit: null, areaName: 'Fitness' },
  // Mindfulness
  { name: 'Meditate 10 Min', icon: '\uD83E\uDDD8', color: '#8B5CF6', habitType: 'timed', frequency: 'daily', timeOfDay: 'morning', targetCount: 600, unit: null, areaName: 'Mindfulness' },
  { name: 'Journal', icon: '\u270D\uFE0F', color: '#6366F1', habitType: 'standard', frequency: 'daily', timeOfDay: 'evening', targetCount: 1, unit: null, areaName: 'Mindfulness' },
  { name: 'Gratitude List', icon: '\uD83D\uDE4F', color: '#EAB308', habitType: 'standard', frequency: 'daily', timeOfDay: 'morning', targetCount: 1, unit: null, areaName: 'Mindfulness' },
  { name: 'Deep Breathing', icon: '\uD83C\uDF2C\uFE0F', color: '#14B8A6', habitType: 'timed', frequency: 'daily', timeOfDay: 'anytime', targetCount: 300, unit: null, areaName: 'Mindfulness' },
  // Learning
  { name: 'Read 30 Min', icon: '\uD83D\uDCDA', color: '#8B5CF6', habitType: 'timed', frequency: 'daily', timeOfDay: 'evening', targetCount: 1800, unit: null, areaName: 'Learning' },
  { name: 'Practice Language', icon: '\uD83C\uDF0D', color: '#3B82F6', habitType: 'timed', frequency: 'daily', timeOfDay: 'anytime', targetCount: 900, unit: null, areaName: 'Learning' },
  { name: 'Online Course', icon: '\uD83C\uDF93', color: '#6366F1', habitType: 'timed', frequency: 'daily', timeOfDay: 'anytime', targetCount: 1800, unit: null, areaName: 'Learning' },
  { name: 'Write 500 Words', icon: '\u270D\uFE0F', color: '#A855F7', habitType: 'measurable', frequency: 'daily', timeOfDay: 'anytime', targetCount: 500, unit: 'words', areaName: 'Learning' },
  // Productivity
  { name: 'Plan Tomorrow', icon: '\uD83D\uDCCB', color: '#3B82F6', habitType: 'standard', frequency: 'daily', timeOfDay: 'evening', targetCount: 1, unit: null, areaName: 'Work' },
  { name: 'Review Goals', icon: '\uD83C\uDFAF', color: '#F97316', habitType: 'standard', frequency: 'weekly', timeOfDay: 'morning', targetCount: 1, unit: null, areaName: 'Work' },
  { name: 'Inbox Zero', icon: '\uD83D\uDCE7', color: '#EF4444', habitType: 'standard', frequency: 'daily', timeOfDay: 'anytime', targetCount: 1, unit: null, areaName: 'Work' },
  { name: 'No Phone Before 9AM', icon: '\uD83D\uDCF5', color: '#EAB308', habitType: 'negative', frequency: 'daily', timeOfDay: 'morning', targetCount: 1, unit: null, areaName: 'Work' },
  // Personal
  { name: 'Call Family', icon: '\uD83D\uDCDE', color: '#EC4899', habitType: 'standard', frequency: 'weekly', timeOfDay: 'evening', targetCount: 1, unit: null, areaName: 'Personal' },
  { name: 'Budget Review', icon: '\uD83D\uDCB0', color: '#22C55E', habitType: 'standard', frequency: 'weekly', timeOfDay: 'anytime', targetCount: 1, unit: null, areaName: 'Personal' },
  { name: 'Cook Dinner', icon: '\uD83C\uDF73', color: '#F97316', habitType: 'standard', frequency: 'daily', timeOfDay: 'evening', targetCount: 1, unit: null, areaName: 'Personal' },
  { name: 'Declutter 10 Min', icon: '\uD83E\uDDF9', color: '#14B8A6', habitType: 'timed', frequency: 'daily', timeOfDay: 'anytime', targetCount: 600, unit: null, areaName: 'Personal' },
];

export function getTemplatesByArea(areaName: string): HabitTemplate[] {
  return HABIT_TEMPLATES.filter((t) => t.areaName === areaName);
}

export function getAllTemplates(): HabitTemplate[] {
  return HABIT_TEMPLATES;
}
