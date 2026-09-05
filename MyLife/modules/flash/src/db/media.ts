import type { DatabaseAdapter } from '@mylife/db';
import type { MediaFile, CreateMediaInput } from '../media/types';

function nowIso(): string {
  return new Date().toISOString();
}

function rowToMediaFile(row: Record<string, unknown>): MediaFile {
  return {
    id: row.id as string,
    hash: row.hash as string,
    filename: row.filename as string,
    mediaType: row.media_type as MediaFile['mediaType'],
    mimeType: row.mime_type as string,
    fileSizeBytes: row.file_size_bytes as number,
    width: (row.width as number) ?? null,
    height: (row.height as number) ?? null,
    durationMs: (row.duration_ms as number) ?? null,
    localPath: row.local_path as string,
    referenceCount: row.reference_count as number,
    createdAt: row.created_at as string,
  };
}

export function createMediaFile(
  db: DatabaseAdapter,
  id: string,
  input: CreateMediaInput,
): MediaFile {
  const now = nowIso();
  db.execute(
    `INSERT INTO fl_media (id, hash, filename, media_type, mime_type, file_size_bytes, width, height, duration_ms, local_path, reference_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id, input.hash, input.filename, input.mediaType, input.mimeType,
      input.fileSizeBytes, input.width ?? null, input.height ?? null,
      input.durationMs ?? null, input.localPath, now,
    ],
  );
  return {
    id, hash: input.hash, filename: input.filename, mediaType: input.mediaType,
    mimeType: input.mimeType, fileSizeBytes: input.fileSizeBytes,
    width: input.width ?? null, height: input.height ?? null,
    durationMs: input.durationMs ?? null, localPath: input.localPath,
    referenceCount: 1, createdAt: now,
  };
}

export function getMediaByHash(
  db: DatabaseAdapter,
  hash: string,
): MediaFile | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM fl_media WHERE hash = ?`,
    [hash],
  );
  return rows.length > 0 ? rowToMediaFile(rows[0]) : null;
}

export function incrementMediaRef(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE fl_media SET reference_count = reference_count + 1 WHERE id = ?`,
    [id],
  );
}

export function decrementMediaRef(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE fl_media SET reference_count = reference_count - 1 WHERE id = ?`,
    [id],
  );
}

export function deleteOrphanMedia(db: DatabaseAdapter): string[] {
  let paths: string[] = [];
  db.transaction(() => {
    const orphans = db.query<{ id: string; local_path: string }>(
      `SELECT id, local_path FROM fl_media WHERE reference_count <= 0`,
    );
    if (orphans.length > 0) {
      db.execute(`DELETE FROM fl_media WHERE reference_count <= 0`);
      paths = orphans.map((o) => o.local_path);
    }
  });
  return paths;
}
