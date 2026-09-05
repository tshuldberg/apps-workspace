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
const communityBin = path.join(packageRoot, 'bin/meerkat-community-node.mjs');
const liveAdminUrl = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const liveCommunityUrl = process.env.MEERKAT_TEST_COMMUNITY_POSTGRES_URL?.trim();
const liveModerationUrl = process.env.MEERKAT_TEST_MODERATION_POSTGRES_URL?.trim();

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
  'MEERKAT_ALLOWED_ORIGINS',
  'MEERKAT_OPERATOR_AUTHORITY_SEED',
  'MEERKAT_OPERATOR_CONSOLE_SECRET',
  'MEERKAT_HUMANITY_REQUIRED',
  'HUMANITY_VERIFY_URL',
  'SESSION_VERIFY_URL',
  'COMMONS_PROVISION_FILE',
  'MEERKAT_ABUSE_HASH_FILE',
  'ANNOUNCE_RELAY_URL',
  'NOTIFY_RELAY_URL',
] as const;

function isolatedEnvironment(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of clearedEnvironmentKeys) delete env[key];
  return {
    ...env,
    NODE_ENV: 'production',
    PORT: '0',
    HOST: '127.0.0.1',
    // Production community nodes require exact browser origins; supply one so the
    // origin guard is never the reason a state-authority assertion fails.
    MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
    // The bin persists its post-receipt seed under DATA_DIR before the state
    // authority resolves, so even fail-closed spawns need a temp directory or
    // they litter the package root with ./.meerkat-community.
    DATA_DIR: path.join(os.tmpdir(), `meerkat-community-bin-fallback-${process.pid}`),
    ...overrides,
  };
}

