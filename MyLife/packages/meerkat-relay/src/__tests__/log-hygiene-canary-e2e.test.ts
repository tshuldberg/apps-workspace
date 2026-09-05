/**
 * Log-hygiene canary E2E for every stateful service bin (Plan 44 WP-4B).
 *
 * Generalizes the relay's process-boundary log-hygiene E2E (log-hygiene-e2e.test.ts,
 * which boots the compiled relay and asserts a session's ciphertext/token never
 * reach stdout) to the FIVE stateful bins that carry operator credentials:
 * community node, public directory node, humanity verification service, persona
 * registry service, and hosted billing service.
 *
 * Each bin is booted as a REAL child process (tsx, exactly the documented run
 * command) under a hermetic temp DATA_DIR with CANARY secret values in its env: a
 * postgres URL whose password is a canary, canary session/entitlement/webhook/api
 * secrets, and (where the bin reads one) a canary object-store secret. Two boot
 * shapes are exercised per bin:
 *
 *   1. FILE-MODE READY BOOT. Self-host file mode, so the bin reaches `ready` and
 *      serves a real request (a GET to its health endpoint). The bin's own log
 *      surface -- ready line, request logs, shutdown -- must carry none of the
 *      canaries. This proves the steady-state log path.
 *   2. POSTGRES FATAL BOOT. First-party postgres mode with a canary connection
 *      string carrying a password and a missing CA file, forcing the fail-closed
 *      fatal path that stringifies the pg/config error. This is the path most
 *      likely to leak a connection string, so we assert the canary password never
 *      appears in the fatal detail.
 *
 * These are HERMETIC: no network, no live database, no special env. They run in
 * the standard `pnpm test` job. Nothing here touches the relay's existing
 * log-hygiene E2E.
 */

