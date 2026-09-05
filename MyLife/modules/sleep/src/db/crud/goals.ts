import type { DatabaseAdapter } from '@mylife/db';
import {
  SleepGoalCreateSchema,
  SleepGoalDateRangeSchema,
  SleepGoalProgressSchema,
  SleepGoalUpdateSchema,
  normalizeGoalNotes,
  normalizeGoalTargetValue,
  rowToGoal,
  type SleepGoal,
  type SleepGoalCreateInput,
  type SleepGoalDateRange,
  type SleepGoalProgress,
  type SleepGoalUpdateInput,
} from '../../models/goal-schemas';
import { evaluateEntry } from '../../engine/progress';
import { listEntries } from './entries';

function nowIso(): string {
  return new Date().toISOString();
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeGoalInput(
  rawInput: SleepGoalCreateInput,
): ReturnType<typeof SleepGoalCreateSchema.parse> {
  const input = SleepGoalCreateSchema.parse(rawInput);
  return {
    ...input,
    target_value: normalizeGoalTargetValue(input.type, input.target_value),
    notes: normalizeGoalNotes(input.notes),
  };
}

function normalizeGoalUpdate(
  existing: SleepGoal,
  rawInput: SleepGoalUpdateInput,
): ReturnType<typeof SleepGoalUpdateSchema.parse> {
  const input = SleepGoalUpdateSchema.parse(rawInput);
  const type = input.type ?? existing.type;
  const targetSource = input.target_value ?? existing.target_value;

  return {
    ...input,
    target_value: normalizeGoalTargetValue(type, targetSource),
    notes:
      Object.prototype.hasOwnProperty.call(input, 'notes')
        ? normalizeGoalNotes(input.notes)
        : undefined,
  };
}

export function createGoal(
  db: DatabaseAdapter,
  rawInput: SleepGoalCreateInput,
): SleepGoal {
  const input = normalizeGoalInput(rawInput);
  const id = crypto.randomUUID();
  const now = nowIso();

  db.execute(
    `INSERT INTO sl_goals
      (id, type, target_value, start_date, end_date, is_active, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.type,
      input.target_value,
      input.start_date ?? null,
      input.end_date ?? null,
      input.is_active ? 1 : 0,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return rowToGoal({
    id,
    type: input.type,
    target_value: input.target_value,
    start_date: input.start_date ?? null,
    end_date: input.end_date ?? null,
    is_active: input.is_active ? 1 : 0,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
  });
}

export function getGoal(db: DatabaseAdapter, id: string): SleepGoal | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sl_goals WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToGoal(rows[0]) : null;
}

export function getActiveGoals(
  db: DatabaseAdapter,
  asOfDate = todayDate(),
): SleepGoal[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sl_goals
     WHERE is_active = 1
       AND (start_date IS NULL OR start_date <= ?)
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY created_at ASC, type ASC`,
    [asOfDate, asOfDate],
  );

  return rows.map(rowToGoal);
}

export function updateGoal(
  db: DatabaseAdapter,
  id: string,
  rawInput: SleepGoalUpdateInput,
): SleepGoal | null {
  const existing = getGoal(db, id);
  if (!existing) {
    return null;
  }

  const input = normalizeGoalUpdate(existing, rawInput);
  const targetValue = String(input.target_value ?? existing.target_value);
  const next: SleepGoal = {
    ...existing,
    type: input.type ?? existing.type,
    target_value: targetValue,
    start_date:
      Object.prototype.hasOwnProperty.call(input, 'start_date')
        ? input.start_date ?? null
        : existing.start_date,
    end_date:
      Object.prototype.hasOwnProperty.call(input, 'end_date')
        ? input.end_date ?? null
        : existing.end_date,
    is_active: input.is_active ?? existing.is_active,
    notes:
      Object.prototype.hasOwnProperty.call(input, 'notes')
        ? input.notes ?? null
        : existing.notes,
    updated_at: nowIso(),
  };

  db.execute(
    `UPDATE sl_goals
     SET type = ?, target_value = ?, start_date = ?, end_date = ?,
         is_active = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.type,
      next.target_value,
      next.start_date,
      next.end_date,
      next.is_active ? 1 : 0,
      next.notes,
      next.updated_at,
      id,
    ],
  );

  return getGoal(db, id);
}

export function deactivateGoal(
  db: DatabaseAdapter,
  id: string,
): SleepGoal | null {
  const existing = getGoal(db, id);
  if (!existing) {
    return null;
  }

  return updateGoal(db, id, {
    is_active: false,
    end_date: existing.end_date ?? todayDate(),
  });
}

export function checkGoalProgress(
  db: DatabaseAdapter,
  goalId: string,
  rawDateRange: SleepGoalDateRange = {},
): SleepGoalProgress | null {
  const goal = getGoal(db, goalId);
  if (!goal) {
    return null;
  }

  const dateRange = SleepGoalDateRangeSchema.parse(rawDateRange);
  const entries = [...listEntries(db, { ...dateRange, limit: 500 })].sort(
    (a, b) => {
      if (a.date !== b.date) {
        return a.date < b.date ? -1 : 1;
      }
      return a.id.localeCompare(b.id);
    },
  );
  let met = 0;
  let missed = 0;
  let currentStreak = 0;
  let longestStreak = 0;

  for (const entry of entries) {
    const result = evaluateEntry(entry, [goal], entries).results[0];
    if (!result) {
      continue;
    }
    if (result.met) {
      met += 1;
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      missed += 1;
      currentStreak = 0;
    }
  }

  const totalEvaluated = met + missed;

  return SleepGoalProgressSchema.parse({
    goalId: goal.id,
    type: goal.type,
    met,
    missed,
    streak: longestStreak,
    percentage:
      totalEvaluated === 0
        ? 0
        : Number(((met / totalEvaluated) * 100).toFixed(1)),
    totalEvaluated,
  });
}
