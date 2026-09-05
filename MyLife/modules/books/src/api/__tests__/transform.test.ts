import { describe, expect, it } from 'vitest';
import type { OLBookEdition, OLSearchDoc } from '../types';
import { olEditionToBook, olSearchDocToBook } from '../transform';

describe('books open-library transforms', () => {
  it('maps OL search docs into book inserts with ISBN and cover preference', () => {
    const doc: OLSearchDoc = {
      key: '/works/OL45804W',
      title: 'Clean Code',
      subtitle: 'A Handbook of Agile Software Craftsmanship',
      author_name: ['Robert C. Martin'],
      first_publish_year: 2008,
      isbn: ['0596007124', '9780132350884'],
      publisher: ['Prentice Hall'],
      number_of_pages_median: 464,
      cover_edition_key: 'OL12345M',
      language: ['eng'],
      subject: ['Software', 'Programming', 'Craft'],
    };

    const mapped = olSearchDocToBook(doc);

    expect(mapped.title).toBe('Clean Code');
    expect(mapped.subtitle).toBe('A Handbook of Agile Software Craftsmanship');
    expect(mapped.authors).toBe(JSON.stringify(['Robert C. Martin']));
    expect(mapped.isbn_10).toBe('0596007124');
    expect(mapped.isbn_13).toBe('9780132350884');
    expect(mapped.open_library_id).toBe('OL45804W');
    expect(mapped.open_library_edition_id).toBe('OL12345M');
    expect(mapped.cover_url).toContain('/b/isbn/0596007124-L.jpg');
    expect(mapped.publisher).toBe('Prentice Hall');
    expect(mapped.publish_year).toBe(2008);
    expect(mapped.page_count).toBe(464);
    expect(mapped.subjects).toBe(JSON.stringify(['Software', 'Programming', 'Craft']));
    expect(mapped.language).toBe('eng');
    expect(mapped.added_source).toBe('search');
  });

  it('falls back to edition-cover URL when search results have no ISBN', () => {
    const doc: OLSearchDoc = {
      key: '/works/OL999W',
      title: 'No ISBN Result',
      cover_edition_key: 'OL999M',
    };

    const mapped = olSearchDocToBook(doc);

    expect(mapped.isbn_10).toBeNull();
    expect(mapped.isbn_13).toBeNull();
    expect(mapped.cover_url).toContain('/b/olid/OL999M-L.jpg');
  });

  it('maps OL editions into book inserts with parsed year and language', () => {
    const edition: OLBookEdition = {
      key: '/books/OL7353617M',
      title: 'Domain-Driven Design',
      subtitle: 'Tackling Complexity in the Heart of Software',
      publishers: ['Addison-Wesley'],
      publish_date: 'August 30, 2003',
      number_of_pages: 560,
      isbn_10: ['0321125215'],
      isbn_13: ['9780321125217'],
      works: [{ key: '/works/OL1234W' }],
      subjects: ['Software architecture', 'Design'],
      description: { type: 'text', value: 'Strategic design patterns.' },
      languages: [{ key: '/languages/eng' }],
    };

    const mapped = olEditionToBook(edition);

    expect(mapped.title).toBe('Domain-Driven Design');
    expect(mapped.subtitle).toBe('Tackling Complexity in the Heart of Software');
    expect(mapped.authors).toBe(JSON.stringify([]));
    expect(mapped.isbn_10).toBe('0321125215');
    expect(mapped.isbn_13).toBe('9780321125217');
    expect(mapped.open_library_edition_id).toBe('OL7353617M');
    expect(mapped.open_library_id).toBe('OL1234W');
    expect(mapped.cover_url).toContain('/b/isbn/9780321125217-L.jpg');
    expect(mapped.publisher).toBe('Addison-Wesley');
    expect(mapped.publish_year).toBe(2003);
    expect(mapped.page_count).toBe(560);
    expect(mapped.subjects).toBe(JSON.stringify(['Software architecture', 'Design']));
    expect(mapped.description).toBe('Strategic design patterns.');
    expect(mapped.language).toBe('eng');
    expect(mapped.added_source).toBe('scan');
  });

  it('uses OLID cover fallback and default language when edition metadata is sparse', () => {
    const edition: OLBookEdition = {
      key: '/books/OL42M',
      title: 'Sparse Edition',
      covers: [42],
      description: 'Plain text description',
    };

    const mapped = olEditionToBook(edition);

    expect(mapped.cover_url).toContain('/b/olid/OL42M-L.jpg');
    expect(mapped.description).toBe('Plain text description');
    expect(mapped.language).toBe('en');
  });
});
