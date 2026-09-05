import type { DatabaseAdapter } from '@mylife/db';
import type { Goal, GoalDirection, GoalProgress, GoalType } from '../types';

interface GoalRow {
  id: string;
  type: GoalType;
  target_value: number;
  period: Goal['period'];
  direction: GoalDirection;
  label: string | null;
  unit: string | null;
  start_date: string;
  end_date: string | null;
  is_active: number;
  created_at: string;
}

interface GoalProgressRow {
  id: string;
  goal_id: string;
  period_start: string;
  period_end: string;
  current_value: number;
  target_value: number;
  completed: number;
  created_at: string;
}

interface DateRange {
  start: string;
  end: string;
}

export interface CreateGoalInput {
  type: GoalType;
  targetValue: number;
  period?: Goal['period'];
  direction?: GoalDirection;
  label?: string | null;
  unit?: string | null;
  startDate?: string;
  endDate?: string | null;
  isActive?: boolean;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseISODate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultPeriod(type: GoalType): Goal['period'] {
  if (type === 'hours_per_month') return 'monthly';
  if (type === 'weight_milestone') return 'milestone';
  return 'weekly';
}

function defaultDirection(type: GoalType): GoalDirection {
  return type === 'weight_milestone' ? 'at_most' : 'at_least';
}

function defaultUnit(type: GoalType): string {
  switch (type) {
    case 'fasts_per_week':
      return 'fasts';
    case 'hours_per_week':
    case 'hours_per_month':
      return 'hours';
    case 'weight_milestone':
      return 'weight';
    default:
      return '';
  }
}

function rowToGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    type: row.type,
    targetValue: row.target_value,
    period: row.period,
    direction: row.direction,
    label: row.label,
    unit: row.unit,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

function rowToGoalProgress(row: GoalProgressRow): GoalProgress {
  return {
    id: row.id,
    goalId: row.goal_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    currentValue: row.current_value,
    targetValue: row.target_value,
    completed: row.completed === 1,
    createdAt: row.created_at,
  };
}

function getWeekRange(date: Date): DateRange {
  const day = date.getUTCDay();
  const offsetToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offsetToMonday));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6));
  return { start: toISODate(start), end: toISODate(end) };
}

function getMonthRange(date: Date): DateRange {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { start: toISODate(start), end: toISODate(end) };
}

function countCompletedFastsInRange(db: DatabaseAdapter, range: DateRange): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count
     FROM ft_fasts
     WHERE ended_at IS NOT NULL
       AND started_at >= ? AND started_at < date(?, '+1 day')`,
    [range.start, range.end],
  );
  return rows[0]?.count ?? 0;
}

function completedHoursInRange(db: DatabaseAdapter, range: DateRange): number {
  const rows = db.query<{ seconds: number | null }>(
    `SELECT COALESCE(SUM(duration_seconds), 0) as seconds
     FROM ft_fasts
     WHERE ended_at IS NOT NULL
       AND started_at >= ? AND started_at < date(?, '+1 day')`,
    [range.start, range.end],
  );
  return Math.round((((rows[0]?.seconds ?? 0) / 3600) + Number.EPSILON) * 10) / 10;
}

function latestWeightEntry(db: DatabaseAdapter): { weight: number; date: string } | null {
  const rows = db.query<{ weight_value: number; date: string }>(
    `SELECT weight_value, date
     FROM ft_weight_entries
     ORDER BY date DESC, created_at DESC
     LIMIT 1`,
  );

  if (!rows[0]) return null;
  return { weight: rows[0].weight_value, date: rows[0].date };
}

function isGoalCompleted(goal: Goal, currentValue: number): boolean {
  if (goal.direction === 'at_most') {
    return currentValue <= goal.targetValue;
  }
  return currentValue >= goal.targetValue;
}

function getRangeForGoal(goal: Goal, asOf: Date): DateRange {
  if (goal.period === 'monthly' || goal.type === 'hours_per_month') {
    return getMonthRange(asOf);
  }

  if (goal.period === 'weekly' || goal.type === 'fasts_per_week' || goal.type === 'hours_per_week') {
    return getWeekRange(asOf);
  }

  return {
    start: goal.startDate,
    end: toISODate(asOf),
  };
}

function computeGoalCurrentValue(db: DatabaseAdapter, goal: Goal, range: DateRange): number {
  switch (goal.type) {
    case 'fasts_per_week':
      return countCompletedFastsInRange(db, range);
    case 'hours_per_week':
    case 'hours_per_month':
      return completedHoursInRange(db, range);
    case 'weight_milestone': {
      const latest = latestWeightEntry(db);
      return latest?.weight ?? 0;
    }
    default:
      return 0;
  }
}

export function createGoal(db: DatabaseAdapter, input: CreateGoalInput): Goal {
  const id = randomId();
  const now = new Date();
  const startDate = input.startDate ?? toISODate(now);
  const goal: Goal = {
    id,
    type: input.type,
    targetValue: Math.max(0, input.targetValue),
    period: input.period ?? defaultPeriod(input.type),
    direction: input.direction ?? defaultDirection(input.type),
    label: input.label ?? null,
    unit: input.unit ?? defaultUnit(input.type),
    startDate,
    endDate: input.endDate ?? null,
    isActive: input.isActive ?? true,
    createdAt: now.toISOString(),
  };

  upsertGoal(db, goal);
  return goal;
}

export function upsertGoal(db: DatabaseAdapter, goal: Goal): void {
  db.execute(
    `INSERT OR REPLACE INTO ft_goals (
      id,
      type,
      target_value,
      period,
      direction,
      label,
      unit,
      start_date,
      end_date,
      is_active,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      goal.id,
      goal.type,
      goal.targetValue,
      goal.period,
      goal.direction,
      goal.label,
      goal.unit,
      goal.startDate,
      goal.endDate,
      goal.isActive ? 1 : 0,
      goal.createdAt,
    ],
  );
}

