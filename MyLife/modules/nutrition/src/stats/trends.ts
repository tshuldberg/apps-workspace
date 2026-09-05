import type { DatabaseAdapter } from '@mylife/db';

export interface DayTotal {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MacroRatios {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
  totalCalories: number;
}

function queryDayTotals(db: DatabaseAdapter, startDate: string, endDate: string): DayTotal[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT
         l.date,
         COALESCE(SUM(i.calories), 0) as total_cal,
         COALESCE(SUM(i.protein_g), 0) as total_protein,
         COALESCE(SUM(i.carbs_g), 0) as total_carbs,
         COALESCE(SUM(i.fat_g), 0) as total_fat
       FROM nu_food_log l
       JOIN nu_food_log_items i ON i.log_id = l.id
       WHERE l.date >= ? AND l.date <= ?
       GROUP BY l.date
       ORDER BY l.date ASC`,
      [startDate, endDate],
    )
    .map((row) => ({
      date: row.date as string,
      calories: (row.total_cal as number) ?? 0,
      proteinG: (row.total_protein as number) ?? 0,
      carbsG: (row.total_carbs as number) ?? 0,
      fatG: (row.total_fat as number) ?? 0,
    }));
}

export function getWeeklyTrends(db: DatabaseAdapter, weekStartDate: string): DayTotal[] {
  const start = new Date(weekStartDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return queryDayTotals(db, weekStartDate, end.toISOString().slice(0, 10));
}

export function getMonthlyTrends(db: DatabaseAdapter, year: number, month: number): DayTotal[] {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10);
  return queryDayTotals(db, startDate, endDate);
}

export function getCalorieHistory(db: DatabaseAdapter, days: number): DayTotal[] {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  return queryDayTotals(db, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
}

export function getMacroRatios(db: DatabaseAdapter, startDate: string, endDate: string): MacroRatios {
  const rows = db.query<Record<string, unknown>>(
    `SELECT
       COALESCE(SUM(i.protein_g), 0) as total_protein,
       COALESCE(SUM(i.carbs_g), 0) as total_carbs,
       COALESCE(SUM(i.fat_g), 0) as total_fat,
       COALESCE(SUM(i.calories), 0) as total_cal
     FROM nu_food_log_items i
     JOIN nu_food_log l ON l.id = i.log_id
     WHERE l.date >= ? AND l.date <= ?`,
    [startDate, endDate],
  );
  const row = rows[0];
  const protein = (row.total_protein as number) ?? 0;
  const carbs = (row.total_carbs as number) ?? 0;
  const fat = (row.total_fat as number) ?? 0;
  const totalCal = (row.total_cal as number) ?? 0;

  // Calories from macros: protein/carbs = 4cal/g, fat = 9cal/g
  const proteinCal = protein * 4;
  const carbsCal = carbs * 4;
  const fatCal = fat * 9;
  const totalMacroCal = proteinCal + carbsCal + fatCal;

  if (totalMacroCal === 0) {
    return { proteinPct: 0, carbsPct: 0, fatPct: 0, totalCalories: 0 };
  }

  return {
    proteinPct: Math.round((proteinCal / totalMacroCal) * 100),
    carbsPct: Math.round((carbsCal / totalMacroCal) * 100),
    fatPct: Math.round((fatCal / totalMacroCal) * 100),
    totalCalories: totalCal,
  };
}
