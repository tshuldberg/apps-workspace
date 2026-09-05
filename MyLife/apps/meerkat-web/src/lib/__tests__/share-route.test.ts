// Plan 20, Phase 10 (web OS-share intake) honesty guards. Proves, on the REAL
// shipped web helpers + the REAL @mylife/sync share-intake engine:
//   1. staged mk_share_* rows NEVER replicate: a prefix guard AND a real 2-node
//      relay session where a control cm_messages row crosses but the staged share
//      does not (NC-9/L7).
//   2. routing writes a REAL cm_messages row BEFORE "Sent": isShareIntakeSent is
//      false until a real destination row exists, and a routed status pointing at
//      a NON-existent message row still reads as NOT sent (status is never trusted
//      on its own, NC-10/L7).
//   3. the payload MIME is RE-SNIFFED at intake; a lying declaredMime is ignored.
//   4. the Web Share Target is ABSENT when the browser cannot host it, and the DM
//      destination is hidden until the Plan-21 messages surface exists.

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import {
  createChannelMessage,
  createCommunity,
  createCommunityInvite,
  joinCommunityFromLink,
  nextHlc,
  routeShareIntake,
  sha512Hex,
} from '@mylife/sync';
import { ensureMeerkatTables } from '../schema';
import {
  channelMessageRowFromEvent,
  highestHlc,
  insertMessageRow,
  storeOwnedCommunity,
  MEERKAT_SYNC_PREFIXES,
} from '../meerkat-data';
import {
  availableShareDestinations,
  isShareIntakeSent,
  listStagedShareItems,
  routeStagedShare,
  routeStagedShareToDm,
  stageWebShare,
  type AuthorSharedMessage,
  type ShareBlobSink,
  type ShareDmSend,
} from '../share-route';
import { isWebShareTargetSupported } from '../web-share-target';
import {
  buildWebNode,
  pairNodes,
  readChannelRows,
  runRelaySession,
  teardownNode,
  withRelay,
  type WebNode,
} from './support/web-node-harness';

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A blob sink that records the mime it was asked to seal under. */
function recordingBlobSink(): ShareBlobSink & { calls: { mimeType: string | null | undefined }[] } {
  const calls: { mimeType: string | null | undefined }[] = [];
  return {
    calls,
    async putLocal(bytes, opts) {
      calls.push({ mimeType: opts.mimeType });
      return { hash: sha512Hex(bytes), size: bytes.byteLength };
    },
  };
}

/** A blob sink that must never be called (text-only paths seal nothing). */
const throwingBlobSink: ShareBlobSink = {
  async putLocal() {
    throw new Error('putLocal should not run for text-only shares');
  },
};

function countRows(node: WebNode, table: string): number {
  return node.db.query<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0]?.n ?? 0;
}

let nodeA: WebNode | null = null;
let nodeB: WebNode | null = null;
afterEach(async () => {
  await teardownNode(nodeA);
  await teardownNode(nodeB);
  nodeA = null;
  nodeB = null;
});

describe('web OS-share intake: staged rows never replicate', () => {
  it('mk_share_intake / mk_share_payload are OUTSIDE every synced prefix', () => {
    const prefixes = Array.from(MEERKAT_SYNC_PREFIXES.values());
    for (const table of ['mk_share_intake', 'mk_share_payload']) {
      expect(prefixes.some((p) => table.startsWith(p))).toBe(false);
    }
  });

  it('a control cm_messages row crosses a real relay session but the staged share does NOT', async () => {
    await withRelay(async (url) => {
      nodeA = await buildWebNode('Owner');
      nodeB = await buildWebNode('Member');
      pairNodes(nodeA, nodeB);

      const signed = createCommunity(nodeA.identity, {
        name: 'Share Club',
        channels: [{ id: 'general', name: 'general' }],
        members: [
          { deviceId: nodeB.identity.publicKey, role: 'member', displayName: nodeB.identity.displayName },
        ],
        now: '2026-06-30T00:00:00.000Z',
      });
      const communityId = signed.descriptor.communityId;
      storeOwnedCommunity(nodeA.db, nodeA.identity, signed);
      const { link } = createCommunityInvite(nodeA.identity, signed);
      expect(joinCommunityFromLink(nodeB.db, nodeB.identity, link).ok).toBe(true);

      // A REAL channel message (the control that must cross).
      const control = createChannelMessage(nodeA.identity, {
        communityId,
        channelId: 'general',
        body: 'a real channel message',
        hlc: nextHlc(highestHlc(nodeA.db, communityId, 'general'), '2026-06-30T00:00:01.000Z'),
      });
      insertMessageRow(nodeA.db, control);
      nodeA.engine.recordChange('cm_messages', 'INSERT', control.id, { ...channelMessageRowFromEvent(control) });

      // A device-local staged share (must NOT cross).
      const staged = await stageWebShare(nodeA.db, throwingBlobSink, {
        items: [{ text: 'staged only on this device https://example.com' }],
        source: 'web_file_pick',
      });
      expect(staged.ok).toBe(true);
      expect(countRows(nodeA, 'mk_share_intake')).toBe(1);
      expect(countRows(nodeA, 'mk_share_payload')).toBe(1);

      const session = await runRelaySession(url, nodeA, nodeB);
      expect(session.status).toBe('completed');

      // The control crossed; the staged share did not.
      expect(readChannelRows(nodeB, communityId, 'general').length).toBeGreaterThanOrEqual(1);
      expect(countRows(nodeB, 'mk_share_intake')).toBe(0);
      expect(countRows(nodeB, 'mk_share_payload')).toBe(0);
    });
  });
});

