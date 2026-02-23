import type { Book, Shelf, ReadingSession, Review, Tag, ReadingGoal } from '@mybooks/shared';

const now = new Date().toISOString();

export const mockShelves: Shelf[] = [
  { id: 'shelf-tbr', name: 'Want to Read', slug: 'want-to-read', icon: '\ud83d\udcda', color: null, is_system: 1, sort_order: 0, book_count: 12, created_at: now },
  { id: 'shelf-reading', name: 'Currently Reading', slug: 'currently-reading', icon: '\ud83d\udcd6', color: null, is_system: 1, sort_order: 1, book_count: 3, created_at: now },
  { id: 'shelf-finished', name: 'Finished', slug: 'finished', icon: '\u2705', color: null, is_system: 1, sort_order: 2, book_count: 47, created_at: now },
  { id: 'shelf-favorites', name: 'Favorites', slug: 'favorites', icon: '\u2764\ufe0f', color: '#E8B84B', is_system: 0, sort_order: 3, book_count: 8, created_at: now },
];

export const mockBooks: Book[] = [
  {
    id: 'b1', title: 'Project Hail Mary', subtitle: null,
    authors: '["Andy Weir"]', isbn_10: null, isbn_13: '9780593135204',
    open_library_id: 'OL20669480W', open_library_edition_id: null,
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780593135204-L.jpg',
    cover_cached_path: null, publisher: 'Ballantine Books', publish_year: 2021,
    page_count: 476, subjects: '["Science Fiction", "Space"]',
    description: null, language: 'en', format: 'physical', added_source: 'search',
    created_at: now, updated_at: now,
  },
  {
    id: 'b2', title: 'The Midnight Library', subtitle: null,
    authors: '["Matt Haig"]', isbn_10: null, isbn_13: '9780525559474',
    open_library_id: 'OL20893162W', open_library_edition_id: null,
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780525559474-L.jpg',
    cover_cached_path: null, publisher: 'Viking', publish_year: 2020,
    page_count: 288, subjects: '["Fiction", "Fantasy"]',
    description: null, language: 'en', format: 'physical', added_source: 'scan',
    created_at: now, updated_at: now,
  },
  {
    id: 'b3', title: 'Klara and the Sun', subtitle: null,
    authors: '["Kazuo Ishiguro"]', isbn_10: null, isbn_13: '9780571364886',
    open_library_id: null, open_library_edition_id: null,
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780571364886-L.jpg',
    cover_cached_path: null, publisher: 'Faber & Faber', publish_year: 2021,
    page_count: 303, subjects: '["Fiction", "Science Fiction"]',
    description: null, language: 'en', format: 'ebook', added_source: 'search',
    created_at: now, updated_at: now,
  },
  {
    id: 'b4', title: 'Piranesi', subtitle: null,
    authors: '["Susanna Clarke"]', isbn_10: null, isbn_13: '9781635575941',
    open_library_id: null, open_library_edition_id: null,
    cover_url: 'https://covers.openlibrary.org/b/isbn/9781635575941-L.jpg',
    cover_cached_path: null, publisher: 'Bloomsbury', publish_year: 2020,
    page_count: 272, subjects: '["Fiction", "Fantasy"]',
    description: null, language: 'en', format: 'physical', added_source: 'manual',
    created_at: now, updated_at: now,
  },
  {
    id: 'b5', title: 'The Name of the Wind', subtitle: null,
    authors: '["Patrick Rothfuss"]', isbn_10: null, isbn_13: '9780756404741',
    open_library_id: null, open_library_edition_id: null,
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780756404741-L.jpg',
    cover_cached_path: null, publisher: 'DAW Books', publish_year: 2007,
    page_count: 662, subjects: '["Fantasy", "Epic Fantasy"]',
    description: null, language: 'en', format: 'physical', added_source: 'search',
    created_at: now, updated_at: now,
  },
  {
    id: 'b6', title: 'Dune', subtitle: null,
    authors: '["Frank Herbert"]', isbn_10: null, isbn_13: '9780441013593',
    open_library_id: null, open_library_edition_id: null,
    cover_url: 'https://covers.openlibrary.org/b/isbn/9780441013593-L.jpg',
    cover_cached_path: null, publisher: 'Ace Books', publish_year: 1965,
    page_count: 688, subjects: '["Science Fiction"]',
    description: null, language: 'en', format: 'physical', added_source: 'scan',
    created_at: now, updated_at: now,
  },
];

