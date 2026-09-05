/**
 * host-registry: the contentId-aware crypto layer over the relay's opaque
 * registry verbs. These tests drive announce/lookup against a STUB WebSocket
 * (no relay process), so they prove the HKDF id derivation, the secretbox
 * record sealing/opening, fail-closed skipping of garbage/undecryptable/bad-url
 * records, and -- via fetchAndPinFromHosts -- that discovery cannot inject
 * content (a malicious announcer is skipped, never trusted).
 */

import { describe, it, expect } from 'vitest';
import naclUtil from 'tweetnacl-util';
import {
  announceHeldContent,
  deriveContentRegistryId,
  deriveContentRegistryKey,
  lookupContentHosts,
} from '../host-registry';
import { generateDeviceIdentity } from '../../identity/device-identity';
import { createSealedShare, type SealedShare } from '../sealed-share';
import { fetchAndPinFromHosts, type RemoteNodeSource } from '../remote-store';
import { InMemoryNodeStore } from '../store';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * A stub relay-in-a-WebSocket: it serves the ann/lk verbs from an in-memory
 * registry so the client primitives run their full round trip with no server.
 */
function stubRelay() {
  const registry = new Map<string, Map<string, string>>(); // rid -> announcerKey -> rec
  let announcerSeq = 0;

  class StubWebSocket {
    readyState = 1;
    private handlers: Record<string, ((ev?: unknown) => void)[]> = {};
    constructor(_url: string) {
      setTimeout(() => this.emit('open'), 0);
    }
    addEventListener(type: string, handler: (ev?: unknown) => void) {
      (this.handlers[type] ??= []).push(handler);
    }
    private emit(type: string, ev?: unknown) {
      for (const h of this.handlers[type] ?? []) h(ev);
    }
    send(data: string) {
      let frame: { t?: string; rid?: string; rec?: string };
      try {
        frame = JSON.parse(data);
      } catch {
        return;
      }
      if (frame.t === 'ann' && frame.rid && frame.rec) {
        const slots = registry.get(frame.rid) ?? new Map<string, string>();
        slots.set(`announcer-${announcerSeq++}`, frame.rec);
        registry.set(frame.rid, slots);
        setTimeout(() => this.emit('message', { data: JSON.stringify({ t: 'annok', rid: frame.rid }) }), 0);
      } else if (frame.t === 'lk' && frame.rid) {
        const recs = [...(registry.get(frame.rid)?.values() ?? [])];
        setTimeout(() => this.emit('message', { data: JSON.stringify({ t: 'hosts', rid: frame.rid, recs }) }), 0);
      }
    }
    close() {
      /* no-op */
    }
  }

  /** Inject a raw record under a contentId's rid (to simulate a hostile/garbage announcer). */
  function inject(contentId: string, rec: string) {
    const rid = deriveContentRegistryId(contentId);
    const slots = registry.get(rid) ?? new Map<string, string>();
    slots.set(`raw-${announcerSeq++}`, rec);
    registry.set(rid, slots);
  }

  return { WebSocket: StubWebSocket as unknown as new (url: string) => unknown, inject };
}

describe('deriveContentRegistryId', () => {
  it('is deterministic and 64 lowercase hex', () => {
    const a = deriveContentRegistryId('content-xyz');
    const b = deriveContentRegistryId('content-xyz');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs for different contentIds and is not the contentId', () => {
    const a = deriveContentRegistryId('content-1');
    const b = deriveContentRegistryId('content-2');
    expect(a).not.toBe(b);
    expect(a).not.toContain('content-1');
  });
});

describe('announce + lookup round trip', () => {
  it('announces a host url and resolves it back, sealed under the contentId key', async () => {
    const relay = stubRelay();
    const contentId = 'sealed-content-a';
    await announceHeldContent({
      url: 'ws://relay.test',
      contentId,
      hostUrl: 'https://seed.example/',
      webSocketImpl: relay.WebSocket as never,
    });

    const hosts = await lookupContentHosts({
      url: 'ws://relay.test',
      contentId,
      webSocketImpl: relay.WebSocket as never,
    });
    expect(hosts).toEqual(['https://seed.example']);
  });

  it('rejects announcing a non-http(s) host url before any network call', async () => {
    const relay = stubRelay();
    await expect(announceHeldContent({
      url: 'ws://relay.test',
      contentId: 'c',
      hostUrl: 'ftp://seed.example',
      webSocketImpl: relay.WebSocket as never,
    })).rejects.toThrow();
  });

  it('returns [] for a contentId nobody announced', async () => {
    const relay = stubRelay();
    const hosts = await lookupContentHosts({
      url: 'ws://relay.test',
      contentId: 'never-announced',
      webSocketImpl: relay.WebSocket as never,
    });
    expect(hosts).toEqual([]);
  });

  it('only the contentId-derived key can open the record (relay learns nothing)', async () => {
    const relay = stubRelay();
    const contentId = 'secret-content';
    await announceHeldContent({
      url: 'ws://relay.test',
      contentId,
      hostUrl: 'https://seed.example',
      webSocketImpl: relay.WebSocket as never,
    });
    // The WRONG contentId derives a different key, so its lookup decrypts nothing.
    const wrong = await lookupContentHosts({
      url: 'ws://relay.test',
      contentId: 'different-content', // same relay, different rid+key
      webSocketImpl: relay.WebSocket as never,
    });
    expect(wrong).toEqual([]);
  });
});