describe('web OS-share intake: routing writes a real destination row before "Sent"', () => {
  it('"Sent" is false until a real cm_messages row exists, then true; a bogus routed status stays NOT sent', async () => {
    nodeA = await buildWebNode('Router');
    const node = nodeA;

    // A real author callback mirroring the provider's attachAndSend (text case).
    const author: AuthorSharedMessage = async (communityId, channelId, body) => {
      const event = createChannelMessage(node.identity, {
        communityId,
        channelId,
        body,
        hlc: nextHlc(highestHlc(node.db, communityId, channelId), new Date().toISOString()),
      });
      insertMessageRow(node.db, event);
      node.engine.recordChange('cm_messages', 'INSERT', event.id, { ...channelMessageRowFromEvent(event) });
      return { ok: true, event };
    };

    const staged = await stageWebShare(node.db, throwingBlobSink, {
      items: [{ text: 'route me into a channel' }],
      source: 'web_file_pick',
    });
    expect(staged.ok).toBe(true);
    const intakeId = staged.intakeId as string;

    // Not sent before routing.
    expect(isShareIntakeSent(node.db, intakeId)).toBe(false);

    const routed = await routeStagedShare(node.db, { get: () => null }, author, {
      intakeId,
      communityId: 'community-1',
      channelId: 'general',
      destination: 'channel',
    });
    expect(routed.ok).toBe(true);
    if (!routed.ok) return;

    // A REAL cm_messages row exists with that id, and "Sent" is now true.
    const hit = node.db.query<{ n: number }>('SELECT COUNT(*) AS n FROM cm_messages WHERE id = ?', [routed.messageId]);
    expect(hit[0]?.n).toBe(1);
    expect(isShareIntakeSent(node.db, intakeId)).toBe(true);

    // Honesty guard: a routed status pointing at a NON-existent message row is NOT sent.
    const staged2 = await stageWebShare(node.db, throwingBlobSink, {
      items: [{ text: 'never really sent' }],
      source: 'web_file_pick',
    });
    const intakeId2 = staged2.intakeId as string;
    routeShareIntake(node.db, intakeId2, 'channel', 'no-such-message-id');
    expect(isShareIntakeSent(node.db, intakeId2)).toBe(false);
  });

  it('routing refuses the DM destination (Plan 21 not shipped) and never writes a message row', async () => {
    nodeA = await buildWebNode('NoDm');
    const staged = await stageWebShare(nodeA.db, throwingBlobSink, {
      items: [{ text: 'dm please' }],
      source: 'web_file_pick',
    });
    const author: AuthorSharedMessage = async () => {
      throw new Error('author must not run for a DM route');
    };
    const routed = await routeStagedShare(nodeA.db, { get: () => null }, author, {
      intakeId: staged.intakeId as string,
      communityId: 'c',
      channelId: 'general',
      destination: 'dm',
    });
    expect(routed.ok).toBe(false);
    expect(isShareIntakeSent(nodeA.db, staged.intakeId as string)).toBe(false);
  });
});

describe('web OS-share intake: MIME is re-sniffed, never trusted from the sender', () => {
  it('a PNG shared with a lying "text/plain" declaredMime stages as image/png', async () => {
    const { adapter } = createInMemoryTestDatabase();
    ensureMeerkatTables(adapter);
    const sink = recordingBlobSink();
    const pngBytes = new Uint8Array([...PNG_HEADER, 1, 2, 3, 4]);

    const staged = await stageWebShare(adapter, sink, {
      items: [{ bytes: pngBytes, declaredMime: 'text/plain', filename: 'evil.txt' }],
      source: 'web_file_pick',
    });
    expect(staged.ok).toBe(true);

    const items = listStagedShareItems(adapter);
    expect(items).toHaveLength(1);
    const payload = items[0].payloads[0];
    // Sniffed, not the declared text/plain.
    expect(payload.mime).toBe('image/png');
    expect(payload.kind).toBe('image');
    // The blob was sealed under the SNIFFED mime, never the declared one.
    expect(sink.calls).toEqual([{ mimeType: 'image/png' }]);
  });
});

