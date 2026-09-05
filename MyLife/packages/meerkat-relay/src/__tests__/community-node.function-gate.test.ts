import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../test/function-quality';
import { CommunityNode } from '../community-node';

describe('CommunityNode function quality gate', () => {
  it('issues bounded private challenges through its authority', async () => {
    const node = new CommunityNode({ rateLimits: { challengeCeilingPerCommunity: 1 } });
    expect(await node.issueChallenge('known-community')).not.toBeNull();
    expect(await node.issueChallenge('known-community')).toBeNull();
  });

  it('passes deterministic unclaimed-community fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'CommunityNode private-state fuzz',
      iterations: 100,
      seed: 42,
      makeCase: (rng, index) => ({ index, maximum: randomInt(rng, 1, 10) }),
      assertCase: async ({ index, maximum }) => {
        const node = new CommunityNode({ maxUnclaimedCommunities: maximum });
        for (let value = 0; value < maximum + 5; value += 1) {
          await node.issueChallenge(`fuzz-${index}-${value}`);
        }
        expect(await node.communityStateCount()).toBeLessThanOrEqual(maximum);
      },
    });
  });

  it('constructs nodes within a linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'CommunityNode construction',
      sizes: [100, 200, 400],
      expected: 'linear',
      setup: (size) => size,
      run: (size) => {
        for (let index = 0; index < size; index += 1) new CommunityNode();
      },
    });
  });

  it('stays within memory budget under repeated construction', async () => {
    await assertMemoryBudget({
      label: 'CommunityNode construction',
      repeats: 20,
      maxHeapDeltaBytes: 12 * 1024 * 1024,
      setup: () => 50,
      run: (size) => {
        const nodes = Array.from({ length: size }, () => new CommunityNode());
        expect(nodes).toHaveLength(size);
      },
    });
  });
});
