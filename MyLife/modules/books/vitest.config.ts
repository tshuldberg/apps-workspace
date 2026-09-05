import { defineConfig } from 'vitest/config';
import {
  VITEST_GLOBAL_SETUP_FILE,
  vitestBaseTestConfig,
} from '../../test/vitest/base';

export default defineConfig({
  test: {
    ...vitestBaseTestConfig,
    setupFiles: [VITEST_GLOBAL_SETUP_FILE],
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 52,
        statements: 52,
        functions: 96,
        branches: 66,
        'src/api/**/*.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 80,
        },
        'src/import/**/*.ts': {
          lines: 85,
          statements: 85,
          functions: 100,
          branches: 60,
        },
        'src/export/**/*.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 45,
        },
        'src/stats/**/*.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 65,
        },
      },
    },
  },
});
