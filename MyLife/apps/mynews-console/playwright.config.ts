import { defineConfig } from '@playwright/test';

// `__dirname`, not `import.meta.url`: this package is CommonJS, so Playwright
// transforms this config to CJS and an `import.meta` reference would make Node
// re-parse it as ESM and fail.
const PROJECT_DIR = __dirname;
const APP_PORT = Number(process.env.MYNEWS_CONSOLE_E2E_PORT ?? 3211);
const FIXTURE_PORT = Number(process.env.MYNEWS_CONSOLE_E2E_FIXTURE_PORT ?? 4311);
const IS_CI = process.env.CI === 'true';

/**
 * Production build by default (`next build && next start`).
 *
 * The console's gates live in middleware and in server components, and the
 * production server is the only one that runs them the way a moderator will.
 * `MYNEWS_CONSOLE_E2E_DEV=1` swaps in `next dev` for iterating while the app is
 * mid-change; it is not the default, because a green run under dev is weaker
 * evidence (and Next's dev-only devtools bundle has its own client-manifest
 * flakiness on client components).
 */
const useDevServer = process.env.MYNEWS_CONSOLE_E2E_DEV === '1';
const appCommand = useDevServer
  ? `pnpm exec next dev --hostname 127.0.0.1 --port ${APP_PORT}`
  : `pnpm exec next build && pnpm exec next start --hostname 127.0.0.1 --port ${APP_PORT}`;

/**
 * Server environment for the console under test. The app's own env contract is
 * untouched: these are the same variables an operator sets, including the
 * allowlist, which is the outer of the console's three gates.
 *
 * `norole@example.org` is allowlisted on purpose: the role table (fixture RPC
 * `nw_moderator_role`) has to be able to disagree with the allowlist, or the
 * "allowlisted, MFA cleared, no role" state could not be tested at all.
 */
const appEnv: Record<string, string> = {
  MYNEWS_CONSOLE_SUPABASE_URL: `http://127.0.0.1:${FIXTURE_PORT}`,
  MYNEWS_CONSOLE_SUPABASE_ANON_KEY: 'mynews-console-e2e-fixture-anon-key',
  MYNEWS_CONSOLE_SUPABASE_SERVICE_ROLE_KEY: 'mynews-console-e2e-fixture-service-role-key',
  MYNEWS_CONSOLE_MODERATOR_EMAILS: 'moderator@example.org,norole@example.org',
  MYNEWS_CONSOLE_ORIGIN: `http://127.0.0.1:${APP_PORT}`,
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
  },
  webServer: [
    {
      command: `node ./e2e/fixture-server.mjs`,
      url: `http://127.0.0.1:${FIXTURE_PORT}/__fixture/health`,
      cwd: PROJECT_DIR,
      timeout: 30_000,
      reuseExistingServer: !IS_CI,
      env: { MYNEWS_CONSOLE_FIXTURE_PORT: String(FIXTURE_PORT) },
    },
    {
      command: appCommand,
      url: `http://127.0.0.1:${APP_PORT}/login`,
      cwd: PROJECT_DIR,
      timeout: 300_000,
      reuseExistingServer: !IS_CI,
      env: appEnv,
    },
  ],
});
