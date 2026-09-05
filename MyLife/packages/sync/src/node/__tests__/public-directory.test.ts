/**
 * public-directory: the PUBLIC twin of host-registry. These tests drive
 * announce/browse/search/host-lookup against a STUB WebSocket (no relay process)
 * that serves the relay's opaque, multi-announcer ann/lk verbs verbatim, so they
 * prove: the HKDF rid derivation (category + search namespaces), the
 * announce -> browse/search round trip, fail-closed DROPPING of a forged
 * (bad-signature / tampered) record, AUTHENTICATED bucket placement (a real signed
 * pub misfiled under the wrong category rid or an unrelated term rid is dropped),
 * killed-genesis drop, empty-term short-circuit, search dedupe across matching
 * terms, and the REAL distinct serving-host count behind `announcingHosts` (never
 * fabricated).
 */

import { describe, it, expect } from 'vitest';
import {
  announcePublication,
  browsePublications,
  searchPublications,
  lookupPublicationHosts,
  deriveCategoryRid,
  deriveSearchRid,
} from '../public-directory';
import { announceHeldContent } from '../host-registry';
import { sha512Hex } from '../hkdf';
import { generateDeviceIdentity } from '../../identity/device-identity';
import { extractSigningPrivateKeyHex, signMessage } from '../../identity/device-identity';
import { bytesToHex } from '../../encryption/keys';
import {
  createPublication,
  verifyPublication,
  type CreatePublicationOptions,
  type PublicationDescriptor,
  type SignedPublicationDescriptor,
} from '../../protocol/publication';

const enc = new TextEncoder();

/**
 * A stub relay-in-a-WebSocket: it serves the ann/lk verbs from an in-memory
 * registry (rid -> announcer -> rec), so the public-directory primitives AND the
 * host-registry primitives (same verbs, different rids) run a full round trip
 * with no server.
 */
function stubRelay() {
  const registry = new Map<string, Map<string, string>>();
  let seq = 0;

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
        slots.set(`announcer-${seq++}`, frame.rec);
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

  /** Inject a raw record under a rid (to simulate a hostile/garbage announcer). */
  function inject(rid: string, rec: string) {
    const slots = registry.get(rid) ?? new Map<string, string>();
    slots.set(`raw-${seq++}`, rec);
    registry.set(rid, slots);
  }

  return { WebSocket: StubWebSocket as unknown as new (url: string) => unknown, inject };
}

function makePublication(overrides: Partial<CreatePublicationOptions> = {}): SignedPublicationDescriptor {
  const owner = generateDeviceIdentity('Owner');
  return createPublication(owner, {
    kind: 'community',
    communityId: 'community-1',
    title: 'Rust Programming Tips',
    description: 'A place for systems programming',
    category: 'technology',
    contentId: 'content-pub-1',
    publicKeyHex: 'aa'.repeat(16),
    ...overrides,
  });
}

/**
 * Replicates the publication.ts canonical signing layout to mint a VALID,
 * owner-signed genesis with status:'killed' (there is no public-API path to a
 * killed genesis), so verifyPublication yields the 'killed' verdict (not
 * 'invalid'). Used to prove the directory drops a genuinely killed publication.
 */
function canonical(d: PublicationDescriptor, idOverride?: string): Uint8Array {
  return enc.encode(JSON.stringify([
    'meerkat-publication-v1', d.version, idOverride ?? d.publicationId, d.kind,
    d.communityId, d.channelId, d.postId, d.title, d.description, d.category,
    d.ownerDeviceId, d.contentId, d.publicKeyHex, [...d.hostUrls], d.revision,
    d.previousHash, d.status, d.joinPolicy, d.createdAt, d.updatedAt,
  ]));
}

function signKilledGenesis(): SignedPublicationDescriptor {
  const owner = generateDeviceIdentity('Owner');
  const now = '2026-06-28T00:00:00.000Z';
  const descriptor: PublicationDescriptor = {
    version: 1,
    publicationId: '',
    kind: 'community',
    communityId: 'community-1',
    channelId: null,
    postId: null,
    title: 'Killed Pub',
    description: 'gone',
    category: 'technology',
    ownerDeviceId: owner.publicKey,
    contentId: 'content-killed',
    publicKeyHex: 'bb'.repeat(16),
    hostUrls: [],
    revision: 1,
    previousHash: null,
    status: 'killed',
    joinPolicy: 'request',
    createdAt: now,
    updatedAt: now,
  };
  descriptor.publicationId = sha512Hex(canonical(descriptor, '')).slice(0, 32);
  const signature = bytesToHex(signMessage(extractSigningPrivateKeyHex(owner.privateKeyRef), canonical(descriptor)));
  return { descriptor, signature };
}

const URL = 'ws://relay.test';

