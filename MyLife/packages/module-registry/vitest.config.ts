import { defineConfig } from 'vitest/config';
import {
  VITEST_GLOBAL_SETUP_FILE,
  vitestBaseTestConfig,
} from '../../test/vitest/base';

export default defineConfig({
  test: {
    ...vitestBaseTestConfig,
    setupFiles: [VITEST_GLOBAL_SETUP_FILE],
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
