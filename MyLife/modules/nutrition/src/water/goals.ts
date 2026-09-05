import type { DatabaseAdapter } from '@mylife/db';
import type { WaterDayTotal, WeeklyWaterTotals } from './types';
import { getSetting } from '../db/settings';

const ML_PER_OZ = 29.5735;

/** Convert ml to oz */
export function convertMlToOz(ml: number): number {
  return ml / ML_PER_OZ;
}

/** Convert oz to ml */
export function convertOzToMl(oz: number): number {
  return oz * ML_PER_OZ;
}

/** Get the user's water goal in ml */
export function getWaterGoalMl(db: DatabaseAdapter): number {
  const val = getSetting(db, 'waterGoalMl');
  const parsed = val ? Number(val) : 2500;
  return Number.isFinite(parsed) && parsed >= 500 ? parsed : 2500;
}

/** Get container presets in ml */
export function getWaterContainers(db: DatabaseAdapter): number[] {
  const val = getSetting(db, 'waterContainersMl');
  if (!val) return [250, 500, 750];
  try {
    const arr = JSON.parse(val) as number[];
    return Array.isArray(arr) && arr.length > 0 ? arr : [250, 500, 750];
  } catch {
    return [250, 500, 750];
  }
}

/** Get the user's preferred water unit */
export function getWaterUnit(db: DatabaseAdapter): 'ml' | 'oz' {
  const val = getSetting(db, 'waterUnit');
  return val === 'oz' ? 'oz' : 'ml';
}

/** Get daily water totals for the past 7 days */
export function getWeeklyWaterTotals(db: DatabaseAdapter, endDate: string): WeeklyWaterTotals {
  const goalMl = getWaterGoalMl(db);
  const days: WaterDayTotal[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const rows = db.query<{ total: number; cnt: number }>(
      'SELECT COALESCE(SUM(amount_ml), 0) as total, COUNT(*) as cnt FROM nu_water_log WHERE date = ?',
      [dateStr],
    );

    days.push({
      date: dateStr,
      totalMl: rows[0]?.total ?? 0,
      entryCount: rows[0]?.cnt ?? 0,
    });
  }

  return { days, goalMl };
}
