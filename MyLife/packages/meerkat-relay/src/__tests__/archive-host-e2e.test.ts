/**
 * Plan 19 P9.2 -- durable public archive, host moderation + dedupe + takedown,
 * end-to-end with REAL bytes (no in-memory simulation passing as transport, TC-8).
 *
 * Composes the real pieces:
 *   - a REAL public snapshot (buildPublicSnapshot) -> content-addressed pieces;
 *   - a REAL seeder piece store (InMemorySeederPieceStore) -> the durable pin;
 *   - the host ArchiveModerationQueue -> the scan-hook gate;
 *   - a LIVE public-directory-node (startPublicDirectoryNode over real ws) -> the
 *     announce / browse discovery a SECOND device reaches.
 *
 * Acceptance proven:
 *   - a durable-pin candidate enters pending_review; a clean scan -> approved ->
 *     announced -> discoverable on a second device + the host serves the real bytes;
 *   - a flagged scan -> NOT announced (browse empty) + NOT served (TC-10);
 *   - DEDUPE: two publications referencing one contentId -> ONE physically stored
 *     copy, asserted against the REAL store byte count (TC-11);
 *   - owner takedown -> un-pinned + dropped from the live directory on the second
 *     device within one refresh (AC-12, NC-6).
 *
 * The scan is the seam: a deterministic result is INJECTED here; the at-scale AV /
 * abuse-hash scanner is Tier-D ops. Nothing is served or announced before a real
 * clean result -- never a fabricated "clean".
 */

import { afterEach, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import {
  buildPublicSnapshot,
  bytesToHex,
  createPublication,
  unpublish,
  announcePublication,
  browsePublications,
  type ContentManifest,
  type DeviceIdentity,
  type SignedPublicationDescriptor,
  generateDeviceIdentity,
  createChannelMessage,
} from '@mylife/sync';
import { InMemorySeederPieceStore } from '../seeder-node';
import { ArchiveModerationQueue, type ArchiveScanResult } from '../archive-moderation';
import {
  PublicDirectoryNode,
  startPublicDirectoryNode,
  type PublicDirectoryNodeServer,
} from '../index';

const WS = WebSocket as unknown as new (url: string) => unknown;
const COMMUNITY = 'cm_archive';
const CHANNEL = 'general';
const CATEGORY = 'technology' as const;
const NOW = '2026-06-30T00:00:00.000Z';

let directory: PublicDirectoryNodeServer | null = null;
afterEach(async () => {
  if (directory) { await directory.close(); directory = null; }
});

interface ArchiveFixture {
  owner: DeviceIdentity;
  signed: SignedPublicationDescriptor;
  publicationId: string;
  contentId: string;
  manifest: ContentManifest;
  pieces: Uint8Array[];
}

async function buildArchiveFixture(owner: DeviceIdentity, title: string): Promise<ArchiveFixture> {
  const publicKey = new Uint8Array(randomBytes(32));
  const events = [
    createChannelMessage(owner, { communityId: COMMUNITY, channelId: CHANNEL, body: `${title} one`, hlc: { wall: '2026-06-28T00:00:10.000Z', counter: 0 } }),
    createChannelMessage(owner, { communityId: COMMUNITY, channelId: CHANNEL, body: `${title} two`, hlc: { wall: '2026-06-28T00:00:11.000Z', counter: 0 } }),
  ];
  const buildStore = new InMemorySeederPieceStore();
  const record = await buildPublicSnapshot({
    identity: owner,
    publicationId: 'pending',
    communityId: COMMUNITY,
    channelId: CHANNEL,
    events,
    publicKey,
    pieceStore: buildStore,
    now: NOW,
  });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) {
    pieces.push(buildStore.get(record.infoHash, i) as Uint8Array);
  }
  const signed = createPublication(owner, {
    kind: 'channel',
    communityId: COMMUNITY,
    channelId: CHANNEL,
    title,
    description: 'A durable public archive channel.',
    category: CATEGORY,
    contentId: record.infoHash,
    publicKeyHex: bytesToHex(publicKey),
    hostUrls: ['https://host.example'],
    now: NOW,
  });
  return { owner, signed, publicationId: signed.descriptor.publicationId, contentId: record.infoHash, manifest, pieces };
}

/**
 * The host: a real seeder store + the moderation queue + the live directory. Pin
 * puts the real bytes; serve + announce are gated on a real clean scan.
 */
class ArchiveHost {
  readonly store = new InMemorySeederPieceStore();
  readonly queue = new ArchiveModerationQueue();
  constructor(private readonly directoryUrl: string) {}

  /** Durable pin: store the real pieces + enter the moderation queue (pending). */
  async pin(fx: ArchiveFixture): Promise<void> {
    for (let i = 0; i < fx.pieces.length; i += 1) {
      await this.store.put(fx.contentId, i, fx.pieces[i]!);
    }
    this.queue.submit({ publicationId: fx.publicationId, contentId: fx.contentId });
  }

  /** Run the real scan hook; on clean -> announce to the live directory; else un-pin. */
  async scanAndPublish(fx: ArchiveFixture, result: ArchiveScanResult): Promise<void> {
    await this.queue.scan(fx.publicationId, () => result);
    if (this.queue.isAnnounceable(fx.publicationId)) {
      await announcePublication({ url: this.directoryUrl, signed: fx.signed, webSocketImpl: WS as never });
    } else {
      // Flagged: never served. Un-pin the bytes (no other publication holds this content here).
      await this.store.removeContent(fx.contentId);
    }
  }

