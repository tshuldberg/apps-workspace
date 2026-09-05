// How We Feel Mood Meter -- 144 descriptors organized by energy/pleasantness quadrant

export interface MoodQuadrant {
  readonly quadrant: string;
  readonly energy: 'high' | 'low';
  readonly pleasantness: 'pleasant' | 'unpleasant';
  readonly descriptors: readonly string[];
}

export const HIGH_ENERGY_PLEASANT: MoodQuadrant = {
  quadrant: 'High Energy + Pleasant',
  energy: 'high',
  pleasantness: 'pleasant',
  descriptors: [
    'excited', 'joyful', 'energetic', 'inspired', 'confident', 'proud',
    'enthusiastic', 'optimistic', 'amused', 'playful', 'curious', 'amazed',
    'motivated', 'bold', 'radiant', 'vibrant', 'ecstatic', 'exhilarated',
    'empowered', 'lively', 'creative', 'passionate', 'thrilled', 'delighted',
    'cheerful', 'elated', 'euphoric', 'bubbly', 'spirited', 'festive',
    'daring', 'dynamic', 'sparkling', 'vivacious', 'zealous', 'invigorated',
  ],
} as const;

export const HIGH_ENERGY_UNPLEASANT: MoodQuadrant = {
  quadrant: 'High Energy + Unpleasant',
  energy: 'high',
  pleasantness: 'unpleasant',
  descriptors: [
    'anxious', 'angry', 'frustrated', 'stressed', 'irritated', 'overwhelmed',
    'panicked', 'agitated', 'restless', 'impatient', 'tense', 'furious',
    'alarmed', 'hostile', 'enraged', 'frantic', 'manic', 'wired',
    'volatile', 'resentful', 'defiant', 'combative', 'exasperated', 'flustered',
    'hyper', 'inflamed', 'livid', 'rattled', 'turbulent', 'edgy',
    'fiery', 'explosive', 'riled', 'seething', 'bristling', 'incensed',
  ],
} as const;

export const LOW_ENERGY_PLEASANT: MoodQuadrant = {
  quadrant: 'Low Energy + Pleasant',
  energy: 'low',
  pleasantness: 'pleasant',
  descriptors: [
    'calm', 'content', 'relaxed', 'peaceful', 'grateful', 'serene',
    'cozy', 'mellow', 'satisfied', 'gentle', 'soothed', 'tranquil',
    'balanced', 'tender', 'warm', 'at_ease', 'comfortable', 'soft',
    'still', 'grounded', 'accepting', 'compassionate', 'secure', 'patient',
    'mindful', 'restful', 'blissful', 'centered', 'harmonious', 'leisurely',
    'pensive', 'quiet', 'reflective', 'rested', 'savoring', 'unhurried',
  ],
} as const;

export const LOW_ENERGY_UNPLEASANT: MoodQuadrant = {
  quadrant: 'Low Energy + Unpleasant',
  energy: 'low',
  pleasantness: 'unpleasant',
  descriptors: [
    'sad', 'tired', 'lonely', 'bored', 'numb', 'drained',
    'hopeless', 'melancholy', 'empty', 'apathetic', 'defeated', 'listless',
    'withdrawn', 'gloomy', 'weary', 'disconnected', 'lethargic', 'despondent',
    'desolate', 'forlorn', 'heavy', 'indifferent', 'pessimistic', 'resigned',
    'sluggish', 'somber', 'stagnant', 'stuck', 'exhausted', 'flat',
    'hollow', 'isolated', 'lifeless', 'lost', 'powerless', 'uninspired',
  ],
} as const;

/** Full 144-descriptor mood vocabulary organized by quadrant */
export const MOOD_VOCABULARY: readonly MoodQuadrant[] = [
  HIGH_ENERGY_PLEASANT,
  HIGH_ENERGY_UNPLEASANT,
  LOW_ENERGY_PLEASANT,
  LOW_ENERGY_UNPLEASANT,
] as const;

/** Simplified 36-descriptor subset (9 per quadrant) for mobile UI */
export const MOOD_VOCABULARY_SIMPLIFIED = {
  highEnergyPleasant: ['excited', 'joyful', 'energetic', 'inspired', 'confident', 'proud', 'enthusiastic', 'optimistic', 'amused'] as const,
  highEnergyUnpleasant: ['anxious', 'angry', 'frustrated', 'stressed', 'irritated', 'overwhelmed', 'panicked', 'agitated', 'restless'] as const,
  lowEnergyPleasant: ['calm', 'content', 'relaxed', 'peaceful', 'grateful', 'serene', 'cozy', 'mellow', 'satisfied'] as const,
  lowEnergyUnpleasant: ['sad', 'tired', 'lonely', 'bored', 'numb', 'drained', 'hopeless', 'melancholy', 'empty'] as const,
} as const;

/** Default activities for mood tagging */
export const DEFAULT_ACTIVITIES = [
  'exercise', 'work', 'socializing', 'reading', 'meditation', 'outdoors',
  'cooking', 'creative', 'family', 'sleep', 'travel', 'shopping',
] as const;

/** Map mood pleasantness to a display color */
export function moodColor(pleasantness: 'pleasant' | 'unpleasant' | null): string {
  if (pleasantness === 'pleasant') return '#4CAF50';
  if (pleasantness === 'unpleasant') return '#F44336';
  return '#9E9E9E';
}
