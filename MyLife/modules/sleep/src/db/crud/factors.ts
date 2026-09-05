import type { DatabaseAdapter } from '@mylife/db';
import {
  FactorDateSchema,
  FactorCorrelationPointSchema,
  FactorCorrelationsSchema,
  FactorCreateSchema,
  FactorListOptionsSchema,
  FactorMetricCorrelationSchema,
  FactorSchema,
  FactorUpdateSchema,
  rowToFactor,
  clockTimeToMinutes,
  stringifyFactorStringArray,
  type Factor,
  type FactorAssociationSummary,
  type FactorCorrelationMetric,
  type FactorCorrelationPoint,
  type FactorCorrelations,
  type FactorCreateInput,
  type FactorListOptions,
  type FactorUpdateInput,
} from '../../models/factor-schemas';
import { getEntry, getEntryByDate } from './entries';

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized ? normalized : null;
}

function roundToTwoDecimals(value: number): number {
  return Number(value.toFixed(2));
}

function roundToThreeDecimals(value: number): number {
  return Number(value.toFixed(3));
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return roundToTwoDecimals(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function computePearsonCorrelation(
  x: number[],
  y: number[],
): number | null {
  const sampleSize = Math.min(x.length, y.length);
  if (sampleSize < 5) {
    return null;
  }

  let sumX = 0;
  let sumY = 0;
  for (let index = 0; index < sampleSize; index += 1) {
    sumX += x[index];
    sumY += y[index];
  }
  const meanX = sumX / sampleSize;
  const meanY = sumY / sampleSize;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let index = 0; index < sampleSize; index += 1) {
    const deltaX = x[index] - meanX;
    const deltaY = y[index] - meanY;
    numerator += deltaX * deltaY;
    denomX += deltaX * deltaX;
    denomY += deltaY * deltaY;
  }

  const denominator = Math.sqrt(denomX * denomY);
  if (denominator === 0) {
    return null;
  }

  return roundToThreeDecimals(numerator / denominator);
}

function getFactorCountByEntry(
  db: DatabaseAdapter,
  sleepEntryId: string,
  excludeId?: string,
): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM sl_factors
     WHERE sleep_entry_id = ?
       ${excludeId ? 'AND id != ?' : ''}`,
    excludeId ? [sleepEntryId, excludeId] : [sleepEntryId],
  );

  return rows[0]?.count ?? 0;
}

function assertFactorEntryLink(
  db: DatabaseAdapter,
  sleepEntryId: string | null,
  date: string,
  factorId?: string,
): void {
  if (!sleepEntryId) {
    return;
  }

  const entry = getEntry(db, sleepEntryId);
  if (!entry) {
    throw new Error(`Sleep entry not found for factor: ${sleepEntryId}`);
  }
  if (entry.date !== date) {
    throw new Error('Factor date must match the linked sleep entry date');
  }
  if (getFactorCountByEntry(db, sleepEntryId, factorId) > 0) {
    throw new Error('A factor record already exists for this sleep entry');
  }
}

function assertExerciseTiming(
  exerciseToday: boolean,
  exerciseTime: string | null,
): void {
  if (!exerciseToday && exerciseTime) {
    throw new Error('exercise_time requires exercise_today to be true');
  }
}

function minutesBeforeBed(
  clockTime: string | null,
  bedtime: string | null,
): number | null {
  if (!clockTime || !bedtime) {
    return null;
  }

  const bedtimeDate = new Date(bedtime);
  if (Number.isNaN(bedtimeDate.getTime())) {
    return null;
  }

  const bedtimeMinutes =
    (bedtimeDate.getUTCHours() * 60) + bedtimeDate.getUTCMinutes();
  const factorMinutes = clockTimeToMinutes(clockTime);
  let delta = bedtimeMinutes - factorMinutes;
  if (delta < 0) {
    delta += 24 * 60;
  }

  return delta;
}

function buildAssociationSummaries(
  points: FactorCorrelationPoint[],
  getValues: (point: FactorCorrelationPoint) => readonly string[],
): FactorAssociationSummary[] {
  const buckets = new Map<
    string,
    {
      count: number;
      quality: number[];
      duration: number[];
      wakeCount: number[];
    }
  >();

  for (const point of points) {
    for (const value of getValues(point)) {
      let bucket = buckets.get(value);
      if (!bucket) {
        bucket = {
          count: 0,
          quality: [],
          duration: [],
          wakeCount: [],
        };
        buckets.set(value, bucket);
      }

      bucket.count += 1;
      if (point.qualityRating !== null) {
        bucket.quality.push(point.qualityRating);
      }
      if (point.durationMinutes !== null) {
        bucket.duration.push(point.durationMinutes);
      }
      if (point.wakeCount !== null) {
        bucket.wakeCount.push(point.wakeCount);
      }
    }
  }

  return [...buckets.entries()]
    .map(([value, bucket]) => ({
      value,
      count: bucket.count,
      averageQualityRating: average(bucket.quality),
      averageDurationMinutes: average(bucket.duration),
      averageWakeCount: average(bucket.wakeCount),
    }))
    .sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      if (a.averageQualityRating !== b.averageQualityRating) {
        return (b.averageQualityRating ?? 0) - (a.averageQualityRating ?? 0);
      }
      return a.value.localeCompare(b.value);
    });
}

function buildNumericCorrelation(
  points: FactorCorrelationPoint[],
  metric: FactorCorrelationMetric,
  getValue: (point: FactorCorrelationPoint) => number | null,
) {
  const values: number[] = [];
  const quality: number[] = [];

  for (const point of points) {
    const value = getValue(point);
    if (value === null || point.qualityRating === null) {
      continue;
    }

    values.push(value);
    quality.push(point.qualityRating);
  }

  return FactorMetricCorrelationSchema.parse({
    metric,
    coefficient: computePearsonCorrelation(values, quality),
    sampleSize: values.length,
  });
}

export function createFactor(
  db: DatabaseAdapter,
  rawInput: FactorCreateInput,
): Factor {
  const input = FactorCreateSchema.parse(rawInput);
  const sleepEntryId = input.sleep_entry_id ?? null;
  assertExerciseTiming(input.exercise_today, input.exercise_time);
  assertFactorEntryLink(db, sleepEntryId, input.date);

  const id = crypto.randomUUID();
  const created_at = nowIso();

  db.execute(
    `INSERT INTO sl_factors
      (id, sleep_entry_id, date, last_caffeine_time, last_meal_time,
       alcohol_drinks, exercise_today, exercise_time, screen_cutoff_time,
       room_temp, room_light, room_noise, supplements, stress_level,
       pre_sleep_activities, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      sleepEntryId,
      input.date,
      input.last_caffeine_time,
      input.last_meal_time,
      input.alcohol_drinks,
      input.exercise_today ? 1 : 0,
      input.exercise_time,
      input.screen_cutoff_time,
      input.room_temp,
      input.room_light,
      input.room_noise,
      stringifyFactorStringArray(input.supplements),
      input.stress_level,
      stringifyFactorStringArray(input.pre_sleep_activities),
      normalizeOptionalText(input.notes),
      created_at,
    ],
  );

  return FactorSchema.parse({
    id,
    sleep_entry_id: sleepEntryId,
    date: input.date,
    last_caffeine_time: input.last_caffeine_time,
    last_meal_time: input.last_meal_time,
    alcohol_drinks: input.alcohol_drinks,
    exercise_today: input.exercise_today,
    exercise_time: input.exercise_time,
    screen_cutoff_time: input.screen_cutoff_time,
    room_temp: input.room_temp,
    room_light: input.room_light,
    room_noise: input.room_noise,
    supplements: input.supplements,
    stress_level: input.stress_level,
    pre_sleep_activities: input.pre_sleep_activities,
    notes: normalizeOptionalText(input.notes),
    created_at,
  });
}

