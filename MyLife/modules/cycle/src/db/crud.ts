import type { DatabaseAdapter } from '@mylife/db';
import type {
  Cycle,
  CycleDay,
  Symptom,
  Temperature,
  CreateCycleInput,
  CreateCycleDayRawInput,
  UpdateCycleDayInput,
  CreateTemperatureRawInput,
  CycleStats,
  PregnancyConfig,
  Appointment,
  CreatePregnancyInput,
  CreateAppointmentInput,
  UpdateAppointmentInput,
  PartnerLink,
  CreatePartnerLinkRawInput,
  UpdatePartnerLinkInput,
} from '../types';
import { CreateCycleInputSchema, CreateCycleDayInputSchema, CreateTemperatureInputSchema, CreatePartnerLinkInputSchema } from '../types';
import { calculateDueDate } from '../engine/pregnancy';
import { generateShareCode } from '../engine/sharing';

// ── Helpers ────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function rowToCycle(row: Record<string, unknown>): Cycle {
  return {
    id: row.id as string,
    startDate: row.start_date as string,
    endDate: (row.end_date as string) ?? null,
    periodEndDate: (row.period_end_date as string) ?? null,
    lengthDays: (row.cycle_length as number) ?? null,
    periodLength: (row.period_length as number) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToCycleDay(row: Record<string, unknown>): CycleDay {
  return {
    id: row.id as string,
    date: row.date as string,
    cycleId: (row.cycle_id as string) ?? null,
    phase: (row.phase as CycleDay['phase']) ?? null,
    flowLevel: (row.flow_level as CycleDay['flowLevel']) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function rowToSymptom(row: Record<string, unknown>): Symptom {
  return {
    id: row.id as string,
    cycleDayId: row.cycle_day_id as string,
    category: row.category as Symptom['category'],
    symptom: row.symptom as string,
    intensity: row.intensity as Symptom['intensity'],
    createdAt: row.created_at as string,
  };
}

function rowToTemperature(row: Record<string, unknown>): Temperature {
  return {
    id: row.id as string,
    date: row.date as string,
    cycleDayId: (row.cycle_day_id as string) ?? null,
    valueCelsius: row.value_celsius as number,
    timeTaken: (row.time_taken as string) ?? null,
    method: row.method as Temperature['method'],
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Cycles ─────────────────────────────────────────────────────────────

export function createCycle(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateCycleInput,
): Cycle {
  const input = CreateCycleInputSchema.parse(rawInput);
  const now = nowIso();

  let periodLength: number | null = null;
  if (input.periodEndDate) {
    const start = new Date(input.startDate + 'T00:00:00Z');
    const end = new Date(input.periodEndDate + 'T00:00:00Z');
    periodLength = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  db.execute(
    `INSERT INTO cy_cycles (id, start_date, period_end_date, period_length, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.startDate, input.periodEndDate ?? null, periodLength, now],
  );

  return {
    id,
    startDate: input.startDate,
    endDate: null,
    periodEndDate: input.periodEndDate ?? null,
    lengthDays: null,
    periodLength,
    createdAt: now,
  };
}

export function getCycle(db: DatabaseAdapter, id: string): Cycle | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_cycles WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToCycle(rows[0]) : null;
}

export function getCycles(
  db: DatabaseAdapter,
  limit = 50,
  offset = 0,
): Cycle[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_cycles ORDER BY start_date DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
  return rows.map(rowToCycle);
}

export function endCycle(
  db: DatabaseAdapter,
  cycleId: string,
  nextStartDate: string,
): Cycle | null {
  let result: Cycle | null = null;

  db.transaction(() => {
    const cycle = getCycle(db, cycleId);
    if (!cycle) return;

    const start = new Date(cycle.startDate + 'T00:00:00Z');
    const end = new Date(nextStartDate + 'T00:00:00Z');
    const lengthDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // The end date is the day before the next cycle starts
    const endDate = new Date(end);
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    const endDateStr = endDate.toISOString().slice(0, 10);

    db.execute(
      `UPDATE cy_cycles SET end_date = ?, cycle_length = ? WHERE id = ?`,
      [endDateStr, lengthDays, cycleId],
    );

    result = {
      ...cycle,
      endDate: endDateStr,
      lengthDays,
    };
  });

  return result;
}

export function deleteCycle(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM cy_cycles WHERE id = ?`, [id]);
  return true;
}

// ── Cycle Days ─────────────────────────────────────────────────────────

export function createCycleDay(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateCycleDayRawInput,
): CycleDay {
  const input = CreateCycleDayInputSchema.parse(rawInput);
  const now = nowIso();

  db.transaction(() => {
    db.execute(
      `INSERT INTO cy_cycle_days (id, date, cycle_id, phase, flow_level, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.date,
        input.cycleId ?? null,
        input.phase ?? null,
        input.flowLevel ?? null,
        input.notes ?? null,
        now,
      ],
    );

    for (const symptomInput of input.symptoms) {
      const symptomId = crypto.randomUUID();
      db.execute(
        `INSERT INTO cy_symptoms (id, cycle_day_id, category, symptom, intensity, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [symptomId, id, symptomInput.category, symptomInput.symptom, symptomInput.intensity, now],
      );
    }
  });

  return {
    id,
    date: input.date,
    cycleId: input.cycleId ?? null,
    phase: input.phase ?? null,
    flowLevel: input.flowLevel ?? null,
    notes: input.notes ?? null,
    createdAt: now,
  };
}

export function getCycleDaysByDate(
  db: DatabaseAdapter,
  date: string,
  limit = 100,
): CycleDay[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_cycle_days WHERE date = ? ORDER BY created_at DESC LIMIT ?`,
    [date, limit],
  );
  return rows.map(rowToCycleDay);
}

export function getCycleDaysByCycle(
  db: DatabaseAdapter,
  cycleId: string,
  limit = 500,
): CycleDay[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_cycle_days WHERE cycle_id = ? ORDER BY date ASC LIMIT ?`,
    [cycleId, limit],
  );
  return rows.map(rowToCycleDay);
}

export function getCycleDayByDate(
  db: DatabaseAdapter,
  date: string,
): CycleDay | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_cycle_days WHERE date = ?`,
    [date],
  );
  return rows.length > 0 ? rowToCycleDay(rows[0]) : null;
}

export function updateCycleDay(
  db: DatabaseAdapter,
  id: string,
  input: UpdateCycleDayInput,
): CycleDay | null {
  let result: CycleDay | null = null;

  db.transaction(() => {
    const existing = db.query<Record<string, unknown>>(
      `SELECT * FROM cy_cycle_days WHERE id = ?`,
      [id],
    );
    if (existing.length === 0) return;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (input.phase !== undefined) {
      updates.push('phase = ?');
      params.push(input.phase);
    }
    if (input.flowLevel !== undefined) {
      updates.push('flow_level = ?');
      params.push(input.flowLevel);
    }
    if (input.notes !== undefined) {
      updates.push('notes = ?');
      params.push(input.notes);
    }

    if (updates.length === 0) {
      result = rowToCycleDay(existing[0]);
      return;
    }

    params.push(id);
    db.execute(`UPDATE cy_cycle_days SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = db.query<Record<string, unknown>>(
      `SELECT * FROM cy_cycle_days WHERE id = ?`,
      [id],
    );
    result = updated.length > 0 ? rowToCycleDay(updated[0]) : null;
  });

  return result;
}

export function deleteCycleDay(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM cy_cycle_days WHERE id = ?`, [id]);
  return true;
}

// ── Symptoms ───────────────────────────────────────────────────────────

export function getSymptomsForDay(
  db: DatabaseAdapter,
  cycleDayId: string,
  limit = 100,
): Symptom[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_symptoms WHERE cycle_day_id = ? LIMIT ?`,
    [cycleDayId, limit],
  );
  return rows.map(rowToSymptom);
}

export function addSymptom(
  db: DatabaseAdapter,
  id: string,
  cycleDayId: string,
  category: string,
  symptom: string,
  intensity = 'moderate',
): Symptom {
  const now = nowIso();
  db.execute(
    `INSERT INTO cy_symptoms (id, cycle_day_id, category, symptom, intensity, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, cycleDayId, category, symptom, intensity, now],
  );
  return {
    id,
    cycleDayId,
    category: category as Symptom['category'],
    symptom,
    intensity: intensity as Symptom['intensity'],
    createdAt: now,
  };
}

export function deleteSymptom(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM cy_symptoms WHERE id = ?`, [id]);
  return true;
}

// ── Analytics ──────────────────────────────────────────────────────────

export function getCycleStats(db: DatabaseAdapter): CycleStats {
  const completedCycles = db.query<Record<string, unknown>>(
    `SELECT cycle_length, period_length FROM cy_cycles
     WHERE cycle_length IS NOT NULL
     ORDER BY start_date DESC
     LIMIT 12`,
  );

  const totalCycles = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM cy_cycles`,
  )[0].count;

  if (completedCycles.length === 0) {
    return {
      totalCycles,
      averageCycleLength: null,
      averagePeriodLength: null,
      shortestCycle: null,
      longestCycle: null,
      cycleLengthStdDev: null,
    };
  }

  const lengths = completedCycles.map((r) => r.cycle_length as number);
  const periodLengths = completedCycles
    .filter((r) => r.period_length != null)
    .map((r) => r.period_length as number);

  const sum = lengths.reduce((a, b) => a + b, 0);
  const avg = sum / lengths.length;

  const periodAvg =
    periodLengths.length > 0
      ? periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length
      : null;

  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);

  // Standard deviation
  const variance = lengths.reduce((s, l) => s + (l - avg) ** 2, 0) / lengths.length;
  const stdDev = Math.round(Math.sqrt(variance) * 100) / 100;

  return {
    totalCycles,
    averageCycleLength: Math.round(avg * 10) / 10,
    averagePeriodLength: periodAvg !== null ? Math.round(periodAvg * 10) / 10 : null,
    shortestCycle: shortest,
    longestCycle: longest,
    cycleLengthStdDev: stdDev,
  };
}

export function getSymptomFrequencies(
  db: DatabaseAdapter,
  limit = 20,
): { symptom: string; category: string; count: number }[] {
  return db.query<{ symptom: string; category: string; count: number }>(
    `SELECT symptom, category, COUNT(*) as count
     FROM cy_symptoms
     GROUP BY symptom, category
     ORDER BY count DESC
     LIMIT ?`,
    [limit],
  );
}

export function getCycleCount(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM cy_cycles`,
  );
  return rows[0].count;
}

