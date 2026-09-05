import type { DatabaseAdapter } from '@mylife/db';
import type { ReaderDocument, ReaderDocumentInsert } from '../models/schemas';

function clampPercent(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function createReaderDocument(
  db: DatabaseAdapter,
  id: string,
  input: ReaderDocumentInsert,
): ReaderDocument {
  const now = new Date().toISOString();
  const textContent = input.text_content;
  const document: ReaderDocument = {
    id,
    book_id: input.book_id ?? null,
    title: input.title,
    author: input.author ?? null,
    source_type: input.source_type ?? 'upload',
    mime_type: input.mime_type ?? null,
    file_name: input.file_name ?? null,
    file_extension: input.file_extension ?? null,
    text_content: textContent,
    content_hash: input.content_hash ?? null,
    total_chars: input.total_chars ?? textContent.length,
    total_words: input.total_words ?? countWords(textContent),
    current_position: Math.max(0, input.current_position ?? 0),
    progress_percent: clampPercent(input.progress_percent ?? 0),
    last_opened_at: input.last_opened_at ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO bk_reader_documents (
      id, book_id, title, author, source_type, mime_type, file_name, file_extension,
      text_content, content_hash, total_chars, total_words, current_position,
      progress_percent, last_opened_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      document.id,
      document.book_id,
      document.title,
      document.author,
      document.source_type,
      document.mime_type,
      document.file_name,
      document.file_extension,
      document.text_content,
      document.content_hash,
      document.total_chars,
      document.total_words,
      document.current_position,
      document.progress_percent,
      document.last_opened_at,
      document.created_at,
      document.updated_at,
    ],
  );

  return document;
}

export function getReaderDocument(db: DatabaseAdapter, id: string): ReaderDocument | null {
  const rows = db.query<ReaderDocument>(
    `SELECT * FROM bk_reader_documents WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export interface ReaderDocumentFilters {
  book_id?: string | null;
  search?: string;
  sort_by?: 'last_opened_at' | 'updated_at' | 'created_at' | 'title';
  sort_dir?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export function getReaderDocuments(
  db: DatabaseAdapter,
  filters?: ReaderDocumentFilters,
): ReaderDocument[] {
  let sql = 'SELECT * FROM bk_reader_documents';
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters?.book_id) {
    where.push('book_id = ?');
    params.push(filters.book_id);
  }

  if (filters?.search) {
    where.push('(title LIKE ? OR author LIKE ? OR text_content LIKE ?)');
    const pattern = `%${filters.search}%`;
    params.push(pattern, pattern, pattern);
  }

  if (where.length > 0) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }

  const sortBy = filters?.sort_by ?? 'updated_at';
  const sortDir = filters?.sort_dir ?? 'DESC';
  sql += ` ORDER BY ${sortBy} ${sortDir}`;

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
    if (filters?.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }
  }

  return db.query<ReaderDocument>(sql, params);
}

export function updateReaderDocument(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Omit<ReaderDocument, 'id' | 'created_at' | 'updated_at'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'progress_percent' && typeof value === 'number') {
      fields.push(`${key} = ?`);
      values.push(clampPercent(value));
      continue;
    }

    if (key === 'current_position' && typeof value === 'number') {
      fields.push(`${key} = ?`);
      values.push(Math.max(0, value));
      continue;
    }

    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE bk_reader_documents SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function updateReaderDocumentProgress(
  db: DatabaseAdapter,
  id: string,
  input: { current_position: number; progress_percent: number },
): void {
  const now = new Date().toISOString();
  db.execute(
    `UPDATE bk_reader_documents
     SET current_position = ?,
         progress_percent = ?,
         last_opened_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      Math.max(0, input.current_position),
      clampPercent(input.progress_percent),
      now,
      now,
      id,
    ],
  );
}

export function deleteReaderDocument(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM bk_reader_documents WHERE id = ?`, [id]);
}
