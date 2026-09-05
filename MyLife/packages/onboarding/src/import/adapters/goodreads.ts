/**
 * Goodreads CSV import adapter.
 *
 * Wraps the existing @mylife/books parseGoodreadsCSV function in the
 * ImportAdapter interface, adding format detection, structured validation,
 * and database import phases.
 */

import { parseGoodreadsCSV } from '@mylife/books';
import type { ParsedBook } from '@mylife/books';
import type {
  ImportAdapter,
  FormatDetection,
  ParsedRecord,
  ImportValidationError,
  ImportResult,
  ImportProgress,
} from '../types';

/** The expected header columns in a Goodreads CSV export. */
const REQUIRED_HEADERS = ['Title', 'Author'];
const SIGNATURE_HEADERS = ['Exclusive Shelf', 'Bookshelves', 'My Rating', 'Date Read'];

/** Raw row shape after CSV parsing (before transform). */
export interface GoodreadsSourceRecord {
  title: string;
  authors: string;
  isbn10: string | null;
  isbn13: string | null;
  pageCount: number | null;
  publishYear: number | null;
  format: string;
  rating: number | null;
  reviewText: string | null;
  shelves: string[];
  status: string | null;
  finishedAt: string | null;
}

/** Target shape ready for books module insertion. */
export interface GoodreadsTargetRecord {
  book: ParsedBook['book'];
  session?: ParsedBook['session'];
  review?: ParsedBook['review'];
  shelves: string[];
}

