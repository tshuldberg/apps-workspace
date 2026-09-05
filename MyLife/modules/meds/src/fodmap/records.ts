import type { DatabaseAdapter } from '@mylife/db';
import type {
  CreateFoodDiaryInput,
  CreateStoolLogInput,
  FODMAPFood,
  FODMAPRating,
  FoodDiaryEntry,
  StoolLog,
} from '../models/fodmap';
import {
  calculateTriggerCorrelation,
  classifyMealFODMAP,
  getFODMAPTypes,
  type TriggerCorrelation,
} from './engine';
import { SEED_FODMAP_FOODS } from './seed';

export type FodmapLoadTone = 'safe' | 'caution' | 'high';

export interface FodmapLoadSummary {
  tone: FodmapLoadTone;
  label: string;
  mealCount: number;
  lowCount: number;
  moderateCount: number;
  highCount: number;
}

export interface FodmapRecentSymptom {
  id: string;
  name: string;
  severity: number;
  loggedAt: string;
  relatedMeals: string[];
}

export interface FodmapSafeFood {
  name: string;
  rating: FODMAPRating;
  servings: number;
}

export interface FodmapInsights {
  todayLoad: FodmapLoadSummary;
  triggerFoods: TriggerCorrelation[];
  safeFoods: FodmapSafeFood[];
  recentSymptoms: FodmapRecentSymptom[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function rowToFodmapFood(row: Record<string, unknown>): FODMAPFood {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as FODMAPFood['category'],
    fodmapRating: row.fodmap_rating as FODMAPRating,
    fructose: !!(row.fructose as number),
    lactose: !!(row.lactose as number),
    fructan: !!(row.fructan as number),
    galactan: !!(row.galactan as number),
    polyol: !!(row.polyol as number),
    servingSize: (row.serving_size as string) ?? null,
    notes: (row.notes as string) ?? null,
  };
}

function rowToFoodDiaryEntry(row: Record<string, unknown>): FoodDiaryEntry {
  return {
    id: row.id as string,
    mealType: row.meal_type as FoodDiaryEntry['mealType'],
    foodItems: row.food_items as string,
    fodmapRating: row.fodmap_rating as FoodDiaryEntry['fodmapRating'],
    fodmapTypes: (row.fodmap_types as string) ?? null,
    portionSize: (row.portion_size as string) ?? null,
    notes: (row.notes as string) ?? null,
    eatenAt: row.eaten_at as string,
    createdAt: row.created_at as string,
  };
}

function rowToStoolLog(row: Record<string, unknown>): StoolLog {
  return {
    id: row.id as string,
    bristolType: row.bristol_type as number,
    urgency: row.urgency as number,
    painLevel: row.pain_level as number,
    blood: !!(row.blood as number),
    notes: (row.notes as string) ?? null,
    loggedAt: row.logged_at as string,
    createdAt: row.created_at as string,
  };
}

function ensureSeededFodmapFoods(db: DatabaseAdapter): void {
  const countRow = db.query<{ count: number }>(
    'SELECT COUNT(*) as count FROM md_fodmap_foods',
  )[0];
  if ((countRow?.count ?? 0) > 0) {
    return;
  }

  db.transaction(() => {
    for (const statement of SEED_FODMAP_FOODS) {
      db.execute(statement);
    }
  });
}

function buildTodayLoad(entries: FoodDiaryEntry[]): FodmapLoadSummary {
  const counts = entries.reduce(
    (acc, entry) => {
      if (entry.fodmapRating === 'low') acc.lowCount++;
      if (entry.fodmapRating === 'moderate') acc.moderateCount++;
      if (entry.fodmapRating === 'high') acc.highCount++;
      return acc;
    },
    { lowCount: 0, moderateCount: 0, highCount: 0 },
  );

  if (counts.highCount > 0) {
    return { tone: 'high', label: 'High', mealCount: entries.length, ...counts };
  }
  if (counts.moderateCount > 0 || entries.length >= 4) {
    return { tone: 'caution', label: 'Caution', mealCount: entries.length, ...counts };
  }
  return { tone: 'safe', label: 'Safe', mealCount: entries.length, ...counts };
}

function getFoodsForMealNames(db: DatabaseAdapter, foodNames: string[]): FODMAPFood[] {
  if (foodNames.length === 0) {
    return [];
  }

  const placeholders = foodNames.map(() => '?').join(', ');
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM md_fodmap_foods
       WHERE lower(name) IN (${placeholders})`,
      foodNames.map((name) => name.toLowerCase()),
    )
    .map(rowToFodmapFood);
}

export function getFodmapFoods(
  db: DatabaseAdapter,
  opts?: { rating?: FODMAPRating; limit?: number },
): FODMAPFood[] {
  ensureSeededFodmapFoods(db);

  const limit = opts?.limit ?? 120;
  if (opts?.rating) {
    return db
      .query<Record<string, unknown>>(
        `SELECT * FROM md_fodmap_foods
         WHERE fodmap_rating = ?
         ORDER BY name ASC
         LIMIT ?`,
        [opts.rating, limit],
      )
      .map(rowToFodmapFood);
  }

  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM md_fodmap_foods ORDER BY name ASC LIMIT ?',
      [limit],
    )
    .map(rowToFodmapFood);
}

export function searchFodmapFoods(
  db: DatabaseAdapter,
  query: string,
  limit: number = 12,
): FODMAPFood[] {
  ensureSeededFodmapFoods(db);

  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }

  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM md_fodmap_foods
       WHERE lower(name) LIKE ?
       ORDER BY CASE fodmap_rating
         WHEN 'low' THEN 1
         WHEN 'moderate' THEN 2
         ELSE 3
       END,
       name ASC
       LIMIT ?`,
      [`%${trimmed}%`, limit],
    )
    .map(rowToFodmapFood);
}

