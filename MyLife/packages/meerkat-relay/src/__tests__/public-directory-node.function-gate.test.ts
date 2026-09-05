import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../test/function-quality';
import {
  PublicDirectoryNode,
  type DirectoryHostAnnouncementStore,
} from '../public-directory-node';

function hostStore(liveRids: number): DirectoryHostAnnouncementStore {
  return {
    announceHost: () => ({ ok: true }),
    lookupHosts: () => [],
    countLiveHosts: () => new Map(),
    pruneExpiredHosts: () => undefined,
    stats: async () => ({ liveRids }),
  };
}

describe('PublicDirectoryNode.stats function quality gate', () => {
  it('awaits the host authority and returns bounded process-local counters with it', async () => {
    const node = new PublicDirectoryNode({ hostAnnouncementStore: hostStore(7) });
    await expect(node.stats()).resolves.toEqual({
      publications: 0,
      hostRids: 7,
      limiterTrackedClients: 0,
    });
  });

  it('passes deterministic authoritative-count fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'PublicDirectoryNode.stats fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng) => randomInt(rng, 0, 200_000),
      assertCase: async (liveRids) => {
        const result = await new PublicDirectoryNode({
          hostAnnouncementStore: hostStore(liveRids),
        }).stats();
        expect(result.hostRids).toBe(liveRids);
        expect(result.publications).toBeGreaterThanOrEqual(0);
        expect(result.limiterTrackedClients).toBeGreaterThanOrEqual(0);
      },
    });
  });

  it('stays within constant complexity and bounded memory', async () => {
    await assertComplexitySlope({
      label: 'PublicDirectoryNode.stats',
      sizes: [100, 500, 1000],
      expected: 'constant',
      setup: (size) => new PublicDirectoryNode({ hostAnnouncementStore: hostStore(size) }),
      run: (node) => node.stats(),
    });
    await assertMemoryBudget({
      label: 'PublicDirectoryNode.stats',
      repeats: 100,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => new PublicDirectoryNode({ hostAnnouncementStore: hostStore(10) }),
      run: (node) => node.stats(),
    });
  });
});
