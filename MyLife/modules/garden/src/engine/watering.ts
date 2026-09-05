import type { Season } from '../types';

/**
 * Calculate the next watering date given last watered date and frequency.
 * Pure function - no I/O.
 */
export function calculateNextWaterDate(
  lastWatered: string,
  frequencyDays: number,
): string {
  // Use UTC to avoid timezone shifts
  const d = new Date(lastWatered + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + frequencyDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculate how many days overdue a plant is for watering.
 * Returns 0 if not overdue, positive number if overdue.
 * Returns frequencyDays if never watered (treat as maximally overdue).
 */
export function isDaysOverdue(
  lastWatered: string | null,
  frequencyDays: number,
  today: string,
): number {
  if (!lastWatered) return frequencyDays;
  const lastDate = new Date(lastWatered + 'T00:00:00Z');
  const todayDate = new Date(today + 'T00:00:00Z');
  const daysSince = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysSince - frequencyDays);
}

/**
 * Get the current season from a month number (0-11).
 */
export function getSeason(month: number): Season {
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

/**
 * Adjust watering frequency by season.
 * Summer = more frequent (multiply by 0.67), Winter = less frequent (multiply by 2.0).
 * Per spec: summer 0.67x interval, winter 2x interval.
 */
export function adjustFrequencyForSeason(
  baseDays: number,
  season: Season,
): number {
  const multipliers: Record<Season, number> = {
    spring: 0.85,
    summer: 0.67,
    fall: 1.0,
    winter: 2.0,
  };
  return Math.max(1, Math.round(baseDays * multipliers[season]));
}

/**
 * Calculate survival rate for a collection of plants.
 * survival_rate = alive_plants / total_plants * 100
 */
export function calculateSurvivalRate(
  totalPlants: number,
  deadPlants: number,
): number {
  if (totalPlants === 0) return 100;
  const alive = totalPlants - deadPlants;
  return Math.round((alive / totalPlants) * 1000) / 10;
}

/**
 * Calculate growing degree days (GDD).
 * GDD = max(0, (T_max + T_min) / 2 - T_base)
 * T_base defaults to 10C (50F) for most vegetables.
 */
export function calculateGDD(
  tMax: number,
  tMin: number,
  tBase = 10,
): number {
  return Math.max(0, (tMax + tMin) / 2 - tBase);
}
