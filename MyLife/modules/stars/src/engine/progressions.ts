import { getZodiacSign, getMoonSign } from './astro';
import { PROGRESSED_MOON_INTERPRETATIONS } from './interpretations';
import type { ZodiacSign } from '../types';

// ── Types ────────────────────────────────────────────────────────────

export interface ProgressedChartResult {
  profileId: string;
  progressedDate: string;
  currentAgeYears: number;
  moonSign: ZodiacSign;
  moonDegreeApprox: number;
  moonNextSignChangeYears: number;
  moonNextSign: ZodiacSign;
  moonInterpretation: string;
  sunSign: ZodiacSign;
  sunDegreeApprox: number;
}

// ── Constants ────────────────────────────────────────────────────────

const ZODIAC_ORDER: ZodiacSign[] = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

// ── Helpers ──────────────────────────────────────────────────────────

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((db - da) / 86400000);
}

// ── Public API ───────────────────────────────────────────────────────

export function computeProgressedDate(birthDate: string, currentDate: string): string {
  const ageInDays = daysBetween(birthDate, currentDate);
  const ageInYears = ageInDays / 365.25;
  const progressedDays = Math.floor(ageInYears);
  return addDays(birthDate, progressedDays);
}

export function computeAgeInYears(birthDate: string, currentDate: string): number {
  const ageInDays = daysBetween(birthDate, currentDate);
  return Math.round((ageInDays / 365.25) * 100) / 100;
}

export function forecastMoonSignChange(
  currentSign: ZodiacSign,
  degreeInSign: number,
  speedPerYear: number = 13,
): { yearsToChange: number; nextSign: ZodiacSign } {
  const degreesToBoundary = 30 - degreeInSign;
  const yearsToChange = degreesToBoundary > 0 ? Math.round((degreesToBoundary / speedPerYear) * 10) / 10 : 0;
  const currentIdx = ZODIAC_ORDER.indexOf(currentSign);
  const nextSign = ZODIAC_ORDER[(currentIdx + 1) % 12];
  return { yearsToChange, nextSign };
}

export function computeProgressedChart(
  profileId: string,
  birthDate: string,
  currentDate: string,
): ProgressedChartResult {
  const ageInYears = computeAgeInYears(birthDate, currentDate);
  const progressedDate = computeProgressedDate(birthDate, currentDate);

  // Progressed Sun: moves ~1 degree per year from natal position
  const sunSign = getZodiacSign(progressedDate);
  // Approximate degree within sign based on day within the sign's ~30-day span
  const sunDegreeApprox = Math.round(ageInYears % 30);

  // Progressed Moon: moves ~12-14 degrees per year
  // Use a simplified model based on the progressed date
  const moonSign = getMoonSign(addDays(progressedDate, Math.floor(ageInYears * 0.37)));
  const moonDegreeApprox = Math.round((ageInYears * 13) % 30);

  const { yearsToChange, nextSign } = forecastMoonSignChange(moonSign, moonDegreeApprox);

  return {
    profileId,
    progressedDate,
    currentAgeYears: ageInYears,
    moonSign,
    moonDegreeApprox,
    moonNextSignChangeYears: yearsToChange,
    moonNextSign: nextSign,
    moonInterpretation: PROGRESSED_MOON_INTERPRETATIONS[moonSign],
    sunSign,
    sunDegreeApprox,
  };
}