export function getFactor(db: DatabaseAdapter, id: string): Factor | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sl_factors WHERE id = ?`,
    [id],
  );

  return rows.length > 0 ? rowToFactor(rows[0]) : null;
}

export function getFactorByDate(
  db: DatabaseAdapter,
  date: string,
): Factor | null {
  const parsedDate = FactorDateSchema.parse(date);
  const rows = db.query<Record<string, unknown>>(
    `SELECT *
     FROM sl_factors
     WHERE date = ?
     ORDER BY CASE WHEN sleep_entry_id IS NULL THEN 1 ELSE 0 END,
              created_at DESC
     LIMIT 1`,
    [parsedDate],
  );

  return rows.length > 0 ? rowToFactor(rows[0]) : null;
}

export function getFactorByEntry(
  db: DatabaseAdapter,
  sleepEntryId: string,
): Factor | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT *
     FROM sl_factors
     WHERE sleep_entry_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [sleepEntryId],
  );

  return rows.length > 0 ? rowToFactor(rows[0]) : null;
}

export function saveFactorLog(
  db: DatabaseAdapter,
  rawInput: FactorCreateInput,
): Factor {
  const input = FactorCreateSchema.parse(rawInput);
  const sleepEntryId =
    input.sleep_entry_id
    ?? getEntryByDate(db, input.date)?.id
    ?? null;
  const existing =
    (sleepEntryId ? getFactorByEntry(db, sleepEntryId) : null)
    ?? getFactorByDate(db, input.date);

  if (!existing) {
    return createFactor(db, {
      ...input,
      ...(sleepEntryId ? { sleep_entry_id: sleepEntryId } : {}),
    });
  }

  if (
    sleepEntryId &&
    existing.sleep_entry_id &&
    existing.sleep_entry_id !== sleepEntryId
  ) {
    throw new Error('A factor record already exists for this sleep entry');
  }

  const updated = updateFactor(db, existing.id, {
    sleep_entry_id: sleepEntryId ?? existing.sleep_entry_id,
    date: input.date,
    last_caffeine_time: input.last_caffeine_time,
    last_meal_time: input.last_meal_time,
    alcohol_drinks: input.alcohol_drinks,
    exercise_today: input.exercise_today,
    exercise_time: input.exercise_time,
    screen_cutoff_time: input.screen_cutoff_time,
    room_temp: input.room_temp,
    room_light: input.room_light,
    room_noise: input.room_noise,
    supplements: input.supplements,
    stress_level: input.stress_level,
    pre_sleep_activities: input.pre_sleep_activities,
    notes: input.notes,
  });

  if (!updated) {
    throw new Error('Could not save factor log');
  }

  return updated;
}

export function updateFactor(
  db: DatabaseAdapter,
  id: string,
  rawInput: FactorUpdateInput,
): Factor | null {
  const existing = getFactor(db, id);
  if (!existing) {
    return null;
  }

  const updates = FactorUpdateSchema.parse(rawInput);
  if (Object.keys(updates).length === 0) {
    return existing;
  }

  const next: Factor = {
    ...existing,
    sleep_entry_id:
      updates.sleep_entry_id === undefined
        ? existing.sleep_entry_id
        : updates.sleep_entry_id,
    date: updates.date ?? existing.date,
    last_caffeine_time:
      updates.last_caffeine_time === undefined
        ? existing.last_caffeine_time
        : updates.last_caffeine_time,
    last_meal_time:
      updates.last_meal_time === undefined
        ? existing.last_meal_time
        : updates.last_meal_time,
    alcohol_drinks: updates.alcohol_drinks ?? existing.alcohol_drinks,
    exercise_today: updates.exercise_today ?? existing.exercise_today,
    exercise_time:
      updates.exercise_time === undefined
        ? existing.exercise_time
        : updates.exercise_time,
    screen_cutoff_time:
      updates.screen_cutoff_time === undefined
        ? existing.screen_cutoff_time
        : updates.screen_cutoff_time,
    room_temp:
      updates.room_temp === undefined
        ? existing.room_temp
        : updates.room_temp,
    room_light:
      updates.room_light === undefined
        ? existing.room_light
        : updates.room_light,
    room_noise:
      updates.room_noise === undefined
        ? existing.room_noise
        : updates.room_noise,
    supplements: updates.supplements ?? existing.supplements,
    stress_level:
      updates.stress_level === undefined
        ? existing.stress_level
        : updates.stress_level,
    pre_sleep_activities:
      updates.pre_sleep_activities ?? existing.pre_sleep_activities,
    notes:
      updates.notes === undefined
        ? existing.notes
        : normalizeOptionalText(updates.notes),
  };

  assertExerciseTiming(next.exercise_today, next.exercise_time);
  assertFactorEntryLink(db, next.sleep_entry_id, next.date, id);

  db.execute(
    `UPDATE sl_factors
     SET sleep_entry_id = ?, date = ?, last_caffeine_time = ?,
         last_meal_time = ?, alcohol_drinks = ?, exercise_today = ?,
         exercise_time = ?, screen_cutoff_time = ?, room_temp = ?,
         room_light = ?, room_noise = ?, supplements = ?, stress_level = ?,
         pre_sleep_activities = ?, notes = ?
     WHERE id = ?`,
    [
      next.sleep_entry_id,
      next.date,
      next.last_caffeine_time,
      next.last_meal_time,
      next.alcohol_drinks,
      next.exercise_today ? 1 : 0,
      next.exercise_time,
      next.screen_cutoff_time,
      next.room_temp,
      next.room_light,
      next.room_noise,
      stringifyFactorStringArray(next.supplements),
      next.stress_level,
      stringifyFactorStringArray(next.pre_sleep_activities),
      next.notes,
      id,
    ],
  );

  return getFactor(db, id);
}

export function deleteFactor(db: DatabaseAdapter, id: string): boolean {
  const existing = getFactor(db, id);
  if (!existing) {
    return false;
  }

  db.execute(`DELETE FROM sl_factors WHERE id = ?`, [id]);
  return true;
}

export function listFactors(
  db: DatabaseAdapter,
  rawOptions?: FactorListOptions,
): Factor[] {
  const options = FactorListOptionsSchema.parse(rawOptions ?? {});
  const where: string[] = [];
  const params: unknown[] = [];

  if (options.startDate) {
    where.push('date >= ?');
    params.push(options.startDate);
  }
  if (options.endDate) {
    where.push('date <= ?');
    params.push(options.endDate);
  }

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.query<Record<string, unknown>>(
    `SELECT *
     FROM sl_factors
     ${whereClause}
     ORDER BY date DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return rows.map(rowToFactor);
}

