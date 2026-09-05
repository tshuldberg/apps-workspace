import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      '../../supabase/functions/mynews-*/__tests__/**/*.test.ts',
      '../../supabase/functions/_shared/__tests__/mynews-*.test.ts',
    ],
  },
});
