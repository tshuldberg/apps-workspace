import type { DatabaseAdapter } from '@mylife/db';
import {
  RequirementInputSchema,
  RequirementRowSchema,
  RequirementUpdateSchema,
  type RequirementInput,
  type RequirementRow,
  type RequirementUpdate,
} from '../../models/schemas';

function serializeStringArray(
  value: string[] | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  if (value.length === 0) return null;
  return JSON.stringify(value);
}

export function createRequirement(
  db: DatabaseAdapter,
  id: string,
  input: RequirementInput,
): RequirementRow {
  const parsed = RequirementInputSchema.parse(input);
  const now = new Date().toISOString();

  const row: RequirementRow = {
    id,
    program_id: parsed.program_id,
    name: parsed.name,
    category: parsed.category ?? null,
    credits_required: parsed.credits_required ?? 0,
    course_count_required: parsed.course_count_required ?? 0,
    min_grade: parsed.min_grade ?? null,
    allowed_course_codes: serializeStringArray(parsed.allowed_course_codes),
    notes_md: parsed.notes_md ?? null,
    sort_order: parsed.sort_order ?? 0,
    created_at: now,
  };

  db.execute(
    `INSERT INTO cs_requirements
      (id, program_id, name, category, credits_required, course_count_required,
       min_grade, allowed_course_codes, notes_md, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.program_id,
      row.name,
      row.category,
      row.credits_required,
      row.course_count_required,
      row.min_grade,
      row.allowed_course_codes,
      row.notes_md,
      row.sort_order,
      row.created_at,
    ],
  );

  return RequirementRowSchema.parse(row);
}

export function getRequirement(
  db: DatabaseAdapter,
  id: string,
): RequirementRow | null {
  const rows = db.query<RequirementRow>(
    `SELECT * FROM cs_requirements WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? RequirementRowSchema.parse(rows[0]) : null;
}

const SCALAR_UPDATABLE_COLUMNS = new Set([
  'name',
  'category',
  'credits_required',
  'course_count_required',
  'min_grade',
  'notes_md',
  'sort_order',
]);

export function updateRequirement(
  db: DatabaseAdapter,
  id: string,
  updates: RequirementUpdate,
): void {
  const parsed = RequirementUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'allowed_course_codes') {
      fields.push('allowed_course_codes = ?');
      values.push(serializeStringArray(value as string[] | null | undefined));
      continue;
    }
    if (!SCALAR_UPDATABLE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }

  if (fields.length === 0) return;

  db.execute(
    `UPDATE cs_requirements SET ${fields.join(', ')} WHERE id = ?`,
    [...values, id],
  );
}

export function deleteRequirement(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM cs_requirements WHERE id = ?`, [id]);
}

export function listRequirementsByProgram(
  db: DatabaseAdapter,
  programId: string,
): RequirementRow[] {
  return db
    .query<RequirementRow>(
      `SELECT * FROM cs_requirements
       WHERE program_id = ?
       ORDER BY sort_order ASC, created_at ASC`,
      [programId],
    )
    .map((row) => RequirementRowSchema.parse(row));
}
