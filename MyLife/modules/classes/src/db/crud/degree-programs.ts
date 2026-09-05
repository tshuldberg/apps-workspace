import type { DatabaseAdapter } from '@mylife/db';
import {
  DegreeProgramInputSchema,
  DegreeProgramRowSchema,
  DegreeProgramUpdateSchema,
  type DegreeProgramInput,
  type DegreeProgramRow,
  type DegreeProgramUpdate,
} from '../../models/schemas';

function toBool(input: boolean | undefined): number {
  return input ? 1 : 0;
}

export function createDegreeProgram(
  db: DatabaseAdapter,
  id: string,
  input: DegreeProgramInput,
): DegreeProgramRow {
  const parsed = DegreeProgramInputSchema.parse(input);
  const now = new Date().toISOString();

  const row: DegreeProgramRow = {
    id,
    name: parsed.name,
    institution: parsed.institution ?? null,
    degree_type: parsed.degree_type ?? null,
    total_credits_required: parsed.total_credits_required,
    gpa_required: parsed.gpa_required ?? null,
    catalog_year: parsed.catalog_year ?? null,
    start_date: parsed.start_date ?? null,
    expected_completion: parsed.expected_completion ?? null,
    is_primary: toBool(parsed.is_primary),
    notes_md: parsed.notes_md ?? null,
    created_at: now,
    updated_at: now,
  };

  db.transaction(() => {
    if (row.is_primary === 1) {
      db.execute(`UPDATE cs_degree_programs SET is_primary = 0 WHERE is_primary = 1`);
    }
    db.execute(
      `INSERT INTO cs_degree_programs
        (id, name, institution, degree_type, total_credits_required, gpa_required,
         catalog_year, start_date, expected_completion, is_primary, notes_md,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.name,
        row.institution,
        row.degree_type,
        row.total_credits_required,
        row.gpa_required,
        row.catalog_year,
        row.start_date,
        row.expected_completion,
        row.is_primary,
        row.notes_md,
        row.created_at,
        row.updated_at,
      ],
    );
  });

  return DegreeProgramRowSchema.parse(row);
}

export function getProgram(
  db: DatabaseAdapter,
  id: string,
): DegreeProgramRow | null {
  const rows = db.query<DegreeProgramRow>(
    `SELECT * FROM cs_degree_programs WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? DegreeProgramRowSchema.parse(rows[0]) : null;
}

export function listPrograms(db: DatabaseAdapter): DegreeProgramRow[] {
  return db
    .query<DegreeProgramRow>(
      `SELECT * FROM cs_degree_programs
       ORDER BY is_primary DESC, COALESCE(start_date, created_at) DESC`,
    )
    .map((row) => DegreeProgramRowSchema.parse(row));
}

const SCALAR_UPDATABLE_COLUMNS = new Set([
  'name',
  'institution',
  'degree_type',
  'total_credits_required',
  'gpa_required',
  'catalog_year',
  'start_date',
  'expected_completion',
  'notes_md',
]);

export function updateDegreeProgram(
  db: DatabaseAdapter,
  id: string,
  updates: DegreeProgramUpdate,
): void {
  const parsed = DegreeProgramUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'is_primary') continue;
    if (!SCALAR_UPDATABLE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }

  if (fields.length === 0 && parsed.is_primary === undefined) return;

  db.transaction(() => {
    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      db.execute(
        `UPDATE cs_degree_programs SET ${fields.join(', ')} WHERE id = ?`,
        [...values, id],
      );
    }
    if (parsed.is_primary !== undefined) {
      if (parsed.is_primary) {
        db.execute(`UPDATE cs_degree_programs SET is_primary = 0 WHERE id != ?`, [id]);
        db.execute(`UPDATE cs_degree_programs SET is_primary = 1 WHERE id = ?`, [id]);
      } else {
        db.execute(`UPDATE cs_degree_programs SET is_primary = 0 WHERE id = ?`, [id]);
      }
    }
  });
}

export function deleteDegreeProgram(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM cs_degree_programs WHERE id = ?`, [id]);
}

/**
 * setPrimaryProgram: enforces the single is_primary invariant. Idempotent.
 */
export function setPrimaryProgram(db: DatabaseAdapter, id: string): void {
  db.transaction(() => {
    db.execute(`UPDATE cs_degree_programs SET is_primary = 0 WHERE is_primary = 1`);
    db.execute(`UPDATE cs_degree_programs SET is_primary = 1 WHERE id = ?`, [id]);
  });
}
