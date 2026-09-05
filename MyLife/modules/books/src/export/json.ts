import type { BookWithRelations } from './types';

/** Export books to JSON format. Returns a pretty-printed JSON string. */
export function exportToJSON(books: BookWithRelations[]): string {
  const output = books.map(({ book, shelves, session, review, tags }) => ({
    title: book.title,
    subtitle: book.subtitle,
    authors: safeParseJSON(book.authors),
    isbn_10: book.isbn_10,
    isbn_13: book.isbn_13,
    open_library_id: book.open_library_id,
    publisher: book.publisher,
    publish_year: book.publish_year,
    page_count: book.page_count,
    subjects: safeParseJSON(book.subjects ?? '[]'),
    description: book.description,
    language: book.language,
    format: book.format,
    shelves,
    tags,
    rating: review?.rating ?? null,
    review: review?.review_text ?? null,
    favorite_quote: review?.favorite_quote ?? null,
    is_favorite: review?.is_favorite === 1,
    reading_status: session?.status ?? null,
    started_at: session?.started_at ?? null,
    finished_at: session?.finished_at ?? null,
    date_added: book.created_at,
  }));

  return JSON.stringify(output, null, 2);
}

function safeParseJSON(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}