export function getFactorCorrelations(
  db: DatabaseAdapter,
): FactorCorrelations {
  const rows = db.query<Record<string, unknown>>(
    `SELECT f.*,
            e.bedtime as entry_bedtime,
            e.quality_rating as entry_quality_rating,
            e.duration_minutes as entry_duration_minutes,
            e.wake_count as entry_wake_count
     FROM sl_factors f
     LEFT JOIN sl_sleep_entries e ON e.id = f.sleep_entry_id
     ORDER BY f.date ASC, f.created_at ASC
     LIMIT 5000`,
  );

  const points = rows.map((row) => {
    const factor = rowToFactor(row);
    return {
      factorId: factor.id,
      sleepEntryId: factor.sleep_entry_id,
      date: factor.date,
      qualityRating:
        typeof row.entry_quality_rating === 'number'
          ? row.entry_quality_rating
          : null,
      durationMinutes:
        typeof row.entry_duration_minutes === 'number'
          ? row.entry_duration_minutes
          : null,
      wakeCount:
        typeof row.entry_wake_count === 'number'
          ? row.entry_wake_count
          : null,
      alcoholDrinks: factor.alcohol_drinks,
      exerciseToday: factor.exercise_today,
      stressLevel: factor.stress_level,
      roomTemp: factor.room_temp,
      roomLight: factor.room_light,
      roomNoise: factor.room_noise,
      supplements: factor.supplements,
      preSleepActivities: factor.pre_sleep_activities,
      lastCaffeineMinutesBeforeBed: minutesBeforeBed(
        factor.last_caffeine_time,
        row.entry_bedtime as string | null,
      ),
      lastMealMinutesBeforeBed: minutesBeforeBed(
        factor.last_meal_time,
        row.entry_bedtime as string | null,
      ),
      screenCutoffMinutesBeforeBed: minutesBeforeBed(
        factor.screen_cutoff_time,
        row.entry_bedtime as string | null,
      ),
      exerciseMinutesBeforeBed: factor.exercise_today
        ? minutesBeforeBed(
            factor.exercise_time,
            row.entry_bedtime as string | null,
          )
        : null,
    };
  });

  const typedPoints = points.map((point) =>
    FactorCorrelationPointSchema.parse(point),
  );

  return FactorCorrelationsSchema.parse({
    sampleSize: typedPoints.filter((point) => point.qualityRating !== null).length,
    points: typedPoints,
    activityAssociations: buildAssociationSummaries(
      typedPoints,
      (point) => point.preSleepActivities,
    ),
    supplementAssociations: buildAssociationSummaries(
      typedPoints,
      (point) => point.supplements,
    ),
    roomTempAssociations: buildAssociationSummaries(
      typedPoints,
      (point) => (point.roomTemp ? [point.roomTemp] : []),
    ),
    roomLightAssociations: buildAssociationSummaries(
      typedPoints,
      (point) => (point.roomLight ? [point.roomLight] : []),
    ),
    roomNoiseAssociations: buildAssociationSummaries(
      typedPoints,
      (point) => (point.roomNoise ? [point.roomNoise] : []),
    ),
    numericCorrelations: [
      buildNumericCorrelation(
        typedPoints,
        'alcoholDrinks',
        (point) => point.alcoholDrinks,
      ),
      buildNumericCorrelation(
        typedPoints,
        'stressLevel',
        (point) => point.stressLevel,
      ),
      buildNumericCorrelation(
        typedPoints,
        'exerciseToday',
        (point) => (point.exerciseToday ? 1 : 0),
      ),
      buildNumericCorrelation(
        typedPoints,
        'lastCaffeineMinutesBeforeBed',
        (point) => point.lastCaffeineMinutesBeforeBed,
      ),
      buildNumericCorrelation(
        typedPoints,
        'lastMealMinutesBeforeBed',
        (point) => point.lastMealMinutesBeforeBed,
      ),
      buildNumericCorrelation(
        typedPoints,
        'screenCutoffMinutesBeforeBed',
        (point) => point.screenCutoffMinutesBeforeBed,
      ),
      buildNumericCorrelation(
        typedPoints,
        'exerciseMinutesBeforeBed',
        (point) => point.exerciseMinutesBeforeBed,
      ),
    ],
  });
}
