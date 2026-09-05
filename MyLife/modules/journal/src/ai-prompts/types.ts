import { z } from 'zod';

export const AiPromptThemeSchema = z.enum([
  'emotional_exploration', 'pattern_recognition', 'growth_reflection',
  'relationship_insight', 'gratitude_deepening', 'future_visioning',
  'self_compassion', 'values_alignment', 'energy_awareness',
  'boundary_setting', 'creative_expression', 'mindful_observation',
]);
export type AiPromptTheme = z.infer<typeof AiPromptThemeSchema>;

export const MoodTrendSchema = z.enum(['improving', 'declining', 'stable', 'mixed', 'unknown']);
export type MoodTrend = z.infer<typeof MoodTrendSchema>;

export const AiPromptSchema = z.object({
  id: z.string(),
  promptText: z.string(),
  theme: AiPromptThemeSchema,
  contextSummary: z.string().nullable(),
  moodContext: z.string().nullable(),
  wasUsed: z.boolean(),
  wasSkipped: z.boolean(),
  generatedDate: z.string(),
  entryId: z.string().nullable(),
  createdAt: z.string(),
});
export type AiPrompt = z.infer<typeof AiPromptSchema>;

export interface PromptContext {
  moodTrend: MoodTrend;
  recentMoods: string[];
  avgWordCount: number;
  streakDays: number;
  daysSinceLastEntry: number;
  recentThemes: AiPromptTheme[];
}
