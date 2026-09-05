import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Minimal vitest config for pure Node.js tests (no React/jsdom).
 * Avoids the react-dom version mismatch in the main test setup.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'lib/__tests__/rate-limit.test.ts',
      'lib/__tests__/api-validation.test.ts',
      'lib/__tests__/api-validation.property.test.ts',
    ],
  },
});
