import type { DatabaseAdapter } from '@mylife/db';
import type { Project, ProjectStatus, ProjectPriority, ProjectCategory } from '../types';

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    status: row.status as ProjectStatus,
    budgetCents: row.budget_cents as number,
    actualCostCents: row.actual_cost_cents as number,
    startDate: (row.start_date as string) ?? null,
    targetEndDate: (row.target_end_date as string) ?? null,
    actualEndDate: (row.actual_end_date as string) ?? null,
    priority: row.priority as ProjectPriority,
    category: row.category as ProjectCategory,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createProject(
  db: DatabaseAdapter,
  id: string,
  input: {
    propertyId: string;
    name: string;
    description?: string;
    status?: ProjectStatus;
    budgetCents?: number;
    actualCostCents?: number;
    startDate?: string;
    targetEndDate?: string;
    priority?: ProjectPriority;
    category?: ProjectCategory;
    notes?: string;
  },
): Project {
  const now = new Date().toISOString();
  const status = input.status ?? 'planning';
  const budgetCents = input.budgetCents ?? 0;
  const actualCostCents = input.actualCostCents ?? 0;
  const priority = input.priority ?? 'medium';
  const category = input.category ?? 'other';

  db.execute(
    `INSERT INTO hm_projects (
      id, property_id, name, description, status,
      budget_cents, actual_cost_cents, start_date, target_end_date,
      actual_end_date, priority, category, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.propertyId,
      input.name,
      input.description ?? null,
      status,
      budgetCents,
      actualCostCents,
      input.startDate ?? null,
      input.targetEndDate ?? null,
      null,
      priority,
      category,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    propertyId: input.propertyId,
    name: input.name,
    description: input.description ?? null,
    status,
    budgetCents,
    actualCostCents,
    startDate: input.startDate ?? null,
    targetEndDate: input.targetEndDate ?? null,
    actualEndDate: null,
    priority,
    category,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getProject(
  db: DatabaseAdapter,
  id: string,
): Project | null {
  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM hm_projects WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToProject(rows[0]) : null;
}

export function getProjectsForProperty(
  db: DatabaseAdapter,
  propertyId: string,
): Project[] {
  return db
    .query<Record<string, unknown>>(
      'SELECT * FROM hm_projects WHERE property_id = ? ORDER BY created_at DESC LIMIT 200',
      [propertyId],
    )
    .map(rowToProject);
}

export function getActiveProjects(db: DatabaseAdapter): Project[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM hm_projects WHERE status IN ('planning', 'in_progress') ORDER BY created_at DESC LIMIT 200`,
    )
    .map(rowToProject);
}

export function updateProject(
  db: DatabaseAdapter,
  id: string,
  input: Partial<{
    name: string;
    description: string | null;
    status: ProjectStatus;
    budgetCents: number;
    actualCostCents: number;
    startDate: string | null;
    targetEndDate: string | null;
    actualEndDate: string | null;
    priority: ProjectPriority;
    category: ProjectCategory;
    notes: string | null;
  }>,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
  if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description); }
  if (input.status !== undefined) { sets.push('status = ?'); params.push(input.status); }
  if (input.budgetCents !== undefined) { sets.push('budget_cents = ?'); params.push(input.budgetCents); }
  if (input.actualCostCents !== undefined) { sets.push('actual_cost_cents = ?'); params.push(input.actualCostCents); }
  if (input.startDate !== undefined) { sets.push('start_date = ?'); params.push(input.startDate); }
  if (input.targetEndDate !== undefined) { sets.push('target_end_date = ?'); params.push(input.targetEndDate); }
  if (input.actualEndDate !== undefined) { sets.push('actual_end_date = ?'); params.push(input.actualEndDate); }
  if (input.priority !== undefined) { sets.push('priority = ?'); params.push(input.priority); }
  if (input.category !== undefined) { sets.push('category = ?'); params.push(input.category); }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(
    `UPDATE hm_projects SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}

export function deleteProject(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hm_projects WHERE id = ?', [id]);
}