export function listGoals(db: DatabaseAdapter, includeInactive: boolean = false): Goal[] {
  const rows = db.query<GoalRow>(
    includeInactive
      ? `SELECT * FROM ft_goals ORDER BY created_at DESC`
      : `SELECT * FROM ft_goals WHERE is_active = 1 ORDER BY created_at DESC`,
  );
  return rows.map(rowToGoal);
}

export function getGoal(db: DatabaseAdapter, goalId: string): Goal | null {
  const rows = db.query<GoalRow>(`SELECT * FROM ft_goals WHERE id = ?`, [goalId]);
  return rows[0] ? rowToGoal(rows[0]) : null;
}

export function archiveGoal(db: DatabaseAdapter, goalId: string, endDate?: string): boolean {
  const goal = getGoal(db, goalId);
  if (!goal) return false;

  db.execute(
    `UPDATE ft_goals SET is_active = 0, end_date = ? WHERE id = ?`,
    [endDate ?? toISODate(new Date()), goalId],
  );
  return true;
}

export function deleteGoal(db: DatabaseAdapter, goalId: string): boolean {
  db.transaction(() => {
    db.execute(`DELETE FROM ft_goal_progress WHERE goal_id = ?`, [goalId]);
    db.execute(`DELETE FROM ft_goals WHERE id = ?`, [goalId]);
  });

  const rows = db.query<{ count: number }>(`SELECT COUNT(*) as count FROM ft_goals WHERE id = ?`, [goalId]);
  return (rows[0]?.count ?? 0) === 0;
}

export function getGoalProgress(db: DatabaseAdapter, goalId: string, asOf?: Date): GoalProgress | null {
  const goal = getGoal(db, goalId);
  if (!goal) return null;

  const now = asOf ?? new Date();
  const range = getRangeForGoal(goal, now);
  const currentValue = computeGoalCurrentValue(db, goal, range);

  return {
    id: randomId(),
    goalId: goal.id,
    periodStart: range.start,
    periodEnd: range.end,
    currentValue,
    targetValue: goal.targetValue,
    completed: isGoalCompleted(goal, currentValue),
    createdAt: now.toISOString(),
  };
}

export function refreshGoalProgress(db: DatabaseAdapter, asOf?: Date): GoalProgress[] {
  const now = asOf ?? new Date();
  const goals = listGoals(db, false);
  const snapshots: GoalProgress[] = [];

  for (const goal of goals) {
    if (!goal.isActive) continue;

    const range = getRangeForGoal(goal, now);
    if (parseISODate(range.start).getTime() < parseISODate(goal.startDate).getTime()) {
      continue;
    }

    if (goal.endDate && parseISODate(range.start).getTime() > parseISODate(goal.endDate).getTime()) {
      continue;
    }

    const currentValue = computeGoalCurrentValue(db, goal, range);
    const completed = isGoalCompleted(goal, currentValue);

    const existing = db.query<{ id: string }>(
      `SELECT id FROM ft_goal_progress WHERE goal_id = ? AND period_start = ? AND period_end = ?`,
      [goal.id, range.start, range.end],
    );

    const id = existing[0]?.id ?? randomId();
    const createdAt = now.toISOString();

    db.execute(
      `INSERT OR REPLACE INTO ft_goal_progress (
        id,
        goal_id,
        period_start,
        period_end,
        current_value,
        target_value,
        completed,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, goal.id, range.start, range.end, currentValue, goal.targetValue, completed ? 1 : 0, createdAt],
    );

    snapshots.push({
      id,
      goalId: goal.id,
      periodStart: range.start,
      periodEnd: range.end,
      currentValue,
      targetValue: goal.targetValue,
      completed,
      createdAt,
    });
  }

  return snapshots;
}

export function listGoalProgress(db: DatabaseAdapter, goalId: string, limit: number = 26): GoalProgress[] {
  const rows = db.query<GoalProgressRow>(
    `SELECT * FROM ft_goal_progress WHERE goal_id = ? ORDER BY period_start DESC LIMIT ?`,
    [goalId, limit],
  );
  return rows.map(rowToGoalProgress);
}