export function createFoodDiaryEntry(
  db: DatabaseAdapter,
  input: CreateFoodDiaryInput,
  id: string = createId('md_food'),
): FoodDiaryEntry {
  ensureSeededFodmapFoods(db);

  const eatenAt = input.eatenAt ?? nowIso();
  const foodNames = input.foodItems
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const foodMatches = getFoodsForMealNames(db, foodNames);
  const inferredRating = foodMatches.length > 0 ? classifyMealFODMAP(foodMatches) : 'unknown';
  const fodmapTypes = foodMatches.length > 0
    ? JSON.stringify(getFODMAPTypes(foodMatches))
    : null;
  const rating = input.fodmapRating ?? inferredRating;

  db.execute(
    `INSERT INTO md_food_diary
      (id, meal_type, food_items, fodmap_rating, fodmap_types, portion_size, notes, eaten_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.mealType,
      input.foodItems.trim(),
      rating,
      input.fodmapTypes ?? fodmapTypes,
      input.portionSize ?? null,
      input.notes ?? null,
      eatenAt,
      eatenAt,
    ],
  );

  return {
    id,
    mealType: input.mealType,
    foodItems: input.foodItems.trim(),
    fodmapRating: rating,
    fodmapTypes: input.fodmapTypes ?? fodmapTypes,
    portionSize: input.portionSize ?? null,
    notes: input.notes ?? null,
    eatenAt,
    createdAt: eatenAt,
  };
}

export function getFoodDiary(
  db: DatabaseAdapter,
  opts?: { from?: string; to?: string; limit?: number },
): FoodDiaryEntry[] {
  let sql = 'SELECT * FROM md_food_diary WHERE 1=1';
  const params: unknown[] = [];

  if (opts?.from) {
    sql += ' AND eaten_at >= ?';
    params.push(opts.from);
  }
  if (opts?.to) {
    sql += ' AND eaten_at <= ?';
    params.push(opts.to);
  }

  sql += ' ORDER BY eaten_at DESC LIMIT ?';
  params.push(opts?.limit ?? 200);

  return db.query<Record<string, unknown>>(sql, params).map(rowToFoodDiaryEntry);
}

export function deleteFoodDiaryEntry(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM md_food_diary WHERE id = ?', [id]);
}

export function createStoolLog(
  db: DatabaseAdapter,
  input: CreateStoolLogInput,
  id: string = createId('md_stool'),
): StoolLog {
  const loggedAt = input.loggedAt ?? nowIso();

  db.execute(
    `INSERT INTO md_stool_logs
      (id, bristol_type, urgency, pain_level, blood, notes, logged_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.bristolType,
      input.urgency ?? 1,
      input.painLevel ?? 0,
      input.blood ? 1 : 0,
      input.notes ?? null,
      loggedAt,
      loggedAt,
    ],
  );

  return {
    id,
    bristolType: input.bristolType,
    urgency: input.urgency ?? 1,
    painLevel: input.painLevel ?? 0,
    blood: input.blood ?? false,
    notes: input.notes ?? null,
    loggedAt,
    createdAt: loggedAt,
  };
}

