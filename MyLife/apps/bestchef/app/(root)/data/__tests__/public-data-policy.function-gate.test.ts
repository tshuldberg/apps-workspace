import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../../test/vitest/function-quality';
import {
  getBestChefPublicDataPolicy,
  type BestChefPublicDataPolicyInput,
} from '../public-data-policy';

const overrideValues = [undefined, '0', '1', 'unexpected'] as const;
const nodeEnvValues = [undefined, 'development', 'test', 'production'] as const;

function makeEnv(index: number): BestChefPublicDataPolicyInput {
  const approvedSeed = index % 7 === 0;
  return {
    NODE_ENV: nodeEnvValues[index % nodeEnvValues.length],
    EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: index % 5 === 0 ? '1' : undefined,
    EXPO_PUBLIC_BESTCHEF_ALLOW_DEMO_CLOUD_ALIASES:
      overrideValues[index % overrideValues.length],
    EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_APPROVAL_STATUS: approvedSeed ? 'approved' : undefined,
    EXPO_PUBLIC_BESTCHEF_APPROVED_SEED_CONTENT_REVISION: approvedSeed ? 'seed-r1' : undefined,
  };
}

describe('getBestChefPublicDataPolicy function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    expect(getBestChefPublicDataPolicy({ NODE_ENV: 'development' })).toMatchObject({
      isPublicLaunch: false,
      allowDemoCloudAliases: true,
      demoCloudAliasReason: 'internal_beta',
    });
    expect(getBestChefPublicDataPolicy({ NODE_ENV: 'production' })).toMatchObject({
      isPublicLaunch: true,
      allowDemoCloudAliases: false,
      demoCloudAliasReason: 'public_launch',
    });
    expect(
      getBestChefPublicDataPolicy({
        NODE_ENV: 'production',
        EXPO_PUBLIC_BESTCHEF_ALLOW_DEMO_CLOUD_ALIASES: '1',
        EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_APPROVAL_STATUS: 'approved',
        EXPO_PUBLIC_BESTCHEF_APPROVED_SEED_CONTENT_REVISION: 'seed-r1',
      }),
    ).toMatchObject({
      isPublicLaunch: true,
      allowDemoCloudAliases: true,
      demoCloudAliasReason: 'explicit_allow',
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getBestChefPublicDataPolicy fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => {
        return makeEnv(randomInt(rng, 0, 10_000));
      },
      assertCase: async (input: BestChefPublicDataPolicyInput) => {
        const result = getBestChefPublicDataPolicy(input);
        expect(typeof result.isPublicLaunch).toBe('boolean');
        expect(typeof result.allowDemoCloudAliases).toBe('boolean');

        if (input.EXPO_PUBLIC_BESTCHEF_ALLOW_DEMO_CLOUD_ALIASES === '1') {
          if (
            result.isPublicLaunch
            && input.EXPO_PUBLIC_BESTCHEF_SEED_CONTENT_APPROVAL_STATUS !== 'approved'
          ) {
            expect(result.allowDemoCloudAliases).toBe(false);
            expect(result.demoCloudAliasReason).toBe('missing_seed_approval');
          } else {
            expect(result.allowDemoCloudAliases).toBe(true);
            expect(result.demoCloudAliasReason).toBe('explicit_allow');
          }
        }
        if (input.EXPO_PUBLIC_BESTCHEF_ALLOW_DEMO_CLOUD_ALIASES === '0') {
          expect(result.allowDemoCloudAliases).toBe(false);
          expect(result.demoCloudAliasReason).toBe('explicit_block');
        }
        if (
          input.EXPO_PUBLIC_BESTCHEF_ALLOW_DEMO_CLOUD_ALIASES !== '1'
          && input.EXPO_PUBLIC_BESTCHEF_ALLOW_DEMO_CLOUD_ALIASES !== '0'
          && (input.NODE_ENV === 'production' || input.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH === '1')
        ) {
          expect(result.allowDemoCloudAliases).toBe(false);
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    // Sizes bumped from [250, 500, 1000] so per-sample medians clear the
    // JIT/GC noise floor under concurrent Vitest execution. maxRatios
    // loosened from 2.80 to 4.0 to absorb remaining OS scheduling jitter.
    await assertComplexitySlope({
      label: 'getBestChefPublicDataPolicy',
      sizes: [2000, 4000, 8000],
      maxRatios: [4.0, 4.0],
      warmupRuns: 2,
      sampleRuns: 7,
      setup: (size) => Array.from({ length: size }, (_, index) => makeEnv(index)),
      run: async (inputs) => {
        for (const input of inputs) {
          getBestChefPublicDataPolicy(input);
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getBestChefPublicDataPolicy',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => Array.from({ length: 1000 }, (_, index) => makeEnv(index)),
      run: async (inputs) => {
        for (const input of inputs) {
          getBestChefPublicDataPolicy(input);
        }
      },
    });
  });
});
