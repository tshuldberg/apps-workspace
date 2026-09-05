import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE, getBooks, getSessions } from '@mylife/books';
import { goodreadsAdapter } from '../goodreads';

// Sample Goodreads CSV export
const GOODREADS_CSV = [
  'Title,Author,Additional Authors,ISBN,ISBN13,Number of Pages,Original Publication Year,Year Published,Binding,Publisher,Exclusive Shelf,Date Read,Date Added,My Rating,My Review,Private Notes,Bookshelves',
  'Dune,Frank Herbert,"Brian Herbert","=""0441172717""","=""9780441172719""",412,1965,1965,Hardcover,Ace,read,2026/02/14,2026/02/01,5,"Great worldbuilding","Loved the politics","sci-fi, favorites"',
  'Project Hail Mary,Andy Weir,,"=""0593135202""","=""9780593135204""",496,2021,2021,Kindle Edition,Ballantine,currently-reading,,2026/01/15,4,,,',
  '1984,George Orwell,,,,328,1949,1949,Paperback,Signet Classic,to-read,,2025/12/01,0,,,classics',
].join('\n');

const GOODREADS_MINIMAL_CSV = [
  'Title,Author,ISBN,ISBN13,My Rating,Exclusive Shelf,Bookshelves',
  'Minimal Book,Jane Doe,,,0,to-read,',
].join('\n');

const NON_GOODREADS_CSV = [
  'Name,Writer,Pages',
  'Some Book,Someone,100',
].join('\n');

const EMPTY_CSV = 'Title,Author\n';

