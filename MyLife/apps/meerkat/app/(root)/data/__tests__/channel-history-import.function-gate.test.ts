import { describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  generateDeviceIdentity,
  type DeviceIdentity,
} from '@mylife/sync';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../../test/vitest/function-quality';
import {
  fetchAndImportChannelHistory,
  type FetchAndImportChannelHistoryInput,
} from '../channel-history-import';

const unusedDb: DatabaseAdapter = {
  execute(): void {
    throw new Error('Database should not be used for invalid manifests.');
  },
  query<T = Record<string, unknown>>(): T[] {
    throw new Error('Database should not be used for invalid manifests.');
  },
  transaction(): void {
    throw new Error('Database should not be used for invalid manifests.');
  },
};

const identity: DeviceIdentity = generateDeviceIdentity('Gate');

function invalidManifestInput(size: number): FetchAndImportChannelHistoryInput {
  return {
    db: unusedDb,
    identity,
    communityId: 'community',
    channelId: 'general',
    manifestJson: JSON.stringify({
      infoHash: 'x',
      noise: Array.from({ length: size }, (_, index) => index),
    }),
  };
}

describe('fetchAndImportChannelHistory function quality gate', () => {
  it('matches contract behavior for known cases', async () => {
    await expect(fetchAndImportChannelHistory({
      db: unusedDb,
      identity,
      communityId: 'community',
      channelId: 'general',
      manifestJson: '',
    })).resolves.toMatchObject({
      ok: false,
      reason: 'empty_manifest',
    });

    await expect(fetchAndImportChannelHistory(invalidManifestInput(4))).resolves.toMatchObject({
      ok: false,
      reason: 'invalid_manifest',
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'fetchAndImportChannelHistory fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => {
        const size = randomInt(rng, 0, 500);
        return randomInt(rng, 0, 1) === 0
          ? { ...invalidManifestInput(size), manifestJson: '{' }
          : invalidManifestInput(size);
      },
      assertCase: async (input) => {
        const result = await fetchAndImportChannelHistory(input);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(['invalid_json', 'invalid_manifest']).toContain(result.reason);
          expect('importedEvents' in result).toBe(false);
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'fetchAndImportChannelHistory',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: invalidManifestInput,
      run: async (input) => {
        await fetchAndImportChannelHistory(input);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'fetchAndImportChannelHistory',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => invalidManifestInput(1000),
      run: async (input) => {
        await fetchAndImportChannelHistory(input);
      },
    });
  });
});
