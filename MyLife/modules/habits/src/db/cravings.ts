import type { DatabaseAdapter } from '@mylife/db';
import type { Craving, CravingTrigger, CravingOutcome, TriggerCategory } from '../types';
import { normalizeTriggerName } from '../sobriety/craving-engine';

// ── Row mappers ──────────────────────────────────────────────────────────

function rowToCraving(row: Record<string, unknown>): Craving {
  return {
    id: row.id as string,
    habitId: row.habit_id as string,
    intensity: row.intensity as number,
    durationMinutes: (row.duration_minutes as number) ?? null,
    copingStrategy: (row.coping_strategy as string) ?? null,
    outcome: (row.outcome as CravingOutcome) ?? null,
    notes: (row.notes as string) ?? null,
    loggedAt: row.logged_at as string,
    createdAt: row.created_at as string,
  };
}

function rowToTrigger(row: Record<string, unknown>): CravingTrigger {
  return {
    id: row.id as string,
    cravingId: row.craving_id as string,
    triggerName: row.trigger_name as string,
    triggerCategory: row.trigger_category as TriggerCategory,
    createdAt: row.created_at as string,
  };
}

// ── Cravings ────────────────────────────────────────────────────────────

export interface CreateCravingInput {
  habitId: string;
  intensity: number;
  durationMinutes?: number;
  copingStrategy?: string;
  outcome?: CravingOutcome;
  notes?: string;
  loggedAt?: string;
  triggers?: Array<{ id: string; name: string; category: TriggerCategory }>;
}

export function createCraving(
  db: DatabaseAdapter,
  id: string,
  input: CreateCravingInput,
): void {
  const now = new Date().toISOString();
  db.transaction(() => {
    db.execute(
      `INSERT INTO hb_cravings (id, habit_id, intensity, duration_minutes, coping_strategy, outcome, notes, logged_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.habitId,
        input.intensity,
        input.durationMinutes ?? null,
        input.copingStrategy ?? null,
        input.outcome ?? null,
        input.notes ?? null,
        input.loggedAt ?? now,
        now,
      ],
    );

    if (input.triggers) {
      for (const t of input.triggers) {
        db.execute(
          `INSERT INTO hb_craving_triggers (id, craving_id, trigger_name, trigger_category, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [t.id, id, normalizeTriggerName(t.name), t.category, now],
        );
      }
    }
  });
}

export function getCravingsForHabit(
  db: DatabaseAdapter,
  habitId: string,
  opts?: { from?: string; to?: string; limit?: number },
): Craving[] {
  let sql = 'SELECT * FROM hb_cravings WHERE habit_id = ?';
  const params: unknown[] = [habitId];
  if (opts?.from) { sql += ' AND logged_at >= ?'; params.push(opts.from); }
  if (opts?.to) { sql += ' AND logged_at <= ?'; params.push(opts.to); }
  sql += ' ORDER BY logged_at DESC';
  if (opts?.limit) { sql += ' LIMIT ?'; params.push(opts.limit); }
  return db.query<Record<string, unknown>>(sql, params).map(rowToCraving);
}

export function getTriggersForCraving(db: DatabaseAdapter, cravingId: string): CravingTrigger[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM hb_craving_triggers WHERE craving_id = ?',
    [cravingId],
  ).map(rowToTrigger);
}

export function getAllTriggersForHabit(db: DatabaseAdapter, habitId: string): CravingTrigger[] {
  return db.query<Record<string, unknown>>(
    `SELECT t.* FROM hb_craving_triggers t
     JOIN hb_cravings c ON t.craving_id = c.id
     WHERE c.habit_id = ?`,
    [habitId],
  ).map(rowToTrigger);
}

export function getCustomTriggerNames(db: DatabaseAdapter, habitId: string): string[] {
  const rows = db.query<{ trigger_name: string }>(
    `SELECT DISTINCT t.trigger_name FROM hb_craving_triggers t
     JOIN hb_cravings c ON t.craving_id = c.id
     WHERE c.habit_id = ? AND t.trigger_category = 'custom'`,
    [habitId],
  );
  return rows.map((r) => r.trigger_name);
}

export function deleteCraving(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_cravings WHERE id = ?', [id]);
}
