/**
 * Public, non-confidential, author-signed snapshots (Plan 19 P1).
 *
 * Confidentiality is intentionally ZERO: the seal key is derived from a NON-secret
 * published public key. Integrity + authenticity are FULL: importPublicSnapshot
 * verifies every piece hash, the snapshot signature, every event's author Ed25519
 * signature and content-id, and fails closed on ANY mismatch. The forgery test
 * proves a host that KNOWS the public key still cannot tamper an author-signed
 * event without detection.
 */

import { describe, expect, it } from 'vitest';
import { generateDeviceIdentity, extractSigningPrivateKeyHex } from '../identity/device-identity';
import { createChannelMessage, type ChannelMessageEvent } from '../protocol/channel-message';
import { buildChannelHistory } from '../protocol/channel-history';
import {
  buildPublicSnapshot,
  derivePublicSnapshotSealKey,
  importPublicSnapshot,
} from '../protocol/public-snapshot';
import type { SnapshotPieceStore } from '../protocol/community-snapshots';
import { buildCommunityCatalog, catalogPieceBytes } from '../torrent/community-catalog';
import { encrypt } from '../encryption/encrypt';

const PUBLICATION = 'pub-1';
const COMMUNITY = 'community-pub';
const CHANNEL = 'general';
const NOW = '2026-06-20T00:00:00.000Z';
// A NON-secret published "public key". Only used to derive the public seal key.
const PUBLIC_KEY = new Uint8Array(Array.from({ length: 32 }, (_, index) => (index * 5 + 9) & 0xff));
const OTHER_PUBLIC_KEY = new Uint8Array(Array.from({ length: 32 }, (_, index) => (index * 13 + 1) & 0xff));

class MapPieceStore implements SnapshotPieceStore {
  private readonly pieces = new Map<string, Uint8Array>();
  private key(infoHash: string, index: number): string { return `${infoHash}:${index}`; }
  put(infoHash: string, index: number, bytes: Uint8Array): void { this.pieces.set(this.key(infoHash, index), bytes); }
  get(infoHash: string, index: number): Uint8Array | null { return this.pieces.get(this.key(infoHash, index)) ?? null; }
  removeContent(infoHash: string): void {
    for (const k of [...this.pieces.keys()]) if (k.startsWith(`${infoHash}:`)) this.pieces.delete(k);
  }
}

function buildEvents(count = 3): ChannelMessageEvent[] {
  const author = generateDeviceIdentity('Author');
  return Array.from({ length: count }, (_, index) =>
    createChannelMessage(author, {
      communityId: COMMUNITY,
      channelId: CHANNEL,
      body: `post-${index}`,
      hlc: { wall: `2026-06-20T00:00:0${index}.000Z`, counter: 0 },
    }));
}

function parseManifest(record: { manifestJson: string }): import('../types').ContentManifest {
  return JSON.parse(record.manifestJson) as import('../types').ContentManifest;
}

