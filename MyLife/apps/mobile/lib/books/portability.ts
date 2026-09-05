import type { DatabaseAdapter } from '@mylife/db';
import {
  addBookToShelf,
  createBook,
  createReview,
  createSession,
  exportToCSV,
  exportToJSON,
  exportToMarkdown,
  getBooks,
  getReviewForBook,
  getSessionsForBook,
  getShelves,
  getShelvesForBook,
  getTagsForBook,
  logImport,
  parseGoodreadsCSV,
  parseStoryGraphCSV,
  type BookWithRelations,
} from '@mylife/books';
import { uuid } from '../uuid';

export type ImportSource = 'goodreads' | 'storygraph';

export interface ImportRunResult {
  booksImported: number;
  booksSkipped: number;
  errorCount: number;
}

export interface LibraryExportPayload {
  csv: string;
  json: string;
  markdown: string;
}

function normalizeShelfSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

export function buildLibraryExportPayload(db: DatabaseAdapter): LibraryExportPayload {
  const books = getBooks(db);
  const rows: BookWithRelations[] = books.map((book) => {
    const shelves = getShelvesForBook(db, book.id).map((shelf) => shelf.name);
    const tags = getTagsForBook(db, book.id).map((tag) => tag.name);
    const session = getSessionsForBook(db, book.id)[0] ?? null;
    const review = getReviewForBook(db, book.id);

    return {
      book,
      shelves,
      session,
      review,
      tags,
    };
  });

  const markdownFiles = exportToMarkdown(rows);
  const markdown = markdownFiles
    .map((file) => `# ${file.filename}\n\n${file.content}`)
    .join('\n\n---\n\n');

  return {
    csv: exportToCSV(rows),
    json: exportToJSON(rows),
    markdown,
  };
}

export function runLibraryImport(
  db: DatabaseAdapter,
  source: ImportSource,
  filename: string,
  csvText: string,
): ImportRunResult {
  const parsed =
    source === 'goodreads' ? parseGoodreadsCSV(csvText) : parseStoryGraphCSV(csvText);

  const shelves = getShelves(db);
  let booksImported = 0;

  db.transaction(() => {
    for (const entry of parsed.books) {
      const bookId = uuid();
      createBook(db, bookId, entry.book);
      booksImported += 1;

      if (entry.session) {
        createSession(db, uuid(), {
          ...entry.session,
          book_id: bookId,
        });
      }

      if (entry.review) {
        createReview(db, uuid(), {
          book_id: bookId,
          rating: entry.review.rating ?? undefined,
          review_text: entry.review.review_text ?? undefined,
        });
      }

      for (const shelfName of entry.shelves) {
        const normalized = normalizeShelfSlug(shelfName);
        const shelf = shelves.find(
          (candidate) =>
            candidate.slug === normalized ||
            candidate.name.toLowerCase() === shelfName.toLowerCase(),
        );

        if (shelf) {
          addBookToShelf(db, bookId, shelf.id);
        }
      }
    }

    logImport(db, uuid(), {
      source,
      filename,
      books_imported: booksImported,
      books_skipped: parsed.skipped,
      errors: parsed.errors.length > 0 ? JSON.stringify(parsed.errors) : undefined,
    });
  });

  return {
    booksImported,
    booksSkipped: parsed.skipped,
    errorCount: parsed.errors.length,
  };
}
