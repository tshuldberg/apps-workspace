import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { createChannelMessage, generateDeviceIdentity, type ChannelMessageAttachment } from '@mylife/sync';
import {
  ensureCommunityTables,
  insertMessageAttachmentRows,
  insertMessageRow,
} from '../(root)/data/community-core';
import {
  EMPTY_FILE_SELECTION,
  aggregateCommunityFiles,
  aggregatedFileId,
  applyPresence,
  buildPresenceMap,
  bulkSaveHeadline,
  fileSelectionReducer,
  perFileOutcomeLabel,
  resolveFilesToSave,
  saveFilesBulk,
  summarizeSelection,
  type AggregatedFile,
  type PresentFile,
  type SaveOneInput,
} from '../(root)/data/community-files';
import type { FileSaveResult } from '../(root)/data/file-save';
import { LINK_PREVIEW_MIME_TYPE } from '../(root)/data/link-preview';

let db: InMemoryTestDatabase;
const author = generateDeviceIdentity('Author');
const CHANNELS = [
  { id: 'general', name: 'general' },
  { id: 'design-files', name: 'design-files' },
];

function attachment(over: Partial<ChannelMessageAttachment> & { id: string; blobHash: string }): ChannelMessageAttachment {
  return {
    name: 'file.bin',
    mimeType: 'application/octet-stream',
    size: 100,
    ...over,
  };
}

function postMessage(input: {
  channelId: string;
  body?: string;
  attachments?: ChannelMessageAttachment[];
  wall: string;
  supersedes?: { id: string; deleted: boolean };
}) {
  const event = createChannelMessage(author, {
    communityId: 'c1',
    channelId: input.channelId,
    body: input.body ?? '',
    attachments: input.attachments,
    hlc: { wall: input.wall, counter: 0 },
    supersedes: input.supersedes,
  });
  insertMessageRow(db.adapter, event);
  // Mirror production (mergeChannelMessageEvents): the attachment index rows are
  // INSERT OR IGNORE and never tombstoned, so they persist after a delete. The
  // aggregation must NOT read them; the test below proves they linger.
  insertMessageAttachmentRows(db.adapter, event);
  return event;
}

beforeEach(() => {
  db = createInMemoryTestDatabase();
  ensureCommunityTables(db.adapter);
});

afterEach(() => {
  db.close();
});

