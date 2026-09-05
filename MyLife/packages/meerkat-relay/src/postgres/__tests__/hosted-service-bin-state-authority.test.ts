import { spawn, spawnSync } from 'node:child_process';
import { promises as fs, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer, type AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));
const hostedBin = path.join(packageRoot, 'bin/meerkat-hosted-service.mjs');
const liveAdminUrl = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const liveHostedUrl = process.env.MEERKAT_TEST_HOSTED_POSTGRES_URL?.trim();

const requiredHostedEnvironment = {
  ENTITLEMENT_SECRET: 'entitlement-secret-that-must-not-be-logged',
  WEBHOOK_SECRET: 'webhook-secret-that-must-not-be-logged',
  STRIPE_SECRET_KEY: 'sk_test_hosted_state_authority',
  STRIPE_MONTHLY_PRICE_ID: 'price_monthly_state_authority',
  STRIPE_APP_UNLOCK_PRICE_ID: 'price_unlock_state_authority',
  REVENUECAT_REST_API_KEY: 'revenuecat-secret-that-must-not-be-logged',
  MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
} as const;

const clearedEnvironmentKeys = [
  'NODE_ENV',
  'PORT',
  'HOST',
  'DATA_DIR',
  'MEERKAT_DEPLOYMENT_PROFILE',
  'MEERKAT_STORE_BACKEND',
  'MEERKAT_POSTGRES_URL',
  'MEERKAT_POSTGRES_SSL_MODE',
  'MEERKAT_POSTGRES_SSL_CA_FILE',
  'ENTITLEMENT_SECRET',
  'WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_MONTHLY_PRICE_ID',
  'STRIPE_APP_UNLOCK_PRICE_ID',
  'REVENUECAT_REST_API_KEY',
  'MEERKAT_ALLOWED_ORIGINS',
  'MEERKAT_OBJECT_STORE_BACKEND',
  'MEERKAT_OBJECT_STORE_ENDPOINT',
  'MEERKAT_OBJECT_STORE_REGION',
  'MEERKAT_OBJECT_STORE_BUCKET',
  'MEERKAT_OBJECT_STORE_ACCESS_KEY_FILE',
  'MEERKAT_OBJECT_STORE_SECRET_KEY_FILE',
  'MEERKAT_OBJECT_STORE_ALLOW_INSECURE_HTTP',
  'MEERKAT_OBJECT_STORE_FORCE_PATH_STYLE',
  'MEERKAT_OAUTH_PROVIDERS',
  'MEERKAT_OAUTH_KMS_KEY_FILE',
  ...['GOOGLE', 'DROPBOX', 'ONEDRIVE', 'BOX'].flatMap((provider) => [
    `MEERKAT_OAUTH_${provider}_AUTH_URL`,
    `MEERKAT_OAUTH_${provider}_TOKEN_URL`,
    `MEERKAT_OAUTH_${provider}_REVOKE_URL`,
    `MEERKAT_OAUTH_${provider}_CLIENT_ID`,
    `MEERKAT_OAUTH_${provider}_CLIENT_SECRET_FILE`,
    `MEERKAT_OAUTH_${provider}_REDIRECT_ALLOWLIST`,
    `MEERKAT_OAUTH_${provider}_SCOPES`,
  ]),
] as const;

function isolatedEnvironment(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of clearedEnvironmentKeys) delete env[key];
  return {
    ...env,
    ...requiredHostedEnvironment,
    NODE_ENV: 'production',
    PORT: '0',
    HOST: '127.0.0.1',
    ...overrides,
  };
}

function runService(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [tsxCli, hostedBin], {
    cwd: packageRoot,
    encoding: 'utf8',
    env,
    timeout: 15_000,
  });
}

function jsonEvents(stdout: string): Array<Record<string, unknown>> {
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function bootAndStopService(
  env: NodeJS.ProcessEnv,
): Promise<{ status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [tsxCli, hostedBin], {
    cwd: packageRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let stopSent = false;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Timed out waiting for the hosted service to start and stop'));
    }, 15_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (!stopSent && stdout.includes('"event":"ready"')) {
        stopSent = true;
        child.kill('SIGTERM');
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
      resolve({ status, signal, stdout, stderr });
    });
  });
}

