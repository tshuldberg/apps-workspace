import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';
import {
  VITEST_GLOBAL_SETUP_FILE,
  vitestBaseTestConfig,
} from '../../test/vitest/base';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    ...vitestBaseTestConfig,
    environment: 'jsdom',
    globals: true,
    setupFiles: [VITEST_GLOBAL_SETUP_FILE, './test/setup.tsx'],
    exclude: [
      ...configDefaults.exclude,
      'e2e/**',
    ],
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.ts'],
      exclude: ['**/__tests__/**', 'e2e/**', 'test/**'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 47,
        statements: 47,
        functions: 55,
        branches: 65,
        'app/actions.ts': {
          branches: 90,
        },
        'app/api/identity/actor/issue/route.ts': {
          lines: 90,
          statements: 90,
          functions: 100,
          branches: 80,
        },
        'app/api/entitlements/**/route.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 65,
        },
        'app/api/access/bundle/**/route.ts': {
          lines: 95,
          statements: 95,
          functions: 100,
          branches: 85,
        },
        'app/api/_shared/actor-identity.ts': {
          lines: 70,
          statements: 70,
          functions: 100,
          branches: 55,
        },
        'lib/access/bundle.ts': {
          lines: 90,
          statements: 90,
          functions: 100,
          branches: 80,
        },
        'lib/billing/entitlement-issuer.ts': {
          lines: 80,
          statements: 80,
          functions: 100,
          branches: 40,
        },
      },
    },
  },
});