describe('aggregateCommunityFiles', () => {
  it('returns one row per attachment across channels with derived name/type/size/channel', () => {
    postMessage({
      channelId: 'design-files',
      attachments: [
        attachment({ id: 'a1', blobHash: 'a'.repeat(128), name: 'cover.jpg', mimeType: 'image/jpeg', size: 2100 }),
      ],
      wall: '2026-06-13T00:00:00.000Z',
    });
    postMessage({
      channelId: 'general',
      attachments: [
        attachment({ id: 'a2', blobHash: 'b'.repeat(128), name: 'notes.txt', mimeType: 'text/plain', size: 40 }),
      ],
      wall: '2026-06-13T00:00:01.000Z',
    });

    const files = aggregateCommunityFiles(db.adapter, 'c1', CHANNELS);
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.name)).toEqual(['cover.jpg', 'notes.txt']);
    const cover = files.find((f) => f.name === 'cover.jpg')!;
    expect(cover).toMatchObject({
      id: aggregatedFileId('design-files', 'a1'),
      attachmentId: 'a1',
      blobHash: 'a'.repeat(128),
      mimeType: 'image/jpeg',
      size: 2100,
      channelId: 'design-files',
      channelName: 'design-files',
    });
  });

  it('excludes attachments from deleted messages (resolved events, not attachment rows)', () => {
    const original = postMessage({
      channelId: 'general',
      attachments: [attachment({ id: 'a1', blobHash: 'a'.repeat(128), name: 'gone.bin' })],
      wall: '2026-06-13T00:00:00.000Z',
    });
    // A signed delete event tombstones the message; its attachment must vanish.
    postMessage({
      channelId: 'general',
      wall: '2026-06-13T00:00:02.000Z',
      supersedes: { id: original.id, deleted: true },
    });

    const files = aggregateCommunityFiles(db.adapter, 'c1', CHANNELS);
    expect(files.map((f) => f.name)).not.toContain('gone.bin');
    expect(files).toHaveLength(0);

    // The raw attachment row still exists (INSERT OR IGNORE, never tombstoned) -
    // proving we must NOT read it directly.
    const rawRows = db.adapter.query<{ name: string }>('SELECT name FROM cm_message_attachments');
    expect(rawRows.map((r) => r.name)).toContain('gone.bin');
  });

  it('keeps an edited message slot and its attachments', () => {
    const original = postMessage({
      channelId: 'general',
      body: 'draft',
      attachments: [attachment({ id: 'a1', blobHash: 'a'.repeat(128), name: 'kept.bin' })],
      wall: '2026-06-13T00:00:00.000Z',
    });
    postMessage({
      channelId: 'general',
      body: 'final',
      attachments: [attachment({ id: 'a1', blobHash: 'a'.repeat(128), name: 'kept.bin' })],
      wall: '2026-06-13T00:00:01.000Z',
      supersedes: { id: original.id, deleted: false },
    });

    const files = aggregateCommunityFiles(db.adapter, 'c1', CHANNELS);
    expect(files.map((f) => f.name)).toEqual(['kept.bin']);
  });

  it('excludes a link-preview attachment from the Files index (it is a decoration, not a file)', () => {
    postMessage({
      channelId: 'general',
      body: 'https://example.com',
      attachments: [
        attachment({ id: 'real', blobHash: 'a'.repeat(128), name: 'photo.jpg', mimeType: 'image/jpeg', size: 900 }),
        attachment({ id: 'preview', blobHash: 'b'.repeat(128), name: 'link-preview', mimeType: LINK_PREVIEW_MIME_TYPE, size: 300 }),
      ],
      wall: '2026-06-13T00:00:00.000Z',
    });

    const files = aggregateCommunityFiles(db.adapter, 'c1', CHANNELS);
    // The real file is indexed; the link-preview payload is never a downloadable file.
    expect(files.map((f) => f.name)).toEqual(['photo.jpg']);
    expect(files.some((f) => f.mimeType === LINK_PREVIEW_MIME_TYPE)).toBe(false);
  });

  it('de-dupes the same blobHash+attachmentId appearing in two messages to one source-of-truth row', () => {
    postMessage({
      channelId: 'general',
      attachments: [attachment({ id: 'shared', blobHash: 'a'.repeat(128), name: 'shared.bin' })],
      wall: '2026-06-13T00:00:00.000Z',
    });
    postMessage({
      channelId: 'general',
      attachments: [attachment({ id: 'shared', blobHash: 'a'.repeat(128), name: 'shared.bin' })],
      wall: '2026-06-13T00:00:05.000Z',
    });

    const files = aggregateCommunityFiles(db.adapter, 'c1', CHANNELS);
    expect(files).toHaveLength(1);
    // The earliest occurrence wins.
    expect(files[0].hlcWall).toBe('2026-06-13T00:00:00.000Z');
  });
});

describe('presence', () => {
  const files: AggregatedFile[] = [
    { id: 'c:1', attachmentId: '1', blobHash: 'h1', name: 'a', mimeType: 'x', size: 10, channelId: 'c', channelName: 'c', messageId: 'm', authorDeviceId: 'd', hlcWall: 'w', hlcCounter: 0 },
    { id: 'c:2', attachmentId: '2', blobHash: 'h2', name: 'b', mimeType: 'x', size: 20, channelId: 'c', channelName: 'c', messageId: 'm', authorDeviceId: 'd', hlcWall: 'w', hlcCounter: 0 },
    { id: 'c:3', attachmentId: '3', blobHash: 'h1', name: 'c', mimeType: 'x', size: 30, channelId: 'c', channelName: 'c', messageId: 'm', authorDeviceId: 'd', hlcWall: 'w', hlcCounter: 0 },
  ];

  it('checks each unique blob hash once and applies it to every row sharing the hash', async () => {
    const checked: string[] = [];
    const map = await buildPresenceMap(files, async (hash) => {
      checked.push(hash);
      return hash === 'h1';
    });
    // h1 and h2 are the only unique hashes, so exactly two checks ran.
    expect(checked.sort()).toEqual(['h1', 'h2']);
    const present = applyPresence(files, map);
    expect(present.map((f) => f.present)).toEqual([true, false, true]);
  });
});