describe('public snapshot build/import (Plan 19 P1)', () => {
  it('round-trips a build into an import with the same events', async () => {
    const identity = generateDeviceIdentity('Owner');
    const events = buildEvents(3);
    const store = new MapPieceStore();

    const record = await buildPublicSnapshot({
      identity,
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      events,
      publicKey: PUBLIC_KEY,
      pieceStore: store,
      now: NOW,
    });

    expect(record.publicationId).toBe(PUBLICATION);
    expect(record.eventCount).toBe(3);
    expect(record.totalBytes).toBeGreaterThan(0);
    expect(record.oversized).toBe(false);

    const imported = await importPublicSnapshot({
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifest: parseManifest(record),
      pieceStore: store,
      publicKey: PUBLIC_KEY,
    });

    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.snapshotId).toBe(record.snapshotId);
      expect(imported.events.map((e) => e.id)).toEqual(events.map((e) => e.id));
      expect(imported.newEvents.map((e) => e.id)).toEqual(events.map((e) => e.id));
    }
  });

  it('applies the sinceHlc warm-tail filter', async () => {
    const identity = generateDeviceIdentity('Owner');
    const events = buildEvents(3);
    const store = new MapPieceStore();

    const record = await buildPublicSnapshot({
      identity,
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      events,
      publicKey: PUBLIC_KEY,
      pieceStore: store,
      now: NOW,
    });

    const imported = await importPublicSnapshot({
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifest: parseManifest(record),
      pieceStore: store,
      publicKey: PUBLIC_KEY,
      sinceHlc: events[0]!.hlc,
    });

    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.events).toHaveLength(3);
      expect(imported.newEvents.map((e) => e.id)).toEqual([events[1]!.id, events[2]!.id]);
    }
  });

  it('fails closed when a stored piece is tampered', async () => {
    const identity = generateDeviceIdentity('Owner');
    const events = buildEvents(4);
    const store = new MapPieceStore();

    const record = await buildPublicSnapshot({
      identity,
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      events,
      publicKey: PUBLIC_KEY,
      pieceStore: store,
      webSeeds: [],
      now: NOW,
    });

    const manifest = parseManifest(record);
    const piece = store.get(record.infoHash, 0)!;
    const tampered = piece.slice();
    tampered[0] = tampered[0]! ^ 0xff;
    store.put(record.infoHash, 0, tampered);

    const imported = await importPublicSnapshot({
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifest,
      pieceStore: store,
      publicKey: PUBLIC_KEY,
    });

    expect(imported).toEqual({ ok: false, reason: 'bad_piece' });
  });

  it('fails closed when imported with the wrong public key', async () => {
    const identity = generateDeviceIdentity('Owner');
    const events = buildEvents(3);
    const store = new MapPieceStore();

    const record = await buildPublicSnapshot({
      identity,
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      events,
      publicKey: PUBLIC_KEY,
      pieceStore: store,
      now: NOW,
    });

    const imported = await importPublicSnapshot({
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifest: parseManifest(record),
      pieceStore: store,
      publicKey: OTHER_PUBLIC_KEY,
    });

    expect(imported).toEqual({ ok: false, reason: 'decrypt_failed' });
  });

  it('fails closed on a forged author signature even from a host that knows the public key', async () => {
    const events = buildEvents(2);
    const host = generateDeviceIdentity('Malicious Host');
    const owner = generateDeviceIdentity('Owner');
    const sealKey = derivePublicSnapshotSealKey(PUBLIC_KEY);

    // A valid public snapshot, sealed under the (NON-secret) public key.
    const built = buildChannelHistory({
      communityId: COMMUNITY,
      channelId: CHANNEL,
      workspaceId: COMMUNITY,
      epoch: 0,
      events,
      sealKey,
      signer: owner,
      createdAt: NOW,
    });

    // The host knows the public key, so it CAN re-seal. It tampers one event's
    // author signature, re-encrypts under the same public key, and re-signs only
    // the CATALOG (its own transport manifest). It cannot re-sign the snapshot.
    const forgedSnapshot = {
      ...built.snapshot,
      events: [
        { ...built.snapshot.events[0]!, signature: 'ab'.repeat(32) },
        built.snapshot.events[1]!,
      ],
    };
    const sealed = encrypt(new TextEncoder().encode(JSON.stringify(forgedSnapshot)), sealKey);
    const entryBytes = new Uint8Array(sealed.nonce.length + sealed.ciphertext.length);
    entryBytes.set(sealed.nonce, 0);
    entryBytes.set(sealed.ciphertext, sealed.nonce.length);

    const forgedCatalog = buildCommunityCatalog({
      communityName: 'Meerkat channel history',
      description: 'Encrypted channel history snapshot',
      entries: [{
        path: `history/${forgedSnapshot.snapshotId}.mkhist`,
        data: entryBytes,
        mimeType: 'application/vnd.mylife.meerkat-history',
      }],
      creatorPublicKey: host.publicKey,
      creatorDisplayName: host.displayName,
      creatorPrivateKey: extractSigningPrivateKeyHex(host.privateKeyRef),
    });
    const forgedPieces = forgedCatalog.manifest.pieces.map((_, index) => catalogPieceBytes(forgedCatalog, index));

    const store = new MapPieceStore();
    forgedPieces.forEach((piece, index) => store.put(forgedCatalog.manifest.infoHash, index, piece));

    const imported = await importPublicSnapshot({
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifest: forgedCatalog.manifest,
      pieceStore: store,
      publicKey: PUBLIC_KEY,
    });

    expect(imported.ok).toBe(false);
  });

  it('surfaces the oversize flag when a snapshot trips the cap', async () => {
    const identity = generateDeviceIdentity('Owner');
    const events = buildEvents(4);
    const store = new MapPieceStore();

    const record = await buildPublicSnapshot({
      identity,
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      events,
      publicKey: PUBLIC_KEY,
      pieceStore: store,
      maxSnapshotBytes: 1,
      now: NOW,
    });

    expect(record.oversized).toBe(true);
    // Still built + served in full: the import round-trip stays correct.
    const imported = await importPublicSnapshot({
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifest: parseManifest(record),
      pieceStore: store,
      publicKey: PUBLIC_KEY,
    });
    expect(imported.ok).toBe(true);
  });

  it('rejects empty events at build time', async () => {
    const identity = generateDeviceIdentity('Owner');
    await expect(buildPublicSnapshot({
      identity,
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      events: [],
      publicKey: PUBLIC_KEY,
      pieceStore: new MapPieceStore(),
      now: NOW,
    })).rejects.toThrow(/at least one event/);
  });

  it('fails closed when manifest.infoHash does not match expectedContentId', async () => {
    const identity = generateDeviceIdentity('Owner');
    const events = buildEvents(2);
    const store = new MapPieceStore();

    const record = await buildPublicSnapshot({
      identity,
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      events,
      publicKey: PUBLIC_KEY,
      pieceStore: store,
      now: NOW,
    });

    const imported = await importPublicSnapshot({
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifest: parseManifest(record),
      pieceStore: store,
      publicKey: PUBLIC_KEY,
      expectedContentId: 'not-the-owner-signed-content-id',
    });

    expect(imported).toEqual({ ok: false, reason: 'content_id_mismatch' });
  });

  it('rejects a self-signed substitute snapshot bound to the legit owner (content + author)', async () => {
    // The attacker knows the NON-secret public key, so it builds a fully valid,
    // self-signed snapshot under its OWN device identity and seals it with the same
    // derived key. Every INTERNAL check passes; the publication binding rejects it.
    const attacker = generateDeviceIdentity('Attacker');
    const legitOwner = generateDeviceIdentity('Legit Owner');
    const events = buildEvents(2);
    const store = new MapPieceStore();

    const attackerRecord = await buildPublicSnapshot({
      identity: attacker,
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      events,
      publicKey: PUBLIC_KEY,
      pieceStore: store,
      now: NOW,
    });
    const manifest = parseManifest(attackerRecord);

    // Bound to the legit owner's content id (which the attacker's infoHash is not).
    const boundByContent = await importPublicSnapshot({
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifest,
      pieceStore: store,
      publicKey: PUBLIC_KEY,
      expectedContentId: 'legit-owner-signed-content-id',
      expectedAuthor: legitOwner.publicKey,
    });
    expect(boundByContent).toEqual({ ok: false, reason: 'content_id_mismatch' });

    // Even if a malicious directory lists the attacker's own infoHash as the content
    // id, binding the signer to the legit owner still rejects the substitution.
    const boundByAuthor = await importPublicSnapshot({
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifest,
      pieceStore: store,
      publicKey: PUBLIC_KEY,
      expectedContentId: attackerRecord.infoHash,
      expectedAuthor: legitOwner.publicKey,
    });
    expect(boundByAuthor).toEqual({ ok: false, reason: 'author_mismatch' });
  });

  it('imports ok with correct expectedContentId and expectedAuthor', async () => {
    const owner = generateDeviceIdentity('Owner');
    const events = buildEvents(3);
    const store = new MapPieceStore();

    const record = await buildPublicSnapshot({
      identity: owner,
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      events,
      publicKey: PUBLIC_KEY,
      pieceStore: store,
      now: NOW,
    });

    const imported = await importPublicSnapshot({
      publicationId: PUBLICATION,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      manifest: parseManifest(record),
      pieceStore: store,
      publicKey: PUBLIC_KEY,
      expectedContentId: record.infoHash,
      expectedAuthor: owner.publicKey,
    });

    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.events.map((e) => e.id)).toEqual(events.map((e) => e.id));
    }
  });
});
