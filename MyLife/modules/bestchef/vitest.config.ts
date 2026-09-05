import { defineConfig } from 'vitest/config';
import {
  VITEST_GLOBAL_SETUP_FILE,
  vitestBaseTestConfig,
} from '../../test/vitest/base';

export default defineConfig({
  test: {
    ...vitestBaseTestConfig,
    setupFiles: [VITEST_GLOBAL_SETUP_FILE],
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
      // Scope edge-function coverage to BestChef surfaces only. The broad
      // `functions/**` glob previously swept in every module's function tests
      // (mynews-*, dowork-*), including the known-broken mynews-review suite
      // that imports @mylife/sync (not a BestChef dep). BestChef owns the
      // bestchef-* functions, moderate_vote_proof, and the two shared helpers
      // its brokers depend on (broker-quota ledger, moderation providers).
      '../../supabase/functions/bestchef-*/__tests__/**/*.test.ts',
      '../../supabase/functions/moderate_vote_proof/__tests__/**/*.test.ts',
      '../../supabase/functions/_shared/__tests__/broker-quota.test.ts',
      '../../supabase/functions/_shared/__tests__/bestchef-moderation-providers.test.ts',
      '../../supabase/functions/_shared/__tests__/worker-secret.test.ts',
      '../../supabase/functions/_shared/__tests__/observability.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 65,
        branches: 50,
      },
    },
  },
});
