import type { DatabaseAdapter } from '@mylife/db';
import type { ContainerPreset } from '../types';

interface ContainerRow {
  id: string;
  name: string;
  volume_oz: number;
  icon: string;
  is_builtin: number;
  sort_order: number;
  created_at: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function rowToPreset(row: ContainerRow): ContainerPreset {
  return {
    id: row.id,
    name: row.name,
    volumeOz: row.volume_oz,
    icon: row.icon,
    isBuiltin: row.is_builtin === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

/** List all container presets ordered by sort_order */
export function getContainerPresets(db: DatabaseAdapter): ContainerPreset[] {
  const rows = db.query<ContainerRow>(
    `SELECT * FROM ft_container_presets ORDER BY sort_order ASC`,
  );
  return rows.map(rowToPreset);
}

/** Get a single container preset by ID */
export function getContainerPreset(db: DatabaseAdapter, id: string): ContainerPreset | null {
  const rows = db.query<ContainerRow>(
    `SELECT * FROM ft_container_presets WHERE id = ?`,
    [id],
  );
  return rows[0] ? rowToPreset(rows[0]) : null;
}

/** Create a custom container preset */
export function createContainerPreset(
  db: DatabaseAdapter,
  input: { name: string; volumeOz: number; icon?: string },
): ContainerPreset {
  if (!input.name.trim()) throw new Error('Name is required');
  if (input.name.length > 30) throw new Error('Name must be 30 characters or less');
  if (input.volumeOz <= 0) throw new Error('Volume must be positive');
  if (input.volumeOz > 128) throw new Error('Volume cannot exceed 128 oz');

  const id = generateId();
  const icon = input.icon ?? '🫗';
  const maxSort = db.query<{ m: number }>(`SELECT COALESCE(MAX(sort_order), 0) as m FROM ft_container_presets`);
  const sortOrder = (maxSort[0]?.m ?? 0) + 1;

  db.execute(
    `INSERT INTO ft_container_presets (id, name, volume_oz, icon, is_builtin, sort_order)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [id, input.name.trim(), input.volumeOz, icon, sortOrder],
  );

  return getContainerPreset(db, id)!;
}

/** Update a container preset. Built-in presets allow volume and icon changes. */
export function updateContainerPreset(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<{ name: string; volumeOz: number; icon: string }>,
): ContainerPreset | null {
  const existing = getContainerPreset(db, id);
  if (!existing) return null;

  if (updates.volumeOz !== undefined) {
    if (updates.volumeOz <= 0) throw new Error('Volume must be positive');
    if (updates.volumeOz > 128) throw new Error('Volume cannot exceed 128 oz');
  }
  if (updates.name !== undefined) {
    if (!updates.name.trim()) throw new Error('Name is required');
    if (updates.name.length > 30) throw new Error('Name must be 30 characters or less');
  }

  const name = updates.name?.trim() ?? existing.name;
  const volumeOz = updates.volumeOz ?? existing.volumeOz;
  const icon = updates.icon ?? existing.icon;

  db.execute(
    `UPDATE ft_container_presets SET name = ?, volume_oz = ?, icon = ? WHERE id = ?`,
    [name, volumeOz, icon, id],
  );

  return getContainerPreset(db, id);
}

/** Delete a custom container preset. Rejects built-in presets. */
export function deleteContainerPreset(db: DatabaseAdapter, id: string): boolean {
  const existing = getContainerPreset(db, id);
  if (!existing) return false;
  if (existing.isBuiltin) throw new Error('Cannot delete built-in container preset');

  db.execute(`DELETE FROM ft_container_presets WHERE id = ?`, [id]);
  return true;
}

/** Reorder container presets by ID list */
export function reorderContainerPresets(db: DatabaseAdapter, orderedIds: string[]): void {
  db.transaction(() => {
    for (let i = 0; i < orderedIds.length; i++) {
      db.execute(
        `UPDATE ft_container_presets SET sort_order = ? WHERE id = ?`,
        [i + 1, orderedIds[i]],
      );
    }
  });
}

/**
 * Convert a container volume to glass equivalents for ft_water_intake.
 * Rounds to nearest 0.5, minimum 0.5.
 */
export function volumeToGlasses(volumeOz: number): number {
  const glasses = volumeOz / 8.0;
  const rounded = Math.round(glasses * 2) / 2;
  return Math.max(0.5, rounded);
}
