import type { DatabaseAdapter } from '@mylife/db';
import {
  SleepHygieneCheckCreateSchema,
  SleepHygieneCheckListOptionsSchema,
  rowToSleepHygieneCheck,
  type SleepHygieneCheck,
  type SleepHygieneCheckCreateInput,
  type SleepHygieneCheckListOptions,
} from '../../models/hygiene-schemas';

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

export function saveHygieneCheck(
  db: DatabaseAdapter,
  rawInput: SleepHygieneCheckCreateInput,
): SleepHygieneCheck {
  const input = SleepHygieneCheckCreateSchema.parse(rawInput);
  const now = nowIso();
  const existing = db.query<{ id: string; created_at: string }>(
    `SELECT id, created_at
     FROM sl_hygiene_checks
     WHERE date = ? AND practice_id = ?
     LIMIT 1`,
    [input.date, input.practice_id],
  )[0];
  const id = existing?.id ?? crypto.randomUUID();
  const createdAt = existing?.created_at ?? now;

  db.execute(
    `INSERT INTO sl_hygiene_checks
      (id, date, practice_id, met, source, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date, practice_id) DO UPDATE SET
      met = excluded.met,
      source = excluded.source,
      notes = excluded.notes,
      updated_at = excluded.updated_at`,
    [
      id,
      input.date,
      input.practice_id,
      input.met ? 1 : 0,
      input.source,
      normalizeOptionalText(input.notes),
      createdAt,
      now,
    ],
  );

  return rowToSleepHygieneCheck({
    id,
    date: input.date,
    practice_id: input.practice_id,
    met: input.met ? 1 : 0,
    source: input.source,
    notes: normalizeOptionalText(input.notes),
    created_at: createdAt,
    updated_at: now,
  });
}

export function listHygieneChecks(
  db: DatabaseAdapter,
  rawOptions?: SleepHygieneCheckListOptions,
): SleepHygieneCheck[] {
  const options = SleepHygieneCheckListOptionsSchema.parse(rawOptions ?? {});
  const where: string[] = [];
  const params: unknown[] = [];

  if (options.date) {
    where.push('date = ?');
    params.push(options.date);
  }
  if (options.startDate) {
    where.push('date >= ?');
    params.push(options.startDate);
  }
  if (options.endDate) {
    where.push('date <= ?');
    params.push(options.endDate);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.query<Record<string, unknown>>(
    `SELECT *
     FROM sl_hygiene_checks
     ${whereClause}
     ORDER BY date DESC, practice_id ASC`,
    params,
  );

  return rows.map(rowToSleepHygieneCheck);
}

export function getHygieneChecksByDate(
  db: DatabaseAdapter,
  date: string,
): SleepHygieneCheck[] {
  return listHygieneChecks(db, { date });
}

export function deleteHygieneCheck(
  db: DatabaseAdapter,
  date: string,
  practiceId: string,
): boolean {
  const existing = db.query<{ id: string }>(
    `SELECT id
     FROM sl_hygiene_checks
     WHERE date = ? AND practice_id = ?
     LIMIT 1`,
    [date, practiceId],
  )[0];

  if (!existing) {
    return false;
  }

  db.execute(
    `DELETE FROM sl_hygiene_checks WHERE date = ? AND practice_id = ?`,
    [date, practiceId],
  );
  return true;
}
