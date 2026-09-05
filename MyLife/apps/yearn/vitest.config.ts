import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/__tests__/**/*.test.tsx',
      'app/**/__tests__/**/*.test.ts',
      'app/**/__tests__/**/*.test.tsx',
      '../../supabase/functions/yearn-boost-activate/__tests__/**/*.test.ts',
      '../../supabase/functions/yearn-moderation/__tests__/**/*.test.ts',
      '../../supabase/functions/yearn-push-fanout/__tests__/**/*.test.ts',
      '../../supabase/functions/yearn-membership-activate/__tests__/**/*.test.ts',
      '../../supabase/functions/yearn-appstore-notifications/__tests__/**/*.test.ts',
    ],
  },
});