describe('fileSelectionReducer + summary', () => {
  const present: PresentFile[] = [
    { id: 'c:1', attachmentId: '1', blobHash: 'h1', name: 'a', mimeType: 'x', size: 100, channelId: 'c', channelName: 'c', messageId: 'm', authorDeviceId: 'd', hlcWall: 'w', hlcCounter: 0, present: true },
    { id: 'c:2', attachmentId: '2', blobHash: 'h2', name: 'b', mimeType: 'x', size: 200, channelId: 'c', channelName: 'c', messageId: 'm', authorDeviceId: 'd', hlcWall: 'w', hlcCounter: 0, present: false },
    { id: 'c:3', attachmentId: '3', blobHash: 'h3', name: 'c', mimeType: 'x', size: 300, channelId: 'c', channelName: 'c', messageId: 'm', authorDeviceId: 'd', hlcWall: 'w', hlcCounter: 0, present: true },
  ];

  it('toggle adds and removes a row by id', () => {
    let state = fileSelectionReducer(EMPTY_FILE_SELECTION, { type: 'toggle', id: 'c:1' });
    expect([...state.selectedIds]).toEqual(['c:1']);
    state = fileSelectionReducer(state, { type: 'toggle', id: 'c:1' });
    expect([...state.selectedIds]).toEqual([]);
  });

  it('select-all selects only on-device rows', () => {
    const state = fileSelectionReducer(EMPTY_FILE_SELECTION, { type: 'select-all', files: present });
    expect([...state.selectedIds].sort()).toEqual(['c:1', 'c:3']);
  });

  it('clear empties the selection', () => {
    const selected = fileSelectionReducer(EMPTY_FILE_SELECTION, { type: 'select-all', files: present });
    expect(fileSelectionReducer(selected, { type: 'clear' }).selectedIds.size).toBe(0);
  });

  it('summarizes from the live presence list, excluding removed selected ids', () => {
    // c:2 is selected but removed; it must not count toward the bulk bar total.
    const selectedIds = new Set(['c:1', 'c:2', 'c:3']);
    const summary = summarizeSelection(present, selectedIds);
    expect(summary.count).toBe(2);
    expect(summary.bytes).toBe(400);
    expect(summary.label).toBe('2 files · 400 B');
  });

  it('resolveFilesToSave returns only selected AND present rows', () => {
    const toSave = resolveFilesToSave(present, new Set(['c:1', 'c:2', 'c:3']));
    expect(toSave.map((f) => f.id)).toEqual(['c:1', 'c:3']);
  });
});

