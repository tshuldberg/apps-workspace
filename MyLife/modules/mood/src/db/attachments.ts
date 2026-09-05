import type { DatabaseAdapter } from '@mylife/db';
import type { Attachment, CreateAttachmentInput } from '../types';

function nowIso(): string {
  return new Date().toISOString();
}

function rowToAttachment(row: Record<string, unknown>): Attachment {
  return {
    id: row.id as string,
    entryId: row.entry_id as string,
    type: row.type as Attachment['type'],
    filePath: row.file_path as string,
    thumbnailPath: (row.thumbnail_path as string) ?? null,
    fileSizeBytes: row.file_size_bytes as number,
    durationSeconds: (row.duration_seconds as number) ?? null,
    mimeType: row.mime_type as string,
    width: (row.width as number) ?? null,
    height: (row.height as number) ?? null,
    createdAt: row.created_at as string,
  };
}

export function createAttachment(
  db: DatabaseAdapter,
  id: string,
  input: CreateAttachmentInput,
): Attachment {
  const now = nowIso();
  db.execute(
    `INSERT INTO mo_attachments (id, entry_id, type, file_path, thumbnail_path, file_size_bytes, duration_seconds, mime_type, width, height, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.entryId, input.type, input.filePath, input.thumbnailPath ?? null, input.fileSizeBytes, input.durationSeconds ?? null, input.mimeType, input.width ?? null, input.height ?? null, now],
  );
  return {
    id,
    entryId: input.entryId,
    type: input.type,
    filePath: input.filePath,
    thumbnailPath: input.thumbnailPath ?? null,
    fileSizeBytes: input.fileSizeBytes,
    durationSeconds: input.durationSeconds ?? null,
    mimeType: input.mimeType,
    width: input.width ?? null,
    height: input.height ?? null,
    createdAt: now,
  };
}

export function getAttachmentsForEntry(db: DatabaseAdapter, entryId: string): Attachment[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_attachments WHERE entry_id = ? ORDER BY created_at ASC`,
    [entryId],
  );
  return rows.map(rowToAttachment);
}

export function getAttachmentById(db: DatabaseAdapter, id: string): Attachment | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_attachments WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToAttachment(rows[0]) : null;
}

export function getAttachmentsByType(db: DatabaseAdapter, type: 'photo' | 'voice', limit = 50): Attachment[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_attachments WHERE type = ? ORDER BY created_at DESC LIMIT ?`,
    [type, limit],
  );
  return rows.map(rowToAttachment);
}

export function deleteAttachment(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM mo_attachments WHERE id = ?`, [id]);
  return true;
}

export function getAttachmentCount(db: DatabaseAdapter, entryId: string): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM mo_attachments WHERE entry_id = ?`,
    [entryId],
  );
  return rows[0].count;
}
