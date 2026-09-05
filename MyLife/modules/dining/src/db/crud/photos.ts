/**
 * Photo CRUD operations.
 */

import type { DatabaseAdapter } from '@mylife/db';
import { CreatePhotoSchema } from '../../models/schemas';
import type { Photo, CreatePhotoInput } from '../../models/schemas';

const PHOTO_COLUMNS = [
  'id',
  'visit_id',
  'dish_id',
  'kind',
  'local_uri',
  'caption',
  'width',
  'height',
  'size_bytes',
  'taken_at',
  'exif_stripped',
  'created_at',
].join(', ');

export function createPhoto(
  db: DatabaseAdapter,
  id: string,
  input: CreatePhotoInput,
): Photo {
  const parsed = CreatePhotoSchema.parse(input);
  const now = new Date().toISOString();

  const photo: Photo = {
    id,
    visit_id: parsed.visit_id ?? null,
    dish_id: parsed.dish_id ?? null,
    kind: parsed.kind,
    local_uri: parsed.local_uri,
    caption: parsed.caption ?? null,
    width: parsed.width ?? null,
    height: parsed.height ?? null,
    size_bytes: parsed.size_bytes ?? null,
    taken_at: parsed.taken_at ?? null,
    exif_stripped: parsed.exif_stripped ?? 0,
    created_at: now,
  };

  db.execute(
    `INSERT INTO dn_photos (${PHOTO_COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      photo.id,
      photo.visit_id,
      photo.dish_id,
      photo.kind,
      photo.local_uri,
      photo.caption,
      photo.width,
      photo.height,
      photo.size_bytes,
      photo.taken_at,
      photo.exif_stripped,
      photo.created_at,
    ],
  );

  return photo;
}

export function getPhoto(
  db: DatabaseAdapter,
  id: string,
): Photo | null {
  const rows = db.query<Photo>(
    `SELECT ${PHOTO_COLUMNS} FROM dn_photos WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function deletePhoto(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM dn_photos WHERE id = ?', [id]);
}

export function listPhotosByVisit(
  db: DatabaseAdapter,
  visitId: string,
): Photo[] {
  return db.query<Photo>(
    `SELECT ${PHOTO_COLUMNS} FROM dn_photos WHERE visit_id = ? ORDER BY created_at`,
    [visitId],
  );
}

export function listPhotosByDish(
  db: DatabaseAdapter,
  dishId: string,
): Photo[] {
  return db.query<Photo>(
    `SELECT ${PHOTO_COLUMNS} FROM dn_photos WHERE dish_id = ? ORDER BY created_at`,
    [dishId],
  );
}