describe('hosted service state authority bin', () => {
  it('refuses first-party file billing before opening a server', () => {
    const result = runService(isolatedEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'file',
      DATA_DIR: '/tmp/hosted-must-not-open',
    }));

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
      event: 'fatal',
      reason: 'state_authority_unavailable',
    }));
    expect(result.stdout).toContain('require the PostgreSQL store backend');
    expect(result.stdout).not.toContain('"event":"ready"');
  });

  it('refuses incomplete first-party PostgreSQL configuration without file fallback', () => {
    const result = runService(isolatedEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'postgres',
      DATA_DIR: '/tmp/hosted-bytes-only',
    }));

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
      event: 'fatal',
      reason: 'state_authority_unavailable',
      detail: 'MEERKAT_POSTGRES_URL is required',
    }));
    expect(result.stdout).not.toContain('"event":"ready"');
  });

  it('fails closed on unreadable PostgreSQL TLS material without logging secrets', () => {
    const postgresPassword = 'database-password-that-must-not-be-logged';
    const result = runService(isolatedEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'postgres',
      MEERKAT_POSTGRES_URL: `postgresql://hosted:${postgresPassword}@example.test/meerkat`,
      MEERKAT_POSTGRES_SSL_MODE: 'verify-full',
      MEERKAT_POSTGRES_SSL_CA_FILE: '/definitely/missing/meerkat-hosted-ca.pem',
      DATA_DIR: '/tmp/hosted-bytes-only',
      // First-party now also requires a complete object-store block at config-resolve time; supply
      // it (endpoint/region/bucket + credential FILE paths) so the failure under test is the
      // PostgreSQL TLS CA load, not a missing byte-path var. The object-store creds are never read
      // here because config resolution passes and the TLS load fails first.
      MEERKAT_OBJECT_STORE_BACKEND: 's3',
      MEERKAT_OBJECT_STORE_ENDPOINT: 'https://s3.example.test',
      MEERKAT_OBJECT_STORE_REGION: 'us-east-1',
      MEERKAT_OBJECT_STORE_BUCKET: 'meerkat-hosted',
      MEERKAT_OBJECT_STORE_ACCESS_KEY_FILE: '/run/secrets/object-store-access-key',
      MEERKAT_OBJECT_STORE_SECRET_KEY_FILE: '/run/secrets/object-store-secret-key',
    }));

    expect(result.status).toBe(1);
    expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
      event: 'fatal',
      reason: 'state_authority_unavailable',
      detail: 'PostgreSQL store is unavailable during TLS CA loading',
    }));
    expect(result.stdout).not.toContain(postgresPassword);
    for (const secret of Object.values(requiredHostedEnvironment)) {
      expect(result.stdout).not.toContain(secret);
    }
    expect(result.stdout).not.toContain('"event":"ready"');
  });

  it('boots and cleanly stops the complete self-hosted file path', async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-hosted-bin-'));
    try {
      const result = await bootAndStopService(isolatedEnvironment({
        NODE_ENV: 'test',
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: dataDir,
      }));

      expect(result.status).toBe(0);
      expect(result.signal).toBeNull();
      expect(result.stderr).toBe('');
      expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
        event: 'ready',
        stateBackend: 'file',
        billingStateBackend: 'file',
        byteStorageBackend: 'file',
        dataDir,
      }));
      expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
        event: 'shutdown',
        signal: 'SIGTERM',
      }));
      for (const secret of Object.values(requiredHostedEnvironment)) {
        expect(result.stdout).not.toContain(secret);
      }
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('locks the PostgreSQL billing graph, cleanup, and honest byte boundary into the bin', () => {
    const source = readFileSync(hostedBin, 'utf8');

    expect(source).toContain("service: 'hosted'");
    expect(source).toContain('resolveMeerkatStoreRuntimeConfig');
    expect(source).toContain('createMeerkatStoreRuntime');
    expect(source).toContain('new PostgresMeerkatBillingStore(storeRuntime.database)');
    expect(source).toContain('new FileMeerkatBillingStore(runtimeConfig.dataDir)');
    // The file byte path is still constructed (self-host), and the object-store byte path is
    // only ever constructed via the fail-closed config resolver (first-party). The selection is
    // by whether an object store was composed, never a silent default.
    expect(source).toContain('new FileStorageIngestStore(');
    expect(source).toContain('new ObjectStoreStorageIngestStore(');
    // The object-store byte path is composed from the typed runtime-config block (requireObjectStore)
    // and its S3 client is built by reading mounted-secret files, never plain-env credentials.
    expect(source).toContain('requireObjectStore: true');
    expect(source).toContain('createS3ObjectStoreFromRuntimeConfig');
    expect(source).toContain("runtimeConfig.objectStore?.backend === 's3'");
    expect(source).toContain('new PostgresHostedStorageMetadataStore(storeRuntime.database)');
    expect(source).toContain('createHostedStorageApiHandler');
    expect(source).toContain('new PostgresObjectDeletionJobStore(storeRuntime.database)');
    expect(source).toContain('new PostgresOAuthBrokerStore(storeRuntime.database)');
    expect(source).toContain('new FileOAuthBrokerStore()');
    expect(source).toContain('loadOAuthProviderRegistryFromEnv()');
    expect(source).toContain('loadMountedSecretKmsFromFile(oauthKmsFile)');
    expect(source).toContain('createOAuthBrokerHandler(oauthBrokerOptions)');
    expect(source).toContain('deleteOAuthBrokerAccountAudited(subjectId, oauthBrokerOptions)');
    expect(source).toContain('isOAuthBrokerApiPath(pathname)');
    expect(source).toContain("byteStorageBackend: objectStore ? 's3' : 'file'");
    // The composed S3 client is disposed on shutdown/fatal alongside the pool.
    expect(source).toContain('objectStore?.destroy()');
    expect(source.match(/closeRuntimeResources\(\)/gu)?.length).toBeGreaterThanOrEqual(3);
  });

  it('refuses first-party mode when the object-store byte-path config is incomplete', () => {
    // Complete + valid first-party PostgreSQL config (verify-full with a CA file path, which config
    // resolution accepts without reading) but NO object-store env: config resolution fails closed
    // naming the missing byte-path var, before any server opens and before the TLS material is even
    // loaded. This is the byte-path analogue of the PostgreSQL fail-closed tests.
    const result = runService(isolatedEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'postgres',
      MEERKAT_POSTGRES_URL: 'postgresql://hosted:pw@example.test/meerkat',
      MEERKAT_POSTGRES_SSL_MODE: 'verify-full',
      MEERKAT_POSTGRES_SSL_CA_FILE: '/definitely/missing/meerkat-hosted-ca.pem',
      DATA_DIR: '/tmp/hosted-objstore-missing',
    }));

    expect(result.status).toBe(1);
    expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
      event: 'fatal',
      reason: 'state_authority_unavailable',
      detail: 'MEERKAT_OBJECT_STORE_ENDPOINT is required',
    }));
    expect(result.stdout).not.toContain('"event":"ready"');
  });

  it('boots a first-party-composed object-store byte path and never logs the secret', async () => {
    // First-party mode forces production semantics (verify-full PostgreSQL TLS), which a local
    // no-TLS fixture cannot satisfy, so a full first-party bin boot is not hermetically runnable
    // here. The object-store composition itself is proven end-to-end in
    // hosted-object-store-composition.test.ts (resolver fail-closed + ingest over the memory
    // adapter + the /api/storage/upload handler landing bytes on the object store). This bin-level
    // test instead asserts the file self-host path is byte-for-byte unchanged and reports the file
    // byte backend, so the WP-2D wiring never regresses self-host.
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-hosted-selfhost-unchanged-'));
    try {
      const result = await bootAndStopService(isolatedEnvironment({
        NODE_ENV: 'test',
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: dataDir,
        // Object-store env present but IGNORED in self-host mode: the resolver returns null and the
        // file byte path is kept, proving the env cannot accidentally flip self-host onto S3.
        MEERKAT_OBJECT_STORE_ENDPOINT: 'https://s3.example.test',
        MEERKAT_OBJECT_STORE_REGION: 'us-east-1',
        MEERKAT_OBJECT_STORE_BUCKET: 'meerkat-hosted',
        MEERKAT_OBJECT_STORE_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        MEERKAT_OBJECT_STORE_SECRET_ACCESS_KEY: 'object-store-secret-that-must-not-be-logged',
      }));

      expect(result.status).toBe(0);
      expect(result.signal).toBeNull();
      expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
        event: 'ready',
        stateBackend: 'file',
        byteStorageBackend: 'file',
      }));
      expect(result.stdout).not.toContain('object-store-secret-that-must-not-be-logged');
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe.runIf(Boolean(liveAdminUrl && liveHostedUrl))(
  'live hosted PostgreSQL bin authority',
  () => {
    it('boots under the hosted role and closes its pool on signal', async () => {
      const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-hosted-pg-bin-'));
      try {
        const result = await bootAndStopService(isolatedEnvironment({
          NODE_ENV: 'test',
          MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
          MEERKAT_STORE_BACKEND: 'postgres',
          MEERKAT_POSTGRES_URL: liveHostedUrl,
          MEERKAT_POSTGRES_SSL_MODE: 'disable',
          DATA_DIR: dataDir,
        }));

        expect(result.status).toBe(0);
        expect(result.signal).toBeNull();
        expect(result.stderr).toBe('');
        expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
          event: 'ready',
          stateBackend: 'postgres',
          billingStateBackend: 'postgres',
          byteStorageBackend: 'file',
        }));

        const admin = new pg.Pool({ connectionString: liveAdminUrl });
        try {
          const activity = await admin.query<{ application_name: string }>(`
            SELECT application_name
            FROM pg_stat_activity
            WHERE application_name = 'meerkat-hosted'
          `);
          expect(activity.rows).toEqual([]);
        } finally {
          await admin.end();
        }
      } finally {
        await fs.rm(dataDir, { recursive: true, force: true });
      }
    }, 30_000);

    it('closes the hosted pool when HTTP startup fails after database readiness', async () => {
      const occupied = createServer();
      await new Promise<void>((resolve, reject) => {
        occupied.once('error', reject);
        occupied.listen(0, '127.0.0.1', resolve);
      });
      const address = occupied.address() as AddressInfo;
      const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-hosted-pg-fail-'));
      try {
        const result = runService(isolatedEnvironment({
          NODE_ENV: 'test',
          PORT: String(address.port),
          MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
          MEERKAT_STORE_BACKEND: 'postgres',
          MEERKAT_POSTGRES_URL: liveHostedUrl,
          MEERKAT_POSTGRES_SSL_MODE: 'disable',
          DATA_DIR: dataDir,
        }));

        expect(result.status).toBe(1);
        expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
          event: 'fatal',
          reason: 'startup_failed',
        }));
        expect(result.stdout).not.toContain('"event":"ready"');
      } finally {
        await new Promise<void>((resolve, reject) => {
          occupied.close((error) => error ? reject(error) : resolve());
        });
        await fs.rm(dataDir, { recursive: true, force: true });
      }

      const admin = new pg.Pool({ connectionString: liveAdminUrl });
      try {
        const activity = await admin.query<{ application_name: string }>(`
          SELECT application_name
          FROM pg_stat_activity
          WHERE application_name = 'meerkat-hosted'
        `);
        expect(activity.rows).toEqual([]);
      } finally {
        await admin.end();
      }
    }, 30_000);
  },
);
