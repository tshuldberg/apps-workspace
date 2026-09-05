import type { DatabaseAdapter } from '@mylife/db';
import {
  RequirementSatisfactionInputSchema,
  RequirementSatisfactionRowSchema,
  RequirementSatisfactionUpdateSchema,
  type RequirementSatisfactionInput,
  type RequirementSatisfactionRow,
  type RequirementSatisfactionUpdate,
  type SatisfactionStatus,
} from '../../models/schemas';

const DEFAULT_STATUS: SatisfactionStatus = 'planned';

export function createRequirementSatisfaction(
  db: DatabaseAdapter,
  id: string,
  input: RequirementSatisfactionInput,
): RequirementSatisfactionRow {
  const parsed = RequirementSatisfactionInputSchema.parse(input);
  const now = new Date().toISOString();

  const row: RequirementSatisfactionRow = {
    id,
    requirement_id: parsed.requirement_id,
    class_id: parsed.class_id,
    credits_applied: parsed.credits_applied,
    status: parsed.status ?? DEFAULT_STATUS,
    approved_by: parsed.approved_by ?? null,
    created_at: now,
  };

  db.execute(
    `INSERT INTO cs_requirement_satisfactions
      (id, requirement_id, class_id, credits_applied, status, approved_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.requirement_id,
      row.class_id,
      row.credits_applied,
      row.status,
      row.approved_by,
      row.created_at,
    ],
  );

  return RequirementSatisfactionRowSchema.parse(row);
}

export function getRequirementSatisfaction(
  db: DatabaseAdapter,
  id: string,
): RequirementSatisfactionRow | null {
  const rows = db.query<RequirementSatisfactionRow>(
    `SELECT * FROM cs_requirement_satisfactions WHERE id = ?`,
    [id],
  );
  return rows.length > 0
    ? RequirementSatisfactionRowSchema.parse(rows[0])
    : null;
}

const SCALAR_UPDATABLE_COLUMNS = new Set([
  'credits_applied',
  'status',
  'approved_by',
]);

export function updateRequirementSatisfaction(
  db: DatabaseAdapter,
  id: string,
  updates: RequirementSatisfactionUpdate,
): void {
  const parsed = RequirementSatisfactionUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (!SCALAR_UPDATABLE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }

  if (fields.length === 0) return;

  db.execute(
    `UPDATE cs_requirement_satisfactions SET ${fields.join(', ')} WHERE id = ?`,
    [...values, id],
  );
}

export function deleteRequirementSatisfaction(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM cs_requirement_satisfactions WHERE id = ?`, [id]);
}

export function listSatisfactionsByRequirement(
  db: DatabaseAdapter,
  requirementId: string,
): RequirementSatisfactionRow[] {
  return db
    .query<RequirementSatisfactionRow>(
      `SELECT * FROM cs_requirement_satisfactions
       WHERE requirement_id = ?
       ORDER BY created_at ASC`,
      [requirementId],
    )
    .map((row) => RequirementSatisfactionRowSchema.parse(row));
}

export function listSatisfactionsByClass(
  db: DatabaseAdapter,
  classId: string,
): RequirementSatisfactionRow[] {
  return db
    .query<RequirementSatisfactionRow>(
      `SELECT * FROM cs_requirement_satisfactions
       WHERE class_id = ?
       ORDER BY created_at ASC`,
      [classId],
    )
    .map((row) => RequirementSatisfactionRowSchema.parse(row));
}