describe('deriveCategoryRid', () => {
  it('is stable for a category and is 64 lowercase hex', () => {
    expect(deriveCategoryRid('technology')).toBe(deriveCategoryRid('technology'));
    expect(deriveCategoryRid('technology')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs across distinct categories', () => {
    expect(deriveCategoryRid('technology')).not.toBe(deriveCategoryRid('gaming'));
  });
});

describe('deriveSearchRid', () => {
  it('normalizes case and surrounding whitespace and is 64 hex', () => {
    expect(deriveSearchRid('Rust')).toBe(deriveSearchRid('  rust '));
    expect(deriveSearchRid('rust')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs across terms and never collides with a same-string category rid', () => {
    expect(deriveSearchRid('rust')).not.toBe(deriveSearchRid('python'));
    expect(deriveSearchRid('technology')).not.toBe(deriveCategoryRid('technology'));
  });
});

describe('Unicode-aware discovery tokenization (Plan 19 FF4)', () => {
  it('derives the same search rid for NFKC composed and decomposed forms', () => {
    // "cafe" + combining acute (U+0301) must fold to the same rid as the
    // precomposed "café" (U+00E9), so an announce and a query agree.
    const composed = String.fromCharCode(0x63, 0x61, 0x66, 0xe9); // caf + precomposed é
    const decomposed = 'cafe' + String.fromCharCode(0x301); // cafe + combining acute
    expect(composed).not.toBe(decomposed); // genuinely different code points
    expect(deriveSearchRid(composed)).toBe(deriveSearchRid(decomposed));
  });

  it('round-trips an accented-Latin title through announce -> search (no longer drops the accent)', async () => {
    const relay = stubRelay();
    const signed = makePublication({
      title: 'Café Société',
      description: 'un lieu public',
      communityId: 'c-accent',
      contentId: 'cid-accent',
    });
    await announcePublication({ url: URL, signed, webSocketImpl: relay.WebSocket as never });
    const hits = await searchPublications({ url: URL, terms: ['café'], webSocketImpl: relay.WebSocket as never });
    expect(hits.map((h) => h.descriptor.publicationId)).toContain(signed.descriptor.publicationId);
  });

  it('round-trips a Cyrillic title through announce -> search', async () => {
    const relay = stubRelay();
    const signed = makePublication({
      title: 'Москва Велоклуб',
      description: 'городское сообщество',
      communityId: 'c-cyr',
      contentId: 'cid-cyr',
    });
    await announcePublication({ url: URL, signed, webSocketImpl: relay.WebSocket as never });
    const hits = await searchPublications({ url: URL, terms: ['москва'], webSocketImpl: relay.WebSocket as never });
    expect(hits.map((h) => h.descriptor.publicationId)).toContain(signed.descriptor.publicationId);
  });

  it('round-trips a CJK title through announce -> search (single/double ideographs survive)', async () => {
    const relay = stubRelay();
    const signed = makePublication({
      title: '東京自転車クラブ',
      description: '公開コミュニティ',
      communityId: 'c-cjk',
      contentId: 'cid-cjk',
    });
    await announcePublication({ url: URL, signed, webSocketImpl: relay.WebSocket as never });
    const hits = await searchPublications({ url: URL, terms: ['東京自転車'], webSocketImpl: relay.WebSocket as never });
    expect(hits.map((h) => h.descriptor.publicationId)).toContain(signed.descriptor.publicationId);
  });
});

describe('announce -> browse round trip', () => {
  it('returns the announced publication, verified, with honest zeros for P2 fields', async () => {
    const relay = stubRelay();
    const signed = makePublication();
    await announcePublication({ url: URL, signed, webSocketImpl: relay.WebSocket as never });

    const entries = await browsePublications({ url: URL, category: 'technology', webSocketImpl: relay.WebSocket as never });
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry!.verified).toBe(true);
    expect(entry!.descriptor.publicationId).toBe(signed.descriptor.publicationId);
    expect(entry!.descriptor.title).toBe('Rust Programming Tips');
    expect(entry!.announcingHosts).toBe(0); // no held content announced yet
    expect(entry!.eventCount).toBe(0);
    expect(entry!.latestWall).toBe('');
    expect(entry!.sourceHost).toBe(URL);
  });

  it('returns nothing for a different category', async () => {
    const relay = stubRelay();
    await announcePublication({ url: URL, signed: makePublication(), webSocketImpl: relay.WebSocket as never });
    const entries = await browsePublications({ url: URL, category: 'gaming', webSocketImpl: relay.WebSocket as never });
    expect(entries).toEqual([]);
  });
});

describe('announce -> search round trip', () => {
  it('finds the publication by a normalized title term', async () => {
    const relay = stubRelay();
    const signed = makePublication();
    await announcePublication({ url: URL, signed, webSocketImpl: relay.WebSocket as never });
    const entries = await searchPublications({ url: URL, terms: ['RUST'], webSocketImpl: relay.WebSocket as never });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.descriptor.publicationId).toBe(signed.descriptor.publicationId);
  });

  it('dedupes a publication matched by multiple terms', async () => {
    const relay = stubRelay();
    const signed = makePublication();
    await announcePublication({ url: URL, signed, webSocketImpl: relay.WebSocket as never });
    const entries = await searchPublications({ url: URL, terms: ['rust', 'programming'], webSocketImpl: relay.WebSocket as never });
    expect(entries).toHaveLength(1);
  });

  it('returns [] for empty / whitespace / punctuation-only terms WITHOUT any relay lookup', async () => {
    class ThrowingWebSocket {
      constructor() {
        throw new Error('searchPublications must not open a socket for empty terms');
      }
    }
    const entries = await searchPublications({
      url: URL,
      terms: ['', '   ', '!!', 'a', 'to'],
      webSocketImpl: ThrowingWebSocket as never,
    });
    expect(entries).toEqual([]);
  });
});

