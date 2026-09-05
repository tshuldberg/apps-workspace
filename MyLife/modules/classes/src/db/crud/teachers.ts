import type { DatabaseAdapter } from '@mylife/db';
import {
  TeacherInputSchema,
  TeacherRowSchema,
  TeacherUpdateSchema,
  type TeacherInput,
  type TeacherRow,
  type TeacherUpdate,
} from '../../models/schemas';

function serializeOfficeHours(value: TeacherInput['office_hours']): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export function createTeacher(
  db: DatabaseAdapter,
  id: string,
  input: TeacherInput,
): TeacherRow {
  const parsed = TeacherInputSchema.parse(input);
  const now = new Date().toISOString();

  const row: TeacherRow = {
    id,
    name: parsed.name,
    title: parsed.title ?? null,
    department: parsed.department ?? null,
    email: parsed.email ?? null,
    office_location: parsed.office_location ?? null,
    office_hours: serializeOfficeHours(parsed.office_hours),
    teaching_style_notes: parsed.teaching_style_notes ?? null,
    grading_notes: parsed.grading_notes ?? null,
    rec_potential: parsed.rec_potential ?? null,
    rating: parsed.rating ?? null,
    notes_md: parsed.notes_md ?? null,
    created_at: now,
  };

  db.execute(
    `INSERT INTO cs_teachers
      (id, name, title, department, email, office_location, office_hours,
       teaching_style_notes, grading_notes, rec_potential, rating, notes_md, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.name,
      row.title,
      row.department,
      row.email,
      row.office_location,
      row.office_hours,
      row.teaching_style_notes,
      row.grading_notes,
      row.rec_potential,
      row.rating,
      row.notes_md,
      row.created_at,
    ],
  );

  return TeacherRowSchema.parse(row);
}

export function getTeacher(db: DatabaseAdapter, id: string): TeacherRow | null {
  const rows = db.query<TeacherRow>(`SELECT * FROM cs_teachers WHERE id = ?`, [id]);
  return rows.length > 0 ? TeacherRowSchema.parse(rows[0]) : null;
}

export function listTeachers(db: DatabaseAdapter): TeacherRow[] {
  return db
    .query<TeacherRow>(`SELECT * FROM cs_teachers ORDER BY name COLLATE NOCASE ASC`)
    .map((row) => TeacherRowSchema.parse(row));
}

const UPDATABLE_COLUMNS = new Set([
  'name',
  'title',
  'department',
  'email',
  'office_location',
  'teaching_style_notes',
  'grading_notes',
  'rec_potential',
  'rating',
  'notes_md',
]);

export function updateTeacher(
  db: DatabaseAdapter,
  id: string,
  updates: TeacherUpdate,
): void {
  const parsed = TeacherUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'office_hours') {
      fields.push('office_hours = ?');
      values.push(serializeOfficeHours(value as TeacherInput['office_hours']));
      continue;
    }
    if (!UPDATABLE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }

  if (fields.length === 0) return;

  db.execute(
    `UPDATE cs_teachers SET ${fields.join(', ')} WHERE id = ?`,
    [...values, id],
  );
}

export function deleteTeacher(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM cs_teachers WHERE id = ?`, [id]);
}

/**
 * getByClass: returns the teacher attached to a given class, if any.
 */
export function getTeacherByClass(
  db: DatabaseAdapter,
  classId: string,
): TeacherRow | null {
  const rows = db.query<TeacherRow>(
    `SELECT t.* FROM cs_teachers t
     INNER JOIN cs_classes c ON c.teacher_id = t.id
     WHERE c.id = ?`,
    [classId],
  );
  return rows.length > 0 ? TeacherRowSchema.parse(rows[0]) : null;
}
