import type { BookInsert } from '../models/schemas';
import type { OLSearchDoc, OLBookEdition } from './types';
import { getCoverUrl, getCoverUrlByOLID } from './open-library';

/** Extract a bare OLID from an Open Library key path like "/works/OL45804W" */
function extractOLID(key: string): string {
  return key.replace(/^\/(?:works|authors|books)\//, '');
}

/** Parse a text or {type, value} description field into a plain string */
function parseDescription(
  desc: string | { type: string; value: string } | undefined,
): string | undefined {
  if (!desc) return undefined;
  if (typeof desc === 'string') return desc;
  return desc.value;
}

/**
 * Transform an Open Library search document into a BookInsert.
 * Used when adding a book from search results.
 */
export function olSearchDocToBook(doc: OLSearchDoc): BookInsert {
  const workOLID = extractOLID(doc.key);
  const editionOLID = doc.cover_edition_key;

  // Pick the best available cover URL
  let cover_url: string | undefined;
  if (doc.isbn && doc.isbn.length > 0) {
    cover_url = getCoverUrl(doc.isbn[0], 'L');
  } else if (editionOLID) {
    cover_url = getCoverUrlByOLID(editionOLID, 'L');
  }

  // Prefer ISBN-13 (starts with 978/979 and is 13 digits)
  let isbn_10: string | undefined;
  let isbn_13: string | undefined;
  if (doc.isbn) {
    isbn_13 = doc.isbn.find((i) => i.length === 13);
    isbn_10 = doc.isbn.find((i) => i.length === 10);
  }

  return {
    title: doc.title,
    subtitle: doc.subtitle ?? null,
    authors: JSON.stringify(doc.author_name ?? []),
    isbn_10: isbn_10 ?? null,
    isbn_13: isbn_13 ?? null,
    open_library_id: workOLID ?? null,
    open_library_edition_id: editionOLID ?? null,
    cover_url: cover_url ?? null,
    publisher: doc.publisher?.[0] ?? null,
    publish_year: doc.first_publish_year ?? null,
    page_count: doc.number_of_pages_median ?? null,
    subjects: doc.subject ? JSON.stringify(doc.subject.slice(0, 20)) : null,
    description: null,
    language: doc.language?.[0] ?? 'en',
    added_source: 'search',
  };
}

/**
 * Transform an Open Library edition (from ISBN lookup) into a BookInsert.
 * Used when adding a book via barcode scan or direct ISBN entry.
 */
export function olEditionToBook(edition: OLBookEdition): BookInsert {
  const editionOLID = extractOLID(edition.key);
  const workOLID = edition.works?.[0]
    ? extractOLID(edition.works[0].key)
    : undefined;

  // Build cover URL from ISBN or cover ID
  let cover_url: string | undefined;
  if (edition.isbn_13?.[0]) {
    cover_url = getCoverUrl(edition.isbn_13[0], 'L');
  } else if (edition.isbn_10?.[0]) {
    cover_url = getCoverUrl(edition.isbn_10[0], 'L');
  } else if (edition.covers?.[0]) {
    cover_url = getCoverUrlByOLID(editionOLID, 'L');
  }

  // Parse publish year from publish_date string (e.g. "October 12, 2006" or "2006")
  let publish_year: number | undefined;
  if (edition.publish_date) {
    const yearMatch = edition.publish_date.match(/\d{4}/);
    if (yearMatch) {
      publish_year = parseInt(yearMatch[0], 10);
    }
  }

  // Extract language code from key like "/languages/eng"
  const language = edition.languages?.[0]?.key.replace('/languages/', '');

  return {
    title: edition.title,
    subtitle: edition.subtitle ?? null,
    authors: JSON.stringify([]), // Edition has author keys, not names — caller resolves
    isbn_10: edition.isbn_10?.[0] ?? null,
    isbn_13: edition.isbn_13?.[0] ?? null,
    open_library_id: workOLID ?? null,
    open_library_edition_id: editionOLID,
    cover_url: cover_url ?? null,
    publisher: edition.publishers?.[0] ?? null,
    publish_year: publish_year ?? null,
    page_count: edition.number_of_pages ?? null,
    subjects: edition.subjects
      ? JSON.stringify(edition.subjects.slice(0, 20))
      : null,
    description: parseDescription(edition.description) ?? null,
    language: language ?? 'en',
    added_source: 'scan',
  };
}
