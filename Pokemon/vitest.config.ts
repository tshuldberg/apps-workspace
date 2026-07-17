import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    fileParallelism: false,
    isolate: true,
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