// ── Temperatures ──────────────────────────────────────────────────────

export function createTemperature(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateTemperatureRawInput,
): Temperature {
  const input = CreateTemperatureInputSchema.parse(rawInput);
  const now = nowIso();

  // Auto-link to existing cycle_day if one exists for this date
  const existingDay = getCycleDayByDate(db, input.date);
  const cycleDayId = existingDay?.id ?? null;

  db.execute(
    `INSERT INTO cy_temperatures (id, date, cycle_day_id, value_celsius, time_taken, method, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.date,
      cycleDayId,
      input.valueCelsius,
      input.timeTaken ?? null,
      input.method,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    date: input.date,
    cycleDayId,
    valueCelsius: input.valueCelsius,
    timeTaken: input.timeTaken ?? null,
    method: input.method,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getTemperatureByDate(
  db: DatabaseAdapter,
  date: string,
): Temperature | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_temperatures WHERE date = ?`,
    [date],
  );
  return rows.length > 0 ? rowToTemperature(rows[0]) : null;
}

export function getTemperaturesByCycleDays(
  db: DatabaseAdapter,
  cycleDayIds: string[],
  limit = 500,
): Temperature[] {
  if (cycleDayIds.length === 0) return [];
  const placeholders = cycleDayIds.map(() => '?').join(',');
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_temperatures WHERE cycle_day_id IN (${placeholders}) ORDER BY date ASC LIMIT ?`,
    [...cycleDayIds, limit],
  );
  return rows.map(rowToTemperature);
}

export function getTemperaturesByDateRange(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
  limit = 500,
): Temperature[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_temperatures WHERE date >= ? AND date <= ? ORDER BY date ASC LIMIT ?`,
    [startDate, endDate, limit],
  );
  return rows.map(rowToTemperature);
}

