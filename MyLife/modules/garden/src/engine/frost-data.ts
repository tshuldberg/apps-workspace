/**
 * Bundled frost date data by USDA hardiness zone.
 * Average last spring frost and first fall frost dates.
 * Data derived from NOAA historical averages (public domain).
 * Format: MM-DD
 */
export interface ZoneFrostDates {
  avgLastFrost: string;
  avgFirstFrost: string;
  growingSeasonDays: number;
}

export const ZONE_FROST_DATES: Record<string, ZoneFrostDates> = {
  '3a': { avgLastFrost: '05-15', avgFirstFrost: '09-15', growingSeasonDays: 123 },
  '3b': { avgLastFrost: '05-10', avgFirstFrost: '09-20', growingSeasonDays: 133 },
  '4a': { avgLastFrost: '05-05', avgFirstFrost: '09-25', growingSeasonDays: 143 },
  '4b': { avgLastFrost: '05-01', avgFirstFrost: '09-30', growingSeasonDays: 152 },
  '5a': { avgLastFrost: '04-25', avgFirstFrost: '10-05', growingSeasonDays: 163 },
  '5b': { avgLastFrost: '04-20', avgFirstFrost: '10-10', growingSeasonDays: 173 },
  '6a': { avgLastFrost: '04-15', avgFirstFrost: '10-15', growingSeasonDays: 183 },
  '6b': { avgLastFrost: '04-10', avgFirstFrost: '10-20', growingSeasonDays: 193 },
  '7a': { avgLastFrost: '04-05', avgFirstFrost: '10-25', growingSeasonDays: 203 },
  '7b': { avgLastFrost: '03-30', avgFirstFrost: '11-01', growingSeasonDays: 216 },
  '8a': { avgLastFrost: '03-20', avgFirstFrost: '11-10', growingSeasonDays: 235 },
  '8b': { avgLastFrost: '03-10', avgFirstFrost: '11-20', growingSeasonDays: 255 },
  '9a': { avgLastFrost: '02-25', avgFirstFrost: '12-01', growingSeasonDays: 279 },
  '9b': { avgLastFrost: '02-15', avgFirstFrost: '12-10', growingSeasonDays: 298 },
  '10a': { avgLastFrost: '01-31', avgFirstFrost: '12-20', growingSeasonDays: 323 },
  '10b': { avgLastFrost: '01-15', avgFirstFrost: '12-31', growingSeasonDays: 350 },
};

/**
 * Common planting calendar: timing relative to frost dates.
 * weeksBeforeLast = start seeds indoors
 * weeksAfterLast = transplant or direct sow
 * weeksBeforeFirst = last safe harvest window
 */
export interface PlantingEntry {
  crop: string;
  indoorStartWeeksBefore: number | null;
  transplantWeeksAfter: number;
  directSow: boolean;
  harvestWeeksBeforeFirst: number;
}

export const PLANTING_CALENDAR: PlantingEntry[] = [
  { crop: 'Tomato', indoorStartWeeksBefore: 8, transplantWeeksAfter: 2, directSow: false, harvestWeeksBeforeFirst: 2 },
  { crop: 'Pepper', indoorStartWeeksBefore: 10, transplantWeeksAfter: 2, directSow: false, harvestWeeksBeforeFirst: 3 },
  { crop: 'Lettuce', indoorStartWeeksBefore: 4, transplantWeeksAfter: 0, directSow: true, harvestWeeksBeforeFirst: 4 },
  { crop: 'Carrot', indoorStartWeeksBefore: null, transplantWeeksAfter: 0, directSow: true, harvestWeeksBeforeFirst: 4 },
  { crop: 'Bean', indoorStartWeeksBefore: null, transplantWeeksAfter: 1, directSow: true, harvestWeeksBeforeFirst: 4 },
  { crop: 'Squash', indoorStartWeeksBefore: 4, transplantWeeksAfter: 2, directSow: true, harvestWeeksBeforeFirst: 2 },
  { crop: 'Cucumber', indoorStartWeeksBefore: 4, transplantWeeksAfter: 2, directSow: true, harvestWeeksBeforeFirst: 3 },
  { crop: 'Basil', indoorStartWeeksBefore: 6, transplantWeeksAfter: 2, directSow: false, harvestWeeksBeforeFirst: 1 },
  { crop: 'Corn', indoorStartWeeksBefore: null, transplantWeeksAfter: 2, directSow: true, harvestWeeksBeforeFirst: 3 },
  { crop: 'Pea', indoorStartWeeksBefore: null, transplantWeeksAfter: -4, directSow: true, harvestWeeksBeforeFirst: 6 },
  { crop: 'Broccoli', indoorStartWeeksBefore: 6, transplantWeeksAfter: 0, directSow: false, harvestWeeksBeforeFirst: 4 },
  { crop: 'Spinach', indoorStartWeeksBefore: null, transplantWeeksAfter: -4, directSow: true, harvestWeeksBeforeFirst: 6 },
  { crop: 'Radish', indoorStartWeeksBefore: null, transplantWeeksAfter: -2, directSow: true, harvestWeeksBeforeFirst: 6 },
  { crop: 'Zucchini', indoorStartWeeksBefore: 4, transplantWeeksAfter: 2, directSow: true, harvestWeeksBeforeFirst: 2 },
  { crop: 'Kale', indoorStartWeeksBefore: 4, transplantWeeksAfter: -2, directSow: true, harvestWeeksBeforeFirst: 2 },
];
