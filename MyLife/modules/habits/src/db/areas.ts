import type { DatabaseAdapter } from '@mylife/db';
import type { Area } from '../types';

function rowToArea(row: Record<string, unknown>): Area {
  return {
    id: row.id as string,
    name: row.name as string,
    icon: (row.icon as string) ?? null,
    color: (row.color as string) ?? null,
    sortOrder: (row.sort_order as number) ?? 0,
    createdAt: row.created_at as string,
  };
}

export interface CreateAreaInput {
  name: string;
  icon?: string;
  color?: string;
}

export function createArea(db: DatabaseAdapter, id: string, input: CreateAreaInput): void {
  const maxOrder = db.query<{ m: number | null }>('SELECT MAX(sort_order) as m FROM hb_areas')[0]?.m ?? -1;
  db.execute(
    `INSERT INTO hb_areas (id, name, icon, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [id, input.name, input.icon ?? null, input.color ?? null, maxOrder + 1],
  );
}

export function getAreas(db: DatabaseAdapter): Area[] {
  return db.query<Record<string, unknown>>(
    'SELECT * FROM hb_areas ORDER BY sort_order ASC, name ASC',
  ).map(rowToArea);
}

export function updateArea(db: DatabaseAdapter, id: string, input: Partial<CreateAreaInput>): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name); }
  if (input.icon !== undefined) { sets.push('icon = ?'); params.push(input.icon); }
  if (input.color !== undefined) { sets.push('color = ?'); params.push(input.color); }
  if (sets.length === 0) return;
  params.push(id);
  db.execute(`UPDATE hb_areas SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteArea(db: DatabaseAdapter, id: string): void {
  // Unlink habits from this area first
  db.execute('UPDATE hb_habits SET area_id = NULL WHERE area_id = ?', [id]);
  db.execute('DELETE FROM hb_areas WHERE id = ?', [id]);
}

export function reorderAreas(db: DatabaseAdapter, orderedIds: string[]): void {
  for (let i = 0; i < orderedIds.length; i++) {
    db.execute('UPDATE hb_areas SET sort_order = ? WHERE id = ?', [i, orderedIds[i]]);
  }
}
