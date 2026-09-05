/**
 * Plan 19 P3a FIX B: the OPEN publication registry + kill ledger survive a node
 * restart. A SECOND CommunityNode constructed over the SAME on-disk file stores
 * (FilePublicationStore + FileKillStore + FileSeederPieceStore) must:
 *   (a) reject a replayed OLDER-revision register with stale_revision (durable
 *       revision monotonicity, so an unpublish cannot be replay-resurrected), and
 *   (b) keep a killed publication 404 through a live durable-ledger lookup.
 *
 * Real temp dir, real Ed25519 identities + owner-signed publication chain + a real
 * authority-signed DescriptorKill. The "restart" is a fresh node over the same dirs.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';
import {
  buildPublicSnapshot,
  bytesToHex,
  createChannelMessage,
  createDescriptorKill,
  createPublication,
  generateDeviceIdentity,
  revisePublication,
  type ContentManifest,
  type DeviceIdentity,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import {
  CommunityNode,
  FileKillStore,
  FilePublicationStore,
  FileSeederPieceStore,
} from '../index';

const CHANNEL = 'general';
const COMMUNITY = 'durable-pub-community';
const NOW = '2026-06-16T00:00:00.000Z';

let tmp: string | null = null;
afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = null;
});

/** A fresh CommunityNode over the SAME on-disk file stores (models a restart). */
function nodeOver(base: string, authority?: string): CommunityNode {
  return new CommunityNode({
    now: () => Date.parse(NOW),
    pieceStore: new FileSeederPieceStore(join(base, 'pieces')),
    publicationStore: new FilePublicationStore(join(base, 'publications')),
    killStore: new FileKillStore(join(base, 'kills')),
    trustedKillAuthorityDeviceId: authority,
  });
}

interface Fixture {
  owner: DeviceIdentity;
  signed: SignedPublicationDescriptor; // rev 1
  rev2: SignedPublicationDescriptor;   // rev 2 (same contentId)
  manifest: ContentManifest;
  pieces: Uint8Array[];
  publicationId: string;
}

async function buildFixture(): Promise<Fixture> {
  const owner = generateDeviceIdentity('Publisher');
  const publicKey = new Uint8Array(randomBytes(32));
  const events = [
    createChannelMessage(owner, {
      communityId: COMMUNITY, channelId: CHANNEL, body: 'hello public',
      hlc: { wall: '2026-06-16T00:00:10.000Z', counter: 0 },
    }),
  ];
  const buildStore = new SnapStore();
  const record = await buildPublicSnapshot({
    identity: owner, publicationId: 'pending', communityId: COMMUNITY, channelId: CHANNEL,
    events, publicKey, pieceStore: buildStore, now: NOW,
  });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(buildStore.get(manifest.infoHash, i) as Uint8Array);

  const signed = createPublication(owner, {
    kind: 'channel', communityId: COMMUNITY, channelId: CHANNEL,
    title: 'Durable Channel', description: 'survives a restart', category: 'technology',
    contentId: record.infoHash, publicKeyHex: bytesToHex(publicKey), now: NOW,
  });
  // A chained rev 2 keeps the same contentId, so the same snapshot satisfies register.
  const rev2 = revisePublication(owner, signed, { title: 'Durable Channel v2' }, '2026-06-16T00:01:00.000Z');
  return { owner, signed, rev2, manifest, pieces, publicationId: signed.descriptor.publicationId };
}

function input(fx: Fixture, signed: SignedPublicationDescriptor) {
  return { descriptor: signed, snapshots: [{ channelId: CHANNEL, epoch: 0, manifest: fx.manifest, pieces: fx.pieces }] };
}

describe('Plan 19 P3a: durable publication registry + kill ledger survive a restart', () => {
  it('rejects a replayed older revision after a restart over the same file stores', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'mk-pub-'));
    const fx = await buildFixture();

    const node1 = nodeOver(tmp);
    expect((await node1.registerPublication(input(fx, fx.signed))).ok).toBe(true); // rev 1
    expect((await node1.registerPublication(input(fx, fx.rev2))).ok).toBe(true);   // rev 2 (durable)

    // Restart: a fresh node over the SAME dirs loads rev 2 as the stored revision.
    const node2 = nodeOver(tmp);
    const replay = await node2.registerPublication(input(fx, fx.signed));          // replay rev 1
    expect(replay).toEqual({ ok: false, status: 400, reason: 'stale_revision' });

    // The current (rev 2) publication still serves after the restart.
    const manifest = await node2.getPublicationManifest(fx.publicationId);
    expect(manifest?.descriptor.descriptor.revision).toBe(2);
  });

  it('keeps a killed publication 404 after a restart through the live kill ledger', async () => {
    tmp = mkdtempSync(join(tmpdir(), 'mk-pub-'));
    const fx = await buildFixture();
    const authority = generateDeviceIdentity('TrustAndSafety');

    const node1 = nodeOver(tmp, authority.publicKey);
    expect((await node1.registerPublication(input(fx, fx.signed))).ok).toBe(true);
    expect(await node1.getPublicationManifest(fx.publicationId)).not.toBeNull();

    const kill = createDescriptorKill(authority, COMMUNITY, 'policy', '2026-06-16T00:02:00.000Z');
    expect(await node1.recordPublicationKill(kill)).toBe(true);
    expect(await node1.getPublicationManifest(fx.publicationId)).toBeNull();

    // Restart: a fresh node over the SAME dirs reads the durable kill ledger live,
    // so the takedown does NOT silently revert.
    const node2 = nodeOver(tmp, authority.publicKey);
    expect(await node2.getPublicationManifest(fx.publicationId)).toBeNull();
  });
});
