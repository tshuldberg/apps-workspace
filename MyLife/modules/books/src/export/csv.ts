import type { BookWithRelations } from './types';

const CSV_HEADERS = [
  'Title',
  'Authors',
  'ISBN 10',
  'ISBN 13',
  'Publisher',
  'Publish Year',
  'Page Count',
  'Format',
  'Shelves',
  'Rating',
  'Review',
  'Tags',
  'Status',
  'Started At',
  'Finished At',
  'Language',
  'Added Source',
  'Date Added',
];

/** Export books to CSV format compatible with spreadsheet apps. */
export function exportToCSV(books: BookWithRelations[]): string {
  const rows: string[] = [CSV_HEADERS.join(',')];

  for (const { book, shelves, session, review, tags } of books) {
    const authors = safeParseJSON(book.authors);
    const row = [
      escapeCSV(book.title),
      escapeCSV(Array.isArray(authors) ? authors.join(', ') : ''),
      escapeCSV(book.isbn_10 ?? ''),
      escapeCSV(book.isbn_13 ?? ''),
      escapeCSV(book.publisher ?? ''),
      book.publish_year?.toString() ?? '',
      book.page_count?.toString() ?? '',
      escapeCSV(book.format),
      escapeCSV(shelves.join(', ')),
      review?.rating?.toString() ?? '',
      escapeCSV(review?.review_text ?? ''),
      escapeCSV(tags.join(', ')),
      escapeCSV(session?.status ?? ''),
      escapeCSV(session?.started_at ?? ''),
      escapeCSV(session?.finished_at ?? ''),
      escapeCSV(book.language),
      escapeCSV(book.added_source),
      escapeCSV(book.created_at),
    ];
    rows.push(row.join(','));
  }

  return rows.join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function safeParseJSON(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}
