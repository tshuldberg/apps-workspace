// OS Share Inbox routing + intake honesty (Plan 20, Phase 9/10).
//
// Proves the load-bearing honesty properties of the OS-share surface:
//   1. A staged intake is DEVICE-LOCAL: its tables are outside the sync prefix
//      map, so it can never auto-replicate (NC-9 / L7).
//   2. Routing into a channel writes a REAL cm_messages row and marks the intake
//      sent ONLY then; a failed send leaves it staged; "sent" reads the real row,
//      never mk_share_intake.status (NC-10 / L7).
//   3. The DM destination is ABSENT until the Plan-21 messages surface exists.
//   4. Intake RE-SNIFFS the payload MIME from bytes; a lying sender MIME loses.

import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createChannelMessage,
  generateDeviceIdentity,
  getSharePayloads,
  listShareIntakes,
  routeShareIntake as markShareIntakeRouted,
  stageShareIntake,
  type ChannelMessageAttachment,
} from '@mylife/sync';
import {
  CM_MESSAGES_TABLE,
  ensureCommunityTables,
  insertMessageRow,
} from '../(root)/data/community-core';
import { ensureMeerkatTables } from '../(root)/data/db';
import { MEERKAT_SYNC_PREFIXES } from '../(root)/data/sync-core';
import {
  DM_MESSAGES_SURFACE_AVAILABLE,
  availableShareDestinations,
  isShareIntakeSent,
  routeStagedShare,
  type ChannelSendFn,
} from '../(root)/data/share-route';
import { ingestShareIntent } from '../(root)/data/share-intake-native';

let db: InMemoryTestDatabase;
const identity = generateDeviceIdentity('Router');

const COMMUNITY_ID = 'c1';
const CHANNEL_ID = 'general';

beforeEach(() => {
  db = createInMemoryTestDatabase();
  ensureMeerkatTables(db.adapter); // creates mk_share_intake + mk_share_payload
  ensureCommunityTables(db.adapter); // creates cm_messages
});

/** A REAL channel send: signs a message, writes the cm_messages row, returns its id. */
function makeRealSend(): ChannelSendFn {
  return (communityId, channelId, body, attachments) => {
    const event = createChannelMessage(identity, {
      communityId,
      channelId,
      body,
      attachments: attachments.length > 0 ? attachments : undefined,
      hlc: { wall: new Date().toISOString(), counter: 0 },
    });
    insertMessageRow(db.adapter, event);
    return { ok: true, messageId: event.id };
  };
}

