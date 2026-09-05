import type { DatabaseAdapter } from '@mylife/db';

export interface CreateProjectInput {
  habitId: string;
  projectName: string;
  clientName?: string;
  hourlyRate: number;
  currency?: string;
}

export function createProject(db: DatabaseAdapter, id: string, input: CreateProjectInput): void {
  db.execute(
    `INSERT INTO hb_projects (id, habit_id, project_name, client_name, hourly_rate, currency)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.habitId, input.projectName, input.clientName ?? null,
     input.hourlyRate, input.currency ?? 'USD'],
  );
}

export function getProjectByHabit(db: DatabaseAdapter, habitId: string) {
  const rows = db.query<Record<string, unknown>>('SELECT * FROM hb_projects WHERE habit_id = ?', [habitId]);
  return rows.length > 0 ? mapProject(rows[0]) : null;
}

export function getAllActiveProjects(db: DatabaseAdapter) {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM hb_projects WHERE is_active = 1 ORDER BY project_name',
  ).map(mapProject);
}

export function updateProject(db: DatabaseAdapter, id: string, updates: Partial<CreateProjectInput>): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.projectName !== undefined) { fields.push('project_name = ?'); values.push(updates.projectName); }
  if (updates.clientName !== undefined) { fields.push('client_name = ?'); values.push(updates.clientName); }
  if (updates.hourlyRate !== undefined) { fields.push('hourly_rate = ?'); values.push(updates.hourlyRate); }
  if (updates.currency !== undefined) { fields.push('currency = ?'); values.push(updates.currency); }

  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(`UPDATE hb_projects SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteProject(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hb_projects WHERE id = ?', [id]);
}

function mapProject(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    habitId: row.habit_id as string,
    projectName: row.project_name as string,
    clientName: (row.client_name as string) ?? null,
    hourlyRate: row.hourly_rate as number,
    currency: row.currency as string,
    isActive: (row.is_active as number) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