export const mockSessions: ReadingSession[] = [
  { id: 's1', book_id: 'b1', started_at: '2026-02-01T00:00:00Z', finished_at: null, current_page: 312, status: 'reading', dnf_reason: null, created_at: now, updated_at: now },
  { id: 's2', book_id: 'b2', started_at: '2026-01-15T00:00:00Z', finished_at: '2026-02-10T00:00:00Z', current_page: 288, status: 'finished', dnf_reason: null, created_at: now, updated_at: now },
  { id: 's3', book_id: 'b3', started_at: '2026-02-05T00:00:00Z', finished_at: null, current_page: 142, status: 'reading', dnf_reason: null, created_at: now, updated_at: now },
  { id: 's4', book_id: 'b4', started_at: '2026-01-01T00:00:00Z', finished_at: '2026-01-20T00:00:00Z', current_page: 272, status: 'finished', dnf_reason: null, created_at: now, updated_at: now },
  { id: 's5', book_id: 'b5', started_at: null, finished_at: null, current_page: 0, status: 'want_to_read', dnf_reason: null, created_at: now, updated_at: now },
  { id: 's6', book_id: 'b6', started_at: '2026-02-18T00:00:00Z', finished_at: null, current_page: 88, status: 'reading', dnf_reason: null, created_at: now, updated_at: now },
];

export const mockReviews: Review[] = [
  { id: 'r1', book_id: 'b2', session_id: 's2', rating: 4.5, review_text: 'A beautiful meditation on regret and second chances.', favorite_quote: null, is_favorite: 1, created_at: now, updated_at: now },
  { id: 'r2', book_id: 'b4', session_id: 's4', rating: 5.0, review_text: 'Extraordinary. One of the most unique books I have ever read.', favorite_quote: 'The Beauty of the House is immeasurable; its Kindness infinite.', is_favorite: 1, created_at: now, updated_at: now },
];

export const mockTags: Tag[] = [
  { id: 't1', name: 'sci-fi', color: '#4A90D9', usage_count: 3, created_at: now },
  { id: 't2', name: 'fantasy', color: '#2C6B50', usage_count: 3, created_at: now },
  { id: 't3', name: 'mind-blowing', color: '#C9894D', usage_count: 2, created_at: now },
  { id: 't4', name: 'beach read', color: '#E0B07A', usage_count: 1, created_at: now },
  { id: 't5', name: 'book club', color: '#9E6060', usage_count: 1, created_at: now },
];

export const mockGoal: ReadingGoal = {
  id: 'g1', year: 2026, target_books: 30, target_pages: null,
  created_at: now, updated_at: now,
};

/** Helper: parse JSON authors field into string array */
export function parseAuthors(authors: string): string[] {
  try { return JSON.parse(authors); } catch { return [authors]; }
}

/** Get the current reading session for a book */
export function getSession(bookId: string): ReadingSession | undefined {
  return mockSessions.find((s) => s.book_id === bookId);
}

/** Get review for a book */
export function getReview(bookId: string): Review | undefined {
  return mockReviews.find((r) => r.book_id === bookId);
}

/** Count finished books (for goal progress) */
export function finishedCount(): number {
  return mockSessions.filter((s) => s.status === 'finished').length;
}

/** Get currently reading books with their sessions */
export function currentlyReading(): Array<{ book: Book; session: ReadingSession }> {
  return mockSessions
    .filter((s) => s.status === 'reading')
    .map((s) => ({
      book: mockBooks.find((b) => b.id === s.book_id)!,
      session: s,
    }))
    .filter((item) => item.book != null);
}

/** Get recently finished books */
export function recentlyFinished(): Array<{ book: Book; session: ReadingSession; review?: Review }> {
  return mockSessions
    .filter((s) => s.status === 'finished')
    .sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))
    .map((s) => ({
      book: mockBooks.find((b) => b.id === s.book_id)!,
      session: s,
      review: mockReviews.find((r) => r.book_id === s.book_id),
    }))
    .filter((item) => item.book != null);
}
