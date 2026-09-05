import type { ZodiacSign, MoonPhase, ZodiacElement, TarotCard } from '../types';
import { TAROT_DECK } from '../data/tarot-deck';

// ── Constants ─────────────────────────────────────────────────────────

/** Synodic period of the Moon in days. */
const SYNODIC_PERIOD = 29.53059;

/** Reference Julian date for new moon (Jan 6, 2000 18:14 UTC). */
const REFERENCE_NEW_MOON_JD = 2451550.1;

/**
 * Zodiac date boundaries as [month, day] pairs.
 * Each entry marks the START of that sign.
 */
const ZODIAC_BOUNDARIES: Array<{ sign: ZodiacSign; startMonth: number; startDay: number }> = [
  { sign: 'capricorn', startMonth: 12, startDay: 22 },
  { sign: 'aquarius', startMonth: 1, startDay: 20 },
  { sign: 'pisces', startMonth: 2, startDay: 19 },
  { sign: 'aries', startMonth: 3, startDay: 21 },
  { sign: 'taurus', startMonth: 4, startDay: 20 },
  { sign: 'gemini', startMonth: 5, startDay: 21 },
  { sign: 'cancer', startMonth: 6, startDay: 21 },
  { sign: 'leo', startMonth: 7, startDay: 23 },
  { sign: 'virgo', startMonth: 8, startDay: 23 },
  { sign: 'libra', startMonth: 9, startDay: 23 },
  { sign: 'scorpio', startMonth: 10, startDay: 23 },
  { sign: 'sagittarius', startMonth: 11, startDay: 22 },
];

const ELEMENT_MAP: Record<ZodiacSign, ZodiacElement> = {
  aries: 'fire',
  leo: 'fire',
  sagittarius: 'fire',
  taurus: 'earth',
  virgo: 'earth',
  capricorn: 'earth',
  gemini: 'air',
  libra: 'air',
  aquarius: 'air',
  cancer: 'water',
  scorpio: 'water',
  pisces: 'water',
};

// ── Date Helpers ──────────────────────────────────────────────────────

/**
 * Convert a calendar date string (YYYY-MM-DD) to Julian Day Number.
 * Uses the standard astronomical algorithm.
 */
function dateToJulianDay(dateStr: string): number {
  const parts = dateStr.split('-');
  let y = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  if (m <= 2) {
    y -= 1;
    m += 12;
  }

  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);

  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

// ── Zodiac Signs Array (ordered by ecliptic longitude) ────────────────

const ZODIAC_SIGNS_ORDERED: ZodiacSign[] = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

export interface SkyPosition {
  body: string;
  sign: ZodiacSign;
  degree: number;
  longitude: number;
}

const REFERENCE_MOON_LONGITUDE = 280.0;

const REFERENCE_PLANETARY_LONGITUDES = {
  mercury: 250,
  venus: 181,
  mars: 120,
  jupiter: 35,
  saturn: 50,
  uranus: 314,
  neptune: 304,
  pluto: 252,
} as const;

const PLANETARY_ORBITAL_PERIODS = {
  mercury: 87.97,
  venus: 224.701,
  mars: 686.98,
  jupiter: 4332.59,
  saturn: 10759.22,
  uranus: 30688.5,
  neptune: 60182,
  pluto: 90560,
} as const;

function normalizeLongitude(longitude: number): number {
  return ((longitude % 360) + 360) % 360;
}

function longitudeToSkyPosition(body: string, longitude: number): SkyPosition {
  const normalizedLongitude = normalizeLongitude(longitude);
  const signIndex = Math.floor(normalizedLongitude / 30);
  return {
    body,
    sign: ZODIAC_SIGNS_ORDERED[signIndex],
    degree: Math.round((normalizedLongitude % 30) * 10) / 10,
    longitude: Math.round(normalizedLongitude * 10) / 10,
  };
}

function getBoundaryDate(sign: ZodiacSign, year: number): Date {
  const boundary = ZODIAC_BOUNDARIES.find((entry) => entry.sign === sign);
  if (!boundary) {
    return new Date(Date.UTC(year, 0, 1));
  }
  return new Date(Date.UTC(year, boundary.startMonth - 1, boundary.startDay));
}

function diffUtcDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function getSunLongitude(date: string): number {
  const current = new Date(`${date}T00:00:00Z`);
  const sign = getZodiacSign(date);
  const signIndex = ZODIAC_SIGNS_ORDERED.indexOf(sign);
  const currentMonth = current.getUTCMonth() + 1;
  const currentYear = current.getUTCFullYear();
  const startYear = sign === 'capricorn' && currentMonth === 1 ? currentYear - 1 : currentYear;
  const signStart = getBoundaryDate(sign, startYear);
  const nextSign = ZODIAC_SIGNS_ORDERED[(signIndex + 1) % ZODIAC_SIGNS_ORDERED.length];
  const nextBoundaryYear = sign === 'capricorn' ? startYear + 1 : startYear;
  const nextBoundary = getBoundaryDate(nextSign, nextBoundaryYear);
  const totalDays = Math.max(1, diffUtcDays(signStart, nextBoundary));
  const elapsedDays = Math.max(0, Math.min(totalDays, diffUtcDays(signStart, current)));
  return normalizeLongitude(signIndex * 30 + (elapsedDays / totalDays) * 30);
}

