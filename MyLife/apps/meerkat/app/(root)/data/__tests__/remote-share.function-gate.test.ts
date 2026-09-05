import { describe, expect, it } from 'vitest';
import {
  createSealedShare,
  generateDeviceIdentity,
  handleNodeStoreHttp,
  InMemoryNodeStore,
  pinShare,
  type NodeStore,
  type ShareLinkParts,
} from '@mylife/sync';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../../test/vitest/function-quality';
import {
  openRemoteShare,
  type OpenRemoteShareInput,
} from '../remote-share';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const dummyParts: ShareLinkParts = {
  contentId: 'missing',
  linkKey: new Uint8Array(32),
  authorPublicKey: 'author',
  name: 'missing.txt',
};

function storeFetch(store: NodeStore): typeof fetch {
  return (async (url: string | URL | Request) => {
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
  const identity = generateDeviceIdentity('Remote Function Gate Author');
  const { share, linkKey } = createSealedShare(encoder.encode(text), {
    name: 'remote-function-gate.txt',
    identity,
    chunkSize: 16,
  });
  const remoteStore = new InMemoryNodeStore();
  await pinShare(remoteStore, share);
  const parts: ShareLinkParts = {
    contentId: share.manifest.contentId,
    linkKey,
    authorPublicKey: identity.publicKey,
    name: share.manifest.name,
  };
  return { remoteStore, parts };
}

function invalidHostInput(size: number): OpenRemoteShareInput {
  return {
    store: new InMemoryNodeStore(),
    parts: dummyParts,
    hostText: Array.from({ length: size }, (_, index) => `ftp://seed-${index}.example`).join(' '),
  };
}

describe('openRemoteShare function quality gate', () => {
  it('matches contract behavior for known cases', async () => {
    await expect(openRemoteShare({
      store: new InMemoryNodeStore(),
      parts: dummyParts,
      hostText: 'ws://relay.example not-a-url',
    })).resolves.toEqual({ ok: false, reason: 'no-hosts' });

    const { remoteStore, parts } = await publishRemote('verified app fetch');
    const localStore = new InMemoryNodeStore();
    const result = await openRemoteShare({
      store: localStore,
      parts,
      hostText: 'https://host.example',
      fetchFn: storeFetch(remoteStore),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pinned).toBe(true);
      expect(decoder.decode(result.content)).toBe('verified app fetch');
    }
    await expect(localStore.getManifest(parts.contentId)).resolves.not.toBeNull();
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'openRemoteShare fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => invalidHostInput(randomInt(rng, 0, 64)),
      assertCase: async (input) => {
        const result = await openRemoteShare(input);
        expect(result).toEqual({ ok: false, reason: 'no-hosts' });
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'openRemoteShare',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: invalidHostInput,
      run: async (input) => {
        await openRemoteShare(input);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'openRemoteShare',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => invalidHostInput(250),
      run: async (input) => {
        await openRemoteShare(input);
      },
    });
  });
});
