import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { generateDeviceIdentity } from '../../identity/device-identity';
import {
  createSealedShare,
  type SealedShare,
} from '../sealed-share';
import {
  fetchAndPinFromHosts,
  type RemoteNodeSource,
} from '../remote-store';
import {
  fetchFromStore,
  InMemoryNodeStore,
  type NodeStore,
} from '../store';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const missingHost: RemoteNodeSource = {
  async getManifest() {
    return null;
  },
  async getBlock() {
    return null;
  },
};

interface FetchCase {
  hosts: RemoteNodeSource[];
  store: NodeStore;
  contentId: string;
  linkKey: Uint8Array;
  expectedAuthor?: string;
}

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

function publish(text: string) {
  const identity = generateDeviceIdentity('Function Gate Author');
  const { share, linkKey } = createSealedShare(encoder.encode(text), {
    name: 'function-gate.txt',
    identity,
    chunkSize: 16,
  });
  return { share, linkKey, expectedAuthor: identity.publicKey };
}

function missingHostsCase(size: number): FetchCase {
  return {
    hosts: Array.from({ length: size }, () => missingHost),
    store: new InMemoryNodeStore(),
    contentId: `missing-${size}`,
    linkKey: new Uint8Array(32),
  };
}

describe('fetchAndPinFromHosts function quality gate', () => {
  it('matches contract behavior for known cases', async () => {
    await expect(fetchAndPinFromHosts(
      [],
      new InMemoryNodeStore(),
      'missing',
      new Uint8Array(32),
    )).resolves.toEqual({ ok: false, reason: 'no-hosts' });

    const { share, linkKey, expectedAuthor } = publish('verified remote payload');
    const localStore = new InMemoryNodeStore();
    const result = await fetchAndPinFromHosts(
      [sourceFromShare(share)],
      localStore,
      share.manifest.contentId,
      linkKey,
      { expectedAuthor },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pinned).toBe(true);
      expect(decoder.decode(result.content)).toBe('verified remote payload');
    }

    const local = await fetchFromStore(localStore, share.manifest.contentId, linkKey);
    expect(local.ok).toBe(true);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'fetchAndPinFromHosts fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => missingHostsCase(randomInt(rng, 0, 32)),
      assertCase: async (input) => {
        const result = await fetchAndPinFromHosts(
          input.hosts,
          input.store,
          input.contentId,
          input.linkKey,
          input.expectedAuthor ? { expectedAuthor: input.expectedAuthor } : undefined,
        );
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(['no-hosts', 'content-unavailable']).toContain(result.reason);
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'fetchAndPinFromHosts',
      sizes: [500, 1000, 2000],
      expected: 'linear',
      sampleRuns: 5,
      maxRatios: [4.5, 4.5],
      setup: missingHostsCase,
      run: async (input) => {
        for (let index = 0; index < 10; index += 1) {
          await fetchAndPinFromHosts(input.hosts, input.store, input.contentId, input.linkKey);
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'fetchAndPinFromHosts',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => missingHostsCase(1000),
      run: async (input) => {
        await fetchAndPinFromHosts(input.hosts, input.store, input.contentId, input.linkKey);
      },
    });
  });
});
