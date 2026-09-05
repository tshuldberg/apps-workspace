import { spawn, spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Bin-level state-authority proof for MEERKAT_STORE_BACKEND=shadow (Plan 44 WP-3B).
 * Follows the established service-bin-state-authority pattern: spawn the real bin via tsx,
 * read the NDJSON boot log, assert fail-closed refusals and the ready report. The live
 * PostgreSQL boot is gated on MEERKAT_TEST_POSTGRES_URL.
 */

const require = createRequire(import.meta.url);
const tsxCli = require.resolve('tsx/cli');
const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));
const personaBin = path.join(packageRoot, 'bin/meerkat-persona-service.mjs');
const communityBin = path.join(packageRoot, 'bin/meerkat-community-node.mjs');

const secretSession = 'session-secret-that-must-not-be-logged';
const operatorSeed = 'a1'.repeat(32);
const postgresPassword = 'shadow-postgres-password-that-must-not-be-logged';

const liveCommunityUrl = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const liveModerationUrl = process.env.MEERKAT_TEST_MODERATION_POSTGRES_URL?.trim() ?? liveCommunityUrl;

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
  'MEERKAT_PERSONA_SESSION_SECRET',
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
  return { ...env, NODE_ENV: 'production', PORT: '0', HOST: '127.0.0.1', ...overrides };
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
  return stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
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
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('close', (status, signal) => { clearTimeout(timeout); resolve({ status, signal, stdout, stderr }); });
  });
}

describe('shadow-mode state authority bins', () => {
  it('refuses shadow mode in the first-party profile before opening a server', () => {
    const persona = runService(personaBin, personaEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'shadow',
      DATA_DIR: '/tmp/persona-shadow-must-not-open',
      MEERKAT_COMMUNITY_DATA_DIR: '/tmp/persona-shadow-community',
      MEERKAT_HOSTED_DATA_DIR: '/tmp/persona-shadow-hosted',
      MEERKAT_POSTGRES_URL: `postgres://persona:${postgresPassword}@example.test/meerkat`,
      MEERKAT_POSTGRES_SSL_CA_FILE: '/run/secrets/ca.pem',
    }));
    const community = runService(communityBin, isolatedEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'shadow',
      DATA_DIR: '/tmp/community-shadow-must-not-open',
      MEERKAT_POSTGRES_URL: `postgres://community:${postgresPassword}@example.test/meerkat`,
      MEERKAT_MODERATION_POSTGRES_URL: `postgres://moderation:${postgresPassword}@example.test/meerkat`,
      MEERKAT_POSTGRES_SSL_CA_FILE: '/run/secrets/ca.pem',
      MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
    }));

    for (const result of [persona, community]) {
      expect(result.status).toBe(1);
      expect(result.stderr).toBe('');
      expect(jsonEvents(result.stdout)).toContainEqual(expect.objectContaining({
        event: 'fatal',
        reason: 'state_authority_unavailable',
      }));
      expect(result.stdout).toContain('require the PostgreSQL store backend');
      expect(result.stdout).not.toContain('"event":"ready"');
      expect(result.stdout).not.toContain(postgresPassword);
    }
  });

  it('refuses shadow mode when the PostgreSQL shadow config is missing', () => {
    const persona = runService(personaBin, personaEnvironment({
      MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
      MEERKAT_STORE_BACKEND: 'shadow',
      DATA_DIR: '/tmp/persona-shadow-no-pg',
      MEERKAT_COMMUNITY_DATA_DIR: '/tmp/persona-shadow-community',
      MEERKAT_HOSTED_DATA_DIR: '/tmp/persona-shadow-hosted',
    }));
    expect(persona.status).toBe(1);
    expect(jsonEvents(persona.stdout)).toContainEqual(expect.objectContaining({
      event: 'fatal',
      reason: 'state_authority_unavailable',
      detail: 'MEERKAT_POSTGRES_URL is required',
    }));
    expect(persona.stdout).not.toContain('"event":"ready"');
    expect(persona.stdout).not.toContain(secretSession);
  });

  it('refuses community shadow mode when the moderation URL is missing', () => {
    const community = runService(communityBin, isolatedEnvironment({
      NODE_ENV: 'test',
      MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
      MEERKAT_STORE_BACKEND: 'shadow',
      DATA_DIR: '/tmp/community-shadow-no-moderation',
      MEERKAT_POSTGRES_URL: `postgres://community:${postgresPassword}@example.test/meerkat`,
      MEERKAT_POSTGRES_SSL_MODE: 'disable',
    }));
    expect(community.status).toBe(1);
    expect(jsonEvents(community.stdout)).toContainEqual(expect.objectContaining({
      event: 'fatal',
      reason: 'state_authority_unavailable',
    }));
    expect(community.stdout).toContain('MEERKAT_MODERATION_POSTGRES_URL');
    expect(community.stdout).not.toContain('"event":"ready"');
    expect(community.stdout).not.toContain(postgresPassword);
  });

  it('locks the shadow comparator wiring into both bins', async () => {
    const persona = await fs.readFile(personaBin, 'utf8');
    const community = await fs.readFile(communityBin, 'utf8');
    for (const source of [persona, community]) {
      expect(source).toContain('shadowedStore');
      expect(source).toContain("event: 'shadow_divergence'");
    }
    // The community bin routes every store through the single selectStore decision point.
    expect(community).toContain('const selectStore =');
  });
});

describe.runIf(Boolean(liveCommunityUrl))('live shadow-mode PostgreSQL bin authority', () => {
  it('boots the community node in shadow mode with file primary + PostgreSQL shadow and stops cleanly', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-shadow-bin-'));
    try {
      const community = await bootAndStopService(communityBin, isolatedEnvironment({
        NODE_ENV: 'test',
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'shadow',
        DATA_DIR: path.join(root, 'community'),
        MEERKAT_POSTGRES_URL: liveCommunityUrl!,
        MEERKAT_MODERATION_POSTGRES_URL: liveModerationUrl!,
        MEERKAT_POSTGRES_SSL_MODE: 'disable',
        MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
      }));
      expect(community.status).toBe(0);
      expect(community.signal).toBeNull();
      expect(community.stderr).toBe('');
      expect(jsonEvents(community.stdout)).toContainEqual(expect.objectContaining({
        event: 'ready',
        stateBackend: 'shadow',
      }));
      expect(jsonEvents(community.stdout)).toContainEqual(expect.objectContaining({
        event: 'shutdown',
        signal: 'SIGTERM',
      }));
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  }, 30_000);
});
