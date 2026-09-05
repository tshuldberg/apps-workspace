import type { CatalogSuggestion, GeneratedSuggestion, SuggestionCategory, ActivityCorrelation } from '../types';

export const SUGGESTION_CATALOG: CatalogSuggestion[] = [
  // physical (5)
  { key: 'physical-walk', title: 'Take a Walk', description: 'A 15-minute walk can reset your mood', category: 'physical', durationMinutes: 15 },
  { key: 'physical-stretch', title: 'Stretch Break', description: 'Release tension with gentle stretches', category: 'physical', durationMinutes: 10 },
  { key: 'physical-dance', title: 'Dance It Out', description: 'Put on your favorite song and move', category: 'physical', durationMinutes: 5 },
  { key: 'physical-cold-water', title: 'Splash Cold Water', description: 'Cold water on your face activates the dive reflex', category: 'physical', durationMinutes: 2 },
  { key: 'physical-run', title: 'Quick Run', description: 'Even 10 minutes of running releases endorphins', category: 'physical', durationMinutes: 10 },

  // social (5)
  { key: 'social-call-friend', title: 'Call a Friend', description: 'Hearing a familiar voice can lift your spirits', category: 'social', durationMinutes: 15 },
  { key: 'social-text-someone', title: 'Send a Kind Text', description: 'Reach out to someone you care about', category: 'social', durationMinutes: 5 },
  { key: 'social-compliment', title: 'Give a Compliment', description: 'Brightening someone else can brighten you too', category: 'social', durationMinutes: 2 },
  { key: 'social-pet-time', title: 'Pet Time', description: 'Spend a few minutes with your pet', category: 'social', durationMinutes: 10 },
  { key: 'social-gratitude-text', title: 'Gratitude Text', description: 'Tell someone why you appreciate them', category: 'social', durationMinutes: 5 },

  // creative (5)
  { key: 'creative-doodle', title: 'Doodle or Draw', description: 'No skill required, just let the pen move', category: 'creative', durationMinutes: 10 },
  { key: 'creative-journal', title: 'Free Write', description: 'Write whatever comes to mind for 5 minutes', category: 'creative', durationMinutes: 5 },
  { key: 'creative-music', title: 'Play Music', description: 'Pick up an instrument or sing along', category: 'creative', durationMinutes: 15 },
  { key: 'creative-photo', title: 'Take a Photo', description: 'Find something beautiful and capture it', category: 'creative', durationMinutes: 5 },
  { key: 'creative-cook', title: 'Cook Something', description: 'Making food can be meditative and rewarding', category: 'creative', durationMinutes: 20 },

  // relaxation (5)
  { key: 'relaxation-bath', title: 'Warm Bath or Shower', description: 'Warm water soothes both body and mind', category: 'relaxation', durationMinutes: 15 },
  { key: 'relaxation-tea', title: 'Make a Cup of Tea', description: 'A warm cup can be a ritual of calm', category: 'relaxation', durationMinutes: 10 },
  { key: 'relaxation-nature', title: 'Step Outside', description: 'Fresh air and natural light help reset', category: 'relaxation', durationMinutes: 10 },
  { key: 'relaxation-read', title: 'Read Something Enjoyable', description: 'Escape into a good book for a few pages', category: 'relaxation', durationMinutes: 15 },
  { key: 'relaxation-nap', title: 'Power Nap', description: 'A 20-minute nap can restore energy', category: 'relaxation', durationMinutes: 20 },

  // mindfulness (6)
  { key: 'mindfulness-breathing', title: 'Box Breathing', description: 'Use the built-in breathing exercise', category: 'mindfulness', durationMinutes: 5 },
  { key: 'mindfulness-body-scan', title: 'Quick Body Scan', description: 'Notice and release tension from head to toe', category: 'mindfulness', durationMinutes: 5 },
  { key: 'mindfulness-gratitude', title: 'Gratitude List', description: 'Write down 3 things you are grateful for', category: 'mindfulness', durationMinutes: 5 },
  { key: 'mindfulness-meditation', title: 'Guided Meditation', description: 'Try a short meditation session', category: 'mindfulness', durationMinutes: 10 },
  { key: 'mindfulness-grounding', title: '5-4-3-2-1 Grounding', description: 'Anchor yourself using your five senses', category: 'mindfulness', durationMinutes: 5 },
  { key: 'mindfulness-progressive', title: 'Progressive Relaxation', description: 'Tense and release each muscle group', category: 'mindfulness', durationMinutes: 10 },
];

export interface SuggestionInput {
  currentScore: number;
  activityCorrelations: ActivityCorrelation[];
  recentSuggestionKeys: string[];
  enabledModules: string[];
  entryCount: number;
}