describe('web OS-share intake: capability gating', () => {
  it('the Web Share Target is absent unless the browser supports service worker AND Cache API', () => {
    expect(isWebShareTargetSupported({ navigator: {}, caches: {} })).toBe(false);
    expect(isWebShareTargetSupported({ navigator: { serviceWorker: {} } })).toBe(false);
    expect(isWebShareTargetSupported({ navigator: { serviceWorker: {} }, caches: {} })).toBe(true);
    // Default node scope has neither, so the entry is absent.
    expect(isWebShareTargetSupported()).toBe(false);
  });

  it('the DM destination is hidden until a real messages surface exists', () => {
    expect(availableShareDestinations()).toEqual(['channel', 'files']);
    expect(availableShareDestinations({ directMessages: false })).toEqual(['channel', 'files']);
    expect(availableShareDestinations({ directMessages: true })).toEqual(['channel', 'files', 'dm']);
  });
});

describe('web OS-share intake: DM routing through the real DM provider (Plan 40 R1)', () => {
  function seededDb() {
    const { adapter } = createInMemoryTestDatabase();
    ensureMeerkatTables(adapter);
    adapter.execute(`CREATE TABLE IF NOT EXISTS dm_messages (id TEXT PRIMARY KEY)`);
    return adapter;
  }

  async function stageText(adapter: ReturnType<typeof seededDb>, id = 'dm-intake') {
    const staged = await stageWebShare(adapter, throwingBlobSink, {
      items: [{ text: 'shared to a friend' }],
      source: 'web_file_pick',
      idFactory: (() => { let n = 0; return () => `${id}-${(n += 1)}`; })(),
    });
    return staged.intakeId as string;
  }

  it('routes through the provider and marks routed only on a real dm_messages row', async () => {
    const adapter = seededDb();
    const intakeId = await stageText(adapter);
    const sendDm: ShareDmSend = async (_conversationId, body) => {
      const messageId = `dm_${body.length}`;
      adapter.execute(`INSERT INTO dm_messages (id) VALUES (?)`, [messageId]);
      return { ok: true, messageId };
    };

    const result = await routeStagedShareToDm(adapter, { get: () => null }, sendDm, {
      intakeId,
      conversationId: 'conv-1',
    });
    expect(result).toEqual({ ok: true, destination: 'dm', destRef: 'dm_18', messageId: 'dm_18' });
    expect(isShareIntakeSent(adapter, intakeId)).toBe(true);
  });

  it('leaves the intake staged + retryable on ok:false, throw, and empty recipient', async () => {
    const adapter = seededDb();
    const intakeId = await stageText(adapter, 'dm-retry');

    const failing: ShareDmSend = async () => ({ ok: false, error: 'no relay' });
    expect((await routeStagedShareToDm(adapter, { get: () => null }, failing, { intakeId, conversationId: 'c' })).ok).toBe(false);
    expect(isShareIntakeSent(adapter, intakeId)).toBe(false);

    const throwing: ShareDmSend = async () => { throw new Error('pairing gone'); };
    expect(await routeStagedShareToDm(adapter, { get: () => null }, throwing, { intakeId, conversationId: 'c' }))
      .toEqual({ ok: false, error: 'pairing gone' });
    expect(isShareIntakeSent(adapter, intakeId)).toBe(false);

    const unused: ShareDmSend = async () => ({ ok: true, messageId: 'x' });
    expect(await routeStagedShareToDm(adapter, { get: () => null }, unused, { intakeId, conversationId: '' }))
      .toEqual({ ok: false, error: 'Choose someone to send this to.' });
    expect(isShareIntakeSent(adapter, intakeId)).toBe(false);
  });

  it('never marks Sent from status alone: a dangling dm dest_ref reads not-sent', async () => {
    const adapter = seededDb();
    const intakeId = await stageText(adapter, 'dm-ghost');
    const ghost: ShareDmSend = async () => ({ ok: true, messageId: 'dm_ghost' });
    const result = await routeStagedShareToDm(adapter, { get: () => null }, ghost, { intakeId, conversationId: 'c' });
    expect(result.ok).toBe(true);
    // Routed status set, but no dm_messages row with that id: not sent.
    expect(isShareIntakeSent(adapter, intakeId)).toBe(false);
  });
});