describe('lookupContentHosts fail-closed', () => {
  it('skips garbage, undecryptable, and non-http(s) records', async () => {
    const relay = stubRelay();
    const contentId = 'mixed-bag';
    // A legitimate sealed record from the real announce path.
    await announceHeldContent({
      url: 'ws://relay.test',
      contentId,
      hostUrl: 'https://good.example',
      webSocketImpl: relay.WebSocket as never,
    });
    // Garbage that is not even base64-decodable to a valid box.
    relay.inject(contentId, 'not-valid-base64-!!!');
    // A record sealed under the WRONG key (cannot be opened by the contentId key).
    const wrongKey = deriveContentRegistryKey('a-different-content');
    const nacl = (await import('tweetnacl')).default;
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const box = nacl.secretbox(encoder.encode(JSON.stringify({ hostUrl: 'https://evil.example' })), nonce, wrongKey);
    const blob = new Uint8Array(nonce.length + box.length);
    blob.set(nonce, 0);
    blob.set(box, nonce.length);
    relay.inject(contentId, naclUtil.encodeBase64(blob));
    // A record sealed under the RIGHT key but carrying a non-http(s) url.
    const rightKey = deriveContentRegistryKey(contentId);
    const nonce2 = nacl.randomBytes(nacl.secretbox.nonceLength);
    const box2 = nacl.secretbox(encoder.encode(JSON.stringify({ hostUrl: 'ftp://nope.example' })), nonce2, rightKey);
    const blob2 = new Uint8Array(nonce2.length + box2.length);
    blob2.set(nonce2, 0);
    blob2.set(box2, nonce2.length);
    relay.inject(contentId, naclUtil.encodeBase64(blob2));

    const hosts = await lookupContentHosts({
      url: 'ws://relay.test',
      contentId,
      webSocketImpl: relay.WebSocket as never,
    });
    // Only the legitimately sealed, valid http(s) url survives; the rest are skipped.
    expect(hosts).toEqual(['https://good.example']);
  });
});

// --- Trust composition: discovery only produces candidates; openSealedShare is
// still the sole trust boundary, so a malicious announcer cannot inject content.

function sourceFromShare(share: SealedShare): RemoteNodeSource {
  const blockById = new Map(share.sealedChunks.map((chunk) => [chunk.sealedId, chunk.payload]));
  return {
    async getManifest() {
      return {
        contentId: share.manifest.contentId,
        name: share.manifest.name,
        size: share.manifest.size,
        scope: share.manifest.scope,
        authorPublicKey: share.manifest.authorPublicKey,
        manifestSignature: share.manifestSignature,
        sealedChunkIds: share.sealedChunks.map((chunk) => chunk.sealedId),
        manifestJson: JSON.stringify(share.manifest),
        pinnedAt: '2026-06-14T00:00:00.000Z',
      };
    },
    async getBlock(sealedId) {
      return blockById.get(sealedId) ?? null;
    },
  };
}

describe('discovery trust composition', () => {
  it('a discovered host serving TAMPERED bytes is skipped fail-closed', async () => {
    const identity = generateDeviceIdentity('Author');
    const { share, linkKey } = createSealedShare(encoder.encode('genuine payload'), {
      name: 'note.txt',
      identity,
      chunkSize: 16,
    });
    // A hostile discovered host: it serves a corrupted first block.
    const honest = sourceFromShare(share);
    const tampered: RemoteNodeSource = {
      getManifest: honest.getManifest,
      async getBlock(sealedId) {
        const real = await honest.getBlock(sealedId);
        return real ? `${real}TAMPER` : null;
      },
    };

    const store = new InMemoryNodeStore();
    const result = await fetchAndPinFromHosts(
      [tampered], // the ONLY discovered host is malicious
      store,
      share.manifest.contentId,
      linkKey,
      { expectedAuthor: identity.publicKey },
    );
    expect(result.ok).toBe(false); // injection rejected, nothing pinned
    await expect(store.getManifest(share.manifest.contentId)).resolves.toBeNull();
  });

  it('a discovered host is rejected under the wrong expectedAuthor', async () => {
    const identity = generateDeviceIdentity('Author');
    const impostor = generateDeviceIdentity('Impostor');
    const { share, linkKey } = createSealedShare(encoder.encode('payload'), {
      name: 'note.txt',
      identity,
      chunkSize: 16,
    });
    const store = new InMemoryNodeStore();
    const result = await fetchAndPinFromHosts(
      [sourceFromShare(share)],
      store,
      share.manifest.contentId,
      linkKey,
      { expectedAuthor: impostor.publicKey }, // wrong author
    );
    expect(result.ok).toBe(false);
  });

  it('a genuine discovered host opens, verifies, and pins normally', async () => {
    const identity = generateDeviceIdentity('Author');
    const { share, linkKey } = createSealedShare(encoder.encode('genuine payload'), {
      name: 'note.txt',
      identity,
      chunkSize: 16,
    });
    const store = new InMemoryNodeStore();
    const result = await fetchAndPinFromHosts(
      [sourceFromShare(share)],
      store,
      share.manifest.contentId,
      linkKey,
      { expectedAuthor: identity.publicKey },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pinned).toBe(true);
      expect(decoder.decode(result.content)).toBe('genuine payload');
    }
  });
});
