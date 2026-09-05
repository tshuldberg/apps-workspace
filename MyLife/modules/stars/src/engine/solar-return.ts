import { getZodiacSign, getMoonSign } from './astro';
import type { ZodiacSign } from '../types';

// ── Types ────────────────────────────────────────────────────────────

export interface SolarReturnResult {
  profileId: string;
  returnYear: number;
  returnDate: string;
  sunSign: ZodiacSign;
  moonSign: ZodiacSign;
  yearTheme: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

const YEAR_THEMES: Record<ZodiacSign, string> = {
  aries: 'A year of bold new beginnings and asserting your independence. Fresh starts and pioneering energy define this period.',
  taurus: 'A year focused on building stability, enjoying sensory pleasures, and solidifying your financial foundation.',
  gemini: 'A year of communication, learning, and social connections. Ideas flow freely and curiosity drives your growth.',
  cancer: 'A year centered on home, family, and emotional security. Nurturing yourself and creating a safe haven is paramount.',
  leo: 'A year of creative self-expression, confidence, and stepping into the spotlight. Pursue what brings you joy.',
  virgo: 'A year of refinement, health improvement, and service. Attention to detail and practical matters pays dividends.',
  libra: 'A year emphasizing partnerships, balance, and harmony. Relationships take center stage and diplomacy serves you well.',
  scorpio: 'A year of deep transformation, emotional intensity, and letting go. You emerge stronger from whatever you face.',
  sagittarius: 'A year of adventure, expansion, and philosophical growth. Travel, education, and broadening your horizons are favored.',
  capricorn: 'A year of ambition, discipline, and building toward long-term goals. Hard work and structure lead to achievement.',
  aquarius: 'A year of innovation, community involvement, and embracing your unique path. Break free from conventions that limit you.',
  pisces: 'A year of spiritual depth, creativity, and compassion. Trust your intuition and let your imagination guide you.',
};

// ── Public API ───────────────────────────────────────────────────────

export function computeSolarReturn(
  profileId: string,
  birthDate: string,
  targetYear: number,
): SolarReturnResult {
  if (targetYear < 1900 || targetYear > 2100) {
    throw new Error('Solar return data is available for years 1900-2100.');
  }

  const birthParts = birthDate.split('-');
  const birthMonth = parseInt(birthParts[1], 10);
  const birthDay = parseInt(birthParts[2], 10);

  // Solar return occurs near the birthday each year
  // Use the birthday in the target year (simplified, accurate to within 1 day)
  const maxDay = new Date(targetYear, birthMonth, 0).getDate();
  const adjustedDay = Math.min(birthDay, maxDay);
  const returnDate = `${targetYear}-${String(birthMonth).padStart(2, '0')}-${String(adjustedDay).padStart(2, '0')}`;

  const sunSign = getZodiacSign(returnDate);
  // Approximate moon sign using the return date
  const moonSign = getMoonSign(returnDate);
  const yearTheme = YEAR_THEMES[sunSign];

  return {
    profileId,
    returnYear: targetYear,
    returnDate,
    sunSign,
    moonSign,
    yearTheme,
  };
}

export function computeSolarReturnRange(
  profileId: string,
  birthDate: string,
  currentYear: number,
  yearsBack: number = 5,
  yearsForward: number = 2,
): SolarReturnResult[] {
  const results: SolarReturnResult[] = [];
  for (let year = currentYear - yearsBack; year <= currentYear + yearsForward; year++) {
    results.push(computeSolarReturn(profileId, birthDate, year));
  }
  return results;
}
