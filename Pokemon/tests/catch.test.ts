// === Gen 1 Catch Mechanics Tests ===

import { describe, it, expect } from 'vitest';
import { attemptCatch } from '../src/battle/catch.ts';
import type { Pokemon } from '../src/data/game-types.ts';

// Use catchRateOverride parameter instead of mocking data modules

function createTestPokemon(overrides: Partial<Pokemon>): Pokemon {
  return {
    speciesId: 25,
    nickname: 'Pikachu',
    level: 25,
    exp: 0,
    hp: 30,
    maxHp: 60,
    attack: 55,
    defense: 30,
    special: 50,
    speed: 90,
    dvs: { attack: 15, defense: 15, speed: 15, special: 15 },
    statExp: { hp: 0, attack: 0, defense: 0, speed: 0, special: 0 },
    moves: [],
    status: 'none',
    statusTurns: 0,
    originalTrainer: 'TEST',
    ...overrides,
  };
}

// Pikachu catch rate = 190, Mewtwo catch rate = 3
const PIKACHU_CATCH_RATE = 190;
const MEWTWO_CATCH_RATE = 3;

describe('attemptCatch', () => {
  describe('Master Ball', () => {
    it('should always catch with Master Ball', () => {
      const pokemon = createTestPokemon({ speciesId: 150, hp: 100, maxHp: 100 });

      // Run 100 times to verify it always catches
      for (let i = 0; i < 100; i++) {
        const result = attemptCatch(pokemon, 4, MEWTWO_CATCH_RATE);
        expect(result.caught).toBe(true);
        expect(result.wobbles).toBe(3);
      }
    });
  });

  describe('Status bonus', () => {
    it('should catch more often with sleep status', () => {
      const awake = createTestPokemon({ hp: 30, maxHp: 60, status: 'none' });
      const asleep = createTestPokemon({ hp: 30, maxHp: 60, status: 'sleep' });

      let awakeCatches = 0;
      let sleepCatches = 0;
      const trials = 2000;

      for (let i = 0; i < trials; i++) {
        if (attemptCatch(awake, 1, PIKACHU_CATCH_RATE).caught) awakeCatches++;
        if (attemptCatch(asleep, 1, PIKACHU_CATCH_RATE).caught) sleepCatches++;
      }

      // Sleep should significantly increase catch rate
      expect(sleepCatches).toBeGreaterThan(awakeCatches);
    });

    it('should catch more often with freeze status', () => {
      const normal = createTestPokemon({ hp: 30, maxHp: 60, status: 'none' });
      const frozen = createTestPokemon({ hp: 30, maxHp: 60, status: 'freeze' });

      let normalCatches = 0;
      let frozenCatches = 0;
      const trials = 2000;

      for (let i = 0; i < trials; i++) {
        if (attemptCatch(normal, 1, PIKACHU_CATCH_RATE).caught) normalCatches++;
        if (attemptCatch(frozen, 1, PIKACHU_CATCH_RATE).caught) frozenCatches++;
      }

      expect(frozenCatches).toBeGreaterThan(normalCatches);
    });
  });

  describe('Low HP bonus', () => {
    it('should catch more often at low HP', () => {
      const fullHp = createTestPokemon({ hp: 60, maxHp: 60 });
      const lowHp = createTestPokemon({ hp: 1, maxHp: 60 });

      let fullCatches = 0;
      let lowCatches = 0;
      const trials = 2000;

      for (let i = 0; i < trials; i++) {
        if (attemptCatch(fullHp, 1, PIKACHU_CATCH_RATE).caught) fullCatches++;
        if (attemptCatch(lowHp, 1, PIKACHU_CATCH_RATE).caught) lowCatches++;
      }

      expect(lowCatches).toBeGreaterThan(fullCatches);
    });
  });

  describe('Ball types', () => {
    it('should return valid wobble counts (0-3)', () => {
      const pokemon = createTestPokemon({ speciesId: 150, hp: 100, maxHp: 200 });

      for (let i = 0; i < 100; i++) {
        const result = attemptCatch(pokemon, 1, MEWTWO_CATCH_RATE);
        expect(result.wobbles).toBeGreaterThanOrEqual(0);
        expect(result.wobbles).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('Difficult catches', () => {
    it('should rarely catch Mewtwo with Poke Ball at full HP', () => {
      const mewtwo = createTestPokemon({ speciesId: 150, hp: 200, maxHp: 200 });

      let catches = 0;
      const trials = 1000;

      for (let i = 0; i < trials; i++) {
        if (attemptCatch(mewtwo, 1, MEWTWO_CATCH_RATE).caught) catches++;
      }

      // Mewtwo has catch rate 3, so very few should be caught
      expect(catches).toBeLessThan(trials * 0.15);
    });
  });
});