  /** Open serve, gated on approval (TC-10): null unless a real clean scan approved it. */
  async serve(publicationId: string, contentId: string, index: number): Promise<Uint8Array | null> {
    if (!this.queue.isServeable(publicationId)) return null;
    return this.store.get(contentId, index);
  }

  async usedBytes(): Promise<number> {
    return this.store.sizeBytes();
  }
}

async function startDirectory(): Promise<string> {
  const node = new PublicDirectoryNode({ now: () => Date.parse(NOW) });
  directory = await startPublicDirectoryNode({ node, host: '127.0.0.1' });
  return directory.url;
}

describe('Plan 19 P9.2: durable archive moderation + dedupe + takedown (REAL bytes)', () => {
  it('a clean scan approves, announces, and serves; a second device discovers + pulls real bytes', async () => {
    const url = await startDirectory();
    const host = new ArchiveHost(url);
    const owner = generateDeviceIdentity('Owner');
    const fx = await buildArchiveFixture(owner, 'Public Archive Clean');

    await host.pin(fx);
    // Pending review: not yet serveable, not yet discoverable.
    expect(host.queue.state(fx.publicationId)!.state).toBe('pending');
    expect(await host.serve(fx.publicationId, fx.contentId, 0)).toBeNull();
    expect(await browsePublications({ url, category: CATEGORY, webSocketImpl: WS as never })).toHaveLength(0);

    await host.scanAndPublish(fx, 'clean');

    // Approved -> the host serves the REAL bytes...
    const piece0 = await host.serve(fx.publicationId, fx.contentId, 0);
    expect(piece0).not.toBeNull();
    expect(Array.from(piece0!)).toEqual(Array.from(fx.pieces[0]!));
    // ...and a SECOND device discovers it over the live directory.
    const found = await browsePublications({ url, category: CATEGORY, webSocketImpl: WS as never });
    expect(found.map((e) => e.descriptor.publicationId)).toEqual([fx.publicationId]);
    expect(found[0]!.verified).toBe(true);
  });

  it('a flagged scan is NOT announced and NOT served (TC-10)', async () => {
    for (const result of ['malware', 'abuse_hash_match', 'flagged'] as ArchiveScanResult[]) {
      const url = await startDirectory();
      const host = new ArchiveHost(url);
      const fx = await buildArchiveFixture(generateDeviceIdentity('Owner'), `Flagged ${result}`);
      await host.pin(fx);
      await host.scanAndPublish(fx, result);

      // Never served, never discovered, and the bytes were un-pinned.
      expect(host.queue.state(fx.publicationId)!.state).toBe('rejected');
      expect(await host.serve(fx.publicationId, fx.contentId, 0)).toBeNull();
      expect(await host.usedBytes()).toBe(0);
      expect(await browsePublications({ url, category: CATEGORY, webSocketImpl: WS as never })).toHaveLength(0);
      await directory!.close();
      directory = null;
    }
  });

  it('dedupes by contentId: two publications of one content -> ONE stored copy (real bytes, TC-11)', async () => {
    const url = await startDirectory();
    const host = new ArchiveHost(url);
    const owner = generateDeviceIdentity('Owner');
    const fx1 = await buildArchiveFixture(owner, 'Dedupe A');

    // A second publication that references the SAME content (same pieces + contentId).
    const fx2: ArchiveFixture = { ...fx1, publicationId: `${fx1.publicationId}-twin` };

    await host.pin(fx1);
    const afterOne = await host.usedBytes();
    expect(afterOne).toBeGreaterThan(0);

    await host.pin(fx2); // same contentId -> overwrites the same infoHash-keyed pieces
    const afterTwo = await host.usedBytes();
    // Structural dedupe: ONE physical copy. Byte count is unchanged, not doubled.
    expect(afterTwo).toBe(afterOne);
  });

  it('owner takedown un-pins + drops from the live directory on a second device within one refresh', async () => {
    const url = await startDirectory();
    const host = new ArchiveHost(url);
    const owner = generateDeviceIdentity('Owner');
    const fx = await buildArchiveFixture(owner, 'Takedown Me');

    await host.pin(fx);
    await host.scanAndPublish(fx, 'clean');
    expect((await browsePublications({ url, category: CATEGORY, webSocketImpl: WS as never })).length).toBe(1);

    // Owner takedown: sign an unpublish revision, announce it (routes to the
    // directory's recordUnpublish), and un-pin on the host + drop from the queue.
    const taken = unpublish(owner, fx.signed);
    await rawAnnounce(url, taken);
    host.queue.remove(fx.publicationId);
    await host.store.removeContent(fx.contentId);

    // Second device: next browse returns nothing; the host serves nothing.
    expect(await browsePublications({ url, category: CATEGORY, webSocketImpl: WS as never })).toHaveLength(0);
    expect(await host.serve(fx.publicationId, fx.contentId, 0)).toBeNull();
    expect(await host.usedBytes()).toBe(0);
  });
});

/** Send a raw `ann` frame carrying an unpublish/kill revision (the directory routes
 * revision>1 + unpublished/killed to recordUnpublish). Mirrors how a host announces
 * a takedown; the directory verifies it against the stored genesis. */
function rawAnnounce(url: string, signed: SignedPublicationDescriptor): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const done = (err?: Error): void => {
      try { ws.close(); } catch { /* noop */ }
      if (err) reject(err); else resolve();
    };
    ws.on('open', () => {
      ws.send(JSON.stringify({ t: 'ann', rid: '0'.repeat(64), rec: JSON.stringify(signed) }));
    });
    ws.on('message', () => done());
    ws.on('error', (e) => done(e as Error));
    setTimeout(() => done(), 1500);
  });
}
