import type { ClothingItem, Hemisphere, Season } from '../types';

const NORTHERN_SEASONS: Array<{ months: number[]; season: Season }> = [
  { months: [3, 4, 5], season: 'spring' },
  { months: [6, 7, 8], season: 'summer' },
  { months: [9, 10, 11], season: 'fall' },
  { months: [12, 1, 2], season: 'winter' },
];

const SOUTHERN_SEASONS: Array<{ months: number[]; season: Season }> = [
  { months: [9, 10, 11], season: 'spring' },
  { months: [12, 1, 2], season: 'summer' },
  { months: [3, 4, 5], season: 'fall' },
  { months: [6, 7, 8], season: 'winter' },
];

export function detectCurrentSeason(date: Date, hemisphere: Hemisphere = 'northern'): Season {
  const month = date.getUTCMonth() + 1;
  const seasonMap = hemisphere === 'northern' ? NORTHERN_SEASONS : SOUTHERN_SEASONS;
  const match = seasonMap.find((s) => s.months.includes(month));
  return match?.season ?? 'spring';
}

export function getSeasonBoundaryDate(
  season: Season,
  year: number,
  hemisphere: Hemisphere = 'northern',
): Date {
  const seasonMap = hemisphere === 'northern' ? NORTHERN_SEASONS : SOUTHERN_SEASONS;
  const entry = seasonMap.find((s) => s.season === season);
  if (!entry) return new Date(`${year}-01-01T00:00:00Z`);
  const firstMonth = Math.min(...entry.months);
  const adjustedYear = season === 'winter' && hemisphere === 'northern' && firstMonth === 12 ? year : year;
  return new Date(`${adjustedYear}-${String(firstMonth).padStart(2, '0')}-01T00:00:00Z`);
}

export function shouldShowRotationReminder(
  currentDate: Date,
  lastRotationDate: string | null,
  _advanceDays: number,
  hemisphere: Hemisphere,
): boolean {
  const currentSeason = detectCurrentSeason(currentDate, hemisphere);
  if (lastRotationDate) {
    const lastSeason = detectCurrentSeason(new Date(lastRotationDate), hemisphere);
    if (lastSeason === currentSeason) return false;
  }
  return true;
}

function isAllSeason(item: ClothingItem): boolean {
  return item.seasons.length === 0 || item.seasons.includes('all-season');
}

function itemMatchesSeason(item: ClothingItem, season: Season): boolean {
  if (isAllSeason(item)) return true;
  return item.seasons.includes(season);
}

export function getItemsToStore(
  items: ClothingItem[],
  outgoingSeason: Season,
  currentSeason: Season,
): ClothingItem[] {
  return items.filter((item) => {
    if (item.status !== 'active') return false;
    if (isAllSeason(item)) return false;
    if (itemMatchesSeason(item, currentSeason)) return false;
    return item.seasons.includes(outgoingSeason);
  });
}

export function getItemsToActivate(
  items: ClothingItem[],
  incomingSeason: Season,
): ClothingItem[] {
  return items.filter((item) => {
    if (item.status !== 'stored') return false;
    if (isAllSeason(item)) return false;
    return item.seasons.includes(incomingSeason);
  });
}

export function getPreviousSeason(season: Season): Season {
  const order: Season[] = ['spring', 'summer', 'fall', 'winter'];
  const idx = order.indexOf(season);
  return order[(idx - 1 + 4) % 4]!;
}
