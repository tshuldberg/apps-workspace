import type { BookWithRelations } from './types';

/** Export a single book as a markdown file. Returns the markdown string. */
export function exportBookToMarkdown(entry: BookWithRelations): string {
  const { book, shelves, session, review, tags } = entry;
  const authors = safeParseJSON(book.authors);
  const authorStr = Array.isArray(authors) ? authors.join(', ') : String(authors);
  const subjects = safeParseJSON(book.subjects ?? '[]');
  const subjectStr = Array.isArray(subjects) ? subjects.join(', ') : '';

  const lines: string[] = [];

  // YAML frontmatter
  lines.push('---');
  lines.push(`title: "${escapeMDValue(book.title)}"`);
  if (book.subtitle) lines.push(`subtitle: "${escapeMDValue(book.subtitle)}"`);
  lines.push(`authors: [${Array.isArray(authors) ? authors.map((a: string) => `"${escapeMDValue(a)}"`).join(', ') : ''}]`);
  if (book.isbn_13) lines.push(`isbn_13: "${book.isbn_13}"`);
  if (book.isbn_10) lines.push(`isbn_10: "${book.isbn_10}"`);
  if (book.publisher) lines.push(`publisher: "${escapeMDValue(book.publisher)}"`);
  if (book.publish_year) lines.push(`publish_year: ${book.publish_year}`);
  if (book.page_count) lines.push(`page_count: ${book.page_count}`);
  lines.push(`format: ${book.format}`);
  lines.push(`language: ${book.language}`);
  if (review?.rating) lines.push(`rating: ${review.rating}`);
  if (session?.status) lines.push(`status: ${session.status}`);
  if (session?.started_at) lines.push(`started: ${session.started_at}`);
  if (session?.finished_at) lines.push(`finished: ${session.finished_at}`);
  if (shelves.length > 0) lines.push(`shelves: [${shelves.map((s) => `"${s}"`).join(', ')}]`);
  if (tags.length > 0) lines.push(`tags: [${tags.map((t) => `"${t}"`).join(', ')}]`);
  lines.push(`date_added: ${book.created_at}`);
  lines.push('---');
  lines.push('');

  // Title
  lines.push(`# ${book.title}`);
  if (book.subtitle) lines.push(`*${book.subtitle}*`);
  lines.push('');
  lines.push(`**by ${authorStr}**`);
  lines.push('');

  // Metadata table
  const meta: [string, string][] = [];
  if (book.publisher) meta.push(['Publisher', book.publisher]);
  if (book.publish_year) meta.push(['Published', String(book.publish_year)]);
  if (book.page_count) meta.push(['Pages', String(book.page_count)]);
  meta.push(['Format', book.format]);
  if (book.isbn_13) meta.push(['ISBN-13', book.isbn_13]);
  if (book.isbn_10) meta.push(['ISBN-10', book.isbn_10]);

  if (meta.length > 0) {
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');
    for (const [key, value] of meta) {
      lines.push(`| ${key} | ${value} |`);
    }
    lines.push('');
  }

  // Rating
  if (review?.rating) {
    const stars = '\u2605'.repeat(Math.floor(review.rating)) +
      (review.rating % 1 !== 0 ? '\u00BD' : '') +
      '\u2606'.repeat(5 - Math.ceil(review.rating));
    lines.push(`**Rating:** ${stars} (${review.rating}/5)`);
    lines.push('');
  }

  // Review
  if (review?.review_text) {
    lines.push('## Review');
    lines.push('');
    lines.push(review.review_text);
    lines.push('');
  }

  // Favorite quote
  if (review?.favorite_quote) {
    lines.push('## Favorite Quote');
    lines.push('');
    lines.push(`> ${review.favorite_quote}`);
    lines.push('');
  }

  // Description
  if (book.description) {
    lines.push('## Description');
    lines.push('');
    lines.push(book.description);
    lines.push('');
  }

  // Subjects
  if (subjectStr) {
    lines.push(`**Subjects:** ${subjectStr}`);
    lines.push('');
  }

  return lines.join('\n');
}

/** Export all books to markdown. Returns an array of {filename, content} objects. */
export function exportToMarkdown(books: BookWithRelations[]): Array<{ filename: string; content: string }> {
  return books.map((entry) => {
    const slug = entry.book.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return {
      filename: `${slug}.md`,
      content: exportBookToMarkdown(entry),
    };
  });
}

function escapeMDValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

function safeParseJSON(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}