// Transaction-free update core: callers own the transaction boundary. Both
// shipped adapters (expo-sqlite, sql.js) issue a raw BEGIN that cannot nest,
// so upsertTemperature must reuse this INSIDE its own transaction instead of
// calling updateTemperature (BEGIN-inside-BEGIN throws at runtime).
function applyTemperatureUpdate(
  db: DatabaseAdapter,
  id: string,
  input: Partial<Pick<CreateTemperatureRawInput, 'valueCelsius' | 'timeTaken' | 'method' | 'notes'>>,
): Temperature | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_temperatures WHERE id = ?`,
    [id],
  );
  if (rows.length === 0) return null;

  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.valueCelsius !== undefined) {
    updates.push('value_celsius = ?');
    params.push(input.valueCelsius);
  }
  if (input.timeTaken !== undefined) {
    updates.push('time_taken = ?');
    params.push(input.timeTaken);
  }
  if (input.method !== undefined) {
    updates.push('method = ?');
    params.push(input.method);
  }
  if (input.notes !== undefined) {
    updates.push('notes = ?');
    params.push(input.notes);
  }

  if (updates.length === 0) {
    return rowToTemperature(rows[0]);
  }

  updates.push('updated_at = ?');
  params.push(nowIso());
  params.push(id);

  db.execute(`UPDATE cy_temperatures SET ${updates.join(', ')} WHERE id = ?`, params);

  const updated = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_temperatures WHERE id = ?`,
    [id],
  );
  return updated.length > 0 ? rowToTemperature(updated[0]) : null;
}