export function getStoolLogs(
  db: DatabaseAdapter,
  opts?: { from?: string; to?: string; limit?: number },
): StoolLog[] {
  let sql = 'SELECT * FROM md_stool_logs WHERE 1=1';
  const params: unknown[] = [];

  if (opts?.from) {
    sql += ' AND logged_at >= ?';
    params.push(opts.from);
  }
  if (opts?.to) {
    sql += ' AND logged_at <= ?';
    params.push(opts.to);
  }

  sql += ' ORDER BY logged_at DESC LIMIT ?';
  params.push(opts?.limit ?? 100);

  return db.query<Record<string, unknown>>(sql, params).map(rowToStoolLog);
}

export function deleteStoolLog(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM md_stool_logs WHERE id = ?', [id]);
}

export function getFodmapInsights(
  db: DatabaseAdapter,
  opts?: { today?: string; limit?: number },
): FodmapInsights {
  ensureSeededFodmapFoods(db);

  const today = opts?.today ?? nowIso().slice(0, 10);
  const limit = opts?.limit ?? 200;
  const todayEntries = getFoodDiary(db, {
    from: `${today}T00:00:00.000Z`,
    to: `${today}T23:59:59.999Z`,
    limit,
  });
  const allEntries = getFoodDiary(db, { limit });

  const symptomRows = db.query<{
    id: string;
    name: string;
    severity: number;
    logged_at: string;
  }>(
    `SELECT sl.id, s.name, sl.severity, sl.logged_at
     FROM md_symptom_logs sl
     JOIN md_symptoms s ON s.id = sl.symptom_id
     ORDER BY sl.logged_at DESC
     LIMIT ?`,
    [50],
  );

  const triggerFoods = calculateTriggerCorrelation(
    allEntries.map((entry) => ({
      foodItems: entry.foodItems,
      fodmapRating: entry.fodmapRating,
      eatenAt: entry.eatenAt,
    })),
    symptomRows.map((row) => ({
      severity: row.severity,
      loggedAt: row.logged_at,
    })),
  ).slice(0, 6);

  const triggerFoodNames = new Set(triggerFoods.map((item) => item.foodName.toLowerCase()));
  const safeFoodMap = new Map<string, FodmapSafeFood>();
  for (const entry of allEntries) {
    if (entry.fodmapRating !== 'low') {
      continue;
    }

    for (const foodName of entry.foodItems.split(',').map((item) => item.trim().toLowerCase())) {
      if (!foodName || triggerFoodNames.has(foodName)) {
        continue;
      }

      const existing = safeFoodMap.get(foodName);
      if (existing) {
        existing.servings += 1;
        continue;
      }

      safeFoodMap.set(foodName, {
        name: foodName,
        rating: 'low',
        servings: 1,
      });
    }
  }

  const recentSymptoms = symptomRows.slice(0, 5).map((row) => {
    const symptomAt = new Date(row.logged_at).getTime();
    const relatedMeals = allEntries
      .filter((entry) => {
        const mealAt = new Date(entry.eatenAt).getTime();
        const diffHours = (symptomAt - mealAt) / (1000 * 60 * 60);
        return diffHours >= 0 && diffHours <= 24;
      })
      .slice(0, 3)
      .map((entry) => entry.foodItems);

    return {
      id: row.id,
      name: row.name,
      severity: row.severity,
      loggedAt: row.logged_at,
      relatedMeals,
    };
  });

  return {
    todayLoad: buildTodayLoad(todayEntries),
    triggerFoods,
    safeFoods: Array.from(safeFoodMap.values())
      .sort((left, right) => right.servings - left.servings || left.name.localeCompare(right.name))
      .slice(0, 6),
    recentSymptoms,
  };
}
