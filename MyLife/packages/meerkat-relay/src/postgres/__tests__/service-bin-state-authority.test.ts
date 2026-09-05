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
const personaBin = path.join(packageRoot, 'bin/meerkat-persona-service.mjs');
const directoryBin = path.join(packageRoot, 'bin/meerkat-public-directory-node.mjs');
const secretSession = 'session-secret-that-must-not-be-logged';
const operatorSeed = 'a1'.repeat(32);
const liveAdminUrl = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const livePersonaUrl = process.env.MEERKAT_TEST_PERSONA_POSTGRES_URL?.trim();
const liveDirectoryUrl = process.env.MEERKAT_TEST_DIRECTORY_POSTGRES_URL?.trim();

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
  'MEERKAT_DIRECTORY_ANNOUNCER_HMAC_KEY',
  'MEERKAT_PERSONA_SESSION_SECRET',
  'MEERKAT_PERSONA_ADMIN_SECRET',
  'MEERKAT_OPERATOR_AUTHORITY_SEED',
  'MEERKAT_ALLOWED_ORIGINS',
  'MEERKAT_COMMUNITY_DATA_DIR',
  'MEERKAT_HOSTED_DATA_DIR',
  'HUMANITY_VERIFY_URL',
  'HUMANITY_SERVICE_PUBLIC_KEY',
] as const;

function isolatedEnvironment(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of clearedEnvironmentKeys) delete env[key];
  return {
    ...env,
    NODE_ENV: 'production',
    PORT: '0',
    HOST: '127.0.0.1',
    ...overrides,
  };
}

function personaEnvironment(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return isolatedEnvironment({
    MEERKAT_PERSONA_SESSION_SECRET: secretSession,
    MEERKAT_OPERATOR_AUTHORITY_SEED: operatorSeed,
    MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
    ...overrides,
  });
}

