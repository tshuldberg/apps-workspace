import type { DatabaseAdapter } from '@mylife/db';
import type { ProjectPhase, PhaseStatus } from '../types';

function rowToPhase(row: Record<string, unknown>): ProjectPhase {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    sortOrder: row.sort_order as number,
    status: row.status as PhaseStatus,
    startDate: (row.start_date as string) ?? null,
    endDate: (row.end_date as string) ?? null,
    budgetCents: (row.budget_cents as number) ?? null,
    contractorId: (row.contractor_id as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createPhase(
  db: DatabaseAdapter,
  id: string,
  input: {
    projectId: string;
    name: string;
    description?: string;
    sortOrder?: number;
    budgetCents?: number;
    contractorId?: string;
  },
): ProjectPhase {
  const now = new Date().toISOString();
  const sortOrder = input.sortOrder ?? 0;

  db.execute(
    `INSERT INTO hm_project_phases (
      id, project_id, name, description, sort_order, status,
      start_date, end_date, budget_cents, contractor_id, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.projectId,
      input.name,
      input.description ?? null,
      sortOrder,
      'pending',
      null,
      null,
      input.budgetCents ?? null,
      input.contractorId ?? null,
      null,
      now,
      now,
    ],
  );

  return {
    id,
    projectId: input.projectId,
    name: input.name,
    description: input.description ?? null,
    sortOrder,
    status: 'pending',
    startDate: null,
    endDate: null,
    budgetCents: input.budgetCents ?? null,
    contractorId: input.contractorId ?? null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getPhase(
  db: DatabaseAdapter,
  id: string,
): ProjectPhase | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hm_project_phases WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToPhase(rows[0]) : null;
}

export function getPhasesForProject(
  db: DatabaseAdapter,
  projectId: string,
): ProjectPhase[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_project_phases WHERE project_id = ? ORDER BY sort_order ASC LIMIT 100',
      [projectId],
    )
    .map(rowToPhase);
}

export function updatePhase(
  db: DatabaseAdapter,
  id: string,
  input: Partial<{
    name: string;
    description: string | null;
    sortOrder: number;
    status: PhaseStatus;
    startDate: string | null;
    endDate: string | null;
    budgetCents: number | null;
    contractorId: string | null;
    notes: string | null;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
  if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description); }
  if (input.sortOrder !== undefined) { sets.push('sort_order = ?'); params.push(input.sortOrder); }
  if (input.status !== undefined) { sets.push('status = ?'); params.push(input.status); }
  if (input.startDate !== undefined) { sets.push('start_date = ?'); params.push(input.startDate); }
  if (input.endDate !== undefined) { sets.push('end_date = ?'); params.push(input.endDate); }
  if (input.budgetCents !== undefined) { sets.push('budget_cents = ?'); params.push(input.budgetCents); }
  if (input.contractorId !== undefined) { sets.push('contractor_id = ?'); params.push(input.contractorId); }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(
    `UPDATE hm_project_phases SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}

export function deletePhase(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_project_phases WHERE id = ?', [id]);
}
