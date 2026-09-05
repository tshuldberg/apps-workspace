import type { DatabaseAdapter } from '@mylife/db';
import type {
  HealthDocument,
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentType,
} from './types';
import { MAX_DOCUMENT_SIZE } from './types';
export { MAX_DOCUMENT_SIZE } from './types';

function createId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `hl_doc_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createDocument(
  db: DatabaseAdapter,
  input: CreateDocumentInput,
): string {
  if (input.content.byteLength > MAX_DOCUMENT_SIZE) {
    throw new Error(`Document exceeds maximum size of ${MAX_DOCUMENT_SIZE / (1024 * 1024)}MB`);
  }

  const id = createId();
  const tags = input.tags ? JSON.stringify(input.tags) : null;

  db.execute(
    `INSERT INTO hl_documents (id, title, type, mime_type, file_size, content, thumbnail, notes, document_date, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.title,
      input.type,
      input.mime_type,
      input.content.byteLength,
      input.content,
      input.thumbnail ?? null,
      input.notes ?? null,
      input.document_date ?? null,
      tags,
    ],
  );

  return id;
}

export function getDocuments(db: DatabaseAdapter, limit = 200): Omit<HealthDocument, 'content'>[] {
  return db.query<Omit<HealthDocument, 'content'>>(
    'SELECT id, title, type, mime_type, file_size, thumbnail, notes, document_date, is_starred, tags, created_at, updated_at FROM hl_documents ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
}

export function getDocument(db: DatabaseAdapter, id: string): HealthDocument | null {
  const rows = db.query<HealthDocument>(
    'SELECT * FROM hl_documents WHERE id = ?',
    [id],
  );
  return rows[0] ?? null;
}

export function getDocumentsByType(
  db: DatabaseAdapter,
  type: DocumentType,
  limit = 200,
): Omit<HealthDocument, 'content'>[] {
  return db.query<Omit<HealthDocument, 'content'>>(
    'SELECT id, title, type, mime_type, file_size, thumbnail, notes, document_date, is_starred, tags, created_at, updated_at FROM hl_documents WHERE type = ? ORDER BY created_at DESC LIMIT ?',
    [type, limit],
  );
}

export function getStarredDocuments(db: DatabaseAdapter, limit = 200): Omit<HealthDocument, 'content'>[] {
  return db.query<Omit<HealthDocument, 'content'>>(
    'SELECT id, title, type, mime_type, file_size, thumbnail, notes, document_date, is_starred, tags, created_at, updated_at FROM hl_documents WHERE is_starred = 1 ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
}

export function updateDocument(
  db: DatabaseAdapter,
  id: string,
  input: UpdateDocumentInput,
): void {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title); }
  if (input.type !== undefined) { sets.push('type = ?'); params.push(input.type); }
  if (input.notes !== undefined) { sets.push('notes = ?'); params.push(input.notes); }
  if (input.document_date !== undefined) { sets.push('document_date = ?'); params.push(input.document_date); }
  if (input.is_starred !== undefined) { sets.push('is_starred = ?'); params.push(input.is_starred ? 1 : 0); }
  if (input.tags !== undefined) { sets.push('tags = ?'); params.push(JSON.stringify(input.tags)); }

  if (sets.length === 0) return;

  sets.push("updated_at = datetime('now')");
  params.push(id);

  db.execute(
    `UPDATE hl_documents SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
}

export function deleteDocument(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM hl_documents WHERE id = ?', [id]);
}
