import path from 'node:path';
import { defineConfig } from '@playwright/test';

const PORT = 3115;
const E2E_DB_PATH = path.join(__dirname, '.tmp', 'e2e', 'mylife-hub-e2e.sqlite');
const IS_CI = process.env.CI === 'true';
const NODE_OPTIONS = [
  process.env.NODE_OPTIONS,
  IS_CI ? '--max-old-space-size=4096' : undefined,
]
  .filter(Boolean)
  .join(' ');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: IS_CI ? 1 : 0,
  timeout: IS_CI ? 120_000 : 45_000,
  expect: {
    timeout: IS_CI ? 20_000 : 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Granted so the in-tab reminders tray (shown when browser notifications
    // are blocked) never renders and overlays action buttons mid-flow.
    permissions: ['notifications'],
  },
  globalSetup: require.resolve('./e2e/global-setup'),
  webServer: {
    // CI runs against a production build: `next dev` compiles routes on demand,
    // which on a shared 2-core runner produces multi-minute first-navigation
    // stalls that read as element-not-found timeouts. Local keeps the dev
    // server for iteration speed.
    command: IS_CI
      ? `pnpm exec next build && pnpm exec next start --port ${PORT}`
      : `pnpm exec next dev --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    timeout: IS_CI ? 900_000 : 180_000,
    // Always start a fresh server so E2E env vars + clean DB reset are deterministic.
    reuseExistingServer: false,
    cwd: __dirname,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      NODE_OPTIONS,
      MYLIFE_DB_PATH: E2E_DB_PATH,
      MYLIFE_ENTITLEMENT_SECRET: 'mylife-e2e-entitlement-secret',
      MYLIFE_ENTITLEMENT_ISSUER_KEY: 'mylife-e2e-issuer-key',
      MYLIFE_ENTITLEMENT_SYNC_KEY: 'mylife-e2e-sync-key',
      STRIPE_WEBHOOK_SECRET: 'mylife-e2e-webhook-secret',
      MYLIFE_HOSTED_API_URL: `http://127.0.0.1:${PORT}`,
    },
  },
});
