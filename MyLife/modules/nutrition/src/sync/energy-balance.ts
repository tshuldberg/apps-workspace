import type { DatabaseAdapter } from '@mylife/db';
import type {
  EnergyLogEntry,
  EnergyBalance,
  DailyEnergyBreakdown,
  UserProfile,
  UserSex,
  ActivityLevel,
} from './types';
import { ACTIVITY_MULTIPLIERS, DEFAULT_USER_PROFILE } from './types';
import { getSetting } from '../db/settings';

// ---------------------------------------------------------------------------
// Row mapper
// ---------------------------------------------------------------------------

function rowToEnergyLog(row: Record<string, unknown>): EnergyLogEntry {
  return {
    id: row.id as string,
    date: row.date as string,
    basalCalories: row.basal_calories as number,
    activeCalories: row.active_calories as number,
    totalExpenditure: row.total_expenditure as number,
    source: row.source as EnergyLogEntry['source'],
    syncedAt: (row.synced_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// BMR Calculation (Mifflin-St Jeor)
// ---------------------------------------------------------------------------

/**
 * Calculate Basal Metabolic Rate using the Mifflin-St Jeor equation.
 *
 * Male:   (10 x weight_kg) + (6.25 x height_cm) - (5 x age) + 5
 * Female: (10 x weight_kg) + (6.25 x height_cm) - (5 x age) - 161
 */
export function calculateBMR(profile: UserProfile): number;
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: UserSex,
): number;
export function calculateBMR(
  profileOrWeightKg: UserProfile | number,
  heightCm?: number,
  age?: number,
  sex?: UserSex,
): number {
  if (typeof profileOrWeightKg === 'number') {
    const base = 10 * profileOrWeightKg + 6.25 * (heightCm ?? 0) - 5 * (age ?? 0);
    return sex === 'male' ? base + 5 : base - 161;
  }

  const profile = profileOrWeightKg;
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.sex === 'male' ? base + 5 : base - 161;
}

/** Apply activity multiplier to BMR for estimated TDEE */
export function applyActivityMultiplier(bmr: number, level: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[level]);
}

// ---------------------------------------------------------------------------
// User profile from settings
// ---------------------------------------------------------------------------

export function getUserProfile(db: DatabaseAdapter): UserProfile {
  const weightKg = Number(getSetting(db, 'userWeightKg')) || DEFAULT_USER_PROFILE.weightKg;
  const heightCm = Number(getSetting(db, 'userHeightCm')) || DEFAULT_USER_PROFILE.heightCm;
  const age = Number(getSetting(db, 'userAge')) || DEFAULT_USER_PROFILE.age;
  const sex = (getSetting(db, 'userSex') as UserSex) || DEFAULT_USER_PROFILE.sex;
  const activityLevel = (getSetting(db, 'activityLevel') as ActivityLevel) || DEFAULT_USER_PROFILE.activityLevel;

  return { weightKg, heightCm, age, sex, activityLevel };
}

export function hasUserProfile(db: DatabaseAdapter): boolean {
  return getSetting(db, 'userWeightKg') !== undefined;
}

// ---------------------------------------------------------------------------
// Energy log CRUD
// ---------------------------------------------------------------------------

/** Upsert daily energy log entry (one per date) */
export function upsertEnergyLog(
  db: DatabaseAdapter,
  id: string,
  input: {
    date: string;
    basalCalories: number;
    activeCalories: number;
    source?: EnergyLogEntry['source'];
  },
): void {
  const totalExpenditure = input.basalCalories + input.activeCalories;
  const source = input.source ?? 'calculated';

  db.execute(
    `INSERT INTO nu_energy_log (id, date, basal_calories, active_calories, total_expenditure, source, synced_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(date) DO UPDATE SET
       basal_calories = excluded.basal_calories,
       active_calories = excluded.active_calories,
       total_expenditure = excluded.total_expenditure,
       source = excluded.source,
       synced_at = excluded.synced_at`,
    [id, input.date, input.basalCalories, input.activeCalories, totalExpenditure, source],
  );
}

export function getEnergyLog(db: DatabaseAdapter, date: string): EnergyLogEntry | null {
  const rows = db
    .query<Record<string, unknown>>(
      'SELECT * FROM nu_energy_log WHERE date = ?',
      [date],
    );
  return rows.length > 0 ? rowToEnergyLog(rows[0]) : null;
}

export function deleteEnergyLog(db: DatabaseAdapter, date: string): void {
  db.execute('DELETE FROM nu_energy_log WHERE date = ?', [date]);
}

// ---------------------------------------------------------------------------
// Net calories
// ---------------------------------------------------------------------------

/** Calculate net calories: intake minus expenditure */
export function getNetCalories(caloriesIn: number, caloriesOut: number): number {
  return caloriesIn - caloriesOut;
}

/** Get energy balance for a date */
export function getEnergyBalance(db: DatabaseAdapter, date: string): EnergyBalance {
  // Calories in from food log
  const intakeRows = db.query<{ total: number }>(
    `SELECT COALESCE(SUM(i.calories), 0) as total
     FROM nu_food_log_items i
     JOIN nu_food_log l ON l.id = i.log_id
     WHERE l.date = ?`,
    [date],
  );
  const caloriesIn = intakeRows[0]?.total ?? 0;

  // Calories out from energy log
  const energyLog = getEnergyLog(db, date);
  const caloriesOut = energyLog?.totalExpenditure ?? 0;

  return {
    caloriesIn,
    caloriesOut,
    net: getNetCalories(caloriesIn, caloriesOut),
  };
}

/** Get weekly energy balance data (7 days ending on endDate) */
export function getWeeklyEnergyBalance(
  db: DatabaseAdapter,
  endDate: string,
): DailyEnergyBreakdown[] {
  const days: DailyEnergyBreakdown[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const balance = getEnergyBalance(db, dateStr);
    const energyLog = getEnergyLog(db, dateStr);

    days.push({
      date: dateStr,
      bmr: energyLog?.basalCalories ?? 0,
      activeCalories: energyLog?.activeCalories ?? 0,
      totalExpenditure: energyLog?.totalExpenditure ?? 0,
      caloriesIn: balance.caloriesIn,
      net: balance.net,
    });
  }

  return days;
}

/** Calculate and store energy expenditure from BMR for a date */
export function calculateAndStoreExpenditure(
  db: DatabaseAdapter,
  id: string,
  date: string,
): EnergyLogEntry | null {
  const profile = getUserProfile(db);
  const bmr = calculateBMR(profile);
  const tdee = applyActivityMultiplier(bmr, profile.activityLevel);

  upsertEnergyLog(db, id, {
    date,
    basalCalories: Math.round(bmr),
    activeCalories: tdee - Math.round(bmr),
    source: 'calculated',
  });

  return getEnergyLog(db, date);
}

// ---------------------------------------------------------------------------
// Cross-module: read active energy from health module
// ---------------------------------------------------------------------------

/**
 * Attempt to read active energy from the health module's hl_vitals table.
 * Returns null if the health module is not enabled or table doesn't exist.
 */
export function readActiveCaloriesFromHealth(db: DatabaseAdapter, date: string): number | null {
  try {
    // Check if hl_vitals table exists
    const tableExists = db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='hl_vitals'",
    );
    if (tableExists.length === 0) return null;

    const rows = db.query<{ total: number }>(
      `SELECT COALESCE(SUM(CAST(value AS REAL)), 0) as total
       FROM hl_vitals
       WHERE vital_type = 'active_energy' AND date = ?`,
      [date],
    );
    return rows[0]?.total ?? null;
  } catch {
    return null;
  }
}
