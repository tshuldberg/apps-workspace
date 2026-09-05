import { describe, expect, it } from 'vitest';
import {
  announceHeldContent,
  buildShareLink,
  createSealedShare,
  generateDeviceIdentity,
  handleNodeStoreHttp,
  InMemoryNodeStore,
  parseShareLink,
  pinShare,
  type NodeStore,
} from '@mylife/sync';
import {
  discoverShareHosts,
  openRemoteShare,
  parseRemoteShareHosts,
  runOpenLinkFlow,
} from '../(root)/data/remote-share';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function storeFetch(store: NodeStore): typeof fetch {
  return (async (url: string) => {
    const response = await handleNodeStoreHttp(store, new URL(String(url)).pathname);
    if (!response) {
      return {
        ok: false,
        status: 404,
        statusText: 'not found',
        json: async () => ({}),
        text: async () => '',
      };
    }
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: 'OK',
      json: async () => JSON.parse(response.body),
      text: async () => response.body,
    };
  }) as unknown as typeof fetch;
}

async function publishRemote(text: string) {
  const identity = generateDeviceIdentity('Remote Author');
  const { share, linkKey } = createSealedShare(encoder.encode(text), {
    name: 'remote-note.txt',
    identity,
    chunkSize: 16,
  });
  const remoteStore = new InMemoryNodeStore();
  await pinShare(remoteStore, share);
  const link = buildShareLink({
    contentId: share.manifest.contentId,
    linkKey,
    authorPublicKey: identity.publicKey,
    name: share.manifest.name,
  });
  return { remoteStore, parts: parseShareLink(link)! };
}

describe('remote share opening', () => {
  it('parses HTTP host URLs and ignores unsupported transport hints', () => {
    expect(parseRemoteShareHosts([
      'https://host.example/',
      'http://backup.example/path/',
      'ws://relay.example',
      'https://host.example',
      'not-a-url',
    ].join('\n'))).toEqual([
      'https://host.example',
      'http://backup.example/path',
    ]);
  });

  it('fetches, verifies, and pins remote content into the local store', async () => {
    const { remoteStore, parts } = await publishRemote('hello from a remote seed');
    const localStore = new InMemoryNodeStore();

    const opened = await openRemoteShare({
      store: localStore,
      parts,
      hostText: 'https://host.example',
      fetchFn: storeFetch(remoteStore),
    });

    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.pinned).toBe(true);
      expect(opened.name).toBe('remote-note.txt');
      expect(decoder.decode(opened.content)).toBe('hello from a remote seed');
    }
    await expect(localStore.getManifest(parts.contentId)).resolves.not.toBeNull();
  });

  it('returns no-hosts without an HTTP host', async () => {
    const { remoteStore, parts } = await publishRemote('unreachable');
    const localStore = new InMemoryNodeStore();

    await expect(openRemoteShare({
      store: localStore,
      parts,
      hostText: 'ws://relay.example',
      fetchFn: storeFetch(remoteStore),
    })).resolves.toEqual({ ok: false, reason: 'no-hosts' });
  });
});

/**
 * A stub relay-in-a-WebSocket serving the registry ann/lk verbs so the app's
 * discovery composition runs end to end without a relay process. `counters`
 * exposes how many sockets were constructed and how many ann/lk frames the relay
 * received, so a test can prove discovery happens exactly once per open.
 */
function stubRelayWebSocket() {
  const registry = new Map<string, Map<string, string>>();
  let seq = 0;
  const counters = { connects: 0, announces: 0, lookups: 0 };
  class StubWebSocket {
    readyState = 1;
    private handlers: Record<string, ((ev?: unknown) => void)[]> = {};
    constructor(_url: string) {
      counters.connects += 1;
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
        counters.announces += 1;
        const slots = registry.get(frame.rid) ?? new Map<string, string>();
        slots.set(`a-${seq++}`, frame.rec);
        registry.set(frame.rid, slots);
        setTimeout(() => this.emit('message', { data: JSON.stringify({ t: 'annok', rid: frame.rid }) }), 0);
      } else if (frame.t === 'lk' && frame.rid) {
        counters.lookups += 1;
        const recs = [...(registry.get(frame.rid)?.values() ?? [])];
        setTimeout(() => this.emit('message', { data: JSON.stringify({ t: 'hosts', rid: frame.rid, recs }) }), 0);
      }
    }
    close() {
      /* no-op */
    }
  }
  return {
    ctor: StubWebSocket as unknown as new (url: string) => unknown,
    counters,
  };
}

/**
 * Mirror exactly what share.tsx does on open: run discovery ONCE for the
 * contentId, then thread that already-discovered list into openRemoteShare.
 * openRemoteShare itself never re-discovers, so the whole open performs a single
 * relay lookup. Returns both the open result and the discovered count the caller
 * would surface in the UI.
 */
