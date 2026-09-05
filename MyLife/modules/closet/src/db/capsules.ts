import type { DatabaseAdapter } from '@mylife/db';
import {
  CapsuleWardrobeSchema,
  CreateCapsuleInputSchema,
  type CapsuleWardrobe,
  type CreateCapsuleInput,
} from '../types';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseBoolean(raw: unknown): boolean {
  return raw === 1 || raw === '1' || raw === true;
}

function getCapsuleItemIds(db: DatabaseAdapter, capsuleId: string): string[] {
  return db
    .query<{ clothing_item_id: string }>(
      `SELECT clothing_item_id FROM cl_capsule_items WHERE capsule_id = ? ORDER BY created_at ASC`,
      [capsuleId],
    )
    .map((row) => row.clothing_item_id);
}

function getCapsuleEssentialIds(db: DatabaseAdapter, capsuleId: string): string[] {
  return db
    .query<{ clothing_item_id: string }>(
      `SELECT clothing_item_id FROM cl_capsule_items WHERE capsule_id = ? AND is_essential = 1`,
      [capsuleId],
    )
    .map((row) => row.clothing_item_id);
}

function rowToCapsule(db: DatabaseAdapter, row: Record<string, unknown>): CapsuleWardrobe {
  const id = row.id as string;
  return CapsuleWardrobeSchema.parse({
    id,
    name: row.name,
    season: row.season,
    targetCount: row.target_count,
    notes: row.notes ?? null,
    isActive: parseBoolean(row.is_active),
    itemIds: getCapsuleItemIds(db, id),
    essentialItemIds: getCapsuleEssentialIds(db, id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function createCapsule(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateCapsuleInput,
): CapsuleWardrobe {
  const input = CreateCapsuleInputSchema.parse(rawInput);
  const now = nowIso();
  const essentialSet = new Set(input.essentialItemIds);

  db.transaction(() => {
    db.execute(
      `UPDATE cl_capsules SET is_active = 0, updated_at = ? WHERE is_active = 1`,
      [now],
    );

    db.execute(
      `INSERT INTO cl_capsules (id, name, season, target_count, notes, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, input.name, input.season, input.targetCount, input.notes, now, now],
    );

    const uniqueIds = [...new Set(input.itemIds)];
    for (const itemId of uniqueIds) {
      db.execute(
        `INSERT OR IGNORE INTO cl_capsule_items (id, capsule_id, clothing_item_id, is_essential, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [createId('cl_cap_item'), id, itemId, essentialSet.has(itemId) ? 1 : 0, now],
      );
    }
  });

  return getCapsuleById(db, id)!;
}

export function getCapsuleById(db: DatabaseAdapter, capsuleId: string): CapsuleWardrobe | null {
  const row = db.query<Record<string, unknown>>(
    `SELECT * FROM cl_capsules WHERE id = ?`, [capsuleId],
  )[0];
  return row ? rowToCapsule(db, row) : null;
}

export function listCapsules(db: DatabaseAdapter, limit: number = 50): CapsuleWardrobe[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM cl_capsules ORDER BY is_active DESC, created_at DESC LIMIT ?`,
      [limit],
    )
    .map((row) => rowToCapsule(db, row));
}

export function setActiveCapsule(db: DatabaseAdapter, capsuleId: string): CapsuleWardrobe | null {
  const existing = getCapsuleById(db, capsuleId);
  if (!existing) return null;

  const now = nowIso();
  db.transaction(() => {
    db.execute(`UPDATE cl_capsules SET is_active = 0, updated_at = ? WHERE is_active = 1`, [now]);
    db.execute(`UPDATE cl_capsules SET is_active = 1, updated_at = ? WHERE id = ?`, [now, capsuleId]);
  });

  return getCapsuleById(db, capsuleId);
}

export function addCapsuleItem(
  db: DatabaseAdapter,
  capsuleId: string,
  itemId: string,
  isEssential: boolean = false,
): CapsuleWardrobe | null {
  const existing = getCapsuleById(db, capsuleId);
  if (!existing) return null;

  const now = nowIso();
  db.execute(
    `INSERT OR IGNORE INTO cl_capsule_items (id, capsule_id, clothing_item_id, is_essential, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [createId('cl_cap_item'), capsuleId, itemId, isEssential ? 1 : 0, now],
  );

  db.execute(`UPDATE cl_capsules SET updated_at = ? WHERE id = ?`, [now, capsuleId]);
  return getCapsuleById(db, capsuleId);
}

export function removeCapsuleItem(
  db: DatabaseAdapter,
  capsuleId: string,
  itemId: string,
): CapsuleWardrobe | null {
  const existing = getCapsuleById(db, capsuleId);
  if (!existing) return null;

  const now = nowIso();
  db.execute(
    `DELETE FROM cl_capsule_items WHERE capsule_id = ? AND clothing_item_id = ?`,
    [capsuleId, itemId],
  );

  db.execute(`UPDATE cl_capsules SET updated_at = ? WHERE id = ?`, [now, capsuleId]);
  return getCapsuleById(db, capsuleId);
}

export function deleteCapsule(db: DatabaseAdapter, capsuleId: string): boolean {
  db.execute(`DELETE FROM cl_capsules WHERE id = ?`, [capsuleId]);
  return true;
}
