import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../test/function-quality';
import { InMemoryCommunityPrivateStateStore } from '../community-private-state';

function nonce(index: number): string {
  return index.toString(16).padStart(48, '0');
}

describe('InMemoryCommunityPrivateStateStore function quality gate', () => {
  it('bounds challenge issuance for a known community', async () => {
    const store = new InMemoryCommunityPrivateStateStore();
    const input = {
      communityId: 'known-community',
      ttlMs: 60_000,
      ceilingPerCommunity: 1,
      maxUnclaimedCommunities: 10,
      nowMs: 1_000,
    };
    expect(await store.issueChallenge({ ...input, nonce: nonce(1) })).toMatchObject({ nonce: nonce(1) });
    expect(await store.issueChallenge({ ...input, nonce: nonce(2) })).toBeNull();
  });

  it('passes deterministic challenge-ceiling fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'InMemoryCommunityPrivateStateStore fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng, index) => ({ index, ceiling: randomInt(rng, 1, 12) }),
      assertCase: async ({ index, ceiling }) => {
        const store = new InMemoryCommunityPrivateStateStore();
        const communityId = `fuzz-${index}`;
        for (let attempt = 0; attempt < ceiling; attempt += 1) {
          expect(await store.issueChallenge({
            communityId,
            nonce: nonce(attempt + 1),
            ttlMs: 60_000,
            ceilingPerCommunity: ceiling,
            maxUnclaimedCommunities: 100,
            nowMs: 1_000,
          })).not.toBeNull();
        }
        expect(await store.issueChallenge({
          communityId,
          nonce: nonce(ceiling + 1),
          ttlMs: 60_000,
          ceilingPerCommunity: ceiling,
          maxUnclaimedCommunities: 100,
          nowMs: 1_000,
        })).toBeNull();
      },
    });
  });

  it('constructs stores within a linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'InMemoryCommunityPrivateStateStore construction',
      sizes: [250, 500, 1000],
      expected: 'linear',
      setup: (size) => size,
      run: (size) => {
        for (let index = 0; index < size; index += 1) new InMemoryCommunityPrivateStateStore();
      },
    });
  });

  it('stays within memory budget under repeated construction', async () => {
    await assertMemoryBudget({
      label: 'InMemoryCommunityPrivateStateStore construction',
      repeats: 20,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => 100,
      run: (size) => {
        const stores = Array.from({ length: size }, () => new InMemoryCommunityPrivateStateStore());
        expect(stores).toHaveLength(size);
      },
    });
  });
});