async function openLikeScreen(args: {
  store: NodeStore;
  parts: ReturnType<typeof parseShareLink>;
  hostText: string;
  relayUrl?: string;
  webSocketImpl?: new (url: string) => unknown;
  fetchFn?: typeof fetch;
}) {
  const parts = args.parts!;
  const discovered = args.relayUrl
    ? await discoverShareHosts({
      relayUrl: args.relayUrl,
      contentId: parts.contentId,
      webSocketImpl: args.webSocketImpl as never,
    })
    : [];
  const result = await openRemoteShare({
    store: args.store,
    parts,
    hostText: args.hostText,
    discoveredHosts: discovered,
    fetchFn: args.fetchFn,
  });
  return { result, discovered };
}

describe('share-link host discovery composition', () => {
  it('discoverShareHosts returns the announced host for a contentId', async () => {
    const { parts } = await publishRemote('discoverable');
    const { ctor } = stubRelayWebSocket();
    (globalThis as { WebSocket?: unknown }).WebSocket = ctor;
    try {
      await announceHeldContent({
        url: 'ws://relay.test',
        contentId: parts.contentId,
        hostUrl: 'https://seed.example',
        webSocketImpl: ctor as never,
      });
      const hosts = await discoverShareHosts({ relayUrl: 'ws://relay.test', contentId: parts.contentId });
      expect(hosts).toEqual(['https://seed.example']);
    } finally {
      delete (globalThis as { WebSocket?: unknown }).WebSocket;
    }
  });

  it('with relayUrl set, unions discovered + pasted hosts (deduped) with ONE lookup per open', async () => {
    const { remoteStore, parts } = await publishRemote('union content');
    const { ctor, counters } = stubRelayWebSocket();
    // The relay announces the SAME host the user also pastes, so the dedup must
    // collapse them: discovery does not double up the candidate list.
    await announceHeldContent({
      url: 'ws://relay.test',
      contentId: parts.contentId,
      hostUrl: 'https://host.example',
      webSocketImpl: ctor as never,
    });
    // From here, count only the OPEN's relay activity (one announce already ran).
    const baselineConnects = counters.connects;

    const localStore = new InMemoryNodeStore();
    const { result, discovered } = await openLikeScreen({
      store: localStore,
      parts,
      hostText: 'https://host.example',
      relayUrl: 'ws://relay.test',
      webSocketImpl: ctor,
      fetchFn: storeFetch(remoteStore),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pinned).toBe(true);
      expect(decoder.decode(result.content)).toBe('union content');
    }
    // The discovered count the UI shows equals the real recs the relay returned.
    expect(discovered).toEqual(['https://host.example']);
    // Discovery happened EXACTLY ONCE for this open: one new socket, one lk frame,
    // and no announce (the app never announces its own pins).
    expect(counters.connects - baselineConnects).toBe(1);
    expect(counters.lookups).toBe(1);
    expect(counters.announces).toBe(1); // only the seeder's setup announce
  });

  it('with relayUrl set but nothing announced, falls back to pasted host (still one lookup)', async () => {
    const { remoteStore, parts } = await publishRemote('paste fallback');
    const { ctor, counters } = stubRelayWebSocket();
    const localStore = new InMemoryNodeStore();
    const { result, discovered } = await openLikeScreen({
      store: localStore,
      parts,
      hostText: 'https://host.example',
      relayUrl: 'ws://relay.test', // relay set, but nobody announced this content
      webSocketImpl: ctor,
      fetchFn: storeFetch(remoteStore),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(decoder.decode(result.content)).toBe('paste fallback');
    expect(discovered).toEqual([]); // relay returned nothing
    expect(counters.lookups).toBe(1); // discovery still ran exactly once
  });

  it('with relayUrl UNSET, behaves exactly as today (pasted-only, no discovery)', async () => {
    const { remoteStore, parts } = await publishRemote('legacy path');
    const localStore = new InMemoryNodeStore();
    // No WebSocket global is set: if discovery ran it would throw. It must not run.
    const { result, discovered } = await openLikeScreen({
      store: localStore,
      parts,
      hostText: 'https://host.example',
      // relayUrl omitted -> openLikeScreen never calls discoverShareHosts.
      fetchFn: storeFetch(remoteStore),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(decoder.decode(result.content)).toBe('legacy path');
    expect(discovered).toEqual([]);

    // And a pasted-only miss is still no-hosts. openRemoteShare with no discovered
    // hosts touches no WebSocket at all.
    await expect(openRemoteShare({
      store: new InMemoryNodeStore(),
      parts,
      hostText: 'ws://relay.example',
      fetchFn: storeFetch(remoteStore),
    })).resolves.toEqual({ ok: false, reason: 'no-hosts' });
  });

  it('a relay that is down does not break the pasted-host path', async () => {
    const { remoteStore, parts } = await publishRemote('relay down');
    // A WebSocket impl that errors immediately simulates an unreachable relay.
    class FailingWebSocket {
      readyState = 1;
      private handlers: Record<string, ((ev?: unknown) => void)[]> = {};
      constructor(_url: string) {
        setTimeout(() => {
          for (const h of this.handlers.error ?? []) h();
        }, 0);
      }
      addEventListener(type: string, handler: (ev?: unknown) => void) {
        (this.handlers[type] ??= []).push(handler);
      }
      send() { /* never reached */ }
      close() { /* no-op */ }
    }
    const failing = FailingWebSocket as unknown as new (url: string) => unknown;
    const localStore = new InMemoryNodeStore();
    const { result, discovered } = await openLikeScreen({
      store: localStore,
      parts,
      hostText: 'https://host.example',
      relayUrl: 'ws://relay.down',
      webSocketImpl: failing,
      fetchFn: storeFetch(remoteStore),
    });
    // Discovery failed closed to [], so the open falls through to the pasted host.
    expect(discovered).toEqual([]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(decoder.decode(result.content)).toBe('relay down');
  });
});

describe('runOpenLinkFlow', () => {
  const parts = {
    contentId: 'c'.repeat(64),
    linkKey: new Uint8Array(32),
    authorPublicKey: 'a'.repeat(64),
    name: 'note.txt',
  };
  const bytes = encoder.encode('hello');
  const notPinned = { ok: false as const, reason: 'content-not-pinned' };

  it('returns a local hit without running discovery', async () => {
    let discoveryRan = false;
    const result = await runOpenLinkFlow({
      parts,
      pastedHostText: '',
      relayConfigured: true,
      openLocal: async () => ({ ok: true, content: bytes }),
      discover: async () => { discoveryRan = true; return []; },
      openRemote: async () => { throw new Error('unreachable'); },
    });
    expect(result).toMatchObject({ kind: 'ok', source: 'local', pinned: true, name: 'note.txt' });
    expect(discoveryRan).toBe(false);
  });

  it('surfaces a non-not-pinned local failure as an error', async () => {
    const result = await runOpenLinkFlow({
      parts,
      pastedHostText: '',
      relayConfigured: false,
      openLocal: async () => ({ ok: false, reason: 'bad-signature' }),
      discover: async () => [],
      openRemote: async () => { throw new Error('unreachable'); },
    });
    expect(result).toEqual({ kind: 'error', reason: 'bad-signature' });
  });

  it('is not-pinned when nothing is discovered and nothing was pasted', async () => {
    const result = await runOpenLinkFlow({
      parts,
      pastedHostText: '   ',
      relayConfigured: true,
      openLocal: async () => notPinned,
      discover: async () => [],
      openRemote: async () => { throw new Error('unreachable'); },
    });
    expect(result).toEqual({ kind: 'not-pinned' });
  });

  it('skips discovery when no relay is configured but still tries pasted hosts', async () => {
    let discoveryRan = false;
    const result = await runOpenLinkFlow({
      parts,
      pastedHostText: 'https://host.example',
      relayConfigured: false,
      openLocal: async () => notPinned,
      discover: async () => { discoveryRan = true; return ['https://relay-host.example']; },
      openRemote: async (_p, hostText, discovered) => {
        expect(hostText).toBe('https://host.example');
        expect(discovered).toEqual([]);
        return { ok: true, content: bytes, name: 'note.txt', pinned: true };
      },
    });
    expect(discoveryRan).toBe(false);
    expect(result).toMatchObject({ kind: 'ok', source: 'remote', pinned: true });
    // No discovery ran, so no candidate count is claimed.
    if (result.kind === 'ok') expect(result.discovered).toBe(0);
  });

  it('threads the ONE discovery result into the remote open and reports its real count', async () => {
    const result = await runOpenLinkFlow({
      parts,
      pastedHostText: '',
      relayConfigured: true,
      openLocal: async () => notPinned,
      discover: async () => ['https://h1.example', 'https://h2.example'],
      openRemote: async (_p, _hostText, discovered) => {
        expect(discovered).toEqual(['https://h1.example', 'https://h2.example']);
        return { ok: false, reason: 'all-hosts-failed' };
      },
    });
    expect(result).toEqual({ kind: 'error', reason: 'all-hosts-failed', discovered: 2 });
  });

  it('turns a thrown local open into an honest error result (never a rejection)', async () => {
    const result = await runOpenLinkFlow({
      parts,
      pastedHostText: '',
      relayConfigured: false,
      openLocal: async () => { throw new Error('block file missing'); },
      discover: async () => [],
      openRemote: async () => { throw new Error('unreachable'); },
    });
    expect(result).toEqual({ kind: 'error', reason: 'block file missing' });
  });

  it('turns a thrown remote open into an honest error result', async () => {
    const result = await runOpenLinkFlow({
      parts,
      pastedHostText: 'https://host.example',
      relayConfigured: false,
      openLocal: async () => notPinned,
      discover: async () => [],
      openRemote: async () => { throw 'boom'; },
    });
    expect(result).toEqual({ kind: 'error', reason: 'Could not open this link.' });
  });
});
