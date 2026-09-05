import type { DatabaseAdapter } from '@mylife/db';
import {
  ApplicationTaskInputSchema,
  ApplicationTaskRowSchema,
  ApplicationTaskUpdateSchema,
  type ApplicationTaskInput,
  type ApplicationTaskRow,
  type ApplicationTaskStatus,
  type ApplicationTaskUpdate,
} from '../../models/schemas';

const DEFAULT_STATUS: ApplicationTaskStatus = 'not_started';

export function createApplicationTask(
  db: DatabaseAdapter,
  id: string,
  input: ApplicationTaskInput,
): ApplicationTaskRow {
  const parsed = ApplicationTaskInputSchema.parse(input);
  const now = new Date().toISOString();

  const row: ApplicationTaskRow = {
    id,
    application_id: parsed.application_id,
    title: parsed.title,
    kind: parsed.kind,
    due_at: parsed.due_at ?? null,
    completed_at: parsed.completed_at ?? null,
    word_target: parsed.word_target ?? null,
    word_count: parsed.word_count ?? null,
    status: parsed.status ?? DEFAULT_STATUS,
    notes_md: parsed.notes_md ?? null,
    sort_order: parsed.sort_order ?? 0,
    created_at: now,
  };

  db.execute(
    `INSERT INTO cs_application_tasks
      (id, application_id, title, kind, due_at, completed_at, word_target,
       word_count, status, notes_md, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.application_id,
      row.title,
      row.kind,
      row.due_at,
      row.completed_at,
      row.word_target,
      row.word_count,
      row.status,
      row.notes_md,
      row.sort_order,
      row.created_at,
    ],
  );

  return ApplicationTaskRowSchema.parse(row);
}

export function getApplicationTask(
  db: DatabaseAdapter,
  id: string,
): ApplicationTaskRow | null {
  const rows = db.query<ApplicationTaskRow>(
    `SELECT * FROM cs_application_tasks WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? ApplicationTaskRowSchema.parse(rows[0]) : null;
}

const SCALAR_UPDATABLE_COLUMNS = new Set([
  'title',
  'kind',
  'due_at',
  'completed_at',
  'word_target',
  'word_count',
  'status',
  'notes_md',
  'sort_order',
]);

export function updateApplicationTask(
  db: DatabaseAdapter,
  id: string,
  updates: ApplicationTaskUpdate,
): void {
  const parsed = ApplicationTaskUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (!SCALAR_UPDATABLE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }

  if (fields.length === 0) return;

  db.execute(
    `UPDATE cs_application_tasks SET ${fields.join(', ')} WHERE id = ?`,
    [...values, id],
  );
}

export function deleteApplicationTask(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM cs_application_tasks WHERE id = ?`, [id]);
}

export function listTasksByApplication(
  db: DatabaseAdapter,
  applicationId: string,
): ApplicationTaskRow[] {
  return db
    .query<ApplicationTaskRow>(
      `SELECT * FROM cs_application_tasks
       WHERE application_id = ?
       ORDER BY sort_order ASC, created_at ASC`,
      [applicationId],
    )
    .map((row) => ApplicationTaskRowSchema.parse(row));
}

export function markTaskComplete(
  db: DatabaseAdapter,
  id: string,
  completedAt?: string,
): void {
  const ts = completedAt ?? new Date().toISOString();
  db.execute(
    `UPDATE cs_application_tasks SET status = 'done', completed_at = ? WHERE id = ?`,
    [ts, id],
  );
}
