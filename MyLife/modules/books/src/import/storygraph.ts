import type { BookInsert } from '../models/schemas';
import type { ParsedBook, ParsedImport } from './types';

/**
 * Parse a StoryGraph CSV export into structured book data.
 * StoryGraph's export format is undocumented and may change.
 * This is a best-effort parser with format auto-detection.
 */
export function parseStoryGraphCSV(csvText: string): ParsedImport {
  const lines = parseCSVLines(csvText);
  if (lines.length < 2) {
    return { books: [], errors: ['CSV file is empty or has no data rows'], skipped: 0 };
  }

  const headers = lines[0].map((h) => h.trim());

  // Auto-detect: verify this looks like a StoryGraph export
  const expectedColumns = ['Title', 'Authors'];
  const hasExpected = expectedColumns.every((col) =>
    headers.some((h) => h.toLowerCase() === col.toLowerCase()),
  );
  if (!hasExpected) {
    return {
      books: [],
      errors: ['Unrecognized CSV format — expected StoryGraph columns (Title, Authors)'],
      skipped: 0,
    };
  }

  const errors: string[] = [];
  const books: ParsedBook[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length === 0 || (row.length === 1 && row[0].trim() === '')) {
      continue;
    }

    try {
      const record = buildRecord(headers, row);
      const parsed = parseStoryGraphRow(record);
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

function parseStoryGraphRow(row: Record<string, string>): ParsedBook | null {
  // StoryGraph columns (known format): Title, Authors, ISBN/UID, Star Rating,
  // Moods, Pace, Read Status, Tags, Date Read, Number of Pages, Format
  const title = findColumn(row, ['Title']);
  if (!title) return null;

  const authorStr = findColumn(row, ['Authors', 'Author']);
  if (!authorStr) return null;

  const authors = authorStr.split(',').map((a) => a.trim()).filter(Boolean);

  const isbn = findColumn(row, ['ISBN/UID', 'ISBN', 'ISBN13']);
  let isbn_10: string | null = null;
  let isbn_13: string | null = null;
  if (isbn) {
    const cleaned = isbn.replace(/[^0-9X]/gi, '');
    if (cleaned.length === 13) isbn_13 = cleaned;
    else if (cleaned.length === 10) isbn_10 = cleaned;
  }

  const pageCount = parseIntOrNull(findColumn(row, ['Number of Pages', 'Pages']));
  const format = mapFormat(findColumn(row, ['Format']));
  const ratingStr = findColumn(row, ['Star Rating', 'Rating', 'My Rating']);
  const rating = ratingStr ? parseFloat(ratingStr) : null;

  const book: BookInsert = {
    title,
    subtitle: null,
    authors: JSON.stringify(authors),
    isbn_10,
    isbn_13,
    page_count: pageCount,
    format,
    added_source: 'import_storygraph',
  };

  // Parse read status
  const readStatus = findColumn(row, ['Read Status', 'Status'])?.toLowerCase();
  let status: 'want_to_read' | 'reading' | 'finished' | 'dnf' = 'want_to_read';
  if (readStatus === 'read' || readStatus === 'finished') status = 'finished';
  else if (readStatus === 'currently-reading' || readStatus === 'currently reading') status = 'reading';
  else if (readStatus === 'did-not-finish' || readStatus === 'dnf') status = 'dnf';

  const dateRead = findColumn(row, ['Date Read', 'Date Finished']);
  const session = {
    book_id: '', // Placeholder
    status,
    finished_at: dateRead ? normalizeDate(dateRead) : null,
    started_at: null,
  };

  const review =
    rating !== null && !isNaN(rating) && rating > 0
      ? { rating, review_text: null }
      : undefined;

  // Map StoryGraph tags to shelf names
  const shelves: string[] = [];
  const tags = findColumn(row, ['Tags']);
  if (tags) {
    shelves.push(...tags.split(',').map((t) => t.trim()).filter(Boolean));
  }

  return { book, session, review, shelves };
}

/** Find a column value by trying multiple possible header names (case-insensitive). */
function findColumn(row: Record<string, string>, candidates: string[]): string | null {
  for (const candidate of candidates) {
    // Try exact match first
    if (row[candidate]) return row[candidate];
    // Try case-insensitive
    const key = Object.keys(row).find((k) => k.toLowerCase() === candidate.toLowerCase());
    if (key && row[key]) return row[key];
  }
  return null;
}

function parseIntOrNull(value: string | null): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return isNaN(n) ? null : n;
}

function mapFormat(format: string | null): 'physical' | 'ebook' | 'audiobook' {
  if (!format) return 'physical';
  const lower = format.toLowerCase();
  if (lower.includes('ebook') || lower.includes('kindle') || lower.includes('digital')) return 'ebook';
  if (lower.includes('audio')) return 'audiobook';
  return 'physical';
}

function normalizeDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr.replace(/\//g, '-'));
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

// --- Simple CSV parser (same logic as goodreads.ts) ---

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

  if (field || current.length > 0) {
    current.push(field);
    results.push(current);
  }

  return results;
}
