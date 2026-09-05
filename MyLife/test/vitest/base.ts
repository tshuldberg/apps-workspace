import { fileURLToPath } from 'node:url';

const providedSeed = Number.parseInt(process.env.VITEST_SEED ?? '', 10);

/**
 * Seed can be overridden via VITEST_SEED for reproducible random ordering.
 * Falling back to current epoch-second keeps local runs randomized.
 */
export const VITEST_SEQUENCE_SEED = Number.isFinite(providedSeed)
  ? providedSeed
  : Math.floor(Date.now() / 1000);

export const VITEST_GLOBAL_SETUP_FILE = fileURLToPath(
  new URL('./setup.global.ts', import.meta.url),
);

export const vitestBaseTestConfig = {
  clearMocks: true,
  restoreMocks: true,
  unstubGlobals: true,
  unstubEnvs: true,
  env: {
    TZ: 'UTC',
  },
  sequence: {
    shuffle: true,
    seed: VITEST_SEQUENCE_SEED,
  },
} as const;
