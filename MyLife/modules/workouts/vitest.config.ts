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
      '__tests__/**/*.test.tsx',
      // DoWork is the standalone surface for the workouts module. Its server
      // edge-function tests live under supabase/functions/dowork-* and have no
      // other package config that globs them (apps/dowork has no vitest config),
      // so the workouts module owns their coverage. Mirrors the mynews precedent
      // (modules/mynews/vitest.config.ts globs mynews-* function tests).
      '../../supabase/functions/dowork-*/__tests__/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/__tests__/**'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 55,
        branches: 45,
      },
    },
  },
});
