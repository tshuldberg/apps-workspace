import type { PetMood, PetSpecies } from '../types';

// ── Pet Species Catalog ──────────────────────────────────────────────────

export const PET_SPECIES_CATALOG: PetSpecies[] = [
  { key: 'fox', emoji: '🦊', description: 'Clever and energetic' },
  { key: 'cat', emoji: '🐱', description: 'Independent and cozy' },
  { key: 'dog', emoji: '🐶', description: 'Loyal and enthusiastic' },
  { key: 'owl', emoji: '🦉', description: 'Wise and calm' },
  { key: 'penguin', emoji: '🐧', description: 'Resilient and determined' },
];

export function getSpeciesByKey(key: string): PetSpecies | null {
  return PET_SPECIES_CATALOG.find(s => s.key === key) ?? null;
}

// ── Pet Mood Calculation ─────────────────────────────────────────────────

export function calculatePetMood(completedCount: number, totalActiveHabits: number): PetMood {
  if (totalActiveHabits === 0) return 'neutral';

  const pct = (completedCount / totalActiveHabits) * 100;
  if (pct >= 80) return 'thriving';
  if (pct >= 60) return 'happy';
  if (pct >= 40) return 'neutral';
  if (pct >= 20) return 'tired';
  return 'sleepy';
}

export function getMoodEmoji(mood: PetMood): string {
  switch (mood) {
    case 'thriving': return '✨';
    case 'happy': return '😊';
    case 'neutral': return '😐';
    case 'tired': return '😴';
    case 'sleepy': return '💤';
  }
}

export function getMoodLabel(mood: PetMood): string {
  switch (mood) {
    case 'thriving': return 'Thriving!';
    case 'happy': return 'Happy';
    case 'neutral': return 'Okay';
    case 'tired': return 'Tired';
    case 'sleepy': return 'Sleepy';
  }
}

// ── Pet Wardrobe ─────────────────────────────────────────────────────────

export function equipItem(equippedItems: string[], itemId: string): string[] {
  if (equippedItems.includes(itemId)) return equippedItems;
  return [...equippedItems, itemId];
}

export function unequipItem(equippedItems: string[], itemId: string): string[] {
  return equippedItems.filter(id => id !== itemId);
}

export function getDaysTogether(createdAt: string, today: string): number {
  const created = new Date(createdAt);
  const now = new Date(today + 'T00:00:00');
  const diffMs = now.getTime() - created.getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

export type PetActionType = 'feed' | 'play' | 'rest' | 'level_up';

export interface PetCareState {
  hunger: number;
  happiness: number;
  energy: number;
  petXP: number;
  petLevel: number;
  totalInteractions: number;
  lastInteractionAt: string | null;
  mood: PetMood;
}

export interface PetHistoryEntry {
  id: string;
  action: PetActionType;
  title: string;
  detail: string;
  value: number;
  timestamp: string;
}

export interface PetUnlockable {
  id: string;
  name: string;
  icon: string;
  category: 'toy' | 'food' | 'decor';
  requiredLevel: number;
  description: string;
  unlocked: boolean;
}

export const DEFAULT_PET_CARE_STATE: Omit<PetCareState, 'mood'> = {
  hunger: 72,
  happiness: 76,
  energy: 68,
  petXP: 0,
  petLevel: 1,
  totalInteractions: 0,
  lastInteractionAt: null,
};

const PET_UNLOCKABLE_CATALOG: Array<Omit<PetUnlockable, 'unlocked'>> = [
  {
    id: 'chew-toy',
    name: 'Star Chew',
    icon: 'sports_esports',
    category: 'toy',
    requiredLevel: 2,
    description: 'A playful toy that boosts happiness.',
  },
  {
    id: 'berry-bites',
    name: 'Berry Bites',
    icon: 'favorite',
    category: 'food',
    requiredLevel: 3,
    description: 'A favorite snack for quick hunger recovery.',
  },
  {
    id: 'moon-bed',
    name: 'Moon Bed',
    icon: 'timer',
    category: 'decor',
    requiredLevel: 5,
    description: 'A soft nook for deeper rest.',
  },
  {
    id: 'forest-lantern',
    name: 'Forest Lantern',
    icon: 'eco',
    category: 'decor',
    requiredLevel: 7,
    description: 'A sanctuary glow that keeps your companion calm.',
  },
  {
    id: 'hero-collar',
    name: 'Hero Collar',
    icon: 'military_tech',
    category: 'decor',
    requiredLevel: 9,
    description: 'A badge of trust earned through steady care.',
  },
];

function clampVital(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getPetLevelForXP(petXP: number): number {
  return 1 + Math.floor(Math.max(0, petXP) / 120);
}

export function calculatePetMoodFromVitals(vitals: Pick<PetCareState, 'hunger' | 'happiness' | 'energy'>): PetMood {
  const average = (vitals.hunger + vitals.happiness + vitals.energy) / 3;

  if (average >= 85) return 'thriving';
  if (average >= 65) return 'happy';
  if (average >= 45) return 'neutral';
  if (average >= 25) return 'tired';
  return 'sleepy';
}

export function hydratePetCareState(
  partial: Partial<Omit<PetCareState, 'mood'>>,
): PetCareState {
  const hunger = clampVital(partial.hunger ?? DEFAULT_PET_CARE_STATE.hunger);
  const happiness = clampVital(partial.happiness ?? DEFAULT_PET_CARE_STATE.happiness);
  const energy = clampVital(partial.energy ?? DEFAULT_PET_CARE_STATE.energy);
  const petXP = Math.max(0, Math.round(partial.petXP ?? DEFAULT_PET_CARE_STATE.petXP));
  const petLevel = Math.max(partial.petLevel ?? 0, getPetLevelForXP(petXP));

  return {
    hunger,
    happiness,
    energy,
    petXP,
    petLevel,
    totalInteractions: Math.max(0, Math.round(partial.totalInteractions ?? DEFAULT_PET_CARE_STATE.totalInteractions)),
    lastInteractionAt: partial.lastInteractionAt ?? DEFAULT_PET_CARE_STATE.lastInteractionAt,
    mood: calculatePetMoodFromVitals({ hunger, happiness, energy }),
  };
}

export function decayPetCareState(
  state: PetCareState,
  hoursElapsed: number,
): PetCareState {
  if (hoursElapsed <= 0) {
    return hydratePetCareState(state);
  }

  const hungerLoss = hoursElapsed * 1.5;
  const happinessLoss = hoursElapsed * 1.2;
  const energyLoss = hoursElapsed * 1.0;

  return hydratePetCareState({
    ...state,
    hunger: state.hunger - hungerLoss,
    happiness: state.happiness - happinessLoss,
    energy: state.energy - energyLoss,
  });
}

export function applyPetCareAction(
  state: PetCareState,
  action: Exclude<PetActionType, 'level_up'>,
): PetCareState {
  const gains = {
    feed: { hunger: 26, happiness: 8, energy: -4, petXP: 18 },
    play: { hunger: -6, happiness: 24, energy: -8, petXP: 24 },
    rest: { hunger: -2, happiness: 6, energy: 28, petXP: 14 },
  } as const;

  const change = gains[action];
  return hydratePetCareState({
    ...state,
    hunger: state.hunger + change.hunger,
    happiness: state.happiness + change.happiness,
    energy: state.energy + change.energy,
    petXP: state.petXP + change.petXP,
    totalInteractions: state.totalInteractions + 1,
  });
}

export function getPetUnlockables(level: number): PetUnlockable[] {
  return PET_UNLOCKABLE_CATALOG.map((item) => ({
    ...item,
    unlocked: level >= item.requiredLevel,
  }));
}
