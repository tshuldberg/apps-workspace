import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { MOOD_MODULE } from '../definition';
import {
  getPet,
  createPet,
  updatePetStats,
  renamePet,
  createPetActivity,
  getPetActivities,
  getPetActivitiesToday,
} from '../db/pet';
import {
  feedPet,
  computeHappinessDecay,
  applyDecay,
  FEED_REWARDS,
  EVOLUTION_THRESHOLDS,
  EVOLUTION_NAMES,
  MAX_FEEDS_PER_TYPE_PER_DAY,
  HAPPINESS_DECAY_PER_MISSED_DAY,
  HATCH_MOOD_ENTRIES_REQUIRED,
} from '../engine/pet';
import type { Pet } from '../types';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('mood', MOOD_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

const basePet: Pet = {
  id: 'singleton',
  name: 'Buddy',
  species: 'egg',
  evolutionStage: 0,
  happiness: 50,
  experience: 0,
  totalFeeds: 0,
  streakBonus: 0,
  lastFedAt: null,
  hatchedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('Pet Engine', () => {
  describe('feedPet', () => {
    it('adds happiness and XP for mood_log', () => {
      const result = feedPet(basePet, 'mood_log', 0);
      expect(result.happinessDelta).toBe(10);
      expect(result.experienceDelta).toBe(5);
      expect(result.newHappiness).toBe(60);
      expect(result.dailyLimitReached).toBe(false);
    });

    it('adds happiness and XP for breathing', () => {
      const result = feedPet({ ...basePet, evolutionStage: 1 }, 'breathing', 0);
      expect(result.happinessDelta).toBe(8);
      expect(result.experienceDelta).toBe(3);
    });

    it('adds happiness and XP for meditation', () => {
      const result = feedPet({ ...basePet, evolutionStage: 1 }, 'meditation', 0);
      expect(result.happinessDelta).toBe(12);
      expect(result.experienceDelta).toBe(5);
    });

    it('blocks feed when daily limit reached', () => {
      const result = feedPet(basePet, 'mood_log', MAX_FEEDS_PER_TYPE_PER_DAY);
      expect(result.dailyLimitReached).toBe(true);
      expect(result.happinessDelta).toBe(0);
      expect(result.newHappiness).toBe(50);
    });

    it('clamps happiness at 100', () => {
      const result = feedPet({ ...basePet, happiness: 95 }, 'mood_log', 0);
      expect(result.newHappiness).toBe(100);
    });

    it('hatches egg after 3 mood entries', () => {
      const result = feedPet(basePet, 'mood_log', 0, HATCH_MOOD_ENTRIES_REQUIRED);
      expect(result.justHatched).toBe(true);
      expect(result.newEvolutionStage).toBe(1);
      expect(result.newExperience).toBe(0);
    });

    it('does not hatch with fewer than 3 entries', () => {
      const result = feedPet(basePet, 'mood_log', 0, 2);
      expect(result.justHatched).toBe(false);
      expect(result.newEvolutionStage).toBe(0);
    });

    it('evolves from stage 1 to 2 at 100 XP', () => {
      const pet = { ...basePet, evolutionStage: 1, experience: 97 };
      const result = feedPet(pet, 'mood_log', 0);
      expect(result.newExperience).toBe(102);
      expect(result.newEvolutionStage).toBe(2);
      expect(result.justEvolved).toBe(true);
    });

    it('does not evolve below threshold', () => {
      const pet = { ...basePet, evolutionStage: 1, experience: 90 };
      const result = feedPet(pet, 'mood_log', 0);
      expect(result.newEvolutionStage).toBe(1);
      expect(result.justEvolved).toBe(false);
    });
  });

  describe('computeHappinessDecay', () => {
    it('returns 0 when lastFedAt is null', () => {
      expect(computeHappinessDecay(null, '2026-03-10')).toBe(0);
    });

    it('returns 0 when fed today', () => {
      expect(computeHappinessDecay('2026-03-10T10:00:00Z', '2026-03-10T18:00:00Z')).toBe(0);
    });

    it('returns 0 when fed yesterday', () => {
      expect(computeHappinessDecay('2026-03-09T10:00:00Z', '2026-03-10T10:00:00Z')).toBe(0);
    });

    it('returns 5 after 2 missed days', () => {
      expect(computeHappinessDecay('2026-03-07T10:00:00Z', '2026-03-10T10:00:00Z')).toBe(HAPPINESS_DECAY_PER_MISSED_DAY * 2);
    });

    it('returns 15 after 4 missed days', () => {
      expect(computeHappinessDecay('2026-03-06T10:00:00Z', '2026-03-10T10:00:00Z')).toBe(HAPPINESS_DECAY_PER_MISSED_DAY * 3);
    });
  });

  describe('applyDecay', () => {
    it('clamps happiness at 0', () => {
      const pet = { ...basePet, happiness: 10, lastFedAt: '2026-03-01T10:00:00Z' };
      const result = applyDecay(pet, '2026-03-10T10:00:00Z');
      expect(result.newHappiness).toBe(0);
    });
  });

  describe('constants', () => {
    it('FEED_REWARDS has all activity types', () => {
      expect(Object.keys(FEED_REWARDS)).toHaveLength(7);
    });

    it('EVOLUTION_THRESHOLDS covers stages 1-5', () => {
      expect(EVOLUTION_THRESHOLDS[1]).toBe(0);
      expect(EVOLUTION_THRESHOLDS[2]).toBe(100);
      expect(EVOLUTION_THRESHOLDS[3]).toBe(500);
      expect(EVOLUTION_THRESHOLDS[4]).toBe(2000);
      expect(EVOLUTION_THRESHOLDS[5]).toBe(5000);
    });

    it('EVOLUTION_NAMES covers stages 0-5', () => {
      expect(Object.keys(EVOLUTION_NAMES)).toHaveLength(6);
    });

    it('MAX_FEEDS_PER_TYPE_PER_DAY is 3', () => {
      expect(MAX_FEEDS_PER_TYPE_PER_DAY).toBe(3);
    });

    it('HATCH_MOOD_ENTRIES_REQUIRED is 3', () => {
      expect(HATCH_MOOD_ENTRIES_REQUIRED).toBe(3);
    });
  });
});

describe('Pet CRUD', () => {
  it('returns null when no pet exists', () => {
    expect(getPet(testDb.adapter)).toBeNull();
  });

  it('creates a pet', () => {
    const pet = createPet(testDb.adapter, 'Luna');
    expect(pet.name).toBe('Luna');
    expect(pet.species).toBe('egg');
    expect(pet.evolutionStage).toBe(0);
    expect(pet.happiness).toBe(50);
  });

  it('does not duplicate pet on second create', () => {
    createPet(testDb.adapter, 'Luna');
    createPet(testDb.adapter, 'Max');
    const pet = getPet(testDb.adapter);
    expect(pet!.name).toBe('Luna');
  });

  it('updates pet stats', () => {
    createPet(testDb.adapter);
    updatePetStats(testDb.adapter, 75, 50, 1, 5);
    const pet = getPet(testDb.adapter);
    expect(pet!.happiness).toBe(75);
    expect(pet!.experience).toBe(50);
    expect(pet!.evolutionStage).toBe(1);
    expect(pet!.totalFeeds).toBe(5);
  });

  it('renames pet', () => {
    createPet(testDb.adapter);
    renamePet(testDb.adapter, 'Star');
    expect(getPet(testDb.adapter)!.name).toBe('Star');
  });

  it('creates and lists pet activities', () => {
    createPetActivity(testDb.adapter, 'pa-1', 'mood_log', 10, 5);
    createPetActivity(testDb.adapter, 'pa-2', 'breathing', 8, 3);
    const activities = getPetActivities(testDb.adapter);
    expect(activities).toHaveLength(2);
    const types = activities.map((a) => a.activityType).sort();
    expect(types).toEqual(['breathing', 'mood_log']);
  });

  it('counts activities by type for today', () => {
    const today = new Date().toISOString().slice(0, 10);
    createPetActivity(testDb.adapter, 'pa-1', 'mood_log', 10, 5);
    createPetActivity(testDb.adapter, 'pa-2', 'mood_log', 10, 5);
    const count = getPetActivitiesToday(testDb.adapter, 'mood_log', today);
    expect(count).toBe(2);
  });
});
