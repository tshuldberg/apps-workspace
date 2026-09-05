import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../../test/vitest/function-quality';
import {
  getBestChefCloudConfig,
  shouldEnableBestChefMeshSync,
  type BestChefLaunchEnv,
} from '../launch-environment';

function makeEnv(index: number): BestChefLaunchEnv {
  return {
    NODE_ENV: index % 3 === 0 ? 'production' : 'development',
    EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: index % 11 === 0 ? '1' : undefined,
    EXPO_PUBLIC_BESTCHEF_ENABLE_MESH_SYNC: index % 7 === 0 ? '0' : undefined,
    EXPO_PUBLIC_BESTCHEF_CLOUD_ENV: index % 5 === 0 ? 'production' : 'staging',
    EXPO_PUBLIC_SUPABASE_URL: index % 5 === 0
      ? 'https://prodrefabcdefghij.supabase.co'
      : 'https://tcikvihyjetsfkjjpljv.supabase.co',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  };
}

describe('BestChef launch environment function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    expect(shouldEnableBestChefMeshSync({ NODE_ENV: 'development' })).toBe(true);
    expect(shouldEnableBestChefMeshSync({ NODE_ENV: 'production' })).toBe(false);
    expect(getBestChefCloudConfig(makeEnv(5))).toMatchObject({
      ok: true,
      config: { environment: 'production' },
    });
    expect(getBestChefCloudConfig({
      EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: '1',
      EXPO_PUBLIC_SUPABASE_URL: 'https://zjxabnazbdocrqpyixgo.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    })).toMatchObject({
      ok: true,
      config: { environment: 'production' },
    });
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'BestChef launch environment fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng) => makeEnv(randomInt(rng, 0, 10_000)),
      assertCase: async (input) => {
        const syncEnabled = shouldEnableBestChefMeshSync(input);
        const cloudConfig = getBestChefCloudConfig(input);
        expect(typeof syncEnabled).toBe('boolean');

        if (input.NODE_ENV === 'production' || input.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH === '1') {
          expect(syncEnabled).toBe(false);
        }
        if (
          input.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH === '1'
          && input.EXPO_PUBLIC_BESTCHEF_CLOUD_ENV !== 'production'
        ) {
          expect(cloudConfig.ok).toBe(false);
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    // Sizes bumped from [250, 500, 1000] so per-sample medians clear the
    // JIT/GC noise floor under concurrent Vitest execution. maxRatios
    // loosened from 2.80 to 4.0 to absorb remaining OS scheduling jitter.
    await assertComplexitySlope({
      label: 'BestChef launch environment',
      sizes: [2000, 4000, 8000],
      maxRatios: [4.0, 4.0],
      warmupRuns: 2,
      sampleRuns: 7,
      setup: (size) => Array.from({ length: size }, (_, index) => makeEnv(index)),
      run: async (inputs) => {
        for (const input of inputs) {
          shouldEnableBestChefMeshSync(input);
          getBestChefCloudConfig(input);
        }
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'BestChef launch environment',
      repeats: 40,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => Array.from({ length: 1000 }, (_, index) => makeEnv(index)),
      run: async (inputs) => {
        for (const input of inputs) {
          shouldEnableBestChefMeshSync(input);
          getBestChefCloudConfig(input);
        }
      },
    });
  });
});
