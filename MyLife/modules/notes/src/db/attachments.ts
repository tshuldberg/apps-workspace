import type { DatabaseAdapter } from '@mylife/db';
import type { NoteAttachment, CreateAttachmentInput } from '../types';

function rowToAttachment(row: Record<string, unknown>): NoteAttachment {
  return {
    id: row.id as string,
    noteId: row.note_id as string,
    fileName: row.file_name as string,
    filePath: row.file_path as string,
    fileSizeBytes: row.file_size_bytes as number,
    mimeType: row.mime_type as string,
    attachmentType: row.attachment_type as NoteAttachment['attachmentType'],
    width: (row.width as number) ?? null,
    height: (row.height as number) ?? null,
    thumbnailPath: (row.thumbnail_path as string) ?? null,
    sortOrder: row.sort_order as number,
    ocrText: (row.ocr_text as string) ?? null,
    ocrStatus: (row.ocr_status as string) ?? null,
    ocrLanguage: (row.ocr_language as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function createAttachment(
  db: DatabaseAdapter,
  id: string,
  input: CreateAttachmentInput,
): NoteAttachment {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO nt_attachments (id, note_id, file_name, file_path, file_size_bytes, mime_type, attachment_type, width, height, thumbnail_path, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.noteId, input.fileName, input.filePath, input.fileSizeBytes ?? 0, input.mimeType, input.attachmentType ?? 'image', input.width ?? null, input.height ?? null, input.thumbnailPath ?? null, input.sortOrder ?? 0, now],
  );
  return {
    id,
    noteId: input.noteId,
    fileName: input.fileName,
    filePath: input.filePath,
    fileSizeBytes: input.fileSizeBytes ?? 0,
    mimeType: input.mimeType,
    attachmentType: input.attachmentType ?? 'image',
    width: input.width ?? null,
    height: input.height ?? null,
    thumbnailPath: input.thumbnailPath ?? null,
    sortOrder: input.sortOrder ?? 0,
    ocrText: null,
    ocrStatus: null,
    ocrLanguage: null,
    createdAt: now,
  };
}

export function getAttachmentsForNote(db: DatabaseAdapter, noteId: string, limit = 500): NoteAttachment[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM nt_attachments WHERE note_id = ? ORDER BY sort_order ASC LIMIT ?`,
    [noteId, limit],
  ).map(rowToAttachment);
}

export function getAttachmentById(db: DatabaseAdapter, id: string): NoteAttachment | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM nt_attachments WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToAttachment(rows[0]) : null;
}

export function deleteAttachment(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM nt_attachments WHERE id = ?`, [id]);
  return true;
}

export function getAttachmentCount(db: DatabaseAdapter, noteId: string): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM nt_attachments WHERE note_id = ?`,
    [noteId],
  );
  return rows[0].count;
}

// ── OCR ───────────────────────────────────────────────────────────────

export function updateOcrStatus(
  db: DatabaseAdapter,
  id: string,
  status: string,
  text?: string,
  language?: string,
): void {
  const updates = ['ocr_status = ?'];
  const params: unknown[] = [status];
  if (text !== undefined) { updates.push('ocr_text = ?'); params.push(text); }
  if (language !== undefined) { updates.push('ocr_language = ?'); params.push(language); }
  params.push(id);
  db.execute(`UPDATE nt_attachments SET ${updates.join(', ')} WHERE id = ?`, params);
}

export function searchAttachmentOcr(
  db: DatabaseAdapter,
  query: string,
  limit = 20,
): Array<{ attachmentId: string; noteId: string; snippet: string }> {
  if (!query.trim()) return [];
  // Escape LIKE wildcards to prevent injection
  const escaped = query.replace(/[%_]/g, (ch) => `\\${ch}`);
  const rows = db.query<{ id: string; note_id: string; ocr_text: string }>(
    `SELECT id, note_id, ocr_text FROM nt_attachments WHERE ocr_text LIKE ? ESCAPE '\\' AND ocr_status = 'complete' LIMIT ?`,
    [`%${escaped}%`, limit],
  );
  return rows.map((r) => ({
    attachmentId: r.id,
    noteId: r.note_id,
    snippet: r.ocr_text.length > 100 ? r.ocr_text.slice(0, 100) + '...' : r.ocr_text,
  }));
}
