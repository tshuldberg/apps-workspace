/**
 * Book CRUD operations.
 */

import type { DatabaseAdapter } from './migrations';
import type { Book, BookInsert } from '../models/schemas';

export function createBook(
  db: DatabaseAdapter,
  id: string,
  input: BookInsert,
): Book {
  const now = new Date().toISOString();
  const book: Book = {
    id,
    title: input.title,
    subtitle: input.subtitle ?? null,
    authors: input.authors,
    isbn_10: input.isbn_10 ?? null,
    isbn_13: input.isbn_13 ?? null,
    open_library_id: input.open_library_id ?? null,
    open_library_edition_id: input.open_library_edition_id ?? null,
    cover_url: input.cover_url ?? null,
    cover_cached_path: input.cover_cached_path ?? null,
    publisher: input.publisher ?? null,
    publish_year: input.publish_year ?? null,
    page_count: input.page_count ?? null,
    subjects: input.subjects ?? null,
    description: input.description ?? null,
    language: input.language ?? 'en',
    format: input.format ?? 'physical',
    added_source: input.added_source ?? 'manual',
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO books (id, title, subtitle, authors, isbn_10, isbn_13,
      open_library_id, open_library_edition_id, cover_url, cover_cached_path,
      publisher, publish_year, page_count, subjects, description,
      language, format, added_source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      book.id, book.title, book.subtitle, book.authors,
      book.isbn_10, book.isbn_13, book.open_library_id, book.open_library_edition_id,
      book.cover_url, book.cover_cached_path, book.publisher, book.publish_year,
      book.page_count, book.subjects, book.description, book.language,
      book.format, book.added_source, book.created_at, book.updated_at,
    ],
  );

  return book;
}

export function getBook(db: DatabaseAdapter, id: string): Book | null {
  const rows = db.query<Book>(
    `SELECT * FROM books WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

export interface BookFilters {
  shelf_id?: string;
  tag_id?: string;
  format?: string;
  sort_by?: 'title' | 'created_at' | 'publish_year' | 'updated_at';
  sort_dir?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export function getBooks(db: DatabaseAdapter, filters?: BookFilters): Book[] {
  let sql = 'SELECT b.* FROM books b';
  const params: unknown[] = [];
  const where: string[] = [];

  if (filters?.shelf_id) {
    sql += ' INNER JOIN book_shelves bs ON b.id = bs.book_id';
    where.push('bs.shelf_id = ?');
    params.push(filters.shelf_id);
  }

  if (filters?.tag_id) {
    sql += ' INNER JOIN book_tags bt ON b.id = bt.book_id';
    where.push('bt.tag_id = ?');
    params.push(filters.tag_id);
  }

  if (filters?.format) {
    where.push('b.format = ?');
    params.push(filters.format);
  }

  if (where.length > 0) {
    sql += ' WHERE ' + where.join(' AND ');
  }

  const sortBy = filters?.sort_by ?? 'created_at';
  const sortDir = filters?.sort_dir ?? 'DESC';
  sql += ` ORDER BY b.${sortBy} ${sortDir}`;

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
    if (filters?.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }
  }

  return db.query<Book>(sql, params);
}

export function updateBook(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Omit<Book, 'id' | 'created_at' | 'updated_at'>>,
): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.execute(
    `UPDATE books SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}

export function deleteBook(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM books WHERE id = ?`, [id]);
}

export function searchBooksLocal(db: DatabaseAdapter, query: string, limit = 50): Book[] {
  return db.query<Book>(
    `SELECT b.* FROM books b
     INNER JOIN books_fts fts ON b.rowid = fts.rowid
     WHERE books_fts MATCH ?
     ORDER BY rank
     LIMIT ?`,
    [query, limit],
  );
}

export function getBookByISBNLocal(db: DatabaseAdapter, isbn: string): Book | null {
  const rows = db.query<Book>(
    `SELECT * FROM books WHERE isbn_13 = ? OR isbn_10 = ?`,
    [isbn, isbn],
  );
  return rows.length > 0 ? rows[0] : null;
}

export function getBookCount(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(`SELECT COUNT(*) as count FROM books`);
  return rows[0]?.count ?? 0;
}
