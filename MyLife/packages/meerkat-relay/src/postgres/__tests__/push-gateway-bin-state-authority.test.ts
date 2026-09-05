import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promises as fs, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));
const pushBin = path.join(packageRoot, 'bin/meerkat-push-gateway.mjs');
const liveAdminUrl = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();

const clearedEnvironmentKeys = [
  'NODE_ENV', 'PORT', 'HOST', 'DATA_DIR',
  'MEERKAT_DEPLOYMENT_PROFILE', 'MEERKAT_STORE_BACKEND',
  'MEERKAT_POSTGRES_URL', 'MEERKAT_POSTGRES_SSL_MODE', 'MEERKAT_POSTGRES_SSL_CA_FILE',
  'MEERKAT_PUSH_TOKEN_KEYS_DIR', 'MEERKAT_PUSH_TOKEN_ACTIVE_VERSION',
  'MEERKAT_PUSH_APNS_KEY_FILE', 'MEERKAT_PUSH_FCM_SERVICE_ACCOUNT_FILE',
  'MEERKAT_PUSH_VAPID_PRIVATE_KEY_FILE', 'MEERKAT_ALLOWED_ORIGINS',
] as const;

async function keyDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'push-bin-keys-'));
  await fs.writeFile(path.join(dir, '1.key'), randomBytes(32).toString('hex'));
  return dir;
}

function isolatedEnvironment(overrides: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of clearedEnvironmentKeys) delete env[key];
  return {
    ...env,
    NODE_ENV: 'test',
    PORT: '0',
    HOST: '127.0.0.1',
    MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
    MEERKAT_PUSH_TOKEN_ACTIVE_VERSION: '1',
    ...overrides,
  };
}

function runService(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [tsxCli, pushBin], {
    cwd: packageRoot, encoding: 'utf8', env, timeout: 15_000,
  });
}

function jsonEvents(stdout: string): Array<Record<string, unknown>> {
  return stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function bootAndStopService(env: NodeJS.ProcessEnv): Promise<{ status: number | null; signal: NodeJS.Signals | null; stdout: string; stderr: string }> {
  const child = spawn(process.execPath, [tsxCli, pushBin], { cwd: packageRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  let stopSent = false;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Timed out')); }, 15_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (!stopSent && stdout.includes('"event":"ready"')) { stopSent = true; child.kill('SIGTERM'); }
    });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('close', (status, signal) => { clearTimeout(timeout); resolve({ status, signal, stdout, stderr }); });
  });
}

describe('push gateway state authority bin', () => {
  it('refuses to boot without a token cipher keyring', () => {
    const result = runService(isolatedEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'self-host', MEERKAT_STORE_BACKEND: 'file', DATA_DIR: '/tmp/push-no-keys',
    }));
    expect(result.status).toBe(1);
    expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
      event: 'fatal', reason: 'token_cipher_config_missing',
    }));
    expect(result.stdout).not.toContain('"event":"ready"');
  });

  it('refuses first-party file mode before opening a server', async () => {
    const keys = await keyDir();
    try {
      const result = runService(isolatedEnvironment({
        MEERKAT_DEPLOYMENT_PROFILE: 'first-party', MEERKAT_STORE_BACKEND: 'file', DATA_DIR: '/tmp/push-must-not-open',
        MEERKAT_PUSH_TOKEN_KEYS_DIR: keys,
      }));
      expect(result.status).toBe(1);
      expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
        event: 'fatal', reason: 'state_authority_unavailable',
      }));
      expect(result.stdout).toContain('require the PostgreSQL store backend');
      expect(result.stdout).not.toContain('"event":"ready"');
    } finally {
      await fs.rm(keys, { recursive: true, force: true });
    }
  });

  it('fails closed with an unreadable key file, redacting the key material', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'push-bin-badkeys-'));
    await fs.writeFile(path.join(dir, '1.key'), 'not-a-valid-32-byte-key');
    try {
      const result = runService(isolatedEnvironment({
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host', MEERKAT_STORE_BACKEND: 'file', DATA_DIR: '/tmp/push-badkeys',
        MEERKAT_PUSH_TOKEN_KEYS_DIR: dir,
      }));
      expect(result.status).toBe(1);
      expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
        event: 'fatal', reason: 'token_cipher_unavailable',
      }));
      expect(result.stdout).not.toContain('"event":"ready"');
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('boots and cleanly stops the complete self-hosted file path', async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'push-bin-data-'));
    const keys = await keyDir();
    try {
      const result = await bootAndStopService(isolatedEnvironment({
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host', MEERKAT_STORE_BACKEND: 'file', DATA_DIR: dataDir,
        MEERKAT_PUSH_TOKEN_KEYS_DIR: keys,
      }));
      expect(result.status).toBe(0);
      expect(result.signal).toBeNull();
      expect(result.stderr).toBe('');
      expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
        event: 'ready', stateBackend: 'file', dataDir,
      }));
      expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
        event: 'shutdown', signal: 'SIGTERM',
      }));
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
      await fs.rm(keys, { recursive: true, force: true });
    }
  }, 30_000);

  it('locks the state-authority + cipher graph into the bin source', () => {
    const source = readFileSync(pushBin, 'utf8');
    expect(source).toContain("service: 'push'");
    expect(source).toContain('resolveMeerkatStoreRuntimeConfig');
    expect(source).toContain('createMeerkatStoreRuntime');
    expect(source).toContain('new PostgresPushRegistrationStore(storeRuntime.database)');
    expect(source).toContain('new FilePushRegistrationStore(runtimeConfig.dataDir)');
    expect(source).toContain('loadAesGcmPushTokenCipherFromDir');
    expect(source).toContain('meerkat_push_attempts_total');
    // The cipher readiness is a REQUIRED readyz check.
    expect(source).toContain("name: 'token_cipher'");
    expect(source).toContain('gateway.drainOnce()');
  });
});

describe.runIf(Boolean(liveAdminUrl))('live push gateway PostgreSQL bin authority', () => {
  it('boots under the push role and closes its pool on signal', async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'push-bin-pg-'));
    const keys = await keyDir();
    try {
      const result = await bootAndStopService(isolatedEnvironment({
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host', MEERKAT_STORE_BACKEND: 'postgres',
        MEERKAT_POSTGRES_URL: liveAdminUrl, MEERKAT_POSTGRES_SSL_MODE: 'disable',
        DATA_DIR: dataDir, MEERKAT_PUSH_TOKEN_KEYS_DIR: keys,
      }));
      expect(result.status).toBe(0);
      expect(result.signal).toBeNull();
      expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
        event: 'ready', stateBackend: 'postgres',
      }));
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
      await fs.rm(keys, { recursive: true, force: true });
    }
  }, 30_000);
});

// Referenced so the pg import is used only when the live suite runs.
void pg;
