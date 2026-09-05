import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.{ts,mjs}', '**/*.test.{ts,tsx,mjs}'],
    passWithNoTests: true,
  },
});
