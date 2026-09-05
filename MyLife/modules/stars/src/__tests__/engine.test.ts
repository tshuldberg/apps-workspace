import { describe, it, expect } from 'vitest';
import {
  getMoonPhase,
  getZodiacSign,
  getZodiacElement,
  calculateCompatibility,
  getTarotCardOfDay,
  getSkyPositions,
} from '../engine/astro';

describe('getMoonPhase', () => {
  it('returns a valid moon phase string', () => {
    const phase = getMoonPhase('2026-03-08');
    expect([
      'new_moon', 'waxing_crescent', 'first_quarter', 'waxing_gibbous',
      'full_moon', 'waning_gibbous', 'last_quarter', 'waning_crescent',
    ]).toContain(phase);
  });

  it('returns different phases for dates ~7 days apart', () => {
    const phase1 = getMoonPhase('2026-01-01');
    const phase2 = getMoonPhase('2026-01-08');
    // 7 days apart should produce different phases (a quarter of the cycle)
    expect(phase1).not.toBe(phase2);
  });

  it('returns the same phase for the same date', () => {
    const a = getMoonPhase('2025-12-25');
    const b = getMoonPhase('2025-12-25');
    expect(a).toBe(b);
  });

  it('cycles through phases over a full synodic period', () => {
    // Collect phases for 30 consecutive days
    const phases = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const date = new Date(2026, 0, 1 + i);
      const iso = date.toISOString().slice(0, 10);
      phases.add(getMoonPhase(iso));
    }
    // Over 30 days, we should see most phases
    expect(phases.size).toBeGreaterThanOrEqual(4);
  });

  it('handles dates far in the past', () => {
    const phase = getMoonPhase('1900-01-01');
    expect(phase).toBeTruthy();
  });

  it('handles dates far in the future', () => {
    const phase = getMoonPhase('2100-12-31');
    expect(phase).toBeTruthy();
  });
});

describe('getZodiacSign', () => {
  it('returns aries for March 21', () => {
    expect(getZodiacSign('2000-03-21')).toBe('aries');
  });

  it('returns aries for April 19', () => {
    expect(getZodiacSign('2000-04-19')).toBe('aries');
  });

  it('returns taurus for April 20', () => {
    expect(getZodiacSign('2000-04-20')).toBe('taurus');
  });

  it('returns gemini for June 15', () => {
    expect(getZodiacSign('1997-06-15')).toBe('gemini');
  });

  it('returns capricorn for January 1', () => {
    expect(getZodiacSign('2000-01-01')).toBe('capricorn');
  });

  it('returns capricorn for January 19', () => {
    expect(getZodiacSign('2000-01-19')).toBe('capricorn');
  });

  it('returns aquarius for January 20', () => {
    expect(getZodiacSign('2000-01-20')).toBe('aquarius');
  });

  it('returns capricorn for December 22', () => {
    expect(getZodiacSign('2000-12-22')).toBe('capricorn');
  });

  it('returns sagittarius for December 21', () => {
    expect(getZodiacSign('2000-12-21')).toBe('sagittarius');
  });

  it('returns pisces for March 20', () => {
    expect(getZodiacSign('2000-03-20')).toBe('pisces');
  });

  it('returns correct signs for all boundary start dates', () => {
    expect(getZodiacSign('2000-03-21')).toBe('aries');
    expect(getZodiacSign('2000-04-20')).toBe('taurus');
    expect(getZodiacSign('2000-05-21')).toBe('gemini');
    expect(getZodiacSign('2000-06-21')).toBe('cancer');
    expect(getZodiacSign('2000-07-23')).toBe('leo');
    expect(getZodiacSign('2000-08-23')).toBe('virgo');
    expect(getZodiacSign('2000-09-23')).toBe('libra');
    expect(getZodiacSign('2000-10-23')).toBe('scorpio');
    expect(getZodiacSign('2000-11-22')).toBe('sagittarius');
    expect(getZodiacSign('2000-12-22')).toBe('capricorn');
    expect(getZodiacSign('2000-01-20')).toBe('aquarius');
    expect(getZodiacSign('2000-02-19')).toBe('pisces');
  });
});

describe('getZodiacElement', () => {
  it('returns fire for aries, leo, sagittarius', () => {
    expect(getZodiacElement('aries')).toBe('fire');
    expect(getZodiacElement('leo')).toBe('fire');
    expect(getZodiacElement('sagittarius')).toBe('fire');
  });

  it('returns earth for taurus, virgo, capricorn', () => {
    expect(getZodiacElement('taurus')).toBe('earth');
    expect(getZodiacElement('virgo')).toBe('earth');
    expect(getZodiacElement('capricorn')).toBe('earth');
  });

  it('returns air for gemini, libra, aquarius', () => {
    expect(getZodiacElement('gemini')).toBe('air');
    expect(getZodiacElement('libra')).toBe('air');
    expect(getZodiacElement('aquarius')).toBe('air');
  });

  it('returns water for cancer, scorpio, pisces', () => {
    expect(getZodiacElement('cancer')).toBe('water');
    expect(getZodiacElement('scorpio')).toBe('water');
    expect(getZodiacElement('pisces')).toBe('water');
  });
});

