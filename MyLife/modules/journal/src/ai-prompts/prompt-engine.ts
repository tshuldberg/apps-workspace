import type { AiPromptTheme, MoodTrend, PromptContext } from './types';
import { PROMPT_THEMES } from './themes';
import type { JournalMood } from '../types';

const MOOD_RANK: Record<string, number> = { low: 1, okay: 2, good: 3, great: 4, grateful: 5 };

/**
 * Analyze mood trend from a list of recent mood values.
 */
export function analyzeMoodTrend(moods: (JournalMood | null)[]): MoodTrend {
  const validMoods = moods.filter((m): m is JournalMood => m !== null);
  if (validMoods.length < 2) return 'unknown';

  const scores = validMoods.map((m) => MOOD_RANK[m] ?? 3);
  const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
  const secondHalf = scores.slice(Math.ceil(scores.length / 2));

  const avgFirst = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
  const diff = avgSecond - avgFirst;

  if (diff > 0.5) return 'improving';
  if (diff < -0.5) return 'declining';

  const allSame = new Set(validMoods).size === 1;
  return allSame ? 'stable' : 'mixed';
}

/**
 * Select a theme based on context, avoiding recently used themes.
 */
export function selectTheme(
  context: PromptContext,
  dateHashSeed: number,
): AiPromptTheme {
  const allThemes = PROMPT_THEMES.map((t) => t.theme);
  const recentSet = new Set(context.recentThemes);

  // Filter out recently used themes (3-day cooldown)
  let available = allThemes.filter((t) => !recentSet.has(t));
  if (available.length === 0) available = allThemes; // fallback if all on cooldown

  // Weight by mood context
  const weighted: AiPromptTheme[] = [];
  for (const theme of available) {
    let weight = 1;
    if (context.moodTrend === 'declining') {
      if (theme === 'self_compassion' || theme === 'emotional_exploration') weight = 3;
    }
    if (context.moodTrend === 'improving') {
      if (theme === 'growth_reflection' || theme === 'gratitude_deepening') weight = 2;
    }
    if (context.daysSinceLastEntry > 3) {
      if (theme === 'energy_awareness' || theme === 'mindful_observation') weight = 2;
    }
    for (let i = 0; i < weight; i++) weighted.push(theme);
  }

  return weighted[dateHashSeed % weighted.length];
}

/**
 * Fill a template string with context variables.
 */
export function fillTemplate(template: string, context: PromptContext): string {
  return template
    .replace(/\{mood\}/g, context.recentMoods[0] ?? 'reflective')
    .replace(/\{streakDays\}/g, String(context.streakDays))
    .replace(/\{daysSinceLastEntry\}/g, String(context.daysSinceLastEntry))
    .replace(/\{avgWordCount\}/g, String(Math.round(context.avgWordCount)));
}

/**
 * Generate a prompt for today given context and date hash.
 */
export function generatePrompt(
  context: PromptContext,
  dateHashSeed: number,
): { theme: AiPromptTheme; promptText: string } {
  const theme = selectTheme(context, dateHashSeed);
  const themeDef = PROMPT_THEMES.find((t) => t.theme === theme)!;
  const templateIndex = dateHashSeed % themeDef.templates.length;
  const template = themeDef.templates[templateIndex];
  const promptText = fillTemplate(template, context);

  return { theme, promptText };
}

/**
 * Convert a date string to a numeric hash for pseudo-random selection.
 */
export function dateToHash(dateStr: string): number {
  return Number(dateStr.replace(/-/g, ''));
}