function countMessages(): number {
  return db.adapter.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${CM_MESSAGES_TABLE}`)[0]?.n ?? 0;
}

async function stageText(text: string): Promise<string> {
  const throwIo = async () => {
    throw new Error('text share must not touch file IO');
  };
  const result = await ingestShareIntent({
    db: db.adapter,
    shareIntent: { text },
    source: 'android_share_intent',
    readFileBytes: throwIo,
    putBlob: throwIo,
  });
  expect(result.itemId).not.toBeNull();
  return result.itemId as string;
}

describe('staged intake is device-local (never replicates)', () => {
  it('mk_share_intake + mk_share_payload are outside MEERKAT_SYNC_PREFIXES', () => {
    const isSynced = (table: string): boolean =>
      [...MEERKAT_SYNC_PREFIXES.values()].some((prefix) => table.startsWith(prefix));

    expect(isSynced('mk_share_intake')).toBe(false);
    expect(isSynced('mk_share_payload')).toBe(false);
    // sanity: the channel table IS synced, so the guard above is meaningful.
    expect(isSynced('cm_messages')).toBe(true);
    // no sync prefix is itself an mk_share table.
    for (const prefix of MEERKAT_SYNC_PREFIXES.values()) {
      expect(prefix.startsWith('mk_share')).toBe(false);
    }
  });

  it('staging writes no synced row (the mk_share tables carry the whole item)', async () => {
    const itemId = await stageText('https://example.com/post');
    const staged = listShareIntakes(db.adapter, ['staged']);
    expect(staged.map((s) => s.id)).toContain(itemId);
    // the payload lives only in the device-local mk_share_payload table.
    expect(getSharePayloads(db.adapter, itemId)).toHaveLength(1);
    // nothing landed in the synced channel table just by staging.
    expect(countMessages()).toBe(0);
  });
});

describe('routing into a channel writes a real row, then marks sent', () => {
  it('writes cm_messages first and only then records the route as sent', async () => {
    const itemId = await stageText('hello from a share');
    const [item] = listShareIntakes(db.adapter, ['staged']);
    expect(item.id).toBe(itemId);

    // Not sent before routing.
    expect(isShareIntakeSent(db.adapter, item)).toBe(false);

    const result = await routeStagedShare({
      db: db.adapter,
      item,
      target: { kind: 'channel', communityId: COMMUNITY_ID, channelId: CHANNEL_ID },
      send: makeRealSend(),
    });
    expect(result.ok).toBe(true);
    const messageId = result.ok ? result.messageId : '';

    // A REAL cm_messages row now exists with that id.
    const rows = db.adapter.query<{ id: string; body: string }>(
      `SELECT id, body FROM ${CM_MESSAGES_TABLE} WHERE id = ?`,
      [messageId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].body).toBe('hello from a share');

    // The intake is recorded routed to that real row.
    const [routed] = listShareIntakes(db.adapter, ['routed']);
    expect(routed.destination).toBe('channel');
    expect(routed.dest_ref).toBe(messageId);
    // "sent" now reads the real destination row.
    expect(isShareIntakeSent(db.adapter, routed)).toBe(true);
  });

  it('"sent" reads the real row, NOT mk_share_intake.status (dangling dest_ref = not sent)', async () => {
    const itemId = await stageText('dangling');
    // Force a routed status pointing at a message id that does not exist.
    markShareIntakeRouted(db.adapter, itemId, 'channel', 'cm_does_not_exist');
    const [routed] = listShareIntakes(db.adapter, ['routed']);
    expect(routed.status).toBe('routed');
    expect(routed.dest_ref).toBe('cm_does_not_exist');
    // Status says routed, but there is no real row -> honestly NOT sent.
    expect(isShareIntakeSent(db.adapter, routed)).toBe(false);
  });

  it('a failed send leaves the item staged and writes no row', async () => {
    const itemId = await stageText('will fail');
    const [item] = listShareIntakes(db.adapter, ['staged']);
    const failingSend: ChannelSendFn = () => ({ ok: false, error: 'no channel key' });

    const result = await routeStagedShare({
      db: db.adapter,
      item,
      target: { kind: 'channel', communityId: COMMUNITY_ID, channelId: CHANNEL_ID },
      send: failingSend,
    });
    expect(result.ok).toBe(false);
    expect(countMessages()).toBe(0);
    // still staged, never marked routed/sent.
    const stillStaged = listShareIntakes(db.adapter, ['staged']);
    expect(stillStaged.map((s) => s.id)).toContain(itemId);
    expect(isShareIntakeSent(db.adapter, stillStaged[0])).toBe(false);
  });

  it('routes a file payload as a real attachment via buildAttachment', async () => {
    // Stage a file intake directly (blob already stored elsewhere).
    const intakeId = 'intake-file';
    stageShareIntake(db.adapter, {
      id: intakeId,
      source: 'ios_share_extension',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      payloads: [
        {
          id: 'p1',
          kind: 'image',
          mime: 'image/png',
          filename: 'photo.png',
          byteLength: 8,
          blobHash: 'abc123',
        },
      ],
    });
    const [item] = listShareIntakes(db.adapter, ['staged']);

    const buildAttachment = async (): Promise<ChannelMessageAttachment> => ({
      id: 'att1',
      blobHash: 'abc123',
      name: 'photo.png',
      mimeType: 'image/png',
      size: 8,
    });

    const result = await routeStagedShare({
      db: db.adapter,
      item,
      target: { kind: 'files', communityId: COMMUNITY_ID, channelId: CHANNEL_ID },
      send: makeRealSend(),
      buildAttachment,
    });
    expect(result.ok).toBe(true);
    expect(countMessages()).toBe(1);
    const [routed] = listShareIntakes(db.adapter, ['routed']);
    expect(routed.destination).toBe('files');
    expect(isShareIntakeSent(db.adapter, routed)).toBe(true);
  });
});

describe('the DM destination tracks the Plan-21 messages surface flag', () => {
  it('offers dm once the DM surface is live, alongside channel and files', () => {
    expect(DM_MESSAGES_SURFACE_AVAILABLE).toBe(true);
    const kinds = availableShareDestinations();
    expect(kinds).toContain('dm');
    expect(kinds).toContain('channel');
    expect(kinds).toContain('files');
  });
});

describe('intake re-sniffs the payload MIME and overrides a lying sender', () => {
  it('a PNG declared as text/plain is filed as an image', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    let putHash = '';
    const result = await ingestShareIntent({
      db: db.adapter,
      source: 'android_share_intent',
      shareIntent: {
        files: [{ fileName: 'liar.txt', mimeType: 'text/plain', path: '/tmp/liar', size: png.length }],
      },
      readFileBytes: async () => png,
      putBlob: async (bytes) => {
        putHash = `blob_${bytes.length}`;
        return { hash: putHash };
      },
    });

    expect(result.staged).toBe(1);
    const payloads = getSharePayloads(db.adapter, result.itemId as string);
    expect(payloads).toHaveLength(1);
    // The sender said text/plain; the re-sniff filed it as an image.
    expect(payloads[0].kind).toBe('image');
    expect(payloads[0].mime).toBe('image/png');
    expect(payloads[0].blob_hash).toBe(putHash);
  });

  it('an oversized file is rejected with a reason, not silently dropped', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = await ingestShareIntent({
      db: db.adapter,
      source: 'android_share_intent',
      shareIntent: {
        files: [{ fileName: 'big.png', mimeType: 'image/png', path: '/tmp/big', size: 999 }],
      },
      maxBytes: 4,
      readFileBytes: async () => png,
      putBlob: async () => ({ hash: 'never' }),
    });
    expect(result.staged).toBe(0);
    expect(result.itemId).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
