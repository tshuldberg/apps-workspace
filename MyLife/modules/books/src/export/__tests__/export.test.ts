import { describe, expect, it } from 'vitest';
import type { Book, ReadingSession, Review } from '../../models/schemas';
import type { BookWithRelations } from '../types';
import {
  exportBookToMarkdown,
  exportToCSV,
  exportToJSON,
  exportToMarkdown,
} from '../index';

const BASE_BOOK: Book = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Base Book',
  subtitle: null,
  authors: '["Ada Lovelace"]',
  isbn_10: '0123456789',
  isbn_13: '9780123456786',
  open_library_id: null,
  open_library_edition_id: null,
  cover_url: null,
  cover_cached_path: null,
  publisher: 'Test Publisher',
  publish_year: 2024,
  page_count: 320,
  subjects: '["Engineering","History"]',
  description: 'A practical handbook.',
  language: 'en',
  format: 'physical',
  added_source: 'manual',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const BASE_SESSION: ReadingSession = {
  id: '00000000-0000-4000-8000-000000000002',
  book_id: BASE_BOOK.id,
  started_at: '2026-01-10T00:00:00.000Z',
  finished_at: '2026-01-20T00:00:00.000Z',
  current_page: 320,
  status: 'finished',
  dnf_reason: null,
  created_at: '2026-01-10T00:00:00.000Z',
  updated_at: '2026-01-20T00:00:00.000Z',
};

const BASE_REVIEW: Review = {
  id: '00000000-0000-4000-8000-000000000003',
  book_id: BASE_BOOK.id,
  session_id: BASE_SESSION.id,
  rating: 4.5,
  review_text: 'Clear and practical.',
  favorite_quote: 'Stay curious.',
  is_favorite: 1,
  created_at: '2026-01-20T00:00:00.000Z',
  updated_at: '2026-01-20T00:00:00.000Z',
};

function makeEntry(overrides: Partial<BookWithRelations> = {}): BookWithRelations {
  return {
    book: { ...BASE_BOOK },
    shelves: ['default'],
    session: { ...BASE_SESSION },
    review: { ...BASE_REVIEW },
    tags: ['tag-1'],
    ...overrides,
  };
}

describe('books export helpers', () => {
  it('exports CSV rows with escaped text fields and joined relation values', () => {
    const entry = makeEntry({
      book: {
        ...BASE_BOOK,
        title: 'The "Great", Escape',
        authors: '["Ada Lovelace","Grace Hopper"]',
      },
      shelves: ['favorites', 'sci-fi'],
      tags: ['classic', 'must-read'],
      review: {
        ...BASE_REVIEW,
        review_text: 'Line 1, with comma',
      },
    });

    const csv = exportToCSV([entry]);

    expect(csv.split('\n')[0]).toContain('Title,Authors,ISBN 10');
    expect(csv).toContain('"The ""Great"", Escape"');
    expect(csv).toContain('"Ada Lovelace, Grace Hopper"');
    expect(csv).toContain('"favorites, sci-fi"');
    expect(csv).toContain('"classic, must-read"');
    expect(csv).toContain('"Line 1, with comma"');
  });

  it('exports JSON with safe JSON parsing fallbacks and normalized review flags', () => {
    const entry = makeEntry({
      book: {
        ...BASE_BOOK,
        authors: 'not-json',
        subjects: 'invalid-subjects-json',
      },
      review: {
        ...BASE_REVIEW,
        is_favorite: 0,
      },
    });

    const parsed = JSON.parse(exportToJSON([entry])) as Array<Record<string, unknown>>;

    expect(parsed).toHaveLength(1);
    expect(parsed[0].authors).toBe('not-json');
    expect(parsed[0].subjects).toBe('invalid-subjects-json');
    expect(parsed[0].is_favorite).toBe(false);
    expect(parsed[0].reading_status).toBe('finished');
  });

  it('exports markdown with frontmatter, sections, and quote blocks', () => {
    const entry = makeEntry({
      book: {
        ...BASE_BOOK,
        title: 'Pragmatic Testing',
        subtitle: 'Patterns for Real Teams',
      },
    });

    const markdown = exportBookToMarkdown(entry);

    expect(markdown).toContain('title: "Pragmatic Testing"');
    expect(markdown).toContain('subtitle: "Patterns for Real Teams"');
    expect(markdown).toContain('# Pragmatic Testing');
    expect(markdown).toContain('## Review');
    expect(markdown).toContain('## Favorite Quote');
    expect(markdown).toContain('> Stay curious.');
    expect(markdown).toContain('(4.5/5)');
  });

  it('exports markdown files with slugged filenames', () => {
    const exports = exportToMarkdown([
      makeEntry({
        book: {
          ...BASE_BOOK,
          title: 'Deep Work: Rules for Focused Success',
        },
      }),
    ]);

    expect(exports).toHaveLength(1);
    expect(exports[0].filename).toBe('deep-work-rules-for-focused-success.md');
    expect(exports[0].content).toContain('# Deep Work: Rules for Focused Success');
  });
});
