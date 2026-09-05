import { describe, it, expect } from 'vitest';
import {
  PET_SPECIES_CATALOG,
  getSpeciesByKey,
  calculatePetMood,
  calculatePetMoodFromVitals,
  getMoodLabel,
  equipItem,
  unequipItem,
  getDaysTogether,
  getPetLevelForXP,
  hydratePetCareState,
  decayPetCareState,
  applyPetCareAction,
  getPetUnlockables,
} from '../engine';

describe('pet engine', () => {
  describe('PET_SPECIES_CATALOG', () => {
    it('contains 5 species', () => {
      expect(PET_SPECIES_CATALOG.length).toBe(5);
    });

    it('all have emoji and description', () => {
      for (const s of PET_SPECIES_CATALOG) {
        expect(s.emoji).toBeTruthy();
        expect(s.description).toBeTruthy();
      }
    });
  });

  describe('getSpeciesByKey', () => {
    it('returns fox species', () => {
      const fox = getSpeciesByKey('fox');
      expect(fox?.emoji).toBe('🦊');
    });

    it('returns null for invalid key', () => {
      expect(getSpeciesByKey('dragon')).toBeNull();
    });
  });

  describe('calculatePetMood', () => {
    it('returns thriving at 100%', () => {
      expect(calculatePetMood(6, 6)).toBe('thriving');
    });

    it('returns happy at 67%', () => {
      expect(calculatePetMood(4, 6)).toBe('happy');
    });

    it('returns neutral at 50%', () => {
      expect(calculatePetMood(3, 6)).toBe('neutral');
    });

    it('returns sleepy at 17%', () => {
      expect(calculatePetMood(1, 6)).toBe('sleepy');
    });

    it('returns sleepy at 0%', () => {
      expect(calculatePetMood(0, 6)).toBe('sleepy');
    });

    it('returns neutral when no habits exist', () => {
      expect(calculatePetMood(0, 0)).toBe('neutral');
    });

    it('returns tired at 20% boundary', () => {
      expect(calculatePetMood(1, 5)).toBe('tired');
    });

    it('returns thriving at 80% boundary', () => {
      expect(calculatePetMood(4, 5)).toBe('thriving');
    });
  });

  describe('getMoodLabel', () => {
    it('returns correct labels', () => {
      expect(getMoodLabel('thriving')).toBe('Thriving!');
      expect(getMoodLabel('sleepy')).toBe('Sleepy');
    });
  });

  describe('equipItem / unequipItem', () => {
    it('adds item to equipped list', () => {
      expect(equipItem([], 'hat_1')).toEqual(['hat_1']);
    });

    it('does not duplicate items', () => {
      expect(equipItem(['hat_1'], 'hat_1')).toEqual(['hat_1']);
    });

    it('removes item from equipped list', () => {
      expect(unequipItem(['hat_1', 'bg_1'], 'hat_1')).toEqual(['bg_1']);
    });
  });

  describe('getDaysTogether', () => {
    it('returns 0 for same day', () => {
      expect(getDaysTogether('2026-03-22T00:00:00', '2026-03-22')).toBe(0);
    });

    it('returns correct days', () => {
      expect(getDaysTogether('2026-02-03T00:00:00', '2026-03-22')).toBe(47);
    });
  });

  describe('care state helpers', () => {
    it('hydrates mood and level from stored vitals', () => {
      const state = hydratePetCareState({
        hunger: 90,
        happiness: 80,
        energy: 70,
        petXP: 260,
      });

      expect(state.petLevel).toBe(getPetLevelForXP(260));
      expect(state.mood).toBe('happy');
    });

    it('decays vitals over time', () => {
      const state = hydratePetCareState({
        hunger: 80,
        happiness: 80,
        energy: 80,
      });

      const decayed = decayPetCareState(state, 5);
      expect(decayed.hunger).toBeLessThan(state.hunger);
      expect(decayed.happiness).toBeLessThan(state.happiness);
      expect(decayed.energy).toBeLessThan(state.energy);
    });

    it('applies care actions and awards xp', () => {
      const state = hydratePetCareState({
        hunger: 40,
        happiness: 40,
        energy: 40,
      });

      const fed = applyPetCareAction(state, 'feed');
      expect(fed.hunger).toBeGreaterThan(state.hunger);
      expect(fed.petXP).toBeGreaterThan(state.petXP);
    });

    it('derives mood from averaged vitals', () => {
      expect(calculatePetMoodFromVitals({ hunger: 95, happiness: 92, energy: 90 })).toBe('thriving');
      expect(calculatePetMoodFromVitals({ hunger: 20, happiness: 18, energy: 24 })).toBe('sleepy');
    });

    it('returns unlockables based on pet level', () => {
      const unlockables = getPetUnlockables(5);
      expect(unlockables.some((item) => item.unlocked)).toBe(true);
      expect(unlockables.some((item) => !item.unlocked)).toBe(true);
    });
  });
});