let adapter: DatabaseAdapter;
let closeDb: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('books', BOOKS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('goodreadsAdapter.detectFormat', () => {
  it('detects standard Goodreads CSV with high confidence', () => {
    const result = goodreadsAdapter.detectFormat(GOODREADS_CSV);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects minimal Goodreads CSV with moderate confidence', () => {
    const result = goodreadsAdapter.detectFormat(GOODREADS_MINIMAL_CSV);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('rejects non-Goodreads CSV', () => {
    const result = goodreadsAdapter.detectFormat(NON_GOODREADS_CSV);
    expect(result.detected).toBe(false);
  });

  it('boosts confidence when filename contains "goodreads"', () => {
    // Use minimal CSV where confidence < 1.0 so the filename boost is visible
    const withoutName = goodreadsAdapter.detectFormat(GOODREADS_MINIMAL_CSV);
    const withName = goodreadsAdapter.detectFormat(GOODREADS_MINIMAL_CSV, 'goodreads_library_export.csv');
    expect(withName.confidence).toBeGreaterThan(withoutName.confidence);
  });

  it('has correct adapter metadata', () => {
    expect(goodreadsAdapter.name).toBe('goodreads-csv');
    expect(goodreadsAdapter.sourceApp).toBe('Goodreads');
    expect(goodreadsAdapter.targetModule).toBe('books');
    expect(goodreadsAdapter.supportedExtensions).toEqual(['.csv']);
  });
});

describe('goodreadsAdapter.parse', () => {
  it('parses books from Goodreads CSV', () => {
    const records = goodreadsAdapter.parse(GOODREADS_CSV);
    expect(records).toHaveLength(3);
  });

  it('extracts title and authors', () => {
    const records = goodreadsAdapter.parse(GOODREADS_CSV);
    expect(records[0].data.title).toBe('Dune');
    expect(records[0].data.authors).toBe(JSON.stringify(['Frank Herbert', 'Brian Herbert']));
  });

  it('extracts ISBNs with wrapper stripped', () => {
    const records = goodreadsAdapter.parse(GOODREADS_CSV);
    expect(records[0].data.isbn10).toBe('0441172717');
    expect(records[0].data.isbn13).toBe('9780441172719');
  });

  it('extracts metadata (pages, year, format)', () => {
    const records = goodreadsAdapter.parse(GOODREADS_CSV);
    expect(records[0].data.pageCount).toBe(412);
    expect(records[0].data.publishYear).toBe(1965);
    expect(records[0].data.format).toBe('physical');
  });

  it('maps Kindle Edition to ebook format', () => {
    const records = goodreadsAdapter.parse(GOODREADS_CSV);
    expect(records[1].data.format).toBe('ebook');
  });

  it('extracts rating (0 becomes null)', () => {
    const records = goodreadsAdapter.parse(GOODREADS_CSV);
    expect(records[0].data.rating).toBe(5);
    expect(records[2].data.rating).toBeNull(); // Goodreads 0 = not rated
  });

  it('extracts review text and private notes', () => {
    const records = goodreadsAdapter.parse(GOODREADS_CSV);
    expect(records[0].data.reviewText).toContain('Great worldbuilding');
    expect(records[0].data.reviewText).toContain('Loved the politics');
  });

  it('extracts shelves', () => {
    const records = goodreadsAdapter.parse(GOODREADS_CSV);
    expect(records[0].data.shelves).toEqual(['sci-fi', 'favorites']);
  });

  it('extracts reading status', () => {
    const records = goodreadsAdapter.parse(GOODREADS_CSV);
    expect(records[0].data.status).toBe('finished');
    expect(records[1].data.status).toBe('reading');
    expect(records[2].data.status).toBe('want_to_read');
  });

  it('extracts finished date', () => {
    const records = goodreadsAdapter.parse(GOODREADS_CSV);
    expect(records[0].data.finishedAt).toMatch(/^2026-02-14T/);
    expect(records[1].data.finishedAt).toBeNull();
  });

  it('adds warning for missing ISBNs', () => {
    const records = goodreadsAdapter.parse(GOODREADS_MINIMAL_CSV);
    expect(records[0].warnings).toContain('No ISBN found; duplicate detection may be less reliable');
  });

  it('assigns sequential row numbers', () => {
    const records = goodreadsAdapter.parse(GOODREADS_CSV);
    expect(records[0].rowNumber).toBe(2);
    expect(records[1].rowNumber).toBe(3);
    expect(records[2].rowNumber).toBe(4);
  });

  it('returns empty array for CSV with no data rows', () => {
    const records = goodreadsAdapter.parse(EMPTY_CSV);
    expect(records).toEqual([]);
  });
});

describe('goodreadsAdapter.validate', () => {
  it('passes records with title and authors', () => {
    const records = goodreadsAdapter.parse(GOODREADS_CSV);
    const { valid, errors } = goodreadsAdapter.validate(records);
    expect(valid).toHaveLength(3);
    expect(errors).toHaveLength(0);
  });

  it('rejects records with empty title', () => {
    const records = [
      { rowNumber: 2, data: { title: '', authors: '["A"]', isbn10: null, isbn13: null, pageCount: null, publishYear: null, format: 'physical', rating: null, reviewText: null, shelves: [], status: null, finishedAt: null }, warnings: [] },
    ];
    const { valid, errors } = goodreadsAdapter.validate(records);
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('title');
  });

  it('rejects records with empty authors', () => {
    const records = [
      { rowNumber: 2, data: { title: 'A Book', authors: '[]', isbn10: null, isbn13: null, pageCount: null, publishYear: null, format: 'physical', rating: null, reviewText: null, shelves: [], status: null, finishedAt: null }, warnings: [] },
    ];
    const { valid, errors } = goodreadsAdapter.validate(records);
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('authors');
  });
});

describe('goodreadsAdapter.transform', () => {
  it('transforms source records to target format', () => {
    const parsed = goodreadsAdapter.parse(GOODREADS_CSV);
    const { valid } = goodreadsAdapter.validate(parsed);
    const transformed = goodreadsAdapter.transform(valid);

    expect(transformed).toHaveLength(3);
    expect(transformed[0].data.book.title).toBe('Dune');
    expect(transformed[0].data.book.added_source).toBe('import_goodreads');
    expect(transformed[0].data.session?.status).toBe('finished');
    expect(transformed[0].data.review?.rating).toBe(5);
    expect(transformed[0].data.shelves).toEqual(['sci-fi', 'favorites']);
  });

  it('omits session when no status', () => {
    const records = [
      { rowNumber: 2, data: { title: 'Test', authors: '["A"]', isbn10: null, isbn13: null, pageCount: null, publishYear: null, format: 'physical', rating: null, reviewText: null, shelves: [], status: null, finishedAt: null }, warnings: [] },
    ];
    const transformed = goodreadsAdapter.transform(records);
    expect(transformed[0].data.session).toBeUndefined();
  });

  it('omits review when no rating or text', () => {
    const records = [
      { rowNumber: 2, data: { title: 'Test', authors: '["A"]', isbn10: null, isbn13: null, pageCount: null, publishYear: null, format: 'physical', rating: null, reviewText: null, shelves: [], status: 'reading', finishedAt: null }, warnings: [] },
    ];
    const transformed = goodreadsAdapter.transform(records);
    expect(transformed[0].data.review).toBeUndefined();
  });
});

describe('goodreadsAdapter.import', () => {
  it('imports books into the database', () => {
    const parsed = goodreadsAdapter.parse(GOODREADS_CSV);
    const { valid } = goodreadsAdapter.validate(parsed);
    const transformed = goodreadsAdapter.transform(valid);
    const result = goodreadsAdapter.import(adapter, transformed);

    expect(result.adapterName).toBe('goodreads-csv');
    expect(result.targetModule).toBe('books');
    expect(result.imported).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    const books = getBooks(adapter);
    expect(books).toHaveLength(3);
  });

  it('creates reading sessions for books with status', () => {
    const parsed = goodreadsAdapter.parse(GOODREADS_CSV);
    const { valid } = goodreadsAdapter.validate(parsed);
    const transformed = goodreadsAdapter.transform(valid);
    goodreadsAdapter.import(adapter, transformed);

    const sessions = getSessions(adapter);
    // Dune (finished) and Hail Mary (reading) have sessions; 1984 (want_to_read with no dates) also has one
    expect(sessions.length).toBeGreaterThanOrEqual(2);
  });

  it('skips duplicate books on re-import', () => {
    const parsed = goodreadsAdapter.parse(GOODREADS_CSV);
    const { valid } = goodreadsAdapter.validate(parsed);
    const transformed = goodreadsAdapter.transform(valid);

    const first = goodreadsAdapter.import(adapter, transformed);
    expect(first.imported).toBe(3);

    const second = goodreadsAdapter.import(adapter, transformed);
    expect(second.imported).toBe(0);
    expect(second.skipped).toBe(3);
  });

  it('reports progress during import', () => {
    const parsed = goodreadsAdapter.parse(GOODREADS_CSV);
    const { valid } = goodreadsAdapter.validate(parsed);
    const transformed = goodreadsAdapter.transform(valid);

    const progress: Array<{ phase: string; current: number; total: number }> = [];
    goodreadsAdapter.import(adapter, transformed, (p) => progress.push(p));

    expect(progress.length).toBeGreaterThanOrEqual(4); // 3 books + 1 complete
    expect(progress[progress.length - 1].phase).toBe('complete');
  });

  it('handles import of minimal data (no ISBN, no rating)', () => {
    const parsed = goodreadsAdapter.parse(GOODREADS_MINIMAL_CSV);
    const { valid } = goodreadsAdapter.validate(parsed);
    const transformed = goodreadsAdapter.transform(valid);
    const result = goodreadsAdapter.import(adapter, transformed);

    expect(result.imported).toBe(1);
    const books = getBooks(adapter);
    expect(books[0].title).toBe('Minimal Book');
  });
});

describe('full pipeline integration', () => {
  it('detect -> parse -> validate -> transform -> import', () => {
    // Step 1: detect
    const detection = goodreadsAdapter.detectFormat(GOODREADS_CSV, 'goodreads_export.csv');
    expect(detection.detected).toBe(true);

    // Step 2: parse
    const parsed = goodreadsAdapter.parse(GOODREADS_CSV);
    expect(parsed.length).toBeGreaterThan(0);

    // Step 3: validate
    const { valid, errors } = goodreadsAdapter.validate(parsed);
    expect(errors).toHaveLength(0);

    // Step 4: transform
    const transformed = goodreadsAdapter.transform(valid);
    expect(transformed.length).toBe(valid.length);

    // Step 5: import
    const result = goodreadsAdapter.import(adapter, transformed);
    expect(result.imported).toBe(3);
    expect(result.failed).toBe(0);

    // Verify database state
    const books = getBooks(adapter);
    expect(books).toHaveLength(3);

    const dune = books.find((b) => b.title === 'Dune');
    expect(dune).toBeDefined();
    expect(dune!.isbn_13).toBe('9780441172719');
    expect(dune!.added_source).toBe('import_goodreads');
  });
});
