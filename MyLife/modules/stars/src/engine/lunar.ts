import { getMoonPhase, getMoonSign } from './astro';
import { MOON_PHASE_INTERPRETATIONS, MOON_SIGN_INTERPRETATIONS } from './interpretations';
import type { MoonPhase, ZodiacSign } from '../types';

// ── Types ────────────────────────────────────────────────────────────

export interface MoonCalendarDay {
  date: string;
  moonPhase: MoonPhase;
  moonSign: ZodiacSign;
  illuminationPct: number;
  isKeyPhase: boolean;
  phaseInterpretation: string;
  signInterpretation: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

const SYNODIC_PERIOD = 29.53059;
const REFERENCE_NEW_MOON_JD = 2451550.1;

function dateToJulianDay(dateStr: string): number {
  const parts = dateStr.split('-');
  let y = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

function getPhaseAngle(date: string): number {
  const jd = dateToJulianDay(date);
  const daysSinceNew = jd - REFERENCE_NEW_MOON_JD;
  const cyclePosition = ((daysSinceNew % SYNODIC_PERIOD) + SYNODIC_PERIOD) % SYNODIC_PERIOD;
  return (cyclePosition / SYNODIC_PERIOD) * 360;
}

const KEY_PHASES: MoonPhase[] = ['new_moon', 'first_quarter', 'full_moon', 'last_quarter'];

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function buildMoonCalendarDay(date: string): MoonCalendarDay {
  const moonPhase = getMoonPhase(date);
  const moonSign = getMoonSign(date);
  const illuminationPct = Math.round(computeIllumination(date) * 10) / 10;
  const isKeyPhase = KEY_PHASES.includes(moonPhase);

  return {
    date,
    moonPhase,
    moonSign,
    illuminationPct,
    isKeyPhase,
    phaseInterpretation: MOON_PHASE_INTERPRETATIONS[moonPhase],
    signInterpretation: MOON_SIGN_INTERPRETATIONS[moonSign],
  };
}

// ── Public API ───────────────────────────────────────────────────────

export function computeIllumination(date: string): number {
  const phaseAngle = getPhaseAngle(date);
  return ((1 - Math.cos((phaseAngle * Math.PI) / 180)) / 2) * 100;
}

export function computeMoonCalendarMonth(year: number, month: number): MoonCalendarDay[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const results: MoonCalendarDay[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    results.push(buildMoonCalendarDay(date));
  }

  return results;
}

export function getKeyPhasesForMonth(year: number, month: number): MoonCalendarDay[] {
  return computeMoonCalendarMonth(year, month).filter((d) => d.isKeyPhase);
}

export function getNextMoonPhase(
  startDate: string,
  targetPhase: MoonPhase,
  maxDaysToScan: number = 45,
): MoonCalendarDay | null {
  let previousPhase = getMoonPhase(startDate);

  for (let offset = 1; offset <= maxDaysToScan; offset++) {
    const candidateDate = addDays(startDate, offset);
    const candidatePhase = getMoonPhase(candidateDate);

    if (candidatePhase === targetPhase && candidatePhase !== previousPhase) {
      return buildMoonCalendarDay(candidateDate);
    }

    previousPhase = candidatePhase;
  }

  return null;
}

export function getNextNewMoon(startDate: string): MoonCalendarDay | null {
  return getNextMoonPhase(startDate, 'new_moon');
}

export function getNextFullMoon(startDate: string): MoonCalendarDay | null {
  return getNextMoonPhase(startDate, 'full_moon');
}