export function updateTemperature(
  db: DatabaseAdapter,
  id: string,
  input: Partial<Pick<CreateTemperatureRawInput, 'valueCelsius' | 'timeTaken' | 'method' | 'notes'>>,
): Temperature | null {
  let result: Temperature | null = null;

  db.transaction(() => {
    result = applyTemperatureUpdate(db, id, input);
  });

  return result;
}

export function upsertTemperature(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateTemperatureRawInput,
): Temperature {
  let result: Temperature | null = null;

  // Atomic check + insert/update to prevent UNIQUE constraint race. Uses the
  // transaction-free update core: a nested updateTemperature call would BEGIN
  // inside this BEGIN and throw on the shipped adapters.
  db.transaction(() => {
    const existing = getTemperatureByDate(db, rawInput.date);
    if (existing) {
      result = applyTemperatureUpdate(db, existing.id, {
        valueCelsius: rawInput.valueCelsius,
        timeTaken: rawInput.timeTaken,
        method: rawInput.method,
        notes: rawInput.notes,
      });
      if (!result) {
        throw new Error(`Temperature record ${existing.id} was deleted during upsert`);
      }
    } else {
      result = createTemperature(db, id, rawInput);
    }
  });

  return result!;
}

export function deleteTemperature(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM cy_temperatures WHERE id = ?`, [id]);
  return true;
}

// ── Pregnancy Config ──────────────────────────────────────────────────

function rowToPregnancyConfig(row: Record<string, unknown>): PregnancyConfig {
  return {
    id: row.id as string,
    status: row.status as PregnancyConfig['status'],
    startMethod: row.start_method as PregnancyConfig['startMethod'],
    lastPeriodDate: (row.last_period_date as string) ?? null,
    conceptionDate: (row.conception_date as string) ?? null,
    dueDate: row.due_date as string,
    actualEndDate: (row.actual_end_date as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createPregnancyConfig(
  db: DatabaseAdapter,
  id: string,
  input: CreatePregnancyInput,
): PregnancyConfig {
  const dueDate = calculateDueDate(input.startMethod, {
    lastPeriodDate: input.lastPeriodDate,
    conceptionDate: input.conceptionDate,
    dueDate: input.dueDate,
    transferDate: input.transferDate,
  });

  const now = nowIso();

  // Atomic check + insert to prevent duplicate active pregnancies
  db.transaction(() => {
    const active = getActivePregnancy(db);
    if (active) {
      throw new Error('An active pregnancy already exists. End it before starting a new one.');
    }

    db.execute(
      `INSERT INTO cy_pregnancy_config (id, status, start_method, last_period_date, conception_date, due_date, notes, created_at, updated_at)
       VALUES (?, 'active', ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.startMethod,
        input.lastPeriodDate ?? null,
        input.conceptionDate ?? null,
        dueDate,
        input.notes ?? null,
        now,
        now,
      ],
    );
  });

  return {
    id,
    status: 'active',
    startMethod: input.startMethod,
    lastPeriodDate: input.lastPeriodDate ?? null,
    conceptionDate: input.conceptionDate ?? null,
    dueDate,
    actualEndDate: null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getActivePregnancy(db: DatabaseAdapter): PregnancyConfig | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_pregnancy_config WHERE status = 'active' LIMIT 1`,
  );
  return rows.length > 0 ? rowToPregnancyConfig(rows[0]) : null;
}

export function getPregnancyConfig(db: DatabaseAdapter, id: string): PregnancyConfig | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_pregnancy_config WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToPregnancyConfig(rows[0]) : null;
}

export function getPregnancyHistory(
  db: DatabaseAdapter,
  limit = 50,
): PregnancyConfig[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_pregnancy_config ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToPregnancyConfig);
}

export function endPregnancy(
  db: DatabaseAdapter,
  id: string,
  status: 'completed' | 'loss',
): PregnancyConfig | null {
  let result: PregnancyConfig | null = null;

  db.transaction(() => {
    const config = getPregnancyConfig(db, id);
    if (!config) return;

    const now = nowIso();
    const today = new Date().toISOString().slice(0, 10);

    db.execute(
      `UPDATE cy_pregnancy_config SET status = ?, actual_end_date = ?, updated_at = ? WHERE id = ?`,
      [status, today, now, id],
    );

    result = {
      ...config,
      status,
      actualEndDate: today,
      updatedAt: now,
    };
  });

  return result;
}

export function updateDueDate(
  db: DatabaseAdapter,
  id: string,
  newDueDate: string,
): PregnancyConfig | null {
  let result: PregnancyConfig | null = null;

  db.transaction(() => {
    const config = getPregnancyConfig(db, id);
    if (!config) return;

    const now = nowIso();
    db.execute(
      `UPDATE cy_pregnancy_config SET due_date = ?, updated_at = ? WHERE id = ?`,
      [newDueDate, now, id],
    );

    result = {
      ...config,
      dueDate: newDueDate,
      updatedAt: now,
    };
  });

  return result;
}

// ── Appointments ──────────────────────────────────────────────────────

function rowToAppointment(row: Record<string, unknown>): Appointment {
  return {
    id: row.id as string,
    pregnancyId: row.pregnancy_id as string,
    title: row.title as string,
    date: row.date as string,
    time: (row.time as string) ?? null,
    location: (row.location as string) ?? null,
    notes: (row.notes as string) ?? null,
    completed: (row.completed as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createAppointment(
  db: DatabaseAdapter,
  id: string,
  input: CreateAppointmentInput,
): Appointment {
  const now = nowIso();
  db.execute(
    `INSERT INTO cy_appointments (id, pregnancy_id, title, date, time, location, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.pregnancyId,
      input.title,
      input.date,
      input.time ?? null,
      input.location ?? null,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    pregnancyId: input.pregnancyId,
    title: input.title,
    date: input.date,
    time: input.time ?? null,
    location: input.location ?? null,
    notes: input.notes ?? null,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function getAppointmentsByPregnancy(
  db: DatabaseAdapter,
  pregnancyId: string,
  limit = 200,
): Appointment[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_appointments WHERE pregnancy_id = ? ORDER BY date ASC LIMIT ?`,
    [pregnancyId, limit],
  );
  return rows.map(rowToAppointment);
}

export function getUpcomingAppointments(
  db: DatabaseAdapter,
  pregnancyId: string,
  today: string,
  limit = 3,
): Appointment[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_appointments
     WHERE pregnancy_id = ? AND date >= ? AND completed = 0
     ORDER BY date ASC LIMIT ?`,
    [pregnancyId, today, limit],
  );
  return rows.map(rowToAppointment);
}

export function updateAppointment(
  db: DatabaseAdapter,
  id: string,
  input: UpdateAppointmentInput,
): Appointment | null {
  let result: Appointment | null = null;

  db.transaction(() => {
    const rows = db.query<Record<string, unknown>>(
      `SELECT * FROM cy_appointments WHERE id = ?`,
      [id],
    );
    if (rows.length === 0) return;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      params.push(input.title);
    }
    if (input.date !== undefined) {
      updates.push('date = ?');
      params.push(input.date);
    }
    if (input.time !== undefined) {
      updates.push('time = ?');
      params.push(input.time);
    }
    if (input.location !== undefined) {
      updates.push('location = ?');
      params.push(input.location);
    }
    if (input.notes !== undefined) {
      updates.push('notes = ?');
      params.push(input.notes);
    }
    if (input.completed !== undefined) {
      updates.push('completed = ?');
      params.push(input.completed ? 1 : 0);
    }

    if (updates.length === 0) {
      result = rowToAppointment(rows[0]);
      return;
    }

    updates.push('updated_at = ?');
    params.push(nowIso());
    params.push(id);

    db.execute(`UPDATE cy_appointments SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = db.query<Record<string, unknown>>(
      `SELECT * FROM cy_appointments WHERE id = ?`,
      [id],
    );
    result = updated.length > 0 ? rowToAppointment(updated[0]) : null;
  });

  return result;
}

export function completeAppointment(db: DatabaseAdapter, id: string): Appointment | null {
  return updateAppointment(db, id, { completed: true });
}

export function deleteAppointment(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM cy_appointments WHERE id = ?`, [id]);
  return true;
}

// ── Partner Links ─────────────────────────────────────────────────────

function rowToPartnerLink(row: Record<string, unknown>): PartnerLink {
  return {
    id: row.id as string,
    linkCode: row.link_code as string,
    partnerName: (row.partner_name as string) ?? null,
    status: row.status as PartnerLink['status'],
    sharePhase: (row.share_phase as number) === 1,
    sharePredictions: (row.share_predictions as number) === 1,
    shareFertileWindow: (row.share_fertile_window as number) === 1,
    shareSymptoms: (row.share_symptoms as number) === 1,
    shareMood: (row.share_mood as number) === 1,
    shareTemperature: (row.share_temperature as number) === 1,
    sharePregnancy: (row.share_pregnancy as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createPartnerLink(
  db: DatabaseAdapter,
  id: string,
  rawInput?: CreatePartnerLinkRawInput,
): PartnerLink {
  const input = CreatePartnerLinkInputSchema.parse(rawInput ?? {});
  const code = generateShareCode();
  const now = nowIso();

  // Atomic check + insert to prevent duplicate active links
  db.transaction(() => {
    const active = getActivePartnerLink(db);
    if (active) {
      throw new Error('An active partner link already exists. Revoke it before creating a new one.');
    }

    db.execute(
      `INSERT INTO cy_partner_links (id, link_code, partner_name, status, share_phase, share_predictions, share_fertile_window, share_symptoms, share_mood, share_temperature, share_pregnancy, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        code,
        input.partnerName ?? null,
        input.sharePhase ? 1 : 0,
        input.sharePredictions ? 1 : 0,
        input.shareFertileWindow ? 1 : 0,
        input.shareSymptoms ? 1 : 0,
        input.shareMood ? 1 : 0,
        input.shareTemperature ? 1 : 0,
        input.sharePregnancy ? 1 : 0,
        now,
        now,
      ],
    );
  });

  return {
    id,
    linkCode: code,
    partnerName: input.partnerName ?? null,
    status: 'active',
    sharePhase: input.sharePhase,
    sharePredictions: input.sharePredictions,
    shareFertileWindow: input.shareFertileWindow,
    shareSymptoms: input.shareSymptoms,
    shareMood: input.shareMood,
    shareTemperature: input.shareTemperature,
    sharePregnancy: input.sharePregnancy,
    createdAt: now,
    updatedAt: now,
  };
}

export function getActivePartnerLink(db: DatabaseAdapter): PartnerLink | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_partner_links WHERE status = 'active' LIMIT 1`,
  );
  return rows.length > 0 ? rowToPartnerLink(rows[0]) : null;
}

export function getPartnerLinkByCode(db: DatabaseAdapter, code: string): PartnerLink | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM cy_partner_links WHERE link_code = ?`,
    [code],
  );
  return rows.length > 0 ? rowToPartnerLink(rows[0]) : null;
}

export function updatePartnerLink(
  db: DatabaseAdapter,
  id: string,
  input: UpdatePartnerLinkInput,
): PartnerLink | null {
  let result: PartnerLink | null = null;

  db.transaction(() => {
    const rows = db.query<Record<string, unknown>>(
      `SELECT * FROM cy_partner_links WHERE id = ?`,
      [id],
    );
    if (rows.length === 0) return;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (input.partnerName !== undefined) {
      updates.push('partner_name = ?');
      params.push(input.partnerName);
    }
    if (input.sharePhase !== undefined) {
      updates.push('share_phase = ?');
      params.push(input.sharePhase ? 1 : 0);
    }
    if (input.sharePredictions !== undefined) {
      updates.push('share_predictions = ?');
      params.push(input.sharePredictions ? 1 : 0);
    }
    if (input.shareFertileWindow !== undefined) {
      updates.push('share_fertile_window = ?');
      params.push(input.shareFertileWindow ? 1 : 0);
    }
    if (input.shareSymptoms !== undefined) {
      updates.push('share_symptoms = ?');
      params.push(input.shareSymptoms ? 1 : 0);
    }
    if (input.shareMood !== undefined) {
      updates.push('share_mood = ?');
      params.push(input.shareMood ? 1 : 0);
    }
    if (input.shareTemperature !== undefined) {
      updates.push('share_temperature = ?');
      params.push(input.shareTemperature ? 1 : 0);
    }
    if (input.sharePregnancy !== undefined) {
      updates.push('share_pregnancy = ?');
      params.push(input.sharePregnancy ? 1 : 0);
    }

    if (updates.length === 0) {
      result = rowToPartnerLink(rows[0]);
      return;
    }

    updates.push('updated_at = ?');
    params.push(nowIso());
    params.push(id);

    db.execute(`UPDATE cy_partner_links SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = db.query<Record<string, unknown>>(
      `SELECT * FROM cy_partner_links WHERE id = ?`,
      [id],
    );
    result = updated.length > 0 ? rowToPartnerLink(updated[0]) : null;
  });

  return result;
}

export function revokePartnerLink(db: DatabaseAdapter, id: string): PartnerLink | null {
  let result: PartnerLink | null = null;

  db.transaction(() => {
    const rows = db.query<Record<string, unknown>>(
      `SELECT * FROM cy_partner_links WHERE id = ?`,
      [id],
    );
    if (rows.length === 0) return;

    const now = nowIso();
    db.execute(
      `UPDATE cy_partner_links SET status = 'revoked', updated_at = ? WHERE id = ?`,
      [now, id],
    );

    result = {
      ...rowToPartnerLink(rows[0]),
      status: 'revoked',
      updatedAt: now,
    };
  });

  return result;
}