export const goodreadsAdapter: ImportAdapter<GoodreadsSourceRecord, GoodreadsTargetRecord> = {
  name: 'goodreads-csv',
  sourceApp: 'Goodreads',
  targetModule: 'books',
  supportedExtensions: ['.csv'],

  detectFormat(content: string, fileName?: string): FormatDetection {
    // Quick check: does the first line contain Goodreads-specific headers?
    const firstLine = content.split(/\r?\n/)[0] ?? '';
    const headers = firstLine.split(',').map((h) => h.trim().replace(/^"/, '').replace(/"$/, ''));

    const hasRequired = REQUIRED_HEADERS.every((h) =>
      headers.some((col) => col === h),
    );

    if (!hasRequired) {
      return { detected: false, confidence: 0, reason: 'Missing required columns: Title, Author' };
    }

    // Check for Goodreads-specific columns to distinguish from generic CSV
    const signatureMatches = SIGNATURE_HEADERS.filter((h) =>
      headers.some((col) => col === h),
    );

    if (signatureMatches.length === 0) {
      return { detected: false, confidence: 0, reason: 'Has Title/Author but no Goodreads-specific columns' };
    }

    const confidence = 0.5 + (signatureMatches.length / SIGNATURE_HEADERS.length) * 0.5;

    // Boost confidence if filename matches
    const fileBoost = fileName?.toLowerCase().includes('goodreads') ? 0.05 : 0;

    return {
      detected: true,
      confidence: Math.min(1.0, confidence + fileBoost),
      reason: `Matched ${signatureMatches.length}/${SIGNATURE_HEADERS.length} Goodreads signature columns`,
    };
  },

  parse(content: string): ParsedRecord<GoodreadsSourceRecord>[] {
    const result = parseGoodreadsCSV(content);
    const records: ParsedRecord<GoodreadsSourceRecord>[] = [];

    for (let i = 0; i < result.books.length; i++) {
      const pb = result.books[i];
      const warnings: string[] = [];

      if (!pb.book.isbn_10 && !pb.book.isbn_13) {
        warnings.push('No ISBN found; duplicate detection may be less reliable');
      }

      records.push({
        rowNumber: i + 2, // +2 for 1-indexed + header row
        data: {
          title: pb.book.title,
          authors: pb.book.authors,
          isbn10: pb.book.isbn_10 ?? null,
          isbn13: pb.book.isbn_13 ?? null,
          pageCount: pb.book.page_count ?? null,
          publishYear: pb.book.publish_year ?? null,
          format: pb.book.format ?? 'physical',
          rating: pb.review?.rating ?? null,
          reviewText: pb.review?.review_text ?? null,
          shelves: pb.shelves,
          status: pb.session?.status ?? null,
          finishedAt: pb.session?.finished_at ?? null,
        },
        warnings,
      });
    }

    return records;
  },

  validate(records: ParsedRecord<GoodreadsSourceRecord>[]): {
    valid: ParsedRecord<GoodreadsSourceRecord>[];
    errors: ImportValidationError[];
  } {
    const valid: ParsedRecord<GoodreadsSourceRecord>[] = [];
    const errors: ImportValidationError[] = [];

    for (const record of records) {
      const { data } = record;

      if (!data.title || data.title.trim().length === 0) {
        errors.push({
          row: record.rowNumber,
          field: 'title',
          message: 'Title is required',
          value: data.title,
        });
        continue;
      }

      if (!data.authors || data.authors === '[]') {
        errors.push({
          row: record.rowNumber,
          field: 'authors',
          message: 'At least one author is required',
          value: data.authors,
        });
        continue;
      }

      valid.push(record);
    }

    return { valid, errors };
  },

  transform(records: ParsedRecord<GoodreadsSourceRecord>[]): ParsedRecord<GoodreadsTargetRecord>[] {
    return records.map((record) => {
      const { data } = record;

      const book: ParsedBook['book'] = {
        title: data.title,
        authors: data.authors,
        isbn_10: data.isbn10,
        isbn_13: data.isbn13,
        page_count: data.pageCount,
        publish_year: data.publishYear,
        format: data.format as 'physical' | 'ebook' | 'audiobook',
        added_source: 'import_goodreads',
        language: 'en',
      };

      const session: ParsedBook['session'] | undefined = data.status
        ? {
            book_id: '', // assigned during import
            status: data.status as 'want_to_read' | 'reading' | 'finished' | 'dnf',
            started_at: null,
            finished_at: data.finishedAt ?? null,
          }
        : undefined;

      const review: ParsedBook['review'] | undefined =
        data.rating !== null || data.reviewText
          ? { rating: data.rating, review_text: data.reviewText }
          : undefined;

      return {
        rowNumber: record.rowNumber,
        data: { book, session, review, shelves: data.shelves },
        warnings: record.warnings,
      };
    });
  },

  import(
    db: unknown,
    records: ParsedRecord<GoodreadsTargetRecord>[],
    onProgress?: (progress: ImportProgress) => void,
  ): ImportResult {
    const startTime = Date.now();
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors: ImportValidationError[] = [];

    const adapter = db as {
      execute(sql: string, params?: unknown[]): void;
      query<T>(sql: string, params?: unknown[]): T[];
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const { book, session, review, shelves } = record.data;

      onProgress?.({
        phase: 'importing',
        current: i + 1,
        total: records.length,
        message: `Importing "${book.title}"`,
      });

      try {
        // Check for duplicate by ISBN or title+author
        const isDuplicate = checkDuplicate(adapter, book);
        if (isDuplicate) {
          skipped++;
          continue;
        }

        const bookId = generateId();
        const now = new Date().toISOString();

        // Insert book
        adapter.execute(
          `INSERT INTO bk_books (id, title, subtitle, authors, isbn_10, isbn_13,
            publisher, publish_year, page_count, language, format, added_source,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bookId, book.title, book.subtitle ?? null, book.authors,
            book.isbn_10 ?? null, book.isbn_13 ?? null,
            book.publisher ?? null, book.publish_year ?? null,
            book.page_count ?? null, book.language ?? 'en',
            book.format ?? 'physical', book.added_source ?? 'import_goodreads',
            now, now,
          ],
        );

        // Insert reading session if present
        if (session) {
          const sessionId = generateId();
          adapter.execute(
            `INSERT INTO bk_reading_sessions (id, book_id, started_at, finished_at, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sessionId, bookId, session.started_at, session.finished_at, session.status, now, now],
          );
        }

        // Insert review if present
        if (review && (review.rating != null || review.review_text)) {
          const reviewId = generateId();
          adapter.execute(
            `INSERT INTO bk_reviews (id, book_id, rating, review_text, is_favorite, created_at, updated_at)
             VALUES (?, ?, ?, ?, 0, ?, ?)`,
            [reviewId, bookId, review.rating ?? null, review.review_text ?? null, now, now],
          );
        }

        // Assign to shelves
        for (const shelfName of shelves) {
          const shelfSlug = shelfName.toLowerCase().replace(/\s+/g, '-');
          const existingShelf = adapter.query<{ id: string }>(
            `SELECT id FROM bk_shelves WHERE slug = ?`,
            [shelfSlug],
          );
          if (existingShelf.length > 0) {
            adapter.execute(
              `INSERT OR IGNORE INTO bk_book_shelves (book_id, shelf_id, added_at) VALUES (?, ?, ?)`,
              [bookId, existingShelf[0].id, now],
            );
          }
        }

        imported++;
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        // Treat UNIQUE constraint violations as skips, not failures
        if (message.includes('UNIQUE')) {
          skipped++;
          failed--;
        } else {
          errors.push({
            row: record.rowNumber,
            field: 'import',
            message,
          });
        }
      }
    }

    onProgress?.({
      phase: 'complete',
      current: records.length,
      total: records.length,
      message: `Import complete: ${imported} imported, ${skipped} skipped, ${failed} failed`,
    });

    return {
      adapterName: 'goodreads-csv',
      targetModule: 'books',
      totalRows: records.length,
      imported,
      skipped,
      failed,
      errors,
      durationMs: Date.now() - startTime,
    };
  },
};

function checkDuplicate(
  db: { query<T>(sql: string, params?: unknown[]): T[] },
  book: ParsedBook['book'],
): boolean {
  // Check by ISBN first (most reliable)
  if (book.isbn_13) {
    const rows = db.query<{ id: string }>(
      `SELECT id FROM bk_books WHERE isbn_13 = ?`,
      [book.isbn_13],
    );
    if (rows.length > 0) return true;
  }
  if (book.isbn_10) {
    const rows = db.query<{ id: string }>(
      `SELECT id FROM bk_books WHERE isbn_10 = ?`,
      [book.isbn_10],
    );
    if (rows.length > 0) return true;
  }

  // Fallback: check by title + authors
  const rows = db.query<{ id: string }>(
    `SELECT id FROM bk_books WHERE title = ? AND authors = ?`,
    [book.title, book.authors],
  );
  return rows.length > 0;
}

function generateId(): string {
  // Use crypto.randomUUID if available, otherwise timestamp-based fallback
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
