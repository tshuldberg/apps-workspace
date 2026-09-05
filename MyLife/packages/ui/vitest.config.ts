import { defineConfig } from 'vitest/config';
import { vitestBaseTestConfig } from '../../test/vitest/base';

export default defineConfig({
  test: {
    ...vitestBaseTestConfig,
    globals: true,
    include: ['src/**/__tests__/**/*.{test,spec}.ts'],
  },
});
