import { describe, expect, it } from 'vitest';
import { parseGoodreadsCSV, parseStoryGraphCSV } from '../index';

describe('books import parsers', () => {
  it('parses Goodreads exports into books, sessions, reviews, and shelves', () => {
    const csv = [
      'Title,Author,Additional Authors,ISBN,ISBN13,Number of Pages,Original Publication Year,Year Published,Binding,Publisher,Exclusive Shelf,Date Read,Date Added,My Rating,My Review,Private Notes,Bookshelves',
      'Dune,Frank Herbert,"Brian Herbert, Kevin J. Anderson","=""0441172717""","=""9780441172719""",412,1965,1965,Hardcover,Ace,read,2026/02/14,2026/02/01,5,"Great worldbuilding","Loved the politics","sci-fi, favorites"',
      ',Missing Author,,,,,,,,,,,,,,,',
    ].join('\n');

    const result = parseGoodreadsCSV(csv);

    expect(result.errors).toEqual([]);
    expect(result.skipped).toBe(1);
    expect(result.books).toHaveLength(1);

    const parsed = result.books[0];
    expect(parsed.book.title).toBe('Dune');
    expect(parsed.book.isbn_10).toBe('0441172717');
    expect(parsed.book.isbn_13).toBe('9780441172719');
    expect(parsed.book.page_count).toBe(412);
    expect(parsed.book.publish_year).toBe(1965);
    expect(parsed.book.format).toBe('physical');
    expect(parsed.book.added_source).toBe('import_goodreads');
    expect(parsed.book.authors).toBe(
      JSON.stringify(['Frank Herbert', 'Brian Herbert', 'Kevin J. Anderson']),
    );

    expect(parsed.session?.status).toBe('finished');
    expect(parsed.session?.finished_at).toMatch(/^2026-02-14T/);
    expect(parsed.review?.rating).toBe(5);
    expect(parsed.review?.review_text).toContain('Great worldbuilding');
    expect(parsed.review?.review_text).toContain('---\nLoved the politics');
    expect(parsed.shelves).toEqual(['sci-fi', 'favorites']);
  });

  it('returns a helpful error for empty Goodreads CSV payloads', () => {
    const result = parseGoodreadsCSV('Title,Author');
    expect(result.books).toEqual([]);
    expect(result.errors).toEqual(['CSV file is empty or has no data rows']);
    expect(result.skipped).toBe(0);
  });

  it('parses StoryGraph exports with status mapping and format detection', () => {
    const csv = [
      'Title,Authors,ISBN/UID,Star Rating,Read Status,Date Read,Number of Pages,Format,Tags',
      'Project Hail Mary,Andy Weir,9780593135204,4.5,read,2026-01-10,496,ebook,"space, sci-fi"',
      'Book Two,Author B,123456789X,,currently-reading,,300,audiobook,',
      'Book Three,Author C,1111111111,2,dnf,2026-01-12,250,hardcover,"learning"',
    ].join('\n');

    const result = parseStoryGraphCSV(csv);

    expect(result.errors).toEqual([]);
    expect(result.skipped).toBe(0);
    expect(result.books).toHaveLength(3);

    expect(result.books[0].book.format).toBe('ebook');
    expect(result.books[0].session?.status).toBe('finished');
    expect(result.books[0].review?.rating).toBe(4.5);
    expect(result.books[0].shelves).toEqual(['space', 'sci-fi']);

    expect(result.books[1].session?.status).toBe('reading');
    expect(result.books[1].review).toBeUndefined();

    expect(result.books[2].session?.status).toBe('dnf');
    expect(result.books[2].book.format).toBe('physical');
  });

  it('rejects non-StoryGraph CSV headers', () => {
    const result = parseStoryGraphCSV('Name,Writer\nExample,Someone');
    expect(result.books).toEqual([]);
    expect(result.errors).toEqual([
      'Unrecognized CSV format — expected StoryGraph columns (Title, Authors)',
    ]);
  });
});
