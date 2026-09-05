import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

// `__dirname`, not `import.meta.url`: this package is CommonJS (no `"type":
// "module"` in package.json), so Playwright transforms this config to CJS and an
// `import.meta` reference would make Node re-parse it as ESM and fail.
const PROJECT_DIR = __dirname;
const APP_PORT = Number(process.env.MYNEWS_WEB_E2E_PORT ?? 3210);
const FIXTURE_PORT = Number(process.env.MYNEWS_WEB_E2E_FIXTURE_PORT ?? 4310);
const IS_CI = process.env.CI === 'true';

/**
 * Production build by default (`next build && next start`).
 *
 * The app is App Router SSR with `force-dynamic` pages, a nonce-minting
 * middleware, and route handlers, and the production server is the only one that
 * runs all three the way a reader will. `next dev` recompiles per route on first
 * hit, which turns the first assertion of every spec into a timing question.
 *
 * `MYNEWS_WEB_E2E_DEV=1` swaps in `next dev` for iterating while the app is
 * mid-change and a production build would fail on unrelated in-flight work. It
 * is not the default, because a green run under dev is weaker evidence.
 */
const useDevServer = process.env.MYNEWS_WEB_E2E_DEV === '1';
const appCommand = useDevServer
  ? `pnpm exec next dev --hostname 127.0.0.1 --port ${APP_PORT}`
  : `pnpm exec next build && pnpm exec next start --hostname 127.0.0.1 --port ${APP_PORT}`;

/**
 * The fixture's self-signed certificate, trusted by the Next process through
 * NODE_EXTRA_CA_CERTS. `parseCloudEnv` requires an https URL, so the fixture has
 * to speak TLS; adding the certificate to the trust store keeps verification ON
 * instead of disabling it globally with NODE_TLS_REJECT_UNAUTHORIZED.
 */
const FIXTURE_CERT = join(PROJECT_DIR, 'e2e', 'fixture-tls-cert.pem');

/**
 * Server environment for the app under test. The app's own env reader is
 * untouched: these are the same variables a deployment sets.
 */
const appEnv: Record<string, string> = {
  MYNEWS_SUPABASE_URL: `https://127.0.0.1:${FIXTURE_PORT}`,
  MYNEWS_SUPABASE_ANON_KEY: 'mynews-e2e-fixture-anon-key',
  MYNEWS_PUBLIC_ORIGIN: `http://127.0.0.1:${APP_PORT}`,
  // app/api/dmca/route.ts fails closed below 32 characters.
  MYNEWS_DMCA_RATE_SALT: 'mynews-e2e-fixture-dmca-rate-salt-0123456789',
  NODE_EXTRA_CA_CERTS: FIXTURE_CERT,
  // Web reporting ON, so the report card renders its real form and the specs can
  // exercise the signed-out sign-in sheet. With it off the card correctly renders
  // a "not switched on for this deployment" note instead, and there is no form to
  // test.
  MYNEWS_WEB_REPORTING_ENABLED: 'true',
  // Contact addresses and the payments rail are deliberately left unset so
  // `capabilities.emailContact` and `capabilities.payments` stay false and the
  // specs assert the honest unconfigured copy.
};

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
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The fixture control plane is reached over its self-signed certificate.
    ignoreHTTPSErrors: true,
    // A real deployment sits behind a proxy that sets a client-IP header, and
    // `app/api/dmca/route.ts` fails closed without one. Supplying it here is the
    // platform's job, not the app's, so nothing in the app is stubbed.
    extraHTTPHeaders: {
      'x-forwarded-for': '203.0.113.7',
    },
  },
  webServer: [
    {
      command: `node ./e2e/fixture-server.mjs`,
      url: `https://127.0.0.1:${FIXTURE_PORT}/__fixture/health`,
      ignoreHTTPSErrors: true,
      cwd: PROJECT_DIR,
      timeout: 30_000,
      reuseExistingServer: !IS_CI,
      env: { MYNEWS_FIXTURE_PORT: String(FIXTURE_PORT) },
    },
    {
      command: appCommand,
      url: `http://127.0.0.1:${APP_PORT}`,
      cwd: PROJECT_DIR,
      timeout: 300_000,
      reuseExistingServer: !IS_CI,
      env: appEnv,
    },
  ],
});