describe('calculateCompatibility', () => {
  it('returns 85 for same sign', () => {
    expect(calculateCompatibility('aries', 'aries')).toBe(85);
    expect(calculateCompatibility('pisces', 'pisces')).toBe(85);
  });

  it('returns 90 for same element (different signs)', () => {
    expect(calculateCompatibility('aries', 'leo')).toBe(90);
    expect(calculateCompatibility('taurus', 'virgo')).toBe(90);
    expect(calculateCompatibility('gemini', 'libra')).toBe(90);
    expect(calculateCompatibility('cancer', 'scorpio')).toBe(90);
  });

  it('returns 75 for compatible elements (fire+air)', () => {
    expect(calculateCompatibility('aries', 'gemini')).toBe(75);
    expect(calculateCompatibility('libra', 'sagittarius')).toBe(75);
  });

  it('returns 75 for compatible elements (earth+water)', () => {
    expect(calculateCompatibility('taurus', 'cancer')).toBe(75);
    expect(calculateCompatibility('pisces', 'virgo')).toBe(75);
  });

  it('returns 40 for challenging combinations', () => {
    expect(calculateCompatibility('aries', 'cancer')).toBe(40);
    expect(calculateCompatibility('taurus', 'gemini')).toBe(40);
  });

  it('is symmetric', () => {
    expect(calculateCompatibility('aries', 'cancer')).toBe(
      calculateCompatibility('cancer', 'aries'),
    );
    expect(calculateCompatibility('leo', 'aquarius')).toBe(
      calculateCompatibility('aquarius', 'leo'),
    );
  });

  it('returns a score between 0 and 100', () => {
    const signs = [
      'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
      'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
    ] as const;
    for (const s1 of signs) {
      for (const s2 of signs) {
        const score = calculateCompatibility(s1, s2);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('getTarotCardOfDay', () => {
  it('returns a card with name, number, and suit', () => {
    const card = getTarotCardOfDay('2026-03-08');
    expect(card.name).toBeTruthy();
    expect(typeof card.number).toBe('number');
    // suit is either a string or null (Major Arcana)
    expect(card.suit === null || typeof card.suit === 'string').toBe(true);
  });

  it('is deterministic for the same date', () => {
    const a = getTarotCardOfDay('2026-01-01');
    const b = getTarotCardOfDay('2026-01-01');
    expect(a).toEqual(b);
  });

  it('returns different cards for different dates', () => {
    const a = getTarotCardOfDay('2026-01-01');
    const b = getTarotCardOfDay('2026-01-02');
    expect(a.name).not.toBe(b.name);
  });

  it('returns Major Arcana cards with null suit', () => {
    // Find a date that produces a Major Arcana card
    let found = false;
    for (let i = 0; i < 78; i++) {
      const date = new Date(2026, 0, 1 + i);
      const iso = date.toISOString().slice(0, 10);
      const card = getTarotCardOfDay(iso);
      if (card.suit === null) {
        found = true;
        expect(card.number).toBeGreaterThanOrEqual(0);
        expect(card.number).toBeLessThanOrEqual(21);
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('returns Minor Arcana cards with valid suits', () => {
    let found = false;
    for (let i = 0; i < 78; i++) {
      const date = new Date(2026, 0, 1 + i);
      const iso = date.toISOString().slice(0, 10);
      const card = getTarotCardOfDay(iso);
      if (card.suit !== null) {
        found = true;
        expect(['Wands', 'Cups', 'Swords', 'Pentacles']).toContain(card.suit);
        expect(card.number).toBeGreaterThanOrEqual(1);
        expect(card.number).toBeLessThanOrEqual(14);
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('covers all 78 cards over 78 consecutive days', () => {
    const names = new Set<string>();
    for (let i = 0; i < 78; i++) {
      const date = new Date(2026, 0, 1 + i);
      const iso = date.toISOString().slice(0, 10);
      names.add(getTarotCardOfDay(iso).name);
    }
    expect(names.size).toBe(78);
  });
});

describe('getSkyPositions', () => {
  it('returns the standard celestial bodies with valid sign data', () => {
    const positions = getSkyPositions('2026-04-07');

    expect(positions).toHaveLength(10);
    expect(positions.map((position) => position.body)).toEqual([
      'sun',
      'moon',
      'mercury',
      'venus',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
    ]);

    for (const position of positions) {
      expect(position.degree).toBeGreaterThanOrEqual(0);
      expect(position.degree).toBeLessThan(30);
      expect(position.longitude).toBeGreaterThanOrEqual(0);
      expect(position.longitude).toBeLessThan(360);
      expect([
        'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
        'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
      ]).toContain(position.sign);
    }
  });

  it('is deterministic for the same date', () => {
    expect(getSkyPositions('2026-04-07')).toEqual(getSkyPositions('2026-04-07'));
  });

  it('tracks solar sign changes consistently with zodiac season boundaries', () => {
    const aries = getSkyPositions('2026-04-01').find((position) => position.body === 'sun');
    const taurus = getSkyPositions('2026-04-25').find((position) => position.body === 'sun');

    expect(aries?.sign).toBe('aries');
    expect(taurus?.sign).toBe('taurus');
  });
});
