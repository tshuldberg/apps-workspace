import type { DatabaseAdapter } from '@mylife/db';
import {
  CreatePhotoInputSchema,
  CreatePhotoRowSchema,
  type CreatePhotoInput,
  type CreatePhotoRow,
} from '../../models/schemas';

interface PhotoRow {
  id: string;
  project_id: string | null;
  portfolio_id: string | null;
  equipment_id: string | null;
  kind: string;
  local_uri: string;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
}

function deserializePhoto(row: PhotoRow): CreatePhotoRow {
  return CreatePhotoRowSchema.parse({
    id: row.id,
    project_id: row.project_id,
    portfolio_id: row.portfolio_id,
    equipment_id: row.equipment_id,
    kind: row.kind,
    local_uri: row.local_uri,
    caption: row.caption,
    taken_at: row.taken_at,
    created_at: row.created_at,
  });
}

export function createPhoto(
  db: DatabaseAdapter,
  id: string,
  input: CreatePhotoInput,
): CreatePhotoRow {
  const parsed = CreatePhotoInputSchema.parse(input);
  const now = new Date().toISOString();

  db.execute(
    `INSERT INTO ct_photos (
      id, project_id, portfolio_id, equipment_id, kind, local_uri, caption,
      taken_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      parsed.project_id ?? null,
      parsed.portfolio_id ?? null,
      parsed.equipment_id ?? null,
      parsed.kind,
      parsed.local_uri,
      parsed.caption ?? null,
      parsed.taken_at ?? null,
      now,
    ],
  );

  return CreatePhotoRowSchema.parse({
    id,
    project_id: parsed.project_id ?? null,
    portfolio_id: parsed.portfolio_id ?? null,
    equipment_id: parsed.equipment_id ?? null,
    kind: parsed.kind,
    local_uri: parsed.local_uri,
    caption: parsed.caption ?? null,
    taken_at: parsed.taken_at ?? null,
    created_at: now,
  });
}

export function getPhoto(
  db: DatabaseAdapter,
  id: string,
): CreatePhotoRow | null {
  const rows = db.query<PhotoRow>(`SELECT * FROM ct_photos WHERE id = ?`, [id]);
  return rows.length > 0 ? deserializePhoto(rows[0]) : null;
}

export function deletePhoto(db: DatabaseAdapter, id: string): boolean {
  const existing = getPhoto(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM ct_photos WHERE id = ?`, [id]);
  return true;
}

export function listPhotosByProject(
  db: DatabaseAdapter,
  projectId: string,
): CreatePhotoRow[] {
  return db
    .query<PhotoRow>(
      `SELECT * FROM ct_photos
       WHERE project_id = ?
       ORDER BY COALESCE(taken_at, created_at) DESC, created_at DESC`,
      [projectId],
    )
    .map(deserializePhoto);
}