export function generateSuggestions(input: SuggestionInput): GeneratedSuggestion[] {
  const result: GeneratedSuggestion[] = [];

  // Data-driven suggestions (only with 7+ days of data)
  if (input.entryCount >= 7) {
    const dataDriven = getDataDrivenSuggestions(input.activityCorrelations, input.recentSuggestionKeys);
    result.push(...dataDriven);
  }

  // Cross-module suggestions
  const crossModule = getCrossModuleSuggestions(input.enabledModules, input.recentSuggestionKeys);
  result.push(...crossModule);

  // Catalog suggestions (fill remaining)
  const catalogItems = getCatalogSuggestions(input.currentScore, input.recentSuggestionKeys, result.map((r) => r.key));
  result.push(...catalogItems);

  // Apply score-based limits: <= 5 = 2-3 suggestions, > 5 = 0-1
  const limit = input.currentScore <= 5 ? 3 : 1;
  return result.slice(0, limit);
}

function getDataDrivenSuggestions(
  correlations: ActivityCorrelation[],
  recentKeys: string[],
): GeneratedSuggestion[] {
  const results: GeneratedSuggestion[] = [];
  for (const corr of correlations) {
    if (corr.pearsonR !== null && corr.pearsonR >= 0.2) {
      const key = `data-${corr.activityName.toLowerCase().replace(/\s+/g, '-')}`;
      if (recentKeys.includes(key)) continue;
      results.push({
        key,
        title: `Try ${corr.activityName}`,
        description: `${corr.activityName} is correlated with higher mood scores for you`,
        category: 'data_driven',
        source: 'data_driven',
      });
    }
  }
  return results;
}

function getCrossModuleSuggestions(
  enabledModules: string[],
  recentKeys: string[],
): GeneratedSuggestion[] {
  const results: GeneratedSuggestion[] = [];
  const moduleMap: Record<string, { key: string; title: string; desc: string }> = {
    workouts: { key: 'cross-workout', title: 'Log a Workout', desc: 'Exercise is proven to improve mood' },
    journal: { key: 'cross-journal', title: 'Write in Your Journal', desc: 'Processing thoughts through writing helps' },
    recipes: { key: 'cross-recipes', title: 'Cook a Recipe', desc: 'Cooking can be meditative and rewarding' },
    habits: { key: 'cross-habits', title: 'Check Off a Habit', desc: 'Small wins build momentum' },
    fast: { key: 'cross-fast', title: 'Check Your Fasting Window', desc: 'Fasting awareness supports mindful eating' },
    health: { key: 'cross-health', title: 'Log Your Vitals', desc: 'Body awareness supports emotional awareness' },
    books: { key: 'cross-books', title: 'Read a Chapter', desc: 'Reading is a proven stress reducer' },
    stars: { key: 'cross-stars', title: 'Check Tonight\'s Sky', desc: 'Stargazing calms the mind' },
    voice: { key: 'cross-voice', title: 'Record a Voice Memo', desc: 'Speaking your thoughts out loud helps process them' },
  };
  for (const mod of enabledModules) {
    const item = moduleMap[mod];
    if (!item) continue;
    if (recentKeys.includes(item.key)) continue;
    results.push({
      key: item.key,
      title: item.title,
      description: item.desc,
      category: 'cross_module',
      source: 'cross_module',
    });
  }
  return results;
}

function getCatalogSuggestions(
  score: number,
  recentKeys: string[],
  alreadyUsedKeys: string[],
): GeneratedSuggestion[] {
  const allExcluded = new Set([...recentKeys, ...alreadyUsedKeys]);

  // Prioritize categories based on score
  const priorityCategories: SuggestionCategory[] = score <= 3
    ? ['mindfulness', 'relaxation', 'physical', 'social', 'creative']
    : score <= 5
      ? ['physical', 'social', 'creative', 'mindfulness', 'relaxation']
      : ['creative', 'social', 'physical', 'relaxation', 'mindfulness'];

  const results: GeneratedSuggestion[] = [];
  for (const cat of priorityCategories) {
    const items = SUGGESTION_CATALOG.filter((s) => s.category === cat && !allExcluded.has(s.key));
    for (const item of items) {
      results.push({
        key: item.key,
        title: item.title,
        description: item.description,
        category: item.category,
        source: 'catalog',
      });
      if (results.length >= 5) return results;
    }
  }
  return results;
}

export function getSuggestionsByCategory(category: SuggestionCategory): CatalogSuggestion[] {
  return SUGGESTION_CATALOG.filter((s) => s.category === category);
}
