/**
 * Companion CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { CreateCompanionSchema } from '../../models/schemas';
import type { Companion, CreateCompanionInput } from '../../models/schemas';

const COMPANION_COLUMNS = [
  'id',
  'visit_id',
  'display_name',
  'notes',
  'created_at',
].join(', ');

export function createCompanion(
  db: DatabaseAdapter,
  id: string,
  input: CreateCompanionInput,
): Companion {
  const parsed = CreateCompanionSchema.parse(input);
  const now = new Date().toISOString();

  const companion: Companion = {
    id,
    visit_id: parsed.visit_id,
    display_name: parsed.display_name,
    notes: parsed.notes ?? null,
    created_at: now,
  };

  db.execute(
    `INSERT INTO dn_companions (${COMPANION_COLUMNS})
     VALUES (?, ?, ?, ?, ?)`,
    [
      companion.id,
      companion.visit_id,
      companion.display_name,
      companion.notes,
      companion.created_at,
    ],
  );

  return companion;
}

export function listCompanionsByVisit(
  db: DatabaseAdapter,
  visitId: string,
): Companion[] {
  return db.query<Companion>(
    `SELECT ${COMPANION_COLUMNS} FROM dn_companions WHERE visit_id = ? ORDER BY display_name`,
    [visitId],
  );
}

export function deleteCompanion(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM dn_companions WHERE id = ?', [id]);
}
