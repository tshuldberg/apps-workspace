import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const rehearsalBin = fileURLToPath(new URL('../../../bin/meerkat-rehearsal.mjs', import.meta.url));

function runRehearsalBin(args: string[], overrides: NodeJS.ProcessEnv = {}) {
  const env = { ...process.env };
  for (const key of [
    'MEERKAT_POSTGRES_URL',
    'MEERKAT_POSTGRES_SSL_MODE',
    'MEERKAT_POSTGRES_SSL_CA_FILE',
  ]) delete env[key];
  return spawnSync(rehearsalBin, args, { cwd: repoRoot, encoding: 'utf8', env: { ...env, ...overrides } });
}

function stdoutLines(stdout: string): Record<string, unknown>[] {
  return stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
}

const DEAD_URL = 'postgres://meerkat:secret@127.0.0.1:1/meerkat_test';

describe('rehearsal CLI arg validation', () => {
  it('requires exactly one subcommand', () => {
    const result = runRehearsalBin([]);
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      reason: 'rehearsal_cli_failed',
      detail: expect.stringContaining('Exactly one of'),
    });
  });

  it('rejects two subcommands at once', () => {
    const result = runRehearsalBin(['--record', '--status']);
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('Exactly one of'),
    });
  });

  it('requires --kind for --record', () => {
    const result = runRehearsalBin(['--record', '--verdict', 'failed', '--started-at', '2026-07-11T00:00:00Z'], {
      MEERKAT_POSTGRES_URL: DEAD_URL,
    });
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--kind'),
    });
  });

  it('requires --verdict for --record', () => {
    const result = runRehearsalBin(['--record', '--kind', 'load', '--started-at', '2026-07-11T00:00:00Z'], {
      MEERKAT_POSTGRES_URL: DEAD_URL,
    });
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--verdict'),
    });
  });

  it('requires --started-at for --record', () => {
    const result = runRehearsalBin(['--record', '--kind', 'load', '--verdict', 'failed'], {
      MEERKAT_POSTGRES_URL: DEAD_URL,
    });
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--started-at'),
    });
  });

  it('makes a passed verdict without --evidence fatal, mentioning evidence, before any connection', () => {
    const result = runRehearsalBin(
      ['--record', '--kind', 'load', '--verdict', 'passed', '--started-at', '2026-07-11T00:00:00Z'],
      { MEERKAT_POSTGRES_URL: DEAD_URL },
    );
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--evidence'),
    });
  });

  it('makes a passed verdict with a VACUOUS evidence file fatal before any connection', () => {
    const dir = mkdtempSync(join(tmpdir(), 'meerkat-rehearsal-cli-'));
    try {
      const evidencePath = join(dir, 'vacuous.json');
      writeFileSync(evidencePath, '{}');
      const result = runRehearsalBin(
        ['--record', '--kind', 'load', '--verdict', 'passed', '--started-at', '2026-07-11T00:00:00Z', '--evidence', evidencePath],
        { MEERKAT_POSTGRES_URL: DEAD_URL },
      );
      expect(result.status).toBe(1);
      expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
        event: 'fatal',
        detail: expect.stringContaining('vacuous'),
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('requires --release-id for --export-evidence', () => {
    const result = runRehearsalBin(['--export-evidence'], { MEERKAT_POSTGRES_URL: DEAD_URL });
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--release-id'),
    });
  });

  it('reports missing MEERKAT_POSTGRES_URL without leaking anything for --history', () => {
    const result = runRehearsalBin(['--history']);
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('MEERKAT_POSTGRES_URL'),
    });
  });

  it('never leaks the connection-string password on a fatal path', () => {
    const secret = 'rehearsal-credential-sentinel';
    const result = runRehearsalBin(['--status'], {
      // A bad SSL mode forces a fatal before any query; the redactor must scrub the userinfo.
      MEERKAT_POSTGRES_URL: `postgres://meerkat:${secret}@127.0.0.1:1/meerkat_test`,
      MEERKAT_POSTGRES_SSL_MODE: 'prefer',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain(secret);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({ event: 'fatal', reason: 'rehearsal_cli_failed' });
  });
});
