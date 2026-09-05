import type { DatabaseAdapter } from '@mylife/db';
import {
  AssignmentInputSchema,
  AssignmentRowSchema,
  AssignmentUpdateSchema,
  type AssignmentInput,
  type AssignmentRow,
  type AssignmentStatus,
  type AssignmentUpdate,
  type GroupMember,
  type LatePolicy,
  type RecurrenceRule,
} from '../../models/schemas';

const DEFAULT_STATUS: AssignmentStatus = 'not_started';
const DEFAULT_PRIORITY = 'medium' as const;
const DEFAULT_MAX_GRADE = 100;

function serializeRecurrence(value: RecurrenceRule | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

function serializeGroupMembers(
  value: GroupMember[] | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  if (value.length === 0) return null;
  return JSON.stringify(value);
}

function serializeLatePolicy(value: LatePolicy | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

function serializeStringArray(
  value: string[] | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  if (value.length === 0) return null;
  return JSON.stringify(value);
}

// Allowed status transitions. Anything outside this map throws.
const ALLOWED_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  not_started: ['not_started', 'in_progress', 'submitted'],
  in_progress: ['in_progress', 'not_started', 'submitted'],
  submitted: ['submitted', 'graded', 'in_progress'],
  graded: ['graded'],
};

export class IllegalAssignmentTransitionError extends Error {
  constructor(from: AssignmentStatus, to: AssignmentStatus) {
    super(`Illegal assignment status transition: ${from} -> ${to}`);
    this.name = 'IllegalAssignmentTransitionError';
  }
}

export function createAssignment(
  db: DatabaseAdapter,
  id: string,
  input: AssignmentInput,
): AssignmentRow {
  const parsed = AssignmentInputSchema.parse(input);
  const now = new Date().toISOString();

  const row: AssignmentRow = {
    id,
    class_id: parsed.class_id,
    title: parsed.title,
    type: parsed.type,
    description_md: parsed.description_md ?? null,
    due_at: parsed.due_at ?? null,
    submitted_at: parsed.submitted_at ?? null,
    graded_at: parsed.graded_at ?? null,
    status: parsed.status ?? DEFAULT_STATUS,
    priority: parsed.priority ?? DEFAULT_PRIORITY,
    estimated_minutes: parsed.estimated_minutes ?? null,
    actual_minutes: parsed.actual_minutes ?? null,
    grade: parsed.grade ?? null,
    max_grade: parsed.max_grade ?? DEFAULT_MAX_GRADE,
    weight: parsed.weight ?? null,
    is_recurring: parsed.is_recurring ? 1 : 0,
    recurrence_rule: serializeRecurrence(parsed.recurrence_rule),
    group_members: serializeGroupMembers(parsed.group_members),
    submission_notes: parsed.submission_notes ?? null,
    late_policy: serializeLatePolicy(parsed.late_policy),
    depends_on: serializeStringArray(parsed.depends_on),
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO cs_assignments
      (id, class_id, title, type, description_md, due_at, submitted_at, graded_at,
       status, priority, estimated_minutes, actual_minutes, grade, max_grade, weight,
       is_recurring, recurrence_rule, group_members, submission_notes, late_policy,
       depends_on, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.class_id,
      row.title,
      row.type,
      row.description_md,
      row.due_at,
      row.submitted_at,
      row.graded_at,
      row.status,
      row.priority,
      row.estimated_minutes,
      row.actual_minutes,
      row.grade,
      row.max_grade,
      row.weight,
      row.is_recurring,
      row.recurrence_rule,
      row.group_members,
      row.submission_notes,
      row.late_policy,
      row.depends_on,
      row.created_at,
      row.updated_at,
    ],
  );

  return AssignmentRowSchema.parse(row);
}

export function getAssignment(
  db: DatabaseAdapter,
  id: string,
): AssignmentRow | null {
  const rows = db.query<AssignmentRow>(
    `SELECT * FROM cs_assignments WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? AssignmentRowSchema.parse(rows[0]) : null;
}

const SCALAR_UPDATABLE_COLUMNS = new Set([
  'class_id',
  'title',
  'type',
  'description_md',
  'due_at',
  'submitted_at',
  'graded_at',
  'priority',
  'estimated_minutes',
  'actual_minutes',
  'grade',
  'max_grade',
  'weight',
  'submission_notes',
]);

export function updateAssignment(
  db: DatabaseAdapter,
  id: string,
  updates: AssignmentUpdate,
): void {
  const parsed = AssignmentUpdateSchema.parse(updates);

  // Status guard: enforce legal transitions before composing SQL.
  if (parsed.status !== undefined) {
    const existing = getAssignment(db, id);
    if (!existing) {
      throw new Error(`Assignment not found: ${id}`);
    }
    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(parsed.status)) {
      throw new IllegalAssignmentTransitionError(existing.status, parsed.status);
    }
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'status') {
      fields.push('status = ?');
      values.push(value);
      continue;
    }
    if (key === 'is_recurring') {
      fields.push('is_recurring = ?');
      values.push(value ? 1 : 0);
      continue;
    }
    if (key === 'recurrence_rule') {
      fields.push('recurrence_rule = ?');
      values.push(serializeRecurrence(value as RecurrenceRule | null | undefined));
      continue;
    }
    if (key === 'group_members') {
      fields.push('group_members = ?');
      values.push(
        serializeGroupMembers(value as GroupMember[] | null | undefined),
      );
      continue;
    }
    if (key === 'late_policy') {
      fields.push('late_policy = ?');
      values.push(serializeLatePolicy(value as LatePolicy | null | undefined));
      continue;
    }
    if (key === 'depends_on') {
      fields.push('depends_on = ?');
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
    `UPDATE cs_assignments SET ${fields.join(', ')} WHERE id = ?`,
    [...values, id],
  );
}

export function deleteAssignment(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM cs_assignments WHERE id = ?`, [id]);
}

export function listAssignmentsByClass(
  db: DatabaseAdapter,
  classId: string,
): AssignmentRow[] {
  return db
    .query<AssignmentRow>(
      `SELECT * FROM cs_assignments
       WHERE class_id = ?
       ORDER BY (due_at IS NULL), due_at ASC, created_at ASC`,
      [classId],
    )
    .map((row) => AssignmentRowSchema.parse(row));
}

export function listAssignmentsByStatus(
  db: DatabaseAdapter,
  status: AssignmentStatus,
): AssignmentRow[] {
  return db
    .query<AssignmentRow>(
      `SELECT * FROM cs_assignments
       WHERE status = ?
       ORDER BY (due_at IS NULL), due_at ASC, created_at ASC`,
      [status],
    )
    .map((row) => AssignmentRowSchema.parse(row));
}

/**
 * listUpcomingAssignments: assignments with a due date within the next N days,
 * excluding any that are already graded. Ordered by due_at ascending.
 */
export function listUpcomingAssignments(
  db: DatabaseAdapter,
  daysAhead: number,
  now?: Date,
): AssignmentRow[] {
  const start = now ?? new Date();
  const end = new Date(start.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return db
    .query<AssignmentRow>(
      `SELECT * FROM cs_assignments
       WHERE due_at IS NOT NULL
         AND due_at >= ?
         AND due_at < ?
         AND status != 'graded'
       ORDER BY due_at ASC`,
      [start.toISOString(), end.toISOString()],
    )
    .map((row) => AssignmentRowSchema.parse(row));
}

/**
 * listOverdueAssignments: due in the past AND status in (not_started, in_progress).
 */
export function listOverdueAssignments(
  db: DatabaseAdapter,
  now?: Date,
): AssignmentRow[] {
  const ts = (now ?? new Date()).toISOString();
  return db
    .query<AssignmentRow>(
      `SELECT * FROM cs_assignments
       WHERE due_at IS NOT NULL
         AND due_at < ?
         AND status IN ('not_started','in_progress')
       ORDER BY due_at ASC`,
      [ts],
    )
    .map((row) => AssignmentRowSchema.parse(row));
}

export function markAssignmentSubmitted(
  db: DatabaseAdapter,
  id: string,
  submittedAt?: string,
): void {
  const ts = submittedAt ?? new Date().toISOString();
  updateAssignment(db, id, {
    status: 'submitted',
    submitted_at: ts,
  });
}

export function setAssignmentGrade(
  db: DatabaseAdapter,
  id: string,
  grade: number,
  maxGrade?: number,
  gradedAt?: string,
): void {
  const ts = gradedAt ?? new Date().toISOString();
  const updates: AssignmentUpdate = {
    status: 'graded',
    grade,
    graded_at: ts,
  };
  if (maxGrade !== undefined) updates.max_grade = maxGrade;
  updateAssignment(db, id, updates);
}

export interface TimeEstimateAccuracy {
  sample_count: number;
  avg_actual_over_estimated_ratio: number | null;
  mean_absolute_error_minutes: number | null;
}

/**
 * getTimeEstimateAccuracy: across assignments that have BOTH estimated_minutes
 * and actual_minutes (and estimated_minutes > 0), returns:
 *   - sample_count
 *   - avg(actual / estimated)
 *   - mean(|actual - estimated|)
 * Optionally scoped to a single class.
 */
export function getTimeEstimateAccuracy(
  db: DatabaseAdapter,
  classId?: string,
): TimeEstimateAccuracy {
  const sql = classId
    ? `SELECT estimated_minutes, actual_minutes FROM cs_assignments
       WHERE class_id = ?
         AND estimated_minutes IS NOT NULL
         AND estimated_minutes > 0
         AND actual_minutes IS NOT NULL`
    : `SELECT estimated_minutes, actual_minutes FROM cs_assignments
       WHERE estimated_minutes IS NOT NULL
         AND estimated_minutes > 0
         AND actual_minutes IS NOT NULL`;
  const params: unknown[] = classId ? [classId] : [];
  const rows = db.query<{
    estimated_minutes: number;
    actual_minutes: number;
  }>(sql, params);

  if (rows.length === 0) {
    return {
      sample_count: 0,
      avg_actual_over_estimated_ratio: null,
      mean_absolute_error_minutes: null,
    };
  }

  const ratios = rows.map((r) => r.actual_minutes / r.estimated_minutes);
  const errors = rows.map((r) => Math.abs(r.actual_minutes - r.estimated_minutes));
  const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const mae = errors.reduce((a, b) => a + b, 0) / errors.length;

  return {
    sample_count: rows.length,
    avg_actual_over_estimated_ratio: avgRatio,
    mean_absolute_error_minutes: mae,
  };
}
