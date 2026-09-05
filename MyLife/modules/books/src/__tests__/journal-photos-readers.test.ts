/**
 * Phase 2 Wave A reader test for @mylife/books journal-photo cross-module
 * attachment surfacing.
 *
 * Validates that getCrossModuleAttachmentsForBook walks bk_journal_photos
 * -> bk_journal_book_links -> hub_attachment_links and surfaces non-books
 * bindings (e.g. the same hub attachment also linked from a hypothetical
 * 'test-module' entity).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  linkAttachment,
  type DatabaseAdapter,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { BOOKS_MODULE } from '../definition';
import { createBook } from '../db/books';
import { createJournalEntry } from '../db/journal-entries';
import { linkJournalToBook } from '../db/journal-book-links';
import {
  addJournalPhoto,
  getCrossModuleAttachmentsForBook,
} from '../db/journal-photos';

let testDb: InMemoryTestDatabase;
let adapter: DatabaseAdapter;

beforeEach(() => {
  testDb = createModuleTestDatabase('books', BOOKS_MODULE.migrations!);
  adapter = testDb.adapter;
});

afterEach(() => {
  testDb.close();
});

function getHubAttachmentIdForPhoto(photoId: string): string {
  const row = adapter.query<{ hub_attachment_id: string | null }>(
    `SELECT hub_attachment_id FROM bk_journal_photos WHERE id = ?`,
    [photoId],
  )[0];
  if (!row?.hub_attachment_id) {
    throw new Error(`photo ${photoId} has no hub_attachment_id`);
  }
  return row.hub_attachment_id;
}

describe('getCrossModuleAttachmentsForBook', () => {
  it('returns an empty array when the book has no linked journal photos', () => {
    createBook(adapter, 'b1', { title: 'Solo', authors: 'Test' });
    expect(getCrossModuleAttachmentsForBook(adapter, 'b1')).toEqual([]);
  });

  it('skips books-owned links and surfaces only cross-module bindings', () => {
    createBook(adapter, 'b1', { title: 'Borges', authors: 'JLB' });
    createJournalEntry(adapter, 'entry-1', { content: 'Reflection on Aleph' });
    linkJournalToBook(adapter, 'entry-1', 'b1');

    addJournalPhoto(adapter, 'p1', {
      entry_id: 'entry-1',
      file_path: '/photos/aleph.jpg',
    });
    addJournalPhoto(adapter, 'p2', {
      entry_id: 'entry-1',
      file_path: '/photos/borges-portrait.jpg',
      sort_order: 1,
    });

    // The shadow-write already created a 'books' link for each photo. Now
    // simulate another module re-using one of the same hub_attachments
    // for its own entity (e.g. notes attaching the photo to a note, or
    // a test-module pinning it to a generic 'memory' record).
    const hubAttachmentForP1 = getHubAttachmentIdForPhoto('p1');
    linkAttachment(adapter, {
      attachmentId: hubAttachmentForP1,
      moduleId: 'test-module',
      entityType: 'memory',
      entityId: 'memory-42',
    });

    const cross = getCrossModuleAttachmentsForBook(adapter, 'b1');

    expect(cross).toHaveLength(1);
    expect(cross[0]).toEqual({
      moduleId: 'test-module',
      entityType: 'memory',
      entityId: 'memory-42',
    });
  });

  it('returns one cross-module entry per non-books link, deduping nothing', () => {
    createBook(adapter, 'b1', { title: 'Calvino', authors: 'IC' });
    createJournalEntry(adapter, 'entry-1', { content: 'Notes' });
    linkJournalToBook(adapter, 'entry-1', 'b1');
    addJournalPhoto(adapter, 'p1', {
      entry_id: 'entry-1',
      file_path: '/photos/cover.jpg',
    });

    const hubAttachmentForP1 = getHubAttachmentIdForPhoto('p1');
    linkAttachment(adapter, {
      attachmentId: hubAttachmentForP1,
      moduleId: 'test-module',
      entityType: 'memory',
      entityId: 'memory-1',
    });
    linkAttachment(adapter, {
      attachmentId: hubAttachmentForP1,
      moduleId: 'other-module',
      entityType: 'card',
      entityId: 'card-9',
    });

    const cross = getCrossModuleAttachmentsForBook(adapter, 'b1');

    expect(cross).toHaveLength(2);
    const moduleIds = cross.map((c) => c.moduleId).sort();
    expect(moduleIds).toEqual(['other-module', 'test-module']);
  });

  it('does not include photos from journals not linked to the requested book', () => {
    createBook(adapter, 'b1', { title: 'Borges', authors: 'JLB' });
    createBook(adapter, 'b2', { title: 'Calvino', authors: 'IC' });
    createJournalEntry(adapter, 'entry-1', { content: 'A' });
    createJournalEntry(adapter, 'entry-2', { content: 'B' });
    linkJournalToBook(adapter, 'entry-1', 'b1');
    linkJournalToBook(adapter, 'entry-2', 'b2');
    addJournalPhoto(adapter, 'p1', {
      entry_id: 'entry-1',
      file_path: '/photos/a.jpg',
    });
    addJournalPhoto(adapter, 'p2', {
      entry_id: 'entry-2',
      file_path: '/photos/b.jpg',
    });

    // Cross-link only p2 (b2's photo) to a non-books module.
    linkAttachment(adapter, {
      attachmentId: getHubAttachmentIdForPhoto('p2'),
      moduleId: 'test-module',
      entityType: 'memory',
      entityId: 'memory-b2',
    });

    expect(getCrossModuleAttachmentsForBook(adapter, 'b1')).toEqual([]);
    expect(getCrossModuleAttachmentsForBook(adapter, 'b2')).toHaveLength(1);
  });
});