import { spawn, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const packageRoot = fileURLToPath(new URL('../../', import.meta.url));

// The canary values. Every one is a distinctive marker that must NEVER surface in
// a bin's stdout or stderr. If a future edit threads any of these into a log, the
// matching assertion fails and CI blocks the release.
const CANARY = {
  postgresPassword: 'CANARY-PG-PASSWORD-must-not-log-7f3a',
  moderationPassword: 'CANARY-MOD-PASSWORD-must-not-log-9b1c',
  sessionSecret: 'CANARY-SESSION-SECRET-must-not-log-4d2e',
  entitlementSecret: 'CANARY-ENTITLEMENT-SECRET-must-not-log-6a8f',
  webhookSecret: 'CANARY-WEBHOOK-SECRET-must-not-log-1c5b',
  stripeKey: 'sk_live_CANARYmustnotlog0000000000000000',
  revenuecatKey: 'CANARY-REVENUECAT-KEY-must-not-log-3e9d',
  turnstileSecret: 'CANARY-TURNSTILE-SECRET-must-not-log-8f4a',
  humanitySigningSeed: 'a1'.repeat(32), // 64 hex Ed25519 seed
  operatorSeed: 'b2'.repeat(32), // 64 hex operator authority seed
  directoryHmac: 'c3'.repeat(32), // 64 hex directory announcer HMAC
  pushTokenKey: 'd4'.repeat(32), // 64 hex push token cipher key
  // Plan 51 verification-account canaries.
  accountSessionSecret: 'CANARY-ACCOUNT-SESSION-SECRET-must-not-log-2b7e',
  accountEpochKeySecret: 'CANARY-ACCOUNT-EPOCH-KEY-SECRET-must-not-log-5c9a',
  providerSubject: 'mustnotlog-provider-subject-9f3a',
  relayEmail: 'mustnotlog-relay@privaterelay.canary.test',
  credentialSerial: 'e5'.repeat(32), // 64 hex credential serial
} as const;

// Every canary that is genuinely secret material. The directory HMAC and the
// two seeds are key material; the operator seed derives a PUBLIC authority key
// that IS logged on purpose, so it is asserted separately (see the directory /
// persona / community cases) rather than in this blanket list.
const SECRET_CANARIES = [
  CANARY.postgresPassword,
  CANARY.moderationPassword,
  CANARY.sessionSecret,
  CANARY.entitlementSecret,
  CANARY.webhookSecret,
  CANARY.stripeKey,
  CANARY.revenuecatKey,
  CANARY.turnstileSecret,
  CANARY.humanitySigningSeed,
  CANARY.directoryHmac,
  CANARY.pushTokenKey,
  CANARY.accountSessionSecret,
  CANARY.accountEpochKeySecret,
  CANARY.providerSubject,
  CANARY.relayEmail,
  CANARY.credentialSerial,
];

const clearedEnvironmentKeys = [
  'NODE_ENV',
  'PORT',
  'HOST',
  'DATA_DIR',
  'MEERKAT_DEPLOYMENT_PROFILE',
  'MEERKAT_STORE_BACKEND',
  'MEERKAT_POSTGRES_URL',
  'MEERKAT_MODERATION_POSTGRES_URL',
  'MEERKAT_POSTGRES_SSL_MODE',
  'MEERKAT_POSTGRES_SSL_CA_FILE',
  'MEERKAT_DIRECTORY_ANNOUNCER_HMAC_KEY',
  'MEERKAT_PERSONA_SESSION_SECRET',
  'MEERKAT_PERSONA_ADMIN_SECRET',
  'MEERKAT_OPERATOR_AUTHORITY_SEED',
  'MEERKAT_ALLOWED_ORIGINS',
  'MEERKAT_COMMUNITY_DATA_DIR',
  'MEERKAT_HOSTED_DATA_DIR',
  'HUMANITY_VERIFY_URL',
  'HUMANITY_SERVICE_PUBLIC_KEY',
  'HUMANITY_SIGNING_KEY',
  'TURNSTILE_SECRET',
  'ENTITLEMENT_SECRET',
  'WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_MONTHLY_PRICE_ID',
  'STRIPE_APP_UNLOCK_PRICE_ID',
  'REVENUECAT_REST_API_KEY',
  'MEERKAT_PUSH_TOKEN_KEYS_DIR',
  'MEERKAT_PUSH_TOKEN_ACTIVE_VERSION',
  'MEERKAT_PUSH_APNS_KEY_FILE',
  'MEERKAT_PUSH_FCM_SERVICE_ACCOUNT_FILE',
  'MEERKAT_PUSH_VAPID_PRIVATE_KEY_FILE',
  'MEERKAT_ACCOUNT_SESSION_SECRET',
  'MEERKAT_ACCOUNT_EPOCH_KEY_SECRET',
  'MEERKAT_ACCOUNT_SESSION_TTL_MS',
  'MEERKAT_APPLE_SERVICE_IDS',
  'MEERKAT_GOOGLE_CLIENT_IDS',
  'MEERKAT_ASSN_ROOT_CA',
  'MEERKAT_PLAY_RTDN_AUDIENCE',
  'MEERKAT_STRIPE_WEBHOOK_SECRET',
  'MEERKAT_ACCOUNT_CANARY_SUBJECT',
  'MEERKAT_ACCOUNT_CANARY_RELAY_EMAIL',
  'MEERKAT_ACCOUNT_CANARY_SERIAL',
];

function isolatedEnv(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of clearedEnvironmentKeys) delete env[key];
  return { ...env, PORT: '0', HOST: '127.0.0.1', ...overrides };
}

interface BinResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

/** Run a bin to completion (used for fatal-path boots that exit on their own). */
function runBin(entry: string, env: NodeJS.ProcessEnv): BinResult {
  const result = spawnSync(process.execPath, [tsxCli, entry], {
    cwd: packageRoot,
    encoding: 'utf8',
    env,
    timeout: 20_000,
  });
  return { status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr };
}

/**
 * Boot a bin, wait for its `ready` line, run `drive(url)` against the reported
 * url, then SIGTERM it and resolve with the full captured output. `drive` lets a
 * caller push a real request through the bin so request-path logging is exercised
 * before hygiene is asserted.
 */
