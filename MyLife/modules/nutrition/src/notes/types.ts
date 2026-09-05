import type { MealType } from '../types';

export interface DailyNote {
  id: string;
  date: string;
  content: string;
  tags: string[] | null;
  mealTypes: MealType[] | null;
  linkedFoodIds: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteSearchResult {
  date: string;
  snippet: string;
  source: 'daily' | 'meal';
  mealType?: string;
}

export const DEFAULT_NOTE_PROMPTS = [
  'How did your meals make you feel?',
  'Any cravings today?',
  'What would you change about today\'s eating?',
  'Energy level after meals?',
] as const;

export const DEFAULT_NOTE_TAGS = [
  'restaurant',
  'home-cooked',
  'takeout',
  'social',
  'stress',
  'celebration',
  'travel',
] as const;
