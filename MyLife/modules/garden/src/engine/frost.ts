import { ZONE_FROST_DATES, PLANTING_CALENDAR } from './frost-data';

export function lookupZone(usdaZone: string): { avgLastFrost: string; avgFirstFrost: string; growingSeasonDays: number } | null {
  return ZONE_FROST_DATES[usdaZone.toLowerCase()] ?? null;
}

export function calculateCountdown(targetMmDd: string, today: string): number {
  const todayDate = new Date(today + 'T00:00:00Z');
  const year = todayDate.getUTCFullYear();
  let target = new Date(Date.UTC(year, ...parseMmDd(targetMmDd)));
  // If the target has passed this year, use next year
  if (target.getTime() < todayDate.getTime()) {
    target = new Date(Date.UTC(year + 1, ...parseMmDd(targetMmDd)));
  }
  return Math.ceil((target.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
}

function parseMmDd(mmdd: string): [number, number] {
  const [m, d] = mmdd.split('-').map(Number);
  return [m - 1, d]; // month is 0-indexed
}

export function getCurrentFrostPhase(
  lastFrost: string,
  firstFrost: string,
  today: string,
): { phase: 'pre_season' | 'growing' | 'pre_frost' | 'off_season'; daysUntilEvent: number; eventDate: string; eventName: string } {
  const todayDate = new Date(today + 'T00:00:00Z');
  const year = todayDate.getUTCFullYear();
  const lastFrostDate = new Date(Date.UTC(year, ...parseMmDd(lastFrost)));
  const firstFrostDate = new Date(Date.UTC(year, ...parseMmDd(firstFrost)));

  const todayTime = todayDate.getTime();

  if (todayTime < lastFrostDate.getTime()) {
    const days = Math.ceil((lastFrostDate.getTime() - todayTime) / (1000 * 60 * 60 * 24));
    return { phase: 'pre_season', daysUntilEvent: days, eventDate: `${year}-${lastFrost}`, eventName: 'Last frost' };
  }

  if (todayTime >= lastFrostDate.getTime() && todayTime < firstFrostDate.getTime()) {
    const daysToFirst = Math.ceil((firstFrostDate.getTime() - todayTime) / (1000 * 60 * 60 * 24));
    if (daysToFirst <= 30) {
      return { phase: 'pre_frost', daysUntilEvent: daysToFirst, eventDate: `${year}-${firstFrost}`, eventName: 'First frost' };
    }
    return { phase: 'growing', daysUntilEvent: daysToFirst, eventDate: `${year}-${firstFrost}`, eventName: 'First frost' };
  }

  // After first frost - off season, count to next year's last frost
  const nextLastFrost = new Date(Date.UTC(year + 1, ...parseMmDd(lastFrost)));
  const days = Math.ceil((nextLastFrost.getTime() - todayTime) / (1000 * 60 * 60 * 24));
  return { phase: 'off_season', daysUntilEvent: days, eventDate: `${year + 1}-${lastFrost}`, eventName: 'Last frost' };
}

export function getPlantingCalendar(): Array<{
  crop: string;
  indoorStartWeeksBefore: number | null;
  transplantWeeksAfter: number | null;
  directSow: boolean;
  harvestWeeksBefore: number | null;
}> {
  return PLANTING_CALENDAR.map((entry) => ({
    crop: entry.crop,
    indoorStartWeeksBefore: entry.indoorStartWeeksBefore,
    transplantWeeksAfter: entry.transplantWeeksAfter,
    directSow: entry.directSow,
    harvestWeeksBefore: entry.harvestWeeksBeforeFirst,
  }));
}
