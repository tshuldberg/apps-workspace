import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const releaseBin = fileURLToPath(new URL('../../../bin/meerkat-release.mjs', import.meta.url));

function runReleaseBin(args: string[], overrides: NodeJS.ProcessEnv = {}) {
  const env = { ...process.env };
  for (const key of [
    'MEERKAT_POSTGRES_URL',
    'MEERKAT_POSTGRES_SSL_MODE',
    'MEERKAT_POSTGRES_SSL_CA_FILE',
  ]) delete env[key];
  return spawnSync(releaseBin, args, { cwd: repoRoot, encoding: 'utf8', env: { ...env, ...overrides } });
}

function stdoutLines(stdout: string): Record<string, unknown>[] {
  return stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('release manifest CLI arg validation', () => {
  it('requires exactly one subcommand', () => {
    const result = runReleaseBin([]);
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      reason: 'release_cli_failed',
      detail: expect.stringContaining('Exactly one of'),
    });
  });

  it('rejects two subcommands at once', () => {
    const result = runReleaseBin(['--record', '--status']);
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('Exactly one of'),
    });
  });

  it('requires --manifest for --record', () => {
    const result = runReleaseBin(['--record', '--release-id', 'release-1'], {
      MEERKAT_POSTGRES_URL: 'postgres://meerkat:secret@127.0.0.1:1/meerkat_test',
    });
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--manifest'),
    });
  });

  it('requires --release-id for --record', () => {
    const result = runReleaseBin(['--record', '--manifest', '/tmp/does-not-matter.json'], {
      MEERKAT_POSTGRES_URL: 'postgres://meerkat:secret@127.0.0.1:1/meerkat_test',
    });
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--release-id'),
    });
  });

  it('requires --expected-version for --approve', () => {
    const result = runReleaseBin(['--approve', '--release-id', 'release-1'], {
      MEERKAT_POSTGRES_URL: 'postgres://meerkat:secret@127.0.0.1:1/meerkat_test',
    });
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--expected-version'),
    });
  });

  it('requires at least one --image for --verify', () => {
    const result = runReleaseBin(['--verify', '--release-id', 'release-1'], {
      MEERKAT_POSTGRES_URL: 'postgres://meerkat:secret@127.0.0.1:1/meerkat_test',
    });
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--image'),
    });
  });

  it('reports missing MEERKAT_POSTGRES_URL without leaking anything for --status', () => {
    const result = runReleaseBin(['--status']);
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('MEERKAT_POSTGRES_URL'),
    });
  });

  it('never leaks the connection-string password on a fatal path', () => {
    const secret = 'release-credential-sentinel';
    const result = runReleaseBin(['--status'], {
      // A bad SSL mode forces a fatal before any query; the redactor must scrub the userinfo.
      MEERKAT_POSTGRES_URL: `postgres://meerkat:${secret}@127.0.0.1:1/meerkat_test`,
      MEERKAT_POSTGRES_SSL_MODE: 'prefer',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain(secret);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({ event: 'fatal', reason: 'release_cli_failed' });
  });
});
