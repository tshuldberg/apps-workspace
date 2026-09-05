import type { DatabaseAdapter } from '@mylife/db';
import {
  ClassInputSchema,
  ClassRowSchema,
  ClassUpdateSchema,
  DAY_ORDER,
  type CategoryWeights,
  type ClassInput,
  type ClassRow,
  type ClassUpdate,
  type DayTime,
  type ScheduleConflict,
} from '../../models/schemas';
import { detectConflicts } from '../../engine/schedule-conflict';

const DEFAULT_COLOR = '#3B82F6';
const DEFAULT_CREDITS = 3;

function serializeDayTimes(value: DayTime[] | null | undefined): string | null {
  if (!value || value.length === 0) return null;
  return JSON.stringify(value);
}

function serializeWeights(value: CategoryWeights | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export function createClass(
  db: DatabaseAdapter,
  id: string,
  input: ClassInput,
): ClassRow {
  const parsed = ClassInputSchema.parse(input);
  const now = new Date().toISOString();

  const row: ClassRow = {
    id,
    semester_id: parsed.semester_id,
    name: parsed.name,
    code: parsed.code ?? null,
    section: parsed.section ?? null,
    credits: parsed.credits ?? DEFAULT_CREDITS,
    day_times: serializeDayTimes(parsed.day_times),
    room: parsed.room ?? null,
    building: parsed.building ?? null,
    teacher_id: parsed.teacher_id ?? null,
    category_weights: serializeWeights(parsed.category_weights),
    current_grade: parsed.current_grade ?? null,
    target_grade: parsed.target_grade ?? null,
    color: parsed.color ?? DEFAULT_COLOR,
    notes_md: parsed.notes_md ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO cs_classes
      (id, semester_id, name, code, section, credits, day_times, room, building,
       teacher_id, category_weights, current_grade, target_grade, color, notes_md,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.semester_id,
      row.name,
      row.code,
      row.section,
      row.credits,
      row.day_times,
      row.room,
      row.building,
      row.teacher_id,
      row.category_weights,
      row.current_grade,
      row.target_grade,
      row.color,
      row.notes_md,
      row.created_at,
      row.updated_at,
    ],
  );

  return ClassRowSchema.parse(row);
}

export function getClass(db: DatabaseAdapter, id: string): ClassRow | null {
  const rows = db.query<ClassRow>(`SELECT * FROM cs_classes WHERE id = ?`, [id]);
  return rows.length > 0 ? ClassRowSchema.parse(rows[0]) : null;
}

export function listClassesBySemester(
  db: DatabaseAdapter,
  semesterId: string,
): ClassRow[] {
  return db
    .query<ClassRow>(
      `SELECT * FROM cs_classes WHERE semester_id = ? ORDER BY name COLLATE NOCASE ASC`,
      [semesterId],
    )
    .map((row) => ClassRowSchema.parse(row));
}

/**
 * listClassesByTeacher: returns every class linked to the given teacher across
 * all semesters, ordered by created_at desc so the most recent classes surface
 * first.
 */
export function listClassesByTeacher(
  db: DatabaseAdapter,
  teacherId: string,
): ClassRow[] {
  return db
    .query<ClassRow>(
      `SELECT * FROM cs_classes WHERE teacher_id = ? ORDER BY created_at DESC`,
      [teacherId],
    )
    .map((row) => ClassRowSchema.parse(row));
}

const UPDATABLE_COLUMNS = new Set([
  'name',
  'code',
  'section',
  'credits',
  'room',
  'building',
  'teacher_id',
  'current_grade',
  'target_grade',
  'color',
  'notes_md',
  'semester_id',
]);

export function updateClass(
  db: DatabaseAdapter,
  id: string,
  updates: ClassUpdate,
): void {
  const parsed = ClassUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'day_times') {
      fields.push('day_times = ?');
      values.push(serializeDayTimes(value as DayTime[] | null | undefined));
      continue;
    }
    if (key === 'category_weights') {
      fields.push('category_weights = ?');
      values.push(serializeWeights(value as CategoryWeights | null | undefined));
      continue;
    }
    if (!UPDATABLE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());

  db.execute(
    `UPDATE cs_classes SET ${fields.join(', ')} WHERE id = ?`,
    [...values, id],
  );
}

export function deleteClass(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM cs_classes WHERE id = ?`, [id]);
}

export interface ScheduledBlock {
  cls: ClassRow;
  block: DayTime;
}

/**
 * getScheduleForWeek: returns every (class, time-block) pair for the given
 * semester, ordered by day-of-week then start_time.
 */
export function getScheduleForWeek(
  db: DatabaseAdapter,
  semesterId: string,
): ScheduledBlock[] {
  const classes = listClassesBySemester(db, semesterId);
  const blocks: ScheduledBlock[] = [];

  for (const cls of classes) {
    if (!cls.day_times) continue;
    let parsed: DayTime[];
    try {
      parsed = JSON.parse(cls.day_times) as DayTime[];
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    for (const block of parsed) {
      blocks.push({ cls, block });
    }
  }

  blocks.sort((left, right) => {
    const dayDelta = DAY_ORDER[left.block.day] - DAY_ORDER[right.block.day];
    if (dayDelta !== 0) return dayDelta;
    if (left.block.start_time !== right.block.start_time) {
      return left.block.start_time < right.block.start_time ? -1 : 1;
    }
    return left.cls.name.localeCompare(right.cls.name);
  });

  return blocks;
}

/**
 * detectClassConflicts: convenience wrapper that loads classes for a semester
 * and runs the pure conflict detector.
 */
export function detectClassConflicts(
  db: DatabaseAdapter,
  semesterId: string,
): ScheduleConflict[] {
  const classes = listClassesBySemester(db, semesterId);
  return detectConflicts(classes);
}
