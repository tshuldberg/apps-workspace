import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.MEERKAT_WEB_E2E_PORT ?? 3127);
const IS_CI = process.env.CI === 'true';
const PROJECT_DIR = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: IS_CI ? 1 : 0,
  timeout: IS_CI ? 90_000 : 45_000,
  expect: {
    timeout: IS_CI ? 20_000 : 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: !IS_CI,
    cwd: PROJECT_DIR,
    env: {
      // Positive and forged-cache launch tests intercept this exact endpoint.
      // Without an API origin, production code fails closed before fetch(), so
      // Playwright's route cannot prove either revalidation outcome.
      VITE_MEERKAT_HOSTED_API_URL: `http://127.0.0.1:${PORT}`,
    },
  },
});
