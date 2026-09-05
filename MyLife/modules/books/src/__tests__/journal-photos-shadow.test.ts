/**
 * Phase 1c Wave A — books journal photos shadow-write integration.
 *
 * Asserts every bk_journal_photos write mirrors to hub_attachments +
 * hub_attachment_links inside a single transaction, and that any hub-side
 * failure rolls back the per-module write so the three tables stay in sync.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DatabaseAdapter, InMemoryTestDatabase } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import * as dbPkg from '@mylife/db';
import { BOOKS_MODULE } from '../definition';
import { createJournalEntry } from '../db/journal-entries';
import {
  addJournalPhoto,
  removeJournalPhoto,
  getPhotosForEntry,
} from '../db/journal-photos';

let testDb: InMemoryTestDatabase;
let adapter: DatabaseAdapter;

beforeEach(() => {
  testDb = createModuleTestDatabase('books', BOOKS_MODULE.migrations!);
  adapter = testDb.adapter;
  createJournalEntry(adapter, 'entry-1', {
    content: 'A sunset at the beach.',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  testDb.close();
});

interface PhotoRow {
  id: string;
  entry_id: string;
  file_path: string;
  hub_attachment_id: string | null;
}

interface HubAttachmentRow {
  id: string;
  uri: string;
  mime: string;
}

interface HubLinkRow {
  attachment_id: string;
  module_id: string;
  entity_type: string;
  entity_id: string;
}

function getPhotoRow(id: string): PhotoRow | undefined {
  return adapter.query<PhotoRow>(
    `SELECT id, entry_id, file_path, hub_attachment_id FROM bk_journal_photos WHERE id = ?`,
    [id],
  )[0];
}

function listHubAttachments(): HubAttachmentRow[] {
  return adapter.query<HubAttachmentRow>(
    `SELECT id, uri, mime FROM hub_attachments ORDER BY id`,
  );
}

function listHubLinks(): HubLinkRow[] {
  return adapter.query<HubLinkRow>(
    `SELECT attachment_id, module_id, entity_type, entity_id
     FROM hub_attachment_links ORDER BY attachment_id`,
  );
}

describe('bk_journal_photos shadow-write on create', () => {
  it('inserts into bk_journal_photos, hub_attachments, and hub_attachment_links', () => {
    addJournalPhoto(adapter, 'p1', {
      entry_id: 'entry-1',
      file_path: '/photos/sunset.jpg',
    });

    const photoRow = getPhotoRow('p1');
    expect(photoRow).toBeDefined();
    expect(photoRow!.file_path).toBe('/photos/sunset.jpg');

    const attachments = listHubAttachments();
    expect(attachments).toHaveLength(1);
    expect(attachments[0]!.uri).toBe('/photos/sunset.jpg');
    expect(attachments[0]!.mime).toBe('image/jpeg');

    const links = listHubLinks();
    expect(links).toHaveLength(1);
    expect(links[0]!.attachment_id).toBe(attachments[0]!.id);
    expect(links[0]!.module_id).toBe('books');
    expect(links[0]!.entity_type).toBe('journal_photo');
    expect(links[0]!.entity_id).toBe('p1');
  });

  it('populates hub_attachment_id on the bk_journal_photos row', () => {
    addJournalPhoto(adapter, 'p1', {
      entry_id: 'entry-1',
      file_path: '/photos/sunset.jpg',
    });

    const photoRow = getPhotoRow('p1');
    const attachments = listHubAttachments();
    expect(photoRow!.hub_attachment_id).not.toBeNull();
    expect(photoRow!.hub_attachment_id).toBe(attachments[0]!.id);
  });

  it('gives distinct hub_attachment_ids to multiple photos on the same entry', () => {
    addJournalPhoto(adapter, 'p1', {
      entry_id: 'entry-1',
      file_path: '/photos/a.jpg',
    });
    addJournalPhoto(adapter, 'p2', {
      entry_id: 'entry-1',
      file_path: '/photos/b.png',
      sort_order: 1,
    });

    const p1 = getPhotoRow('p1');
    const p2 = getPhotoRow('p2');
    expect(p1!.hub_attachment_id).not.toBeNull();
    expect(p2!.hub_attachment_id).not.toBeNull();
    expect(p1!.hub_attachment_id).not.toBe(p2!.hub_attachment_id);

    const attachments = listHubAttachments();
    expect(attachments).toHaveLength(2);

    const links = listHubLinks();
    expect(links).toHaveLength(2);
    const entityIds = links.map((l) => l.entity_id).sort();
    expect(entityIds).toEqual(['p1', 'p2']);
  });

  it('infers mime from file extension (png)', () => {
    addJournalPhoto(adapter, 'p1', {
      entry_id: 'entry-1',
      file_path: '/photos/image.png',
    });

    const attachments = listHubAttachments();
    expect(attachments[0]!.mime).toBe('image/png');
  });
});

describe('bk_journal_photos shadow-write on delete', () => {
  it('removes the photo from all three tables via CASCADE + explicit delete', () => {
    addJournalPhoto(adapter, 'p1', {
      entry_id: 'entry-1',
      file_path: '/photos/a.jpg',
    });
    expect(listHubAttachments()).toHaveLength(1);
    expect(listHubLinks()).toHaveLength(1);

    removeJournalPhoto(adapter, 'p1');

    expect(getPhotoRow('p1')).toBeUndefined();
    expect(listHubAttachments()).toHaveLength(0);
    expect(listHubLinks()).toHaveLength(0);
    expect(getPhotosForEntry(adapter, 'entry-1')).toHaveLength(0);
  });

  it('deleting one photo leaves the other photo and its hub rows intact', () => {
    addJournalPhoto(adapter, 'p1', {
      entry_id: 'entry-1',
      file_path: '/photos/a.jpg',
    });
    addJournalPhoto(adapter, 'p2', {
      entry_id: 'entry-1',
      file_path: '/photos/b.jpg',
      sort_order: 1,
    });

    removeJournalPhoto(adapter, 'p1');

    const attachments = listHubAttachments();
    expect(attachments).toHaveLength(1);
    const links = listHubLinks();
    expect(links).toHaveLength(1);
    expect(links[0]!.entity_id).toBe('p2');
  });
});

describe('bk_journal_photos shadow-write transactional safety', () => {
  it('rolls back the per-module insert when createAttachment throws', () => {
    const spy = vi
      .spyOn(dbPkg, 'createAttachment')
      .mockImplementation(() => {
        throw new Error('simulated hub createAttachment failure');
      });

    expect(() =>
      addJournalPhoto(adapter, 'p-boom', {
        entry_id: 'entry-1',
        file_path: '/photos/boom.jpg',
      }),
    ).toThrow(/simulated hub createAttachment failure/);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(getPhotoRow('p-boom')).toBeUndefined();
    expect(listHubAttachments()).toHaveLength(0);
    expect(listHubLinks()).toHaveLength(0);
  });

  it('rolls back all three writes when linkAttachment throws after createAttachment succeeds', () => {
    const spy = vi
      .spyOn(dbPkg, 'linkAttachment')
      .mockImplementation(() => {
        throw new Error('simulated hub linkAttachment failure');
      });

    expect(() =>
      addJournalPhoto(adapter, 'p-boom', {
        entry_id: 'entry-1',
        file_path: '/photos/boom.jpg',
      }),
    ).toThrow(/simulated hub linkAttachment failure/);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(getPhotoRow('p-boom')).toBeUndefined();
    expect(listHubAttachments()).toHaveLength(0);
    expect(listHubLinks()).toHaveLength(0);
  });
});
