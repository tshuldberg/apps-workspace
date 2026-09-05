import type { DatabaseAdapter } from '@mylife/db';
import {
  OnlineCourseInputSchema,
  OnlineCourseRowSchema,
  OnlineCourseStatsSchema,
  OnlineCourseUpdateSchema,
  type OnlineCourseInput,
  type OnlineCourseRow,
  type OnlineCourseStats,
  type OnlineCourseStatus,
  type OnlineCourseUpdate,
} from '../../models/schemas';

const DEFAULT_STATUS: OnlineCourseStatus = 'not_started';

function serializeStringArray(
  value: string[] | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  if (value.length === 0) return null;
  return JSON.stringify(value);
}

export function createOnlineCourse(
  db: DatabaseAdapter,
  id: string,
  input: OnlineCourseInput,
): OnlineCourseRow {
  const parsed = OnlineCourseInputSchema.parse(input);
  const now = new Date().toISOString();

  const row: OnlineCourseRow = {
    id,
    title: parsed.title,
    provider: parsed.provider ?? null,
    url: parsed.url ?? null,
    instructor: parsed.instructor ?? null,
    category: parsed.category ?? null,
    status: parsed.status ?? DEFAULT_STATUS,
    progress_percent: parsed.progress_percent ?? 0,
    started_at: parsed.started_at ?? null,
    completed_at: parsed.completed_at ?? null,
    estimated_hours: parsed.estimated_hours ?? null,
    actual_hours: parsed.actual_hours ?? null,
    notes_md: parsed.notes_md ?? null,
    certificate_url: parsed.certificate_url ?? null,
    rating: parsed.rating ?? null,
    tags: serializeStringArray(parsed.tags),
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO cs_online_courses
      (id, title, provider, url, instructor, category, status, progress_percent,
       started_at, completed_at, estimated_hours, actual_hours, notes_md,
       certificate_url, rating, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.title,
      row.provider,
      row.url,
      row.instructor,
      row.category,
      row.status,
      row.progress_percent,
      row.started_at,
      row.completed_at,
      row.estimated_hours,
      row.actual_hours,
      row.notes_md,
      row.certificate_url,
      row.rating,
      row.tags,
      row.created_at,
      row.updated_at,
    ],
  );

  return OnlineCourseRowSchema.parse(row);
}

export function getOnlineCourse(
  db: DatabaseAdapter,
  id: string,
): OnlineCourseRow | null {
  const rows = db.query<OnlineCourseRow>(
    `SELECT * FROM cs_online_courses WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? OnlineCourseRowSchema.parse(rows[0]) : null;
}

const SCALAR_UPDATABLE_COLUMNS = new Set([
  'title',
  'provider',
  'url',
  'instructor',
  'category',
  'status',
  'progress_percent',
  'started_at',
  'completed_at',
  'estimated_hours',
  'actual_hours',
  'notes_md',
  'certificate_url',
  'rating',
]);

export function updateOnlineCourse(
  db: DatabaseAdapter,
  id: string,
  updates: OnlineCourseUpdate,
): void {
  const parsed = OnlineCourseUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'tags') {
      fields.push('tags = ?');
      values.push(serializeStringArray(value as string[] | null | undefined));
      continue;
    }
    if (!SCALAR_UPDATABLE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());

  db.execute(
    `UPDATE cs_online_courses SET ${fields.join(', ')} WHERE id = ?`,
    [...values, id],
  );
}

export function deleteOnlineCourse(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM cs_online_courses WHERE id = ?`, [id]);
}

export interface OnlineCourseFilter {
  status?: OnlineCourseStatus;
}

export function listOnlineCourses(
  db: DatabaseAdapter,
  filter?: OnlineCourseFilter,
): OnlineCourseRow[] {
  if (filter?.status) {
    return db
      .query<OnlineCourseRow>(
        `SELECT * FROM cs_online_courses
         WHERE status = ?
         ORDER BY created_at DESC`,
        [filter.status],
      )
      .map((row) => OnlineCourseRowSchema.parse(row));
  }
  return db
    .query<OnlineCourseRow>(
      `SELECT * FROM cs_online_courses ORDER BY created_at DESC`,
    )
    .map((row) => OnlineCourseRowSchema.parse(row));
}

/**
 * getCourseStats: aggregate counters across all courses.
 *
 * - total: every course
 * - in_progress: status === 'in_progress'
 * - completed: status === 'completed'
 * - total_hours_spent: sum of actual_hours across all courses (NULLs ignored)
 */
export function getCourseStats(db: DatabaseAdapter): OnlineCourseStats {
  const row = db.query<{
    total: number;
    in_progress: number;
    completed: number;
    total_hours_spent: number | null;
  }>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
       COALESCE(SUM(actual_hours), 0) AS total_hours_spent
     FROM cs_online_courses`,
  )[0];

  return OnlineCourseStatsSchema.parse({
    total: row?.total ?? 0,
    in_progress: row?.in_progress ?? 0,
    completed: row?.completed ?? 0,
    total_hours_spent: row?.total_hours_spent ?? 0,
  });
}
