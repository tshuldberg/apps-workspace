import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAuthor,
  getBookByISBN,
  getCoverUrl,
  getCoverUrlByOLID,
  getWork,
  searchBooks,
  buildSearchQuery,
  relevanceScore,
} from '../open-library';

describe('books open-library client', () => {
  beforeEach(() => {
    let now = 1_777_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => {
      now += 1_000;
      return now;
    });
  });

  it('searches books and validates response payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          numFound: 1,
          start: 0,
          docs: [
            {
              key: '/works/OL45804W',
              title: 'Dune',
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await searchBooks('dune test', 5);

    expect(result.numFound).toBe(1);
    expect(result.docs[0].title).toBe('Dune');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(
      'https://openlibrary.org/search.json?q=title%3Adune%20test&limit=5',
    );
  });

  it('throws meaningful errors on failed edition lookups', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        }),
      ),
    );

    await expect(getBookByISBN('9780000000000')).rejects.toThrow(
      'Open Library request failed: 404 Not Found',
    );
  });

  it('fetches works and authors with schema validation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            key: '/works/OL1W',
            title: 'Work Title',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            key: '/authors/OL1A',
            name: 'Author Name',
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const work = await getWork('OL1W');
    const author = await getAuthor('OL1A');

    expect(work.title).toBe('Work Title');
    expect(author.name).toBe('Author Name');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('buildSearchQuery prefixes title queries', () => {
    expect(buildSearchQuery('Vietnam')).toBe('title:Vietnam');
    expect(buildSearchQuery('  dune  ')).toBe('title:dune');
  });

  it('buildSearchQuery detects ISBN patterns', () => {
    expect(buildSearchQuery('978-0-06-112008-4')).toBe('isbn:9780061120084');
    expect(buildSearchQuery('0061120081')).toBe('isbn:0061120081');
  });

  it('buildSearchQuery passes through "by" queries unchanged', () => {
    expect(buildSearchQuery('Dune by Frank Herbert')).toBe('Dune by Frank Herbert');
  });

  it('relevanceScore ranks exact matches highest', () => {
    const doc = { key: '/works/OL1W', title: 'Vietnam' };
    expect(relevanceScore(doc, 'Vietnam')).toBe(100);
  });

  it('relevanceScore ranks substring matches above no-match', () => {
    const substringDoc = { key: '/works/OL2W', title: 'The Vietnam War' };
    const noMatchDoc = { key: '/works/OL3W', title: 'Stephen King Stories' };
    expect(relevanceScore(substringDoc, 'Vietnam')).toBeGreaterThan(
      relevanceScore(noMatchDoc, 'Vietnam'),
    );
  });

  it('constructs deterministic cover URLs', () => {
    expect(getCoverUrl('9780132350884')).toBe(
      'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg',
    );
    expect(getCoverUrl('9780132350884', 'S')).toBe(
      'https://covers.openlibrary.org/b/isbn/9780132350884-S.jpg',
    );
    expect(getCoverUrlByOLID('OL123M')).toBe(
      'https://covers.openlibrary.org/b/olid/OL123M-L.jpg',
    );
    expect(getCoverUrlByOLID('OL123M', 'M')).toBe(
      'https://covers.openlibrary.org/b/olid/OL123M-M.jpg',
    );
  });
});
