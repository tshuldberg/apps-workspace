/**
 * CRUD operations for the bk_quotes table.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { Quote, CreateQuoteInput, QuoteFilter, QuoteWithBook } from '../quotes/types';

export function createQuote(db: DatabaseAdapter, id: string, input: CreateQuoteInput): Quote {
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO bk_quotes (id, book_id, content, page_number, chapter, note, is_favorite, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.book_id,
      input.content,
      input.page_number ?? null,
      input.chapter ?? null,
      input.note ?? null,
      input.is_favorite ?? 0,
      input.source ?? 'manual',
      now,
      now,
    ],
  );

  return {
    id,
    book_id: input.book_id,
    content: input.content,
    page_number: input.page_number ?? null,
    chapter: input.chapter ?? null,
    note: input.note ?? null,
    is_favorite: input.is_favorite ?? 0,
    source: input.source ?? 'manual',
    created_at: now,
    updated_at: now,
  };
}

export function getQuoteById(db: DatabaseAdapter, id: string): Quote | null {
  const rows = db.query<Quote>(
    'SELECT * FROM bk_quotes WHERE id = ?',
    [id],
  );
  return rows[0] ?? null;
}

export function getQuotesForBook(db: DatabaseAdapter, bookId: string): Quote[] {
  return db.query<Quote>(
    'SELECT * FROM bk_quotes WHERE book_id = ? ORDER BY created_at DESC',
    [bookId],
  );
}

export function getQuotes(db: DatabaseAdapter, filter?: QuoteFilter): QuoteWithBook[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter?.bookId) {
    conditions.push('q.book_id = ?');
    params.push(filter.bookId);
  }

  if (filter?.isFavorite !== undefined) {
    conditions.push('q.is_favorite = ?');
    params.push(filter.isFavorite ? 1 : 0);
  }

  if (filter?.source) {
    conditions.push('q.source = ?');
    params.push(filter.source);
  }

  if (filter?.searchText) {
    conditions.push('q.id IN (SELECT rowid FROM bk_quotes_fts WHERE bk_quotes_fts MATCH ?)');
    params.push(filter.searchText);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filter?.limit ?? 50;
  const offset = filter?.offset ?? 0;

  const rows = db.query<Quote & { book_title: string; book_authors: string; book_cover_url: string | null }>(
    `SELECT q.*, b.title as book_title, b.authors as book_authors, b.cover_url as book_cover_url
     FROM bk_quotes q
     JOIN bk_books b ON b.id = q.book_id
     ${where}
     ORDER BY q.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return rows.map((row) => ({
    quote: {
      id: row.id,
      book_id: row.book_id,
      content: row.content,
      page_number: row.page_number,
      chapter: row.chapter,
      note: row.note,
      is_favorite: row.is_favorite,
      source: row.source,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    bookTitle: row.book_title,
    bookAuthors: row.book_authors,
    bookCoverUrl: row.book_cover_url,
  }));
}

export function updateQuote(
  db: DatabaseAdapter,
  id: string,
  updates: Partial<Pick<Quote, 'content' | 'page_number' | 'chapter' | 'note' | 'is_favorite'>>,
): void {
  const fields: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.content !== undefined) {
    fields.push('content = ?');
    params.push(updates.content);
  }
  if (updates.page_number !== undefined) {
    fields.push('page_number = ?');
    params.push(updates.page_number);
  }
  if (updates.chapter !== undefined) {
    fields.push('chapter = ?');
    params.push(updates.chapter);
  }
  if (updates.note !== undefined) {
    fields.push('note = ?');
    params.push(updates.note);
  }
  if (updates.is_favorite !== undefined) {
    fields.push('is_favorite = ?');
    params.push(updates.is_favorite);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  db.execute(
    `UPDATE bk_quotes SET ${fields.join(', ')} WHERE id = ?`,
    params,
  );
}

export function deleteQuote(db: DatabaseAdapter, id: string): void {
  db.execute('DELETE FROM bk_quotes WHERE id = ?', [id]);
}

export function getRandomQuote(db: DatabaseAdapter): QuoteWithBook | null {
  const rows = db.query<Quote & { book_title: string; book_authors: string; book_cover_url: string | null }>(
    `SELECT q.*, b.title as book_title, b.authors as book_authors, b.cover_url as book_cover_url
     FROM bk_quotes q
     JOIN bk_books b ON b.id = q.book_id
     ORDER BY RANDOM()
     LIMIT 1`,
  );

  const row = rows[0];
  if (!row) return null;

  return {
    quote: {
      id: row.id,
      book_id: row.book_id,
      content: row.content,
      page_number: row.page_number,
      chapter: row.chapter,
      note: row.note,
      is_favorite: row.is_favorite,
      source: row.source,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    bookTitle: row.book_title,
    bookAuthors: row.book_authors,
    bookCoverUrl: row.book_cover_url,
  };
}

export function getFavoriteQuotes(db: DatabaseAdapter): QuoteWithBook[] {
  return getQuotes(db, { isFavorite: true, limit: 100 });
}

export function getQuoteCount(db: DatabaseAdapter, bookId?: string): number {
  const query = bookId
    ? 'SELECT COUNT(*) as count FROM bk_quotes WHERE book_id = ?'
    : 'SELECT COUNT(*) as count FROM bk_quotes';
  const params = bookId ? [bookId] : [];
  const rows = db.query<{ count: number }>(query, params);
  return rows[0]?.count ?? 0;
}
