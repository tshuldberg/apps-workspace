import type { DatabaseAdapter } from '@mylife/db';
import type { OcclusionRegion, CreateOcclusionRegionInput } from '../occlusion/types';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `fl_occ_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function rowToRegion(row: Record<string, unknown>): OcclusionRegion {
  return {
    id: row.id as string,
    cardId: row.card_id as string,
    mediaId: row.media_id as string,
    regionIndex: row.region_index as number,
    shape: row.shape as OcclusionRegion['shape'],
    x: row.x as number,
    y: row.y as number,
    width: row.width as number,
    height: row.height as number,
    label: (row.label as string) ?? '',
    maskColor: (row.mask_color as string) ?? '#FBBF24',
    createdAt: row.created_at as string,
  };
}

export function createOcclusionRegion(
  db: DatabaseAdapter,
  cardId: string,
  mediaId: string,
  regionIndex: number,
  input: CreateOcclusionRegionInput,
): OcclusionRegion {
  const id = createId();
  const now = nowIso();
  db.execute(
    `INSERT INTO fl_occlusion_regions (id, card_id, media_id, region_index, shape, x, y, width, height, label, mask_color, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, cardId, mediaId, regionIndex, input.shape ?? 'rect', input.x, input.y, input.width, input.height, input.label ?? '', input.maskColor ?? '#FBBF24', now],
  );
  return { id, cardId, mediaId, regionIndex, shape: input.shape ?? 'rect', x: input.x, y: input.y, width: input.width, height: input.height, label: input.label ?? '', maskColor: input.maskColor ?? '#FBBF24', createdAt: now };
}

export function listRegionsForCard(db: DatabaseAdapter, cardId: string): OcclusionRegion[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM fl_occlusion_regions WHERE card_id = ? ORDER BY region_index ASC`,
    [cardId],
  ).map(rowToRegion);
}

export function listRegionsForMedia(db: DatabaseAdapter, mediaId: string): OcclusionRegion[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM fl_occlusion_regions WHERE media_id = ? ORDER BY region_index ASC`,
    [mediaId],
  ).map(rowToRegion);
}

export function deleteOcclusionRegion(db: DatabaseAdapter, regionId: string): boolean {
  db.execute(`DELETE FROM fl_occlusion_regions WHERE id = ?`, [regionId]);
  return true;
}

export function deleteRegionsForCard(db: DatabaseAdapter, cardId: string): number {
  const count = db.query<{ count: number }>(`SELECT COUNT(*) as count FROM fl_occlusion_regions WHERE card_id = ?`, [cardId])[0]?.count ?? 0;
  db.execute(`DELETE FROM fl_occlusion_regions WHERE card_id = ?`, [cardId]);
  return count;
}
