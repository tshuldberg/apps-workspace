import type { DatabaseAdapter } from '@mylife/db';
import {
  LearningGoalInputSchema,
  LearningGoalProgressSchema,
  LearningGoalRowSchema,
  LearningGoalUpdateSchema,
  type LearningGoalInput,
  type LearningGoalProgress,
  type LearningGoalRow,
  type LearningGoalStatus,
  type LearningGoalUpdate,
} from '../../models/schemas';

const DEFAULT_STATUS: LearningGoalStatus = 'active';

function serializeStringArray(
  value: string[] | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  if (value.length === 0) return null;
  return JSON.stringify(value);
}

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === 'string')
      : [];
  } catch {
    return [];
  }
}

export function createLearningGoal(
  db: DatabaseAdapter,
  id: string,
  input: LearningGoalInput,
): LearningGoalRow {
  const parsed = LearningGoalInputSchema.parse(input);
  const now = new Date().toISOString();

  const row: LearningGoalRow = {
    id,
    title: parsed.title,
    description_md: parsed.description_md ?? null,
    target_date: parsed.target_date ?? null,
    status: parsed.status ?? DEFAULT_STATUS,
    course_ids: serializeStringArray(parsed.course_ids),
    certification_ids: serializeStringArray(parsed.certification_ids),
    created_at: now,
    completed_at: parsed.completed_at ?? null,
  };

  db.execute(
    `INSERT INTO cs_learning_goals
      (id, title, description_md, target_date, status, course_ids,
       certification_ids, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.title,
      row.description_md,
      row.target_date,
      row.status,
      row.course_ids,
      row.certification_ids,
      row.created_at,
      row.completed_at,
    ],
  );

  return LearningGoalRowSchema.parse(row);
}

export function getLearningGoal(
  db: DatabaseAdapter,
  id: string,
): LearningGoalRow | null {
  const rows = db.query<LearningGoalRow>(
    `SELECT * FROM cs_learning_goals WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? LearningGoalRowSchema.parse(rows[0]) : null;
}

const SCALAR_UPDATABLE_COLUMNS = new Set([
  'title',
  'description_md',
  'target_date',
  'status',
  'completed_at',
]);

export function updateLearningGoal(
  db: DatabaseAdapter,
  id: string,
  updates: LearningGoalUpdate,
): void {
  const parsed = LearningGoalUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'course_ids') {
      fields.push('course_ids = ?');
      values.push(serializeStringArray(value as string[] | null | undefined));
      continue;
    }
    if (key === 'certification_ids') {
      fields.push('certification_ids = ?');
      values.push(serializeStringArray(value as string[] | null | undefined));
      continue;
    }
    if (!SCALAR_UPDATABLE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }

  if (fields.length === 0) return;

  db.execute(
    `UPDATE cs_learning_goals SET ${fields.join(', ')} WHERE id = ?`,
    [...values, id],
  );
}

export function deleteLearningGoal(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM cs_learning_goals WHERE id = ?`, [id]);
}

export function listLearningGoals(db: DatabaseAdapter): LearningGoalRow[] {
  return db
    .query<LearningGoalRow>(
      `SELECT * FROM cs_learning_goals
       ORDER BY (target_date IS NULL), target_date ASC, created_at DESC`,
    )
    .map((row) => LearningGoalRowSchema.parse(row));
}

/**
 * getGoalProgress: percent completion across the goal's linked courses and
 * certifications.
 *
 * - A linked course counts as completed when its status is 'completed'.
 * - A linked certification counts as completed when it has a non-null issued_at.
 * - Missing rows still count toward total_items (not dropped silently).
 */
export function getGoalProgress(
  db: DatabaseAdapter,
  id: string,
): LearningGoalProgress {
  const goal = getLearningGoal(db, id);
  if (!goal) {
    return LearningGoalProgressSchema.parse({
      total_items: 0,
      completed_items: 0,
      percent: 0,
      goal: null,
    });
  }

  const courseIds = parseStringArray(goal.course_ids);
  const certIds = parseStringArray(goal.certification_ids);
  const totalItems = courseIds.length + certIds.length;

  if (totalItems === 0) {
    return LearningGoalProgressSchema.parse({
      total_items: 0,
      completed_items: 0,
      percent: 0,
      goal,
    });
  }

  let completed = 0;

  if (courseIds.length > 0) {
    const placeholders = courseIds.map(() => '?').join(',');
    const rows = db.query<{ id: string; status: string }>(
      `SELECT id, status FROM cs_online_courses WHERE id IN (${placeholders})`,
      courseIds,
    );
    for (const row of rows) {
      if (row.status === 'completed') completed += 1;
    }
  }

  if (certIds.length > 0) {
    const placeholders = certIds.map(() => '?').join(',');
    const rows = db.query<{ id: string; issued_at: string | null }>(
      `SELECT id, issued_at FROM cs_certifications WHERE id IN (${placeholders})`,
      certIds,
    );
    for (const row of rows) {
      if (row.issued_at) completed += 1;
    }
  }

  return LearningGoalProgressSchema.parse({
    total_items: totalItems,
    completed_items: completed,
    percent: (completed / totalItems) * 100,
    goal,
  });
}
