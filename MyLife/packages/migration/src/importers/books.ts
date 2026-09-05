import type { DatabaseAdapter } from '@mylife/db';

export interface BooksImportResult {
  booksImported: number;
  shelvesImported: number;
  sessionsImported: number;
  reviewsImported: number;
  tagsImported: number;
  goalsImported: number;
  errors: string[];
}

/**
 * Import data from a standalone MyBooks SQLite database into the hub database.
 * Reads from unprefixed tables in sourceDb, writes to bk_-prefixed tables in hubDb.
 */
export function importFromMyBooks(
  sourceDb: DatabaseAdapter,
  hubDb: DatabaseAdapter,
): BooksImportResult {
  const errors: string[] = [];
  let booksImported = 0;
  let shelvesImported = 0;
  let sessionsImported = 0;
  let reviewsImported = 0;
  let tagsImported = 0;
  let goalsImported = 0;

  hubDb.transaction(() => {
    // 1. Import shelves (before books, due to FK references in book_shelves)
    const shelves = sourceDb.query<Record<string, unknown>>('SELECT * FROM shelves');
    for (const shelf of shelves) {
      try {
        hubDb.execute(
          `INSERT OR IGNORE INTO bk_shelves (id, name, slug, icon, color, is_system, sort_order, book_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [shelf.id, shelf.name, shelf.slug, shelf.icon, shelf.color, shelf.is_system, shelf.sort_order, shelf.book_count, shelf.created_at],
        );
        shelvesImported++;
      } catch (e) {
        errors.push(`Shelf ${shelf.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 2. Import books
    const books = sourceDb.query<Record<string, unknown>>('SELECT * FROM books');
    for (const book of books) {
      try {
        hubDb.execute(
          `INSERT OR IGNORE INTO bk_books (id, title, subtitle, authors, isbn_10, isbn_13, open_library_id, open_library_edition_id, cover_url, cover_cached_path, publisher, publish_year, page_count, subjects, description, language, format, added_source, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [book.id, book.title, book.subtitle, book.authors, book.isbn_10, book.isbn_13, book.open_library_id, book.open_library_edition_id, book.cover_url, book.cover_cached_path, book.publisher, book.publish_year, book.page_count, book.subjects, book.description, book.language, book.format, book.added_source, book.created_at, book.updated_at],
        );
        booksImported++;
      } catch (e) {
        errors.push(`Book ${book.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 3. Import book_shelves junction
    const bookShelves = sourceDb.query<Record<string, unknown>>('SELECT * FROM book_shelves');
    for (const bs of bookShelves) {
      try {
        hubDb.execute(
          'INSERT OR IGNORE INTO bk_book_shelves (book_id, shelf_id, added_at) VALUES (?, ?, ?)',
          [bs.book_id, bs.shelf_id, bs.added_at],
        );
      } catch (e) {
        errors.push(`BookShelf: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 4. Import reading_sessions
    const sessions = sourceDb.query<Record<string, unknown>>('SELECT * FROM reading_sessions');
    for (const s of sessions) {
      try {
        hubDb.execute(
          `INSERT OR IGNORE INTO bk_reading_sessions (id, book_id, started_at, finished_at, current_page, status, dnf_reason, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [s.id, s.book_id, s.started_at, s.finished_at, s.current_page, s.status, s.dnf_reason, s.created_at, s.updated_at],
        );
        sessionsImported++;
      } catch (e) {
        errors.push(`Session ${s.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 5. Import reviews
    const reviews = sourceDb.query<Record<string, unknown>>('SELECT * FROM reviews');
    for (const r of reviews) {
      try {
        hubDb.execute(
          `INSERT OR IGNORE INTO bk_reviews (id, book_id, session_id, rating, review_text, favorite_quote, is_favorite, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [r.id, r.book_id, r.session_id, r.rating, r.review_text, r.favorite_quote, r.is_favorite, r.created_at, r.updated_at],
        );
        reviewsImported++;
      } catch (e) {
        errors.push(`Review ${r.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 6. Import tags
    const tags = sourceDb.query<Record<string, unknown>>('SELECT * FROM tags');
    for (const t of tags) {
      try {
        hubDb.execute(
          'INSERT OR IGNORE INTO bk_tags (id, name, color, usage_count, created_at) VALUES (?, ?, ?, ?, ?)',
          [t.id, t.name, t.color, t.usage_count, t.created_at],
        );
        tagsImported++;
      } catch (e) {
        errors.push(`Tag ${t.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 7. Import book_tags junction
    const bookTags = sourceDb.query<Record<string, unknown>>('SELECT * FROM book_tags');
    for (const bt of bookTags) {
      try {
        hubDb.execute(
          'INSERT OR IGNORE INTO bk_book_tags (book_id, tag_id) VALUES (?, ?)',
          [bt.book_id, bt.tag_id],
        );
      } catch (e) {
        errors.push(`BookTag: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // 8. Import reading_goals
    const goals = sourceDb.query<Record<string, unknown>>('SELECT * FROM reading_goals');
    for (const g of goals) {
      try {
        hubDb.execute(
          `INSERT OR IGNORE INTO bk_reading_goals (id, year, target_books, target_pages, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [g.id, g.year, g.target_books, g.target_pages, g.created_at, g.updated_at],
        );
        goalsImported++;
      } catch (e) {
        errors.push(`Goal ${g.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  });

  return { booksImported, shelvesImported, sessionsImported, reviewsImported, tagsImported, goalsImported, errors };
}