function runService(entry: string, env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [tsxCli, entry], {
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
  entry: string,
  env: NodeJS.ProcessEnv,
): Promise<{ status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [tsxCli, entry], {
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
      reject(new Error(`Timed out waiting for ${path.basename(entry)} to start and stop`));
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

describe('persona and public-directory state authority bins', () => {
  it('refuses first-party file mode in both entrypoints before opening a server', () => {
    const persona = runService(personaBin, personaEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'file',
      DATA_DIR: '/tmp/persona-must-not-open',
    }));
    const directory = runService(directoryBin, isolatedEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'file',
      DATA_DIR: '/tmp/directory-must-not-open',
    }));

    for (const result of [persona, directory]) {
      expect(result.status).toBe(1);
      expect(result.stderr).toBe('');
      expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
        event: 'fatal',
        reason: 'state_authority_unavailable',
      }));
      expect(result.stdout).toContain('require the PostgreSQL store backend');
      expect(result.stdout).not.toContain('"event":"ready"');
    }
  });

  it('refuses incomplete first-party PostgreSQL configuration without file fallback', () => {
    const persona = runService(personaBin, personaEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'postgres',
    }));
    const directory = runService(directoryBin, isolatedEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'postgres',
    }));

    for (const result of [persona, directory]) {
      expect(result.status).toBe(1);
      expect(result.stderr).toBe('');
      expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
        event: 'fatal',
        reason: 'state_authority_unavailable',
        detail: 'MEERKAT_POSTGRES_URL is required',
      }));
      expect(result.stdout).not.toContain('"event":"ready"');
    }
  });

  it('requires one exactly 32-byte decoded directory HMAC key before PostgreSQL startup', () => {
    const base = {
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'postgres',
      MEERKAT_POSTGRES_URL: 'postgresql://directory@example.test/meerkat',
      MEERKAT_POSTGRES_SSL_MODE: 'verify-full',
      MEERKAT_POSTGRES_SSL_CA_FILE: '/not-read-before-hmac-validation.pem',
    };
    const missing = runService(directoryBin, isolatedEnvironment(base));
    const malformed = runService(directoryBin, isolatedEnvironment({
      ...base,
      MEERKAT_DIRECTORY_ANNOUNCER_HMAC_KEY: 'abcd',
    }));

    for (const result of [missing, malformed]) {
      expect(result.status).toBe(1);
      expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
        event: 'fatal',
        reason: 'state_authority_unavailable',
      }));
      expect(result.stdout).toContain('64-hex MEERKAT_DIRECTORY_ANNOUNCER_HMAC_KEY');
      expect(result.stdout).not.toContain('"event":"ready"');
    }
  });

  it('fails closed on unreadable PostgreSQL TLS material without logging secrets', () => {
    const hmacKey = 'b2'.repeat(32);
    const postgresPassword = 'database-password-that-must-not-be-logged';
    const result = runService(directoryBin, isolatedEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'postgres',
      MEERKAT_POSTGRES_URL: `postgresql://directory:${postgresPassword}@example.test/meerkat`,
      MEERKAT_POSTGRES_SSL_MODE: 'verify-full',
      MEERKAT_POSTGRES_SSL_CA_FILE: '/definitely/missing/meerkat-ca.pem',
      MEERKAT_DIRECTORY_ANNOUNCER_HMAC_KEY: hmacKey,
    }));

    expect(result.status).toBe(1);
    expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
      event: 'fatal',
      reason: 'state_authority_unavailable',
      detail: 'PostgreSQL store is unavailable during TLS CA loading',
    }));
    expect(result.stdout).not.toContain(postgresPassword);
    expect(result.stdout).not.toContain(hmacKey);
    expect(result.stdout).not.toContain('"event":"ready"');
  });

  it('boots and cleanly stops the complete self-hosted file paths', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-bin-authority-'));
    try {
      const persona = await bootAndStopService(personaBin, personaEnvironment({
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: path.join(root, 'persona'),
        MEERKAT_COMMUNITY_DATA_DIR: path.join(root, 'community'),
        MEERKAT_HOSTED_DATA_DIR: path.join(root, 'hosted'),
      }));
      const directory = await bootAndStopService(directoryBin, isolatedEnvironment({
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: path.join(root, 'directory'),
      }));

      for (const result of [persona, directory]) {
        expect(result.status).toBe(0);
        expect(result.signal).toBeNull();
        expect(result.stderr).toBe('');
        expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
          event: 'ready',
          stateBackend: 'file',
        }));
        expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
          event: 'shutdown',
          signal: 'SIGTERM',
        }));
      }
      expect(persona.stdout).not.toContain(secretSession);
      expect(persona.stdout).not.toContain(operatorSeed);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it('locks the PostgreSQL adapter graph and runtime cleanup into both bins', () => {
    const persona = readFileSync(personaBin, 'utf8');
    const directory = readFileSync(directoryBin, 'utf8');

    for (const adapter of [
      'PostgresPersonaRegistryStore',
      'PostgresPublicationStore',
      'PostgresReportStore',
      'PostgresPublicPostStore',
      'PostgresKillStore',
      'PostgresMeerkatBillingStore',
      'PostgresOperatorConsoleStore',
    ]) {
      expect(persona).toContain(`new ${adapter}(database)`);
    }
    expect(directory).toContain('new PostgresPublicDirectoryRepository(database)');
    expect(directory).toContain('new PostgresDirectoryHostAnnouncementStore(database');
    for (const source of [persona, directory]) {
      expect(source).toContain('resolveMeerkatStoreRuntimeConfig');
      expect(source).toContain('createMeerkatStoreRuntime');
      expect(source).toContain('stateBackend: storeRuntime.config.backend');
      expect(source.match(/await storeRuntime\.close\(\)/gu)?.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe.runIf(Boolean(liveAdminUrl && livePersonaUrl && liveDirectoryUrl))(
  'live persona and public-directory PostgreSQL bin authority',
  () => {
    it('boots under least-privilege roles and closes both pools on signal', async () => {
      const hmacKey = 'c3'.repeat(32);
      const persona = await bootAndStopService(personaBin, personaEnvironment({
        NODE_ENV: 'test',
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'postgres',
        MEERKAT_POSTGRES_URL: livePersonaUrl,
        MEERKAT_POSTGRES_SSL_MODE: 'disable',
      }));
      const directory = await bootAndStopService(directoryBin, isolatedEnvironment({
        NODE_ENV: 'test',
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'postgres',
        MEERKAT_POSTGRES_URL: liveDirectoryUrl,
        MEERKAT_POSTGRES_SSL_MODE: 'disable',
        MEERKAT_DIRECTORY_ANNOUNCER_HMAC_KEY: hmacKey,
      }));

      for (const result of [persona, directory]) {
        expect(result.status).toBe(0);
        expect(result.signal).toBeNull();
        expect(result.stderr).toBe('');
        expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
          event: 'ready',
          stateBackend: 'postgres',
        }));
        expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
          event: 'shutdown',
          signal: 'SIGTERM',
        }));
      }
      expect(directory.stdout).not.toContain(hmacKey);

      const admin = new pg.Pool({ connectionString: liveAdminUrl });
      try {
        const activity = await admin.query<{ application_name: string }>(`
          SELECT application_name
          FROM pg_stat_activity
          WHERE application_name IN ('meerkat-persona', 'meerkat-directory')
        `);
        expect(activity.rows).toEqual([]);
        const grants = await admin.query<{ ready: boolean }>(`
          SELECT
            has_table_privilege(
              'meerkat_persona', 'community.public_posts', 'SELECT,INSERT,DELETE'
            )
            AND has_table_privilege(
              'meerkat_persona', 'community.public_post_tombstones', 'SELECT,INSERT'
            )
            AND has_table_privilege(
              'meerkat_persona', 'hosted.app_persona_bindings', 'SELECT,DELETE'
            )
            AND has_table_privilege(
              'meerkat_persona', 'moderation.triage', 'SELECT,DELETE'
            )
            AND has_table_privilege(
              'meerkat_directory', 'directory.publications', 'SELECT,INSERT,UPDATE,DELETE'
            )
            AND has_table_privilege(
              'meerkat_directory', 'directory.host_announcements', 'SELECT,INSERT,UPDATE,DELETE'
            ) AS ready
        `);
        expect(grants.rows).toEqual([{ ready: true }]);
      } finally {
        await admin.end();
      }
    }, 30_000);

    it('closes both pools when server startup fails after database readiness', async () => {
      const occupied = createServer();
      await new Promise<void>((resolve, reject) => {
        occupied.once('error', reject);
        occupied.listen(0, '127.0.0.1', resolve);
      });
      const address = occupied.address() as AddressInfo;
      try {
        const persona = runService(personaBin, personaEnvironment({
          NODE_ENV: 'test',
          PORT: String(address.port),
          MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
          MEERKAT_STORE_BACKEND: 'postgres',
          MEERKAT_POSTGRES_URL: livePersonaUrl,
          MEERKAT_POSTGRES_SSL_MODE: 'disable',
        }));
        const directory = runService(directoryBin, isolatedEnvironment({
          NODE_ENV: 'test',
          PORT: String(address.port),
          MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
          MEERKAT_STORE_BACKEND: 'postgres',
          MEERKAT_POSTGRES_URL: liveDirectoryUrl,
          MEERKAT_POSTGRES_SSL_MODE: 'disable',
          MEERKAT_DIRECTORY_ANNOUNCER_HMAC_KEY: 'd4'.repeat(32),
        }));
        for (const result of [persona, directory]) {
          expect(result.status).toBe(1);
          expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
            event: 'fatal',
            reason: 'startup_failed',
          }));
          expect(result.stdout).not.toContain('"event":"ready"');
        }
      } finally {
        await new Promise<void>((resolve, reject) => {
          occupied.close((error) => error ? reject(error) : resolve());
        });
      }

      const admin = new pg.Pool({ connectionString: liveAdminUrl });
      try {
        const activity = await admin.query<{ application_name: string }>(`
          SELECT application_name
          FROM pg_stat_activity
          WHERE application_name IN ('meerkat-persona', 'meerkat-directory')
        `);
        expect(activity.rows).toEqual([]);
      } finally {
        await admin.end();
      }
    }, 30_000);
  },
);