describe('forged / garbage records are dropped fail-closed', () => {
  it('drops a tampered-descriptor record and non-JSON garbage from browse results', async () => {
    const relay = stubRelay();
    const signed = makePublication();
    await announcePublication({ url: URL, signed, webSocketImpl: relay.WebSocket as never });

    const categoryRid = deriveCategoryRid('technology');
    // Tampered after signing: the recomputed content-addressed id no longer
    // matches, and the owner signature no longer verifies -> 'invalid' -> dropped.
    const forged: SignedPublicationDescriptor = {
      descriptor: { ...signed.descriptor, title: 'Tampered Title' },
      signature: signed.signature,
    };
    relay.inject(categoryRid, JSON.stringify(forged));
    // Pure garbage and a wrong-shape object: both must be skipped, never thrown on.
    relay.inject(categoryRid, 'not-json-at-all{{{');
    relay.inject(categoryRid, JSON.stringify({ nope: true }));

    const entries = await browsePublications({ url: URL, category: 'technology', webSocketImpl: relay.WebSocket as never });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.descriptor.title).toBe('Rust Programming Tips');
    expect(entries.every((e) => e.verified)).toBe(true);
  });

  it('refuses to announce an unverifiable descriptor', async () => {
    const relay = stubRelay();
    const signed = makePublication();
    const forged: SignedPublicationDescriptor = {
      descriptor: { ...signed.descriptor, title: 'X' },
      signature: signed.signature,
    };
    await expect(
      announcePublication({ url: URL, signed: forged, webSocketImpl: relay.WebSocket as never }),
    ).rejects.toThrow();
  });

  it('drops a valid owner-signed but KILLED genesis from browse results', async () => {
    const relay = stubRelay();
    const killed = signKilledGenesis();
    // Sanity: this is genuinely a 'killed' verdict, not merely 'invalid'.
    expect(verifyPublication(killed)).toBe('killed');
    relay.inject(deriveCategoryRid('technology'), JSON.stringify(killed));
    const entries = await browsePublications({ url: URL, category: 'technology', webSocketImpl: relay.WebSocket as never });
    expect(entries).toEqual([]);
  });
});

describe('authenticated bucket placement (anti-spam)', () => {
  it('drops a REAL signed pub misfiled under the wrong category rid (browse)', async () => {
    const relay = stubRelay();
    const signed = makePublication(); // its true category is 'technology'
    // A spammer re-announces the real, validly-signed tech pub under the gaming rid.
    relay.inject(deriveCategoryRid('gaming'), JSON.stringify(signed));
    // The verdict is 'ok' (signature attests contents), but placement is wrong.
    expect(verifyPublication(signed)).toBe('ok');
    const entries = await browsePublications({ url: URL, category: 'gaming', webSocketImpl: relay.WebSocket as never });
    expect(entries).toEqual([]);
  });

  it('drops a REAL signed pub stuffed under a term rid for a word not in its title/description (search)', async () => {
    const relay = stubRelay();
    const signed = makePublication(); // title/desc do not contain 'minecraft'
    // A spammer files the real pub under a popular but unrelated search term.
    relay.inject(deriveSearchRid('minecraft'), JSON.stringify(signed));
    const entries = await searchPublications({ url: URL, terms: ['minecraft'], webSocketImpl: relay.WebSocket as never });
    expect(entries).toEqual([]);
  });
});

describe('lookupPublicationHosts (real serving-host count)', () => {
  it('dedupes repeated announcements of the same host', async () => {
    const relay = stubRelay();
    const contentId = 'content-pub-1';
    await announceHeldContent({ url: URL, contentId, hostUrl: 'https://seed-a.example', webSocketImpl: relay.WebSocket as never });
    await announceHeldContent({ url: URL, contentId, hostUrl: 'https://seed-a.example/', webSocketImpl: relay.WebSocket as never });
    const hosts = await lookupPublicationHosts({ url: URL, contentId, webSocketImpl: relay.WebSocket as never });
    expect(hosts).toEqual(['https://seed-a.example']);
  });

  it('announcingHosts reflects the real distinct serving-host count', async () => {
    const relay = stubRelay();
    const signed = makePublication();
    await announcePublication({ url: URL, signed, webSocketImpl: relay.WebSocket as never });
    await announceHeldContent({ url: URL, contentId: signed.descriptor.contentId, hostUrl: 'https://seed-a.example', webSocketImpl: relay.WebSocket as never });
    await announceHeldContent({ url: URL, contentId: signed.descriptor.contentId, hostUrl: 'https://seed-b.example', webSocketImpl: relay.WebSocket as never });

    const entries = await browsePublications({ url: URL, category: 'technology', webSocketImpl: relay.WebSocket as never });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.announcingHosts).toBe(2);
  });
});
