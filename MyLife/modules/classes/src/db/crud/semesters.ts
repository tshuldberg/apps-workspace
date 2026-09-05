import type { DatabaseAdapter } from '@mylife/db';
import {
  SemesterInputSchema,
  SemesterRowSchema,
  SemesterStatsSchema,
  SemesterUpdateSchema,
  type SemesterInput,
  type SemesterRow,
  type SemesterStats,
  type SemesterUpdate,
} from '../../models/schemas';

function toBool(input: number | undefined): number {
  return input ? 1 : 0;
}

export function createSemester(
  db: DatabaseAdapter,
  id: string,
  input: SemesterInput,
): SemesterRow {
  const parsed = SemesterInputSchema.parse(input);
  const now = new Date().toISOString();
  const row: SemesterRow = {
    id,
    name: parsed.name,
    start_date: parsed.start_date ?? null,
    end_date: parsed.end_date ?? null,
    institution: parsed.institution ?? null,
    credit_hours: parsed.credit_hours ?? 0,
    gpa: parsed.gpa ?? null,
    is_current: toBool(parsed.is_current ? 1 : 0),
    created_at: now,
  };

  db.transaction(() => {
    if (row.is_current === 1) {
      db.execute(`UPDATE cs_semesters SET is_current = 0 WHERE is_current = 1`);
    }
    db.execute(
      `INSERT INTO cs_semesters
        (id, name, start_date, end_date, institution, credit_hours, gpa, is_current, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.name,
        row.start_date,
        row.end_date,
        row.institution,
        row.credit_hours,
        row.gpa,
        row.is_current,
        row.created_at,
      ],
    );
  });

  return SemesterRowSchema.parse(row);
}

export function getSemester(db: DatabaseAdapter, id: string): SemesterRow | null {
  const rows = db.query<SemesterRow>(
    `SELECT * FROM cs_semesters WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? SemesterRowSchema.parse(rows[0]) : null;
}

export function listSemesters(db: DatabaseAdapter): SemesterRow[] {
  return db
    .query<SemesterRow>(
      `SELECT * FROM cs_semesters ORDER BY is_current DESC, COALESCE(start_date, created_at) DESC`,
    )
    .map((row) => SemesterRowSchema.parse(row));
}

const UPDATABLE_COLUMNS = new Set([
  'name',
  'start_date',
  'end_date',
  'institution',
  'credit_hours',
  'gpa',
]);

export function updateSemester(
  db: DatabaseAdapter,
  id: string,
  updates: SemesterUpdate,
): void {
  const parsed = SemesterUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'is_current') continue;
    if (!UPDATABLE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }

  if (fields.length === 0 && parsed.is_current === undefined) return;

  db.transaction(() => {
    if (fields.length > 0) {
      db.execute(
        `UPDATE cs_semesters SET ${fields.join(', ')} WHERE id = ?`,
        [...values, id],
      );
    }
    if (parsed.is_current !== undefined) {
      if (parsed.is_current) {
        db.execute(`UPDATE cs_semesters SET is_current = 0 WHERE id != ?`, [id]);
        db.execute(`UPDATE cs_semesters SET is_current = 1 WHERE id = ?`, [id]);
      } else {
        db.execute(`UPDATE cs_semesters SET is_current = 0 WHERE id = ?`, [id]);
      }
    }
  });
}

export function deleteSemester(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM cs_semesters WHERE id = ?`, [id]);
}

/**
 * setCurrent: enforces a single is_current row. Idempotent.
 */
export function setCurrentSemester(db: DatabaseAdapter, id: string): void {
  db.transaction(() => {
    db.execute(`UPDATE cs_semesters SET is_current = 0 WHERE is_current = 1`);
    db.execute(`UPDATE cs_semesters SET is_current = 1 WHERE id = ?`, [id]);
  });
}

/**
 * archive: soft archive by clearing is_current. We do not delete classes.
 * If the caller wants the semester gone they call deleteSemester.
 */
export function archiveSemester(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE cs_semesters SET is_current = 0 WHERE id = ?`, [id]);
}

/**
 * getStats: aggregate counters for a semester.
 *
 * - class_count: classes attached to this semester
 * - credit_hours: sum of credits across those classes
 * - gpa: weighted by credits using current_grade as a 4.0-scale value when set;
 *   returns null if no graded classes are present.
 */
export function getSemesterStats(
  db: DatabaseAdapter,
  semesterId: string,
): SemesterStats {
  const countRow = db.query<{ class_count: number; credit_hours: number }>(
    `SELECT COUNT(*) AS class_count, COALESCE(SUM(credits), 0) AS credit_hours
     FROM cs_classes WHERE semester_id = ?`,
    [semesterId],
  )[0];

  const gpaRow = db.query<{ weighted: number | null; total: number | null }>(
    `SELECT
       SUM(current_grade * credits) AS weighted,
       SUM(credits) AS total
     FROM cs_classes
     WHERE semester_id = ? AND current_grade IS NOT NULL AND credits > 0`,
    [semesterId],
  )[0];

  const gpa =
    gpaRow && gpaRow.total && gpaRow.total > 0 && gpaRow.weighted !== null
      ? gpaRow.weighted / gpaRow.total
      : null;

  return SemesterStatsSchema.parse({
    class_count: countRow?.class_count ?? 0,
    credit_hours: countRow?.credit_hours ?? 0,
    gpa,
  });
}
