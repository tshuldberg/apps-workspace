import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const migrateBin = fileURLToPath(new URL('../../../bin/meerkat-postgres-migrate.mjs', import.meta.url));
const grantsBin = fileURLToPath(new URL('../../../bin/meerkat-postgres-role-grants.mjs', import.meta.url));
const runnerModule = fileURLToPath(new URL('../../../bin/run-local-tsx.mjs', import.meta.url));
const backupBin = fileURLToPath(new URL('../../../bin/meerkat-postgres-backup.mjs', import.meta.url));

function runBackupBin(args: string[], overrides: NodeJS.ProcessEnv = {}) {
  const env = { ...process.env };
  for (const key of [
    'MEERKAT_POSTGRES_URL',
    'MEERKAT_RELEASE_SHA',
    'MEERKAT_OBJECT_STORE_BACKEND',
    'MEERKAT_OBJECT_STORE_DIR',
    'MEERKAT_POSTGRES_SSL_MODE',
    'MEERKAT_POSTGRES_SSL_CA_FILE',
  ]) delete env[key];
  return spawnSync(backupBin, args, { cwd: repoRoot, encoding: 'utf8', env: { ...env, ...overrides } });
}

function stdoutLines(stdout: string): Record<string, unknown>[] {
  return stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
}

function runBin(bin: string, overrides: NodeJS.ProcessEnv = {}) {
  const env = { ...process.env };
  for (const key of [
    'DATABASE_URL',
    'MEERKAT_POSTGRES_SSL_MODE',
    'MEERKAT_POSTGRES_SSL_CA_FILE',
    'MEERKAT_POSTGRES_OWNER_ROLE',
  ]) delete env[key];
  return spawnSync(bin, [], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...env, ...overrides },
  });
}

async function waitForFile(file: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(file)) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${file}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('PostgreSQL operator CLIs', () => {
  it('runs the migration package bin directly and reports missing configuration safely', () => {
    const result = runBin(migrateBin);
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      event: 'fatal',
      reason: 'migration_failed',
      detail: 'DATABASE_URL is required',
    });
  });

  it('structures CA, TLS-mode, and connection failures without leaking credentials', () => {
    const secret = 'credential-sentinel';
    const unreadableCa = runBin(migrateBin, {
      DATABASE_URL: `postgres://meerkat:${secret}@127.0.0.1:1/meerkat_test`,
      MEERKAT_POSTGRES_SSL_CA_FILE: '/definitely/missing/meerkat-ca.pem',
    });
    expect(unreadableCa.status).toBe(1);
    expect(JSON.parse(unreadableCa.stdout)).toMatchObject({ event: 'fatal', reason: 'migration_failed' });
    expect(unreadableCa.stdout).not.toContain(secret);

    const invalidMode = runBin(migrateBin, {
      DATABASE_URL: `postgres://meerkat:${secret}@127.0.0.1:1/meerkat_test`,
      MEERKAT_POSTGRES_SSL_MODE: 'prefer',
    });
    expect(invalidMode.status).toBe(1);
    expect(invalidMode.stdout).toContain('Unsupported PostgreSQL TLS mode');
    expect(invalidMode.stdout).not.toContain(secret);

    const refused = runBin(migrateBin, {
      DATABASE_URL: `postgres://meerkat:${secret}@127.0.0.1:1/meerkat_test`,
      MEERKAT_POSTGRES_SSL_MODE: 'disable',
    });
    expect(refused.status).toBe(1);
    expect(JSON.parse(refused.stdout)).toMatchObject({ event: 'fatal', reason: 'migration_failed' });
    expect(refused.stdout).not.toContain(secret);
  });

  it('runs the role-grant bin directly and fails closed on an absent owner', () => {
    const missing = runBin(grantsBin);
    expect(missing.status).toBe(1);
    expect(JSON.parse(missing.stdout)).toMatchObject({ event: 'fatal', reason: 'role_grants_failed' });

    const rendered = runBin(grantsBin, { MEERKAT_POSTGRES_OWNER_ROLE: 'meerkat_schema_owner' });
    expect(rendered.status).toBe(0);
    expect(rendered.stdout).toContain('GRANT USAGE ON SCHEMA');
    expect(rendered.stdout).not.toContain('CREATE ROLE');
  });

  it('forwards termination signals to the active migration child', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'meerkat-postgres-signal-'));
    const readyFile = path.join(directory, 'ready');
    const receivedFile = path.join(directory, 'received');
    const source = `import { runLocalTsx } from ${JSON.stringify(runnerModule)}; await runLocalTsx('../src/postgres/__tests__/fixtures/signal-target.ts');`;
    const wrapper = spawn(process.execPath, ['--input-type=module', '--eval', source], {
      cwd: repoRoot,
      env: {
        ...process.env,
        MEERKAT_SIGNAL_READY_FILE: readyFile,
        MEERKAT_SIGNAL_RECEIVED_FILE: receivedFile,
      },
      stdio: 'ignore',
    });

    try {
      await waitForFile(readyFile);
      wrapper.kill('SIGTERM');
      const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
        wrapper.once('close', (code, signal) => resolve({ code, signal }));
      });
      expect(result).toEqual({ code: null, signal: 'SIGTERM' });
      expect(readFileSync(receivedFile, 'utf8')).toBe('SIGTERM');
    } finally {
      if (wrapper.exitCode === null && wrapper.signalCode === null) wrapper.kill('SIGKILL');
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('backup evidence CLI arg validation', () => {
  it('requires exactly one subcommand', () => {
    const result = runBackupBin([]);
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      reason: 'backup_cli_failed',
      detail: expect.stringContaining('Exactly one of'),
    });
  });

  it('requires a release SHA for a digest snapshot and never leaks the connection secret', () => {
    const secret = 'digest-credential-sentinel';
    const result = runBackupBin(['--digest-snapshot', '--out', '/tmp/does-not-matter.json'], {
      MEERKAT_POSTGRES_URL: `postgres://meerkat:${secret}@127.0.0.1:1/meerkat_test`,
    });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain(secret);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--release-sha'),
    });
  });

  it('requires the reference, restored-url, ops-url, source-backup-id, and backup-timestamp for a restore smoke', () => {
    const result = runBackupBin(['--restore-smoke', '--release-sha', 'abc'], {});
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--reference'),
    });
  });

  it('refuses a restore smoke whose restored database IS the ops database, without leaking the credentials', () => {
    const secret = 'ops-credential-sentinel';
    const url = `postgres://meerkat:${secret}@db.example.internal:5432/meerkat_prod`;
    const result = runBackupBin([
      '--restore-smoke',
      '--release-sha', 'abc',
      '--reference', '/tmp/reference.json',
      '--restored-url', url,
      '--ops-url', url,
      '--source-backup-id', 'backup-1',
      '--backup-timestamp', '2026-07-10T00:00:00.000Z',
    ]);
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain(secret);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('scratch restore'),
    });
  });
});