function getMoonLongitude(date: string): number {
  const jd = dateToJulianDay(date);
  const daysSinceRef = jd - REFERENCE_NEW_MOON_JD;
  return normalizeLongitude(REFERENCE_MOON_LONGITUDE + daysSinceRef * 13.176);
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Approximate the Moon's zodiac sign for a given date.
 * Uses the synodic period and mean lunar motion (~13.176 degrees/day)
 * to estimate the Moon's ecliptic longitude, then maps to zodiac sign.
 *
 * Accuracy: within ~1 sign boundary (the Moon moves ~13 deg/day,
 * changing signs every ~2.3 days). For exact positions, Swiss Ephemeris
 * would be required.
 *
 * @param date - ISO date string (YYYY-MM-DD)
 * @returns Approximate zodiac sign the Moon is in
 */
export function getMoonSign(date: string): ZodiacSign {
  const longitude = getMoonLongitude(date);

  // Each sign spans 30 degrees
  const signIndex = Math.floor(longitude / 30);
  return ZODIAC_SIGNS_ORDERED[signIndex];
}

/**
 * Calculate the moon phase for a given date.
 * Uses the synodic period (29.53059 days) with a reference new moon Julian date.
 *
 * @param date - ISO date string (YYYY-MM-DD)
 * @returns The current MoonPhase
 */
export function getMoonPhase(date: string): MoonPhase {
  const jd = dateToJulianDay(date);
  const daysSinceNew = jd - REFERENCE_NEW_MOON_JD;

  // Normalize to current cycle position (0 to 1)
  const cyclePosition = ((daysSinceNew % SYNODIC_PERIOD) + SYNODIC_PERIOD) % SYNODIC_PERIOD;
  const phaseAngle = (cyclePosition / SYNODIC_PERIOD) * 360;

  if (phaseAngle < 22.5) return 'new_moon';
  if (phaseAngle < 67.5) return 'waxing_crescent';
  if (phaseAngle < 112.5) return 'first_quarter';
  if (phaseAngle < 157.5) return 'waxing_gibbous';
  if (phaseAngle < 202.5) return 'full_moon';
  if (phaseAngle < 247.5) return 'waning_gibbous';
  if (phaseAngle < 292.5) return 'last_quarter';
  if (phaseAngle < 337.5) return 'waning_crescent';
  return 'new_moon';
}

/**
 * Determine the zodiac sign for a given birth date using standard zodiac boundaries.
 *
 * @param date - ISO date string (YYYY-MM-DD)
 * @returns The ZodiacSign for that date
 */
export function getZodiacSign(date: string): ZodiacSign {
  const parts = date.split('-');
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // Convert to a "day of year" value for comparison (month * 100 + day).
  // Capricorn wraps around the year, so handle Dec 22+ first.
  const md = month * 100 + day;

  // Check Capricorn first (Dec 22 onward)
  if (md >= 1222) return 'capricorn';

  // Walk backwards through the remaining boundaries (Aquarius..Sagittarius).
  for (let i = ZODIAC_BOUNDARIES.length - 1; i >= 1; i--) {
    const b = ZODIAC_BOUNDARIES[i];
    const bmd = b.startMonth * 100 + b.startDay;
    if (md >= bmd) {
      return b.sign;
    }
  }

  // Before Jan 20 is also Capricorn
  return 'capricorn';
}

/**
 * Get the classical element for a zodiac sign.
 *
 * @param sign - The zodiac sign
 * @returns The element: fire, earth, air, or water
 */
export function getZodiacElement(sign: ZodiacSign): ZodiacElement {
  return ELEMENT_MAP[sign];
}

/**
 * Calculate compatibility between two zodiac signs using element-based scoring.
 *
 * Scoring rules:
 * - Same sign: 85
 * - Same element: 90
 * - Compatible elements (fire/air, earth/water): 75
 * - Neutral (same modality cross-element): 50
 * - Challenging (fire/water, earth/air): 40
 *
 * @param sign1 - First zodiac sign
 * @param sign2 - Second zodiac sign
 * @returns Compatibility score from 0 to 100
 */
export function calculateCompatibility(sign1: ZodiacSign, sign2: ZodiacSign): number {
  if (sign1 === sign2) return 85;

  const el1 = getZodiacElement(sign1);
  const el2 = getZodiacElement(sign2);

  if (el1 === el2) return 90;

  // Compatible pairs: fire+air, earth+water
  const compatible =
    (el1 === 'fire' && el2 === 'air') ||
    (el1 === 'air' && el2 === 'fire') ||
    (el1 === 'earth' && el2 === 'water') ||
    (el1 === 'water' && el2 === 'earth');

  if (compatible) return 75;

  // Challenging pairs: fire+water, earth+air, fire+earth, air+water
  return 40;
}

/**
 * Get the tarot card of the day for a given date.
 * Deterministic: the same date always produces the same card.
 * Cycles through all 78 cards (22 Major Arcana + 56 Minor Arcana).
 *
 * @param date - ISO date string (YYYY-MM-DD)
 * @returns The tarot card metadata for the day
 */
export function getTarotCardOfDay(date: string): TarotCard {
  const jd = dateToJulianDay(date);
  const totalCards = TAROT_DECK.length;
  const index = ((Math.floor(jd) % totalCards) + totalCards) % totalCards;
  return TAROT_DECK[index] ?? TAROT_DECK[0];
}

export function getSkyPositions(date: string): SkyPosition[] {
  const jd = dateToJulianDay(date);
  const daysSinceRef = jd - REFERENCE_NEW_MOON_JD;

  const positions: SkyPosition[] = [
    longitudeToSkyPosition('sun', getSunLongitude(date)),
    longitudeToSkyPosition('moon', getMoonLongitude(date)),
  ];

  for (const [body, referenceLongitude] of Object.entries(REFERENCE_PLANETARY_LONGITUDES)) {
    const orbitalPeriod = PLANETARY_ORBITAL_PERIODS[body as keyof typeof PLANETARY_ORBITAL_PERIODS];
    const longitude = normalizeLongitude(referenceLongitude + (daysSinceRef * 360) / orbitalPeriod);
    positions.push(longitudeToSkyPosition(body, longitude));
  }

  return positions;
}
