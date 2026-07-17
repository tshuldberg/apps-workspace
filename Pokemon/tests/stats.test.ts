// === Gen 1 Stat Calculation Tests ===

import { describe, it, expect } from 'vitest';
import { calcHp, calcStat, getHpDV, applyStatStage, generateRandomDVs, expForLevel } from '../src/battle/stats.ts';
import type { GrowthRate } from '../src/data/game-types.ts';

describe('calcHp', () => {
  it('should calculate Level 5 Charmander HP (base 39, DV 15, statExp 0)', () => {
    // HP = floor(((39 + 15) * 2 + 0) * 5 / 100) + 5 + 10 = floor(5.4) + 15 = 5 + 15 = 20
    expect(calcHp(39, 15, 0, 5)).toBe(20);
  });

  it('should calculate Level 100 Chansey HP (base 250, DV 15, statExp 65535)', () => {
    // evBonus = floor(ceil(sqrt(65535)) / 4) = floor(ceil(255.998) / 4) = floor(256/4) = 64
    // HP = floor(((250 + 15) * 2 + 64) * 100 / 100) + 100 + 10 = floor(594) + 110 = 704
    expect(calcHp(250, 15, 65535, 100)).toBe(704);
  });

  it('should calculate Level 100 Snorlax HP (base 160, DV 15, statExp 0)', () => {
    // HP = floor(((160 + 15) * 2 + 0) * 100 / 100) + 100 + 10 = 350 + 110 = 460
    expect(calcHp(160, 15, 0, 100)).toBe(460);
  });

  it('should handle minimum DVs', () => {
    // Level 5 Charmander with DV 0
    // HP = floor(((39 + 0) * 2 + 0) * 5 / 100) + 5 + 10 = floor(3.9) + 15 = 3 + 15 = 18
    expect(calcHp(39, 0, 0, 5)).toBe(18);
  });
});

describe('calcStat', () => {
  it('should calculate a stat with no stat exp', () => {
    // Level 100 Mewtwo Attack (base 110, DV 15, statExp 0)
    // Stat = floor(((110 + 15) * 2 + 0) * 100 / 100) + 5 = 250 + 5 = 255
    expect(calcStat(110, 15, 0, 100)).toBe(255);
  });

  it('should calculate a stat with max stat exp', () => {
    // Level 100 Mewtwo Special (base 154, DV 15, statExp 65535)
    // evBonus = 64
    // Stat = floor(((154 + 15) * 2 + 64) * 100 / 100) + 5 = 402 + 5 = 407
    expect(calcStat(154, 15, 65535, 100)).toBe(407);
  });

  it('should calculate level 5 starter stats', () => {
    // Level 5 Charmander Attack (base 52, DV 15, statExp 0)
    // Stat = floor(((52 + 15) * 2 + 0) * 5 / 100) + 5 = floor(6.7) + 5 = 6 + 5 = 11
    expect(calcStat(52, 15, 0, 5)).toBe(11);
  });

  it('should calculate max possible stat (Mewtwo Special)', () => {
    // Level 100 Mewtwo Special (base 154, DV 15, statExp 65535)
    expect(calcStat(154, 15, 65535, 100)).toBe(407);
  });
});

describe('getHpDV', () => {
  it('should derive HP DV from other DVs', () => {
    // All max DVs (15 = odd): HP_DV = 1*8 + 1*4 + 1*2 + 1*1 = 15
    expect(getHpDV(15, 15, 15, 15)).toBe(15);
  });

  it('should derive HP DV = 0 from all even DVs', () => {
    // All even DVs: HP_DV = 0*8 + 0*4 + 0*2 + 0*0 = 0
    expect(getHpDV(0, 0, 0, 0)).toBe(0);
  });

  it('should correctly handle mixed DVs', () => {
    // Atk=9(odd), Def=4(even), Spd=7(odd), Spc=2(even)
    // HP_DV = 1*8 + 0*4 + 1*2 + 0*1 = 10
    expect(getHpDV(9, 4, 7, 2)).toBe(10);
  });

  it('should handle Atk=1, Def=0, Spd=0, Spc=0', () => {
    // HP_DV = 1*8 + 0*4 + 0*2 + 0*1 = 8
    expect(getHpDV(1, 0, 0, 0)).toBe(8);
  });
});