describe('saveFilesBulk', () => {
  function file(id: string, blobHash: string, name = id): AggregatedFile {
    return { id, attachmentId: id, blobHash, name, mimeType: 'application/octet-stream', size: 10, channelId: 'c', channelName: 'c', messageId: 'm', authorDeviceId: 'd', hlcWall: 'w', hlcCounter: 0 };
  }
  const bytes = new Uint8Array([1, 2, 3]);

  it('all-success: savedCount === total and every per-file is saved', async () => {
    const result = await saveFilesBulk({
      files: [file('1', 'h1'), file('2', 'h2')],
      loadBytes: async () => bytes,
      saveOne: async (): Promise<FileSaveResult> => ({ kind: 'saved', uri: 'u', location: 'saf-folder' }),
    });
    expect(result.total).toBe(2);
    expect(result.savedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect(result.perFile.every((p) => p.status === 'saved')).toBe(true);
    expect(bulkSaveHeadline(result)).toBe('2 of 2 saved');
  });

  it('partial failure preserves the REAL reason and never claims all done', async () => {
    const result = await saveFilesBulk({
      files: [file('1', 'h1'), file('2', 'h2'), file('3', 'h3')],
      loadBytes: async () => bytes,
      saveOne: async (input: SaveOneInput): Promise<FileSaveResult> =>
        input.name === '2'
          ? { kind: 'failed', reason: 'Drive declined the write' }
          : { kind: 'saved', uri: 'u', location: 'saf-folder' },
    });
    expect(result.savedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    const failed = result.perFile.find((p) => p.id === '2');
    expect(failed).toMatchObject({ status: 'failed', reason: 'Drive declined the write' });
    expect(bulkSaveHeadline(result)).toBe('2 of 3 saved');
  });

  it('skips removed files (loadBytes null) with an honest reason, not counted as saved', async () => {
    const result = await saveFilesBulk({
      files: [file('1', 'h1', 'present'), file('2', 'h2', 'removed')],
      loadBytes: async (hash) => (hash === 'h1' ? bytes : null),
      saveOne: async (): Promise<FileSaveResult> => ({ kind: 'saved', uri: 'u', location: 'saf-folder' }),
    });
    expect(result.savedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
    const skipped = result.perFile.find((p) => p.name === 'removed');
    expect(skipped?.status).toBe('skipped');
    if (skipped?.status === 'skipped') expect(skipped.reason).toMatch(/not on this device/i);
  });

  it('maps cancelled to skipped and no-destination to failed without claiming success', async () => {
    const cancelled = await saveFilesBulk({
      files: [file('1', 'h1')],
      loadBytes: async () => bytes,
      saveOne: async (): Promise<FileSaveResult> => ({ kind: 'cancelled' }),
    });
    expect(cancelled.skippedCount).toBe(1);
    expect(cancelled.savedCount).toBe(0);
    expect(cancelled.perFile[0].status).toBe('skipped');

    const noDest = await saveFilesBulk({
      files: [file('1', 'h1')],
      loadBytes: async () => bytes,
      saveOne: async (): Promise<FileSaveResult> => ({ kind: 'no-destination' }),
    });
    expect(noDest.failedCount).toBe(1);
    expect(noDest.savedCount).toBe(0);
    expect(noDest.perFile[0].status).toBe('failed');
  });

  it('maps a thrown saveOne to a failed outcome with the thrown message', async () => {
    const result = await saveFilesBulk({
      files: [file('1', 'h1')],
      loadBytes: async () => bytes,
      saveOne: async (): Promise<FileSaveResult> => {
        throw new Error('disk exploded');
      },
    });
    expect(result.failedCount).toBe(1);
    expect(result.perFile[0]).toMatchObject({ status: 'failed', reason: 'disk exploded' });
  });

  it('saves sequentially: each saveOne completes before the next begins', async () => {
    const order: string[] = [];
    let active = 0;
    let maxConcurrent = 0;
    const result = await saveFilesBulk({
      files: [file('1', 'h1'), file('2', 'h2'), file('3', 'h3')],
      loadBytes: async () => bytes,
      saveOne: async (input: SaveOneInput): Promise<FileSaveResult> => {
        active += 1;
        maxConcurrent = Math.max(maxConcurrent, active);
        order.push(`start:${input.name}`);
        await new Promise((resolve) => setTimeout(resolve, 1));
        order.push(`end:${input.name}`);
        active -= 1;
        return { kind: 'saved', uri: 'u', location: 'saf-folder' };
      },
    });
    expect(maxConcurrent).toBe(1);
    expect(order).toEqual(['start:1', 'end:1', 'start:2', 'end:2', 'start:3', 'end:3']);
    expect(result.savedCount).toBe(3);
  });

  it('perFileOutcomeLabel is honest per location and status', () => {
    expect(perFileOutcomeLabel({ id: '1', name: 'a', status: 'saved', location: 'saf-folder' }))
      .toBe('saved · verified on disk');
    expect(perFileOutcomeLabel({ id: '1', name: 'a', status: 'saved', location: 'files-app' }))
      .toBe('saved · verified copy in the Files app');
    expect(perFileOutcomeLabel({ id: '1', name: 'a', status: 'failed', reason: 'nope' }))
      .toBe('failed · nope');
  });
});
