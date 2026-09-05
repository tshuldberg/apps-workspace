import type { Pet, PetActivityType } from '../types';

export interface FeedResult {
  happinessDelta: number;
  experienceDelta: number;
  newHappiness: number;
  newExperience: number;
  newEvolutionStage: number;
  justHatched: boolean;
  justEvolved: boolean;
  dailyLimitReached: boolean;
}

export const FEED_REWARDS: Record<PetActivityType, { happiness: number; experience: number }> = {
  mood_log: { happiness: 10, experience: 5 },
  breathing: { happiness: 8, experience: 3 },
  meditation: { happiness: 12, experience: 5 },
  journal: { happiness: 5, experience: 2 },
  workout: { happiness: 5, experience: 2 },
  experiment: { happiness: 5, experience: 2 },
  streak_bonus: { happiness: 5, experience: 2 },
};

export const EVOLUTION_THRESHOLDS: Record<number, number> = {
  1: 0,     // baby (just hatched)
  2: 100,   // youngster
  3: 500,   // teen
  4: 2000,  // adult
  5: 5000,  // legendary
};

export const EVOLUTION_NAMES: Record<number, string> = {
  0: 'Egg',
  1: 'Baby',
  2: 'Youngster',
  3: 'Teen',
  4: 'Adult',
  5: 'Legendary',
};

export const MAX_FEEDS_PER_TYPE_PER_DAY = 3;
export const HAPPINESS_DECAY_PER_MISSED_DAY = 5;
export const HATCH_MOOD_ENTRIES_REQUIRED = 3;

export function feedPet(
  pet: Pet,
  activityType: PetActivityType,
  feedCountToday: number,
  totalMoodEntries?: number,
): FeedResult {
  if (feedCountToday >= MAX_FEEDS_PER_TYPE_PER_DAY) {
    return {
      happinessDelta: 0,
      experienceDelta: 0,
      newHappiness: pet.happiness,
      newExperience: pet.experience,
      newEvolutionStage: pet.evolutionStage,
      justHatched: false,
      justEvolved: false,
      dailyLimitReached: true,
    };
  }

  const reward = FEED_REWARDS[activityType];
  const happinessDelta = reward.happiness;
  const experienceDelta = reward.experience;

  let newHappiness = clampHappiness(pet.happiness + happinessDelta);
  let newExperience = pet.experience + experienceDelta;
  let newStage = pet.evolutionStage;
  let justHatched = false;
  let justEvolved = false;

  // Hatching logic: stage 0 -> 1 after 3 mood entries
  if (pet.evolutionStage === 0 && totalMoodEntries !== undefined && totalMoodEntries >= HATCH_MOOD_ENTRIES_REQUIRED) {
    newStage = 1;
    newExperience = 0;
    justHatched = true;
  }

  // Evolution logic (only if already hatched and not just hatching)
  if (!justHatched && newStage >= 1) {
    const nextStage = newStage + 1;
    const threshold = EVOLUTION_THRESHOLDS[nextStage];
    if (threshold !== undefined && newExperience >= threshold) {
      newStage = nextStage;
      justEvolved = true;
    }
  }

  return {
    happinessDelta,
    experienceDelta,
    newHappiness,
    newExperience,
    newEvolutionStage: newStage,
    justHatched,
    justEvolved,
    dailyLimitReached: false,
  };
}

export function computeHappinessDecay(lastFedAt: string | null, now: string): number {
  if (!lastFedAt) return 0;
  const lastFedDate = lastFedAt.slice(0, 10);
  const nowDate = now.slice(0, 10);
  const diff = daysBetween(lastFedDate, nowDate);
  if (diff <= 1) return 0;
  return (diff - 1) * HAPPINESS_DECAY_PER_MISSED_DAY;
}

export function applyDecay(pet: Pet, now: string): { newHappiness: number; decayAmount: number } {
  const decayAmount = computeHappinessDecay(pet.lastFedAt, now);
  const newHappiness = clampHappiness(pet.happiness - decayAmount);
  return { newHappiness, decayAmount };
}

export function getEvolutionStage(experience: number, currentStage: number): number {
  if (currentStage === 0) return 0;
  let stage = 1;
  for (const [s, threshold] of Object.entries(EVOLUTION_THRESHOLDS)) {
    if (Number(s) > currentStage) break;
    if (experience >= threshold) stage = Number(s);
  }
  // Check next stage
  const next = stage + 1;
  const nextThreshold = EVOLUTION_THRESHOLDS[next];
  if (nextThreshold !== undefined && experience >= nextThreshold) {
    return next;
  }
  return stage;
}

function clampHappiness(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA + 'T00:00:00Z').getTime();
  const b = new Date(dateB + 'T00:00:00Z').getTime();
  return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}