describe('applyStatStage', () => {
  it('should return unchanged stat at stage 0', () => {
    expect(applyStatStage(100, 0)).toBe(100);
  });

  it('should increase stat at +1 stage', () => {
    // +1: multiply by 15/10 = 1.5
    expect(applyStatStage(100, 1)).toBe(150);
  });

  it('should double stat at +2 stage', () => {
    expect(applyStatStage(100, 2)).toBe(200);
  });

  it('should quadruple stat at +6 stage', () => {
    expect(applyStatStage(100, 6)).toBe(400);
  });

  it('should decrease stat at -1 stage', () => {
    // -1: multiply by 66/100
    expect(applyStatStage(100, -1)).toBe(66);
  });

  it('should halve stat at -2 stage', () => {
    expect(applyStatStage(100, -2)).toBe(50);
  });

  it('should quarter stat at -6 stage', () => {
    expect(applyStatStage(100, -6)).toBe(25);
  });

  it('should clamp out-of-range stages', () => {
    // Stage 7 should clamp to +6
    expect(applyStatStage(100, 7)).toBe(400);
    // Stage -7 should clamp to -6
    expect(applyStatStage(100, -7)).toBe(25);
  });
});

describe('generateRandomDVs', () => {
  it('should generate DVs in valid range (0-15)', () => {
    for (let i = 0; i < 50; i++) {
      const dvs = generateRandomDVs();
      expect(dvs.attack).toBeGreaterThanOrEqual(0);
      expect(dvs.attack).toBeLessThanOrEqual(15);
      expect(dvs.defense).toBeGreaterThanOrEqual(0);
      expect(dvs.defense).toBeLessThanOrEqual(15);
      expect(dvs.speed).toBeGreaterThanOrEqual(0);
      expect(dvs.speed).toBeLessThanOrEqual(15);
      expect(dvs.special).toBeGreaterThanOrEqual(0);
      expect(dvs.special).toBeLessThanOrEqual(15);
    }
  });
});

describe('expForLevel', () => {
  it('should compute fast growth rate', () => {
    // Fast: floor(4 * n^3 / 5)
    expect(expForLevel(10, 'fast')).toBe(800);
    expect(expForLevel(50, 'fast')).toBe(100000);
    expect(expForLevel(100, 'fast')).toBe(800000);
  });

  it('should compute medium-fast growth rate', () => {
    // Medium Fast: n^3
    expect(expForLevel(10, 'medium-fast')).toBe(1000);
    expect(expForLevel(50, 'medium-fast')).toBe(125000);
    expect(expForLevel(100, 'medium-fast')).toBe(1000000);
  });

  it('should compute medium-slow growth rate', () => {
    // Medium Slow: floor(6/5 * n^3 - 15 * n^2 + 100 * n - 140)
    // n=10: floor(1200 - 1500 + 1000 - 140) = floor(560) = 560
    expect(expForLevel(10, 'medium-slow')).toBe(560);
    // n=100: floor(1200000 - 150000 + 10000 - 140) = 1059860
    expect(expForLevel(100, 'medium-slow')).toBe(1059860);
  });

  it('should compute slow growth rate', () => {
    // Slow: floor(5 * n^3 / 4)
    expect(expForLevel(10, 'slow')).toBe(1250);
    expect(expForLevel(100, 'slow')).toBe(1250000);
  });

  it('should return 0 for level 0', () => {
    expect(expForLevel(0, 'medium-fast')).toBe(0);
  });

  it('should return correct exp for level 1', () => {
    // Fast: floor(4/5) = 0
    expect(expForLevel(1, 'fast')).toBe(0);
    // Medium Fast: 1
    expect(expForLevel(1, 'medium-fast')).toBe(1);
  });
});
