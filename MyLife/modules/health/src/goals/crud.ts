import type { DatabaseAdapter } from '@mylife/db';
import type { HealthGoal, CreateGoalInput, GoalProgress } from './types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_goal_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createGoal(db: DatabaseAdapter, input: CreateGoalInput): string {
  const id = createId();
  db.execute(
    `INSERT INTO hl_goals (id, domain, metric, target_value, unit, period, direction, label, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.domain,
      input.metric,
      input.target_value,
      input.unit ?? null,
      input.period ?? 'daily',
      input.direction ?? 'at_least',
      input.label ?? null,
      input.start_date ?? new Date().toISOString().split('T')[0],
      input.end_date ?? null,
    ],
  );
  return id;
}

export function getActiveGoals(db: DatabaseAdapter, limit = 50): HealthGoal[] {
  return db.query<HealthGoal>(
    'SELECT * FROM hl_goals WHERE is_active = 1 ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
}

export function getGoalById(db: DatabaseAdapter, id: string): HealthGoal | null {
  const rows = db.query<HealthGoal>('SELECT * FROM hl_goals WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export function deactivateGoal(db: DatabaseAdapter, id: string): void {
  db.execute("UPDATE hl_goals SET is_active = 0, updated_at = datetime('now') WHERE id = ?", [id]);
}

export function deleteGoal(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_goals WHERE id = ?', [id]);
}

export function recordProgress(
  db: DatabaseAdapter,
  goalId: string,
  periodStart: string,
  periodEnd: string,
  currentValue: number,
  targetValue: number,
): string {
  const id = createId();
  const completed = evaluateCompletion(currentValue, targetValue, goalId, db);

  db.execute(
    `INSERT OR REPLACE INTO hl_goal_progress (id, goal_id, period_start, period_end, current_value, target_value, completed)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, goalId, periodStart, periodEnd, currentValue, targetValue, completed ? 1 : 0],
  );
  return id;
}

function evaluateCompletion(
  currentValue: number,
  targetValue: number,
  goalId: string,
  db: DatabaseAdapter,
): boolean {
  const goal = getGoalById(db, goalId);
  if (!goal) return false;

  switch (goal.direction) {
    case 'at_least':
      return currentValue >= targetValue;
    case 'at_most':
      return currentValue <= targetValue;
    case 'exactly':
      return Math.abs(currentValue - targetValue) < 0.01;
    default:
      return false;
  }
}

export function getGoalProgress(
  db: DatabaseAdapter,
  goalId: string,
  limit = 30,
): GoalProgress[] {
  return db.query<GoalProgress>(
    'SELECT * FROM hl_goal_progress WHERE goal_id = ? ORDER BY period_start DESC LIMIT ?',
    [goalId, limit],
  );
}
