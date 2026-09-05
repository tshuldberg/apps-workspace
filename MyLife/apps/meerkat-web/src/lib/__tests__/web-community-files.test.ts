// Web twin of the mobile community-files aggregateCommunityFiles tests
// (apps/meerkat/app/__tests__/community-files.test.ts). Proves the web Files index
// excludes a link-preview attachment: it is a decoration that rides the attachment
// pipeline, never a user-shared, downloadable file (Plan 32 T5.1).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { createChannelMessage, generateDeviceIdentity, type ChannelMessageAttachment } from '@mylife/sync';
import { aggregateCommunityFiles, insertMessageRow } from '../meerkat-data';
import { LINK_PREVIEW_MIME_TYPE } from '../link-preview';
import { ensureSyncSchema } from '../schema';

let db: InMemoryTestDatabase;
const author = generateDeviceIdentity('Author');
const CHANNELS = [{ id: 'general', name: 'general' }];

function attachment(over: Partial<ChannelMessageAttachment> & { id: string; blobHash: string }): ChannelMessageAttachment {
  return { name: 'file.bin', mimeType: 'application/octet-stream', size: 100, ...over };
}

function postMessage(input: { body?: string; attachments?: ChannelMessageAttachment[]; wall: string }) {
  const event = createChannelMessage(author, {
    communityId: 'c1',
    channelId: 'general',
    body: input.body ?? '',
    attachments: input.attachments,
    hlc: { wall: input.wall, counter: 0 },
  });
  insertMessageRow(db.adapter, event);
  return event;
}

beforeEach(() => {
  db = createInMemoryTestDatabase();
  ensureSyncSchema(db.adapter);
});

afterEach(() => {
  db.close();
});

describe('web aggregateCommunityFiles link-preview exclusion (twin)', () => {
  it('excludes a link-preview attachment from the Files index (it is a decoration, not a file)', () => {
    postMessage({
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
});
