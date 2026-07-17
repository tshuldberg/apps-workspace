import { describe, it, expect } from 'vitest';
import { MOVES } from '../src/data/moves.ts';
import { TYPES } from '../src/data/types.ts';

describe('Move data', () => {
  const moveIds = Object.keys(MOVES).map(Number);
  const validTypes = new Set(TYPES);

  it('has all 165 moves', () => {
    expect(moveIds.length).toBe(165);
  });

  it('has IDs from 1 to 165', () => {
    for (let i = 1; i <= 165; i++) {
      expect(MOVES[i]).toBeDefined();
      expect(MOVES[i].id).toBe(i);
    }
  });

  it('every move has a valid type', () => {
    for (const move of Object.values(MOVES)) {
      expect(validTypes.has(move.type)).toBe(true);
    }
  });

  it('every damaging move has positive power', () => {
    for (const move of Object.values(MOVES)) {
      if (move.power !== null) {
        expect(move.power).toBeGreaterThan(0);
      }
    }
  });

  it('every move has non-negative PP', () => {
    for (const move of Object.values(MOVES)) {
      expect(move.pp).toBeGreaterThan(0);
    }
  });

  it('accuracy is null or between 1-100', () => {
    for (const move of Object.values(MOVES)) {
      if (move.accuracy !== null) {
        expect(move.accuracy).toBeGreaterThanOrEqual(1);
        expect(move.accuracy).toBeLessThanOrEqual(100);
      }
    }
  });

  it('effectChance is between 0 and 100', () => {
    for (const move of Object.values(MOVES)) {
      expect(move.effectChance).toBeGreaterThanOrEqual(0);
      expect(move.effectChance).toBeLessThanOrEqual(100);
    }
  });

  // Specific move spot checks
  it('Pound is correct', () => {
    const pound = MOVES[1];
    expect(pound.name).toBe('Pound');
    expect(pound.type).toBe('Normal');
    expect(pound.power).toBe(40);
    expect(pound.accuracy).toBe(100);
    expect(pound.pp).toBe(35);
    expect(pound.effect).toBe('none');
  });

  it('Hyper Beam is correct', () => {
    const hb = MOVES[63];
    expect(hb.name).toBe('Hyper Beam');
    expect(hb.type).toBe('Normal');
    expect(hb.power).toBe(150);
    expect(hb.accuracy).toBe(90);
    expect(hb.pp).toBe(5);
    expect(hb.effect).toBe('recharge');
  });

  it('Thunderbolt is correct', () => {
    const tb = MOVES[85];
    expect(tb.name).toBe('Thunderbolt');
    expect(tb.type).toBe('Electric');
    expect(tb.power).toBe(95);
    expect(tb.accuracy).toBe(100);
    expect(tb.effectChance).toBe(10);
    expect(tb.effect).toBe('paralyze');
  });

  it('Psychic is correct', () => {
    const psy = MOVES[94];
    expect(psy.name).toBe('Psychic');
    expect(psy.type).toBe('Psychic');
    expect(psy.power).toBe(90);
    expect(psy.effectChance).toBe(33);
    expect(psy.effect).toBe('spc-down-1');
  });

  it('Toxic is correct', () => {
    const toxic = MOVES[92];
    expect(toxic.power).toBeNull();
    expect(toxic.accuracy).toBe(85);
    expect(toxic.effect).toBe('bad-poison');
  });

  it('Quick Attack has priority 1', () => {
    expect(MOVES[98].priority).toBe(1);
  });

  it('high-crit moves are marked correctly', () => {
    expect(MOVES[2].highCrit).toBe(true);   // Karate Chop
    expect(MOVES[75].highCrit).toBe(true);  // Razor Leaf
    expect(MOVES[152].highCrit).toBe(true); // Crabhammer
    expect(MOVES[163].highCrit).toBe(true); // Slash
  });

  it('Struggle is move 165', () => {
    expect(MOVES[165].name).toBe('Struggle');
    expect(MOVES[165].power).toBe(50);
    expect(MOVES[165].effect).toBe('recoil-25');
  });

  it('Swift never misses (null accuracy)', () => {
    expect(MOVES[129].accuracy).toBeNull();
  });
});