async function bootDriveStop(
  entry: string,
  env: NodeJS.ProcessEnv,
  drive?: (url: string) => Promise<void>,
): Promise<BinResult> {
  const child = spawn(process.execPath, [tsxCli, entry], {
    cwd: packageRoot,
    // The heap cap keeps a cold tsx compile of the heaviest bin graph
    // (community node -> @mylife/sync) bounded on memory-constrained CI
    // runners, where an uncapped child is the first OOM-kill candidate.
    // 768 MiB is a locally verified ready-boot floor; 1024 adds headroom.
    env: { ...env, NODE_OPTIONS: '--max-old-space-size=1024' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let driven = false;

  return new Promise<BinResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Timed out booting ${path.basename(entry)}`));
    }, 20_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (!driven && stdout.includes('"event":"ready"')) {
        driven = true;
        void (async () => {
          try {
            const readyLine = stdout
              .split('\n')
              .map((line) => {
                try {
                  return JSON.parse(line) as Record<string, unknown>;
                } catch {
                  return null;
                }
              })
              .find((event) => event?.event === 'ready');
            const url = typeof readyLine?.url === 'string' ? readyLine.url : '';
            if (drive && url) await drive(url);
          } catch {
            // A drive failure is not the assertion under test; hygiene is. Fall
            // through to shutdown and let the stdout assertions run.
          } finally {
            // Give any request-path log line a tick to flush before SIGTERM.
            setTimeout(() => child.kill('SIGTERM'), 100);
          }
        })();
      }
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('close', (status, signal) => {
      clearTimeout(timeout);
      // A child that dies before `ready` must fail with its exit status,
      // signal, and output tails. Resolving here would push the failure into
      // a bare empty-stdout assertion that hides the actual cause (a SIGKILL
      // from the kernel OOM killer looks identical to a silent crash).
      if (!driven) {
        reject(
          new Error(
            `${path.basename(entry)} exited before its ready line ` +
              `(status=${String(status)}, signal=${String(signal)})\n` +
              `--- stdout tail ---\n${stdout.slice(-2000)}\n` +
              `--- stderr tail ---\n${stderr.slice(-2000)}`,
          ),
        );
        return;
      }
      resolve({ status, signal, stdout, stderr });
    });
  });
}

function assertNoSecretCanary(result: BinResult): void {
  const combined = result.stdout + result.stderr;
  for (const canary of SECRET_CANARIES) {
    expect(combined).not.toContain(canary);
  }
}

const bin = (name: string) => path.join(packageRoot, 'bin', name);

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-canary-'));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

/**
 * A first-party postgres env whose connection string carries the canary password
 * and whose CA file is missing, forcing the fail-closed fatal path that
 * stringifies the pg/config error. Used to prove the fatal path never leaks the
 * connection-string password.
 */
function postgresFatalEnv(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return isolatedEnv({
    NODE_ENV: 'production',
    MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
    MEERKAT_STORE_BACKEND: 'postgres',
    MEERKAT_POSTGRES_URL: `postgresql://meerkat:${CANARY.postgresPassword}@db.internal.example:5432/meerkat`,
    MEERKAT_POSTGRES_SSL_MODE: 'verify-full',
    MEERKAT_POSTGRES_SSL_CA_FILE: '/definitely/missing/meerkat-ca.pem',
    ...overrides,
  });
}

describe('community node log hygiene at the process boundary', () => {
  it('serves a real request in file mode without leaking any canary secret', async () => {
    const result = await bootDriveStop(
      bin('meerkat-community-node.mjs'),
      isolatedEnv({
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: path.join(root, 'community'),
        MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
        // Operator seed derives the PUBLIC authority key that IS logged; its
        // presence exercises the console/authority log lines.
        MEERKAT_OPERATOR_AUTHORITY_SEED: CANARY.operatorSeed,
        MEERKAT_OPERATOR_CONSOLE_SECRET: CANARY.sessionSecret,
        ENTITLEMENT_SECRET: CANARY.entitlementSecret,
        // NOTIFY_RELAY_URL is logged VERBATIM as `relay` in the notify_enabled
        // event (bin line ~166) with no userinfo validation. This is a genuine
        // credential-in-log path, so it gives this canary teeth against a real
        // regression: deleting redactForLog from the bin re-leaks the password.
        // parkNotify only dials the relay lazily on a real change, so a bogus host
        // never blocks boot.
        NOTIFY_RELAY_URL: `wss://notifybot:${CANARY.postgresPassword}@relay.internal.example`,
      }),
      async (url) => {
        // A real read request through the community node's HTTP surface.
        await fetch(`${url}/healthz`).catch(() => undefined);
      },
    );
    expect(result.stdout).toContain('"event":"ready"');
    assertNoSecretCanary(result);
    // The console secret (used as a bearer) must never be echoed.
    expect(result.stdout + result.stderr).not.toContain(CANARY.sessionSecret);
    // The notify_enabled event logged the relay url with its userinfo REDACTED
    // (host preserved for diagnosis, credential stripped). This is the end-to-end
    // proof that the bin's out() actually routes through the redaction helper.
    expect(result.stdout).toContain('"event":"notify_enabled"');
    expect(result.stdout).toContain('relay.internal.example');
    expect(result.stdout).not.toContain('notifybot');
  }, 30_000);

  it('does not leak the connection-string password on the postgres fatal path', () => {
    const result = runBin(
      bin('meerkat-community-node.mjs'),
      postgresFatalEnv({
        DATA_DIR: path.join(root, 'community'),
        MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
        MEERKAT_MODERATION_POSTGRES_URL: `postgresql://meerkat_mod:${CANARY.moderationPassword}@db.internal.example:5432/meerkat`,
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"event":"fatal"');
    expect(result.stdout).not.toContain('"event":"ready"');
    assertNoSecretCanary(result);
  });
});

describe('public directory node log hygiene at the process boundary', () => {
  it('serves a real request in file mode without leaking any canary secret', async () => {
    const result = await bootDriveStop(
      bin('meerkat-public-directory-node.mjs'),
      isolatedEnv({
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: path.join(root, 'directory'),
      }),
      async (url) => {
        await fetch(`${url}/healthz`).catch(() => undefined);
      },
    );
    expect(result.stdout).toContain('"event":"ready"');
    assertNoSecretCanary(result);
  }, 30_000);

  it('does not leak the directory HMAC or password on the postgres fatal path', () => {
    const result = runBin(
      bin('meerkat-public-directory-node.mjs'),
      postgresFatalEnv({
        DATA_DIR: path.join(root, 'directory'),
        MEERKAT_DIRECTORY_ANNOUNCER_HMAC_KEY: CANARY.directoryHmac,
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"event":"fatal"');
    expect(result.stdout).not.toContain('"event":"ready"');
    assertNoSecretCanary(result);
  });
});

describe('humanity verification service log hygiene at the process boundary', () => {
  it('serves a real request in file mode without leaking the signing seed or turnstile secret', async () => {
    const result = await bootDriveStop(
      bin('meerkat-verification-service.mjs'),
      isolatedEnv({
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: path.join(root, 'humanity'),
        HUMANITY_SIGNING_KEY: CANARY.humanitySigningSeed,
        TURNSTILE_SECRET: CANARY.turnstileSecret,
      }),
      async (url) => {
        await fetch(`${url}/healthz`).catch(() => undefined);
      },
    );
    expect(result.stdout).toContain('"event":"ready"');
    assertNoSecretCanary(result);
  }, 30_000);

  it('does not leak the connection-string password on the postgres fatal path', () => {
    const result = runBin(
      bin('meerkat-verification-service.mjs'),
      postgresFatalEnv({
        DATA_DIR: path.join(root, 'humanity'),
        HUMANITY_SIGNING_KEY: CANARY.humanitySigningSeed,
        TURNSTILE_SECRET: CANARY.turnstileSecret,
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"event":"fatal"');
    expect(result.stdout).not.toContain('"event":"ready"');
    assertNoSecretCanary(result);
  });
});

describe('persona registry service log hygiene at the process boundary', () => {
  it('serves a real request in file mode without leaking the session secret', async () => {
    const result = await bootDriveStop(
      bin('meerkat-persona-service.mjs'),
      isolatedEnv({
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: path.join(root, 'persona'),
        MEERKAT_COMMUNITY_DATA_DIR: path.join(root, 'persona-community'),
        MEERKAT_HOSTED_DATA_DIR: path.join(root, 'persona-hosted'),
        MEERKAT_PERSONA_SESSION_SECRET: CANARY.sessionSecret,
        MEERKAT_PERSONA_ADMIN_SECRET: CANARY.entitlementSecret,
        MEERKAT_OPERATOR_AUTHORITY_SEED: CANARY.operatorSeed,
        MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
      }),
      async (url) => {
        // A real read through the persona surface (a resolve for an unknown alias
        // returns a clean not-found; the goal is exercising request logging).
        await fetch(`${url}/persona/resolve?alias=nobody`).catch(() => undefined);
      },
    );
    expect(result.stdout).toContain('"event":"ready"');
    assertNoSecretCanary(result);
    expect(result.stdout + result.stderr).not.toContain(CANARY.sessionSecret);
  }, 30_000);

  it('does not leak the connection-string password on the postgres fatal path', () => {
    const result = runBin(
      bin('meerkat-persona-service.mjs'),
      postgresFatalEnv({
        DATA_DIR: path.join(root, 'persona'),
        MEERKAT_PERSONA_SESSION_SECRET: CANARY.sessionSecret,
        MEERKAT_OPERATOR_AUTHORITY_SEED: CANARY.operatorSeed,
        MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"event":"fatal"');
    expect(result.stdout).not.toContain('"event":"ready"');
    assertNoSecretCanary(result);
  });
});

describe('hosted billing service log hygiene at the process boundary', () => {
  it('serves a real request in file mode without leaking Stripe / entitlement / api canaries', async () => {
    const result = await bootDriveStop(
      bin('meerkat-hosted-service.mjs'),
      isolatedEnv({
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: path.join(root, 'hosted'),
        MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
        ENTITLEMENT_SECRET: CANARY.entitlementSecret,
        WEBHOOK_SECRET: CANARY.webhookSecret,
        STRIPE_SECRET_KEY: CANARY.stripeKey,
        STRIPE_MONTHLY_PRICE_ID: 'price_canary_monthly',
        STRIPE_APP_UNLOCK_PRICE_ID: 'price_canary_unlock',
        REVENUECAT_REST_API_KEY: CANARY.revenuecatKey,
      }),
      async (url) => {
        await fetch(`${url}/healthz`).catch(() => undefined);
        // An unauthorized entitlements call exercises the request-log path with a
        // rejected request (no bearer), which must not echo the secret env.
        await fetch(`${url}/api/entitlements`).catch(() => undefined);
      },
    );
    expect(result.stdout).toContain('"event":"ready"');
    assertNoSecretCanary(result);
  }, 30_000);

  it('does not leak the connection-string password on the postgres fatal path', () => {
    const result = runBin(
      bin('meerkat-hosted-service.mjs'),
      postgresFatalEnv({
        DATA_DIR: path.join(root, 'hosted'),
        MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
        ENTITLEMENT_SECRET: CANARY.entitlementSecret,
        WEBHOOK_SECRET: CANARY.webhookSecret,
        STRIPE_SECRET_KEY: CANARY.stripeKey,
        STRIPE_MONTHLY_PRICE_ID: 'price_canary_monthly',
        STRIPE_APP_UNLOCK_PRICE_ID: 'price_canary_unlock',
        REVENUECAT_REST_API_KEY: CANARY.revenuecatKey,
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"event":"fatal"');
    expect(result.stdout).not.toContain('"event":"ready"');
    assertNoSecretCanary(result);
  });
});

describe('push gateway log hygiene at the process boundary', () => {
  it('serves a real request in file mode without leaking the token cipher key', async () => {
    const keysDir = path.join(root, 'push-keys');
    await fs.mkdir(keysDir, { recursive: true });
    // The key file content is a canary; if the bin ever logged key bytes it would fail.
    await fs.writeFile(path.join(keysDir, '1.key'), CANARY.pushTokenKey);
    const result = await bootDriveStop(
      bin('meerkat-push-gateway.mjs'),
      isolatedEnv({
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: path.join(root, 'push'),
        MEERKAT_PUSH_TOKEN_KEYS_DIR: keysDir,
        MEERKAT_PUSH_TOKEN_ACTIVE_VERSION: '1',
        MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
      }),
      async (url) => {
        // Real reads through the push surface exercise the request + readyz log path.
        await fetch(`${url}/readyz`).catch(() => undefined);
        await fetch(`${url}/v1/push/status/00000000-0000-4000-8000-000000000000`, {
          headers: { authorization: `Bearer ${'A'.repeat(43)}` },
        }).catch(() => undefined);
      },
    );
    expect(result.stdout).toContain('"event":"ready"');
    assertNoSecretCanary(result);
    expect(result.stdout + result.stderr).not.toContain(CANARY.pushTokenKey);
  }, 30_000);

  it('does not leak the connection-string password on the postgres fatal path', async () => {
    const keysDir = path.join(root, 'push-keys-fatal');
    await fs.mkdir(keysDir, { recursive: true });
    await fs.writeFile(path.join(keysDir, '1.key'), CANARY.pushTokenKey);
    const result = runBin(
      bin('meerkat-push-gateway.mjs'),
      postgresFatalEnv({
        DATA_DIR: path.join(root, 'push'),
        MEERKAT_PUSH_TOKEN_KEYS_DIR: keysDir,
        MEERKAT_PUSH_TOKEN_ACTIVE_VERSION: '1',
        MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"event":"fatal"');
    expect(result.stdout).not.toContain('"event":"ready"');
    assertNoSecretCanary(result);
  });
});

describe('verification-account service log hygiene at the process boundary', () => {
  it('serves a real request in file mode without leaking the session secret, provider subject, relay email, or serial', async () => {
    const result = await bootDriveStop(
      bin('meerkat-account-service.mjs'),
      isolatedEnv({
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: path.join(root, 'account'),
        MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
        MEERKAT_ACCOUNT_SESSION_SECRET: CANARY.accountSessionSecret,
        MEERKAT_ACCOUNT_EPOCH_KEY_SECRET: CANARY.accountEpochKeySecret,
        MEERKAT_APPLE_SERVICE_IDS: 'com.mylife.meerkat',
        // These account-layer identifiers are passed via bogus env the bin never
        // reads. They are the values that MUST NOT appear in a log if a future edit
        // ever threads a provider subject / relay email / serial into an event, so
        // asserting their absence exercises the extended redaction denylist teeth.
        MEERKAT_ACCOUNT_CANARY_SUBJECT: CANARY.providerSubject,
        MEERKAT_ACCOUNT_CANARY_RELAY_EMAIL: CANARY.relayEmail,
        MEERKAT_ACCOUNT_CANARY_SERIAL: CANARY.credentialSerial,
      }),
      async (url) => {
        // A real read through the account surface (healthz + an unauthenticated
        // status call exercises the request-log path with a rejected request).
        await fetch(`${url}/healthz`).catch(() => undefined);
        await fetch(`${url}/account/status`).catch(() => undefined);
      },
    );
    expect(result.stdout).toContain('"event":"ready"');
    assertNoSecretCanary(result);
    const combined = result.stdout + result.stderr;
    expect(combined).not.toContain(CANARY.accountSessionSecret);
    expect(combined).not.toContain(CANARY.accountEpochKeySecret);
    expect(combined).not.toContain(CANARY.providerSubject);
    expect(combined).not.toContain(CANARY.relayEmail);
    expect(combined).not.toContain(CANARY.credentialSerial);
  }, 30_000);

  it('refuses to boot without a session secret (fatal, fail closed)', () => {
    const result = runBin(
      bin('meerkat-account-service.mjs'),
      isolatedEnv({
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: path.join(root, 'account'),
        MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
        // No MEERKAT_ACCOUNT_SESSION_SECRET => refuse to boot.
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"event":"fatal"');
    expect(result.stdout).not.toContain('"event":"ready"');
  });

  it('does not leak the connection-string password on the postgres fatal path', () => {
    const result = runBin(
      bin('meerkat-account-service.mjs'),
      postgresFatalEnv({
        DATA_DIR: path.join(root, 'account'),
        MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
        MEERKAT_ACCOUNT_SESSION_SECRET: CANARY.accountSessionSecret,
        MEERKAT_ACCOUNT_EPOCH_KEY_SECRET: CANARY.accountEpochKeySecret,
      }),
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('"event":"fatal"');
    expect(result.stdout).not.toContain('"event":"ready"');
    assertNoSecretCanary(result);
  });
});
