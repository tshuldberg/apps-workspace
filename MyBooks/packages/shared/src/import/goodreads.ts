import type { BookInsert, ReadingSessionInsert } from '../models/schemas';
import type { ParsedBook, ParsedImport } from './types';

/**
 * Parse a Goodreads CSV export into structured book data.
 * Handles the standard Goodreads export format with columns like
 * Title, Author, ISBN, ISBN13, My Rating, Bookshelves, Date Read, etc.
 */
export function parseGoodreadsCSV(csvText: string): ParsedImport {
  const lines = parseCSVLines(csvText);
  if (lines.length < 2) {
    return { books: [], errors: ['CSV file is empty or has no data rows'], skipped: 0 };
  }

  const headers = lines[0].map((h) => h.trim());
  const errors: string[] = [];
  const books: ParsedBook[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length === 0 || (row.length === 1 && row[0].trim() === '')) {
      continue; // skip blank lines
    }

    try {
      const record = buildRecord(headers, row);
      const parsed = parseGoodreadsRow(record);
      if (parsed) {
        books.push(parsed);
      } else {
        skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Row ${i + 1}: ${msg}`);
      skipped++;
    }
  }

  return { books, errors, skipped };
}

function buildRecord(headers: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    record[headers[i]] = (row[i] ?? '').trim();
  }
  return record;
}

function parseGoodreadsRow(row: Record<string, string>): ParsedBook | null {
  const title = row['Title'];
  if (!title) return null;

  // Build authors array
  const authors: string[] = [];
  if (row['Author']) authors.push(row['Author']);
  if (row['Additional Authors']) {
    const additional = row['Additional Authors'].split(',').map((a) => a.trim()).filter(Boolean);
    authors.push(...additional);
  }
  if (authors.length === 0) return null;

  // Strip Goodreads' ="..." wrapper from ISBN fields
  const isbn10 = stripISBNWrapper(row['ISBN']);
  const isbn13 = stripISBNWrapper(row['ISBN13']);

  // Parse page count
  const pageCount = parseIntOrNull(row['Number of Pages']);

  // Parse publish year (prefer Original Publication Year over Year Published)
  const publishYear =
    parseIntOrNull(row['Original Publication Year']) ??
    parseIntOrNull(row['Year Published']);

  // Map binding to format
  const format = mapBinding(row['Binding']);

  const book: BookInsert = {
    title,
    subtitle: null,
    authors: JSON.stringify(authors),
    isbn_10: isbn10,
    isbn_13: isbn13,
    publisher: row['Publisher'] || null,
    publish_year: publishYear,
    page_count: pageCount,
    language: 'en',
    format,
    added_source: 'import_goodreads',
  };

  // Parse reading session
  const session = parseSession(row);

  // Parse rating and review
  const rating = parseRating(row['My Rating']);
  const reviewText = combineReviewText(row['My Review'], row['Private Notes']);
  const review =
    rating !== null || reviewText
      ? { rating, review_text: reviewText ?? null }
      : undefined;

  // Parse shelves
  const shelves = parseShelves(row['Bookshelves'] || row['Exclusive Shelf'] || '');

  return { book, session, review, shelves };
}

/** Strip Goodreads' ="0123456789" ISBN wrapper */
function stripISBNWrapper(value: string | undefined): string | null {
  if (!value) return null;
  const stripped = value.replace(/^="/, '').replace(/"$/, '').trim();
  return stripped || null;
}

function parseIntOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

function parseRating(value: string | undefined): number | null {
  if (!value) return null;
  const n = parseFloat(value);
  if (isNaN(n) || n === 0) return null; // Goodreads uses 0 for "not rated"
  return n;
}

function mapBinding(binding: string | undefined): 'physical' | 'ebook' | 'audiobook' {
  if (!binding) return 'physical';
  const lower = binding.toLowerCase();
  if (lower.includes('kindle') || lower.includes('ebook') || lower.includes('nook')) return 'ebook';
  if (lower.includes('audio')) return 'audiobook';
  return 'physical';
}

function parseSession(row: Record<string, string>): ReadingSessionInsert | undefined {
  const exclusiveShelf = row['Exclusive Shelf']?.toLowerCase();

  let status: 'want_to_read' | 'reading' | 'finished' | 'dnf';
  if (exclusiveShelf === 'read') {
    status = 'finished';
  } else if (exclusiveShelf === 'currently-reading') {
    status = 'reading';
  } else {
    status = 'want_to_read';
  }

  const dateRead = row['Date Read'] || null;
  const dateAdded = row['Date Added'] || null;

  // Only create a session if there's meaningful tracking data
  if (status === 'want_to_read' && !dateRead && !dateAdded) return undefined;

  return {
    book_id: '', // Placeholder — the DB layer assigns this after book insert
    started_at: null, // Goodreads doesn't export start date
    finished_at: dateRead ? normalizeDate(dateRead) : null,
    status,
  };
}

/** Normalize a date string to ISO format. Goodreads uses YYYY/MM/DD. */
function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;
  // Handle YYYY/MM/DD format
  const slashDate = dateStr.replace(/\//g, '-');
  const parsed = new Date(slashDate);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function combineReviewText(review: string | undefined, privateNotes: string | undefined): string | null {
  const parts: string[] = [];
  if (review) parts.push(review);
  if (privateNotes) parts.push(`---\n${privateNotes}`);
  return parts.length > 0 ? parts.join('\n\n') : null;
}

function parseShelves(shelfString: string): string[] {
  if (!shelfString) return [];
  return shelfString.split(',').map((s) => s.trim()).filter(Boolean);
}

// --- Simple CSV parser ---

/** Parse CSV text into arrays of strings, handling quoted fields with commas and newlines. */
function parseCSVLines(text: string): string[][] {
  const results: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        current.push(field);
        field = '';
        i++;
      } else if (ch === '\n' || (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n')) {
        current.push(field);
        field = '';
        results.push(current);
        current = [];
        i += ch === '\r' ? 2 : 1;
      } else if (ch === '\r') {
        current.push(field);
        field = '';
        results.push(current);
        current = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Handle last field/row
  if (field || current.length > 0) {
    current.push(field);
    results.push(current);
  }

  return results;
}