function runService(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [tsxCli, communityBin], {
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
  const child = spawn(process.execPath, [tsxCli, communityBin], {
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
      reject(new Error('Timed out waiting for the community node to start and stop'));
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

describe('community node state authority bin', () => {
  it('boots and cleanly stops the complete self-hosted file path', async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-community-bin-'));
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
        dataDir,
      }));
      expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
        event: 'shutdown',
        signal: 'SIGTERM',
      }));
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  }, 30_000);

  it('refuses first-party file mode before opening a server', () => {
    const result = runService(isolatedEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'file',
      DATA_DIR: '/tmp/community-must-not-open',
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

  it('requires a distinct moderation PostgreSQL role URL in postgres mode', () => {
    const result = runService(isolatedEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'postgres',
      MEERKAT_POSTGRES_URL: 'postgresql://community@example.test/meerkat',
      MEERKAT_POSTGRES_SSL_MODE: 'verify-full',
      MEERKAT_POSTGRES_SSL_CA_FILE: '/not-read-before-moderation-url-check.pem',
    }));

    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
      event: 'fatal',
      reason: 'state_authority_unavailable',
    }));
    expect(result.stdout).toContain('MEERKAT_MODERATION_POSTGRES_URL');
    expect(result.stdout).not.toContain('"event":"ready"');
  });

  it('fails closed on unreadable community TLS material without logging the database password', () => {
    const communityPassword = 'community-database-password-that-must-not-be-logged';
    const moderationPassword = 'moderation-database-password-that-must-not-be-logged';
    const result = runService(isolatedEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'postgres',
      MEERKAT_POSTGRES_URL: `postgresql://community:${communityPassword}@example.test/meerkat`,
      MEERKAT_MODERATION_POSTGRES_URL: `postgresql://moderation:${moderationPassword}@example.test/meerkat`,
      MEERKAT_POSTGRES_SSL_MODE: 'verify-full',
      MEERKAT_POSTGRES_SSL_CA_FILE: '/definitely/missing/meerkat-community-ca.pem',
    }));

    expect(result.status).toBe(1);
    expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
      event: 'fatal',
      reason: 'state_authority_unavailable',
      detail: 'PostgreSQL store is unavailable during TLS CA loading',
    }));
    expect(result.stdout).not.toContain(communityPassword);
    expect(result.stdout).not.toContain(moderationPassword);
    expect(result.stdout).not.toContain('"event":"ready"');
  });

  it('locks the two least-privilege PostgreSQL contexts and runtime cleanup into the bin', () => {
    const source = readFileSync(communityBin, 'utf8');

    // Two distinct runtime contexts resolved from two distinct env vars.
    expect(source).toContain("service: 'community'");
    expect(source).toContain("service: 'moderation'");
    expect(source).toContain('MEERKAT_MODERATION_POSTGRES_URL');
    expect(source).toContain('resolveMeerkatStoreRuntimeConfig');
    expect(source).toContain('createMeerkatStoreRuntime');
    expect(source).toContain('stateBackend: storeBackend');

    // The community context binds the community-role stores (descriptors, private
    // state, publications, kills, reports, public posts).
    for (const adapter of [
      'new PostgresCommunityDescriptorStore(communityDb)',
      'new PostgresCommunityPrivateStateStore(communityDb)',
      'new PostgresPublicationStore(communityDb)',
      'new PostgresKillStore(communityDb)',
      'new PostgresReportStore(communityDb)',
      'new PostgresPublicPostStore(communityDb)',
    ]) {
      expect(source).toContain(adapter);
    }

    // The moderation context binds ONLY the operator console, NCMEC queue, and DMCA
    // intake -- and those adapters must never be constructed from the community db.
    for (const adapter of [
      'new PostgresOperatorConsoleStore(moderationDb)',
      'new PostgresNcmecReportQueueStore(moderationDb)',
      'new PostgresDmcaIntakeStore(moderationDb)',
    ]) {
      expect(source).toContain(adapter);
    }
    expect(source).not.toContain('new PostgresOperatorConsoleStore(communityDb)');
    expect(source).not.toContain('new PostgresNcmecReportQueueStore(communityDb)');
    expect(source).not.toContain('new PostgresDmcaIntakeStore(communityDb)');

    // The seeder piece store stays file-backed in BOTH modes (no Postgres piece store).
    expect(source).toContain('new FileSeederPieceStore(piecesDir)');
    expect(source).not.toContain('PostgresSeederPieceStore');

    // Both pools close on shutdown and on every startup-failure fatal path.
    expect(source).toContain('closeRuntimes');
    expect(source.match(/await fatalExit\(/gu)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe.runIf(Boolean(liveAdminUrl && liveCommunityUrl && liveModerationUrl))(
  'live community node PostgreSQL bin authority',
  () => {
    it('boots two least-privilege pools and closes both on signal', async () => {
      const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-community-pg-bin-'));
      try {
        const result = await bootAndStopService(isolatedEnvironment({
          NODE_ENV: 'test',
          MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
          MEERKAT_STORE_BACKEND: 'postgres',
          MEERKAT_POSTGRES_URL: liveCommunityUrl,
          MEERKAT_MODERATION_POSTGRES_URL: liveModerationUrl,
          MEERKAT_POSTGRES_SSL_MODE: 'disable',
          DATA_DIR: dataDir,
        }));

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

        const admin = new pg.Pool({ connectionString: liveAdminUrl });
        try {
          const activity = await admin.query<{ application_name: string }>(`
            SELECT application_name
            FROM pg_stat_activity
            WHERE application_name IN ('meerkat-community', 'meerkat-moderation')
          `);
          expect(activity.rows).toEqual([]);
          // Least-privilege boot: the community role must NOT hold the moderation
          // grants and the moderation role must NOT hold the community write grants.
          const grants = await admin.query<{ ready: boolean }>(`
            SELECT
              has_table_privilege('meerkat_community', 'community.private_states', 'SELECT,INSERT')
              AND has_table_privilege('meerkat_moderation', 'moderation.triage', 'SELECT,INSERT,UPDATE,DELETE')
              AND NOT has_table_privilege('meerkat_community', 'moderation.triage', 'INSERT')
              AND NOT has_table_privilege('meerkat_moderation', 'community.public_posts', 'INSERT')
              AS ready
          `);
          expect(grants.rows).toEqual([{ ready: true }]);
        } finally {
          await admin.end();
        }
      } finally {
        await fs.rm(dataDir, { recursive: true, force: true });
      }
    }, 30_000);

    it('closes both pools when HTTP startup fails after database readiness', async () => {
      const occupied = createServer();
      await new Promise<void>((resolve, reject) => {
        occupied.once('error', reject);
        occupied.listen(0, '127.0.0.1', resolve);
      });
      const address = occupied.address() as AddressInfo;
      const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-community-pg-fail-'));
      try {
        const result = runService(isolatedEnvironment({
          NODE_ENV: 'test',
          PORT: String(address.port),
          MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
          MEERKAT_STORE_BACKEND: 'postgres',
          MEERKAT_POSTGRES_URL: liveCommunityUrl,
          MEERKAT_MODERATION_POSTGRES_URL: liveModerationUrl,
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
          WHERE application_name IN ('meerkat-community', 'meerkat-moderation')
        `);
        expect(activity.rows).toEqual([]);
      } finally {
        await admin.end();
      }
    }, 30_000);
  },
);
