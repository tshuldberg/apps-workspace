import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const promotionBin = fileURLToPath(new URL('../../../bin/meerkat-promotion.mjs', import.meta.url));

function runPromotionBin(args: string[], overrides: NodeJS.ProcessEnv = {}) {
  const env = { ...process.env };
  for (const key of [
    'MEERKAT_POSTGRES_URL',
    'MEERKAT_POSTGRES_SSL_MODE',
    'MEERKAT_POSTGRES_SSL_CA_FILE',
  ]) delete env[key];
  return spawnSync(promotionBin, args, { cwd: repoRoot, encoding: 'utf8', env: { ...env, ...overrides } });
}

function stdoutLines(stdout: string): Record<string, unknown>[] {
  return stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('release promotion CLI arg validation', () => {
  it('requires exactly one subcommand', () => {
    const result = runPromotionBin([]);
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      reason: 'promotion_cli_failed',
      detail: expect.stringContaining('Exactly one of'),
    });
  });

  it('rejects two subcommands at once', () => {
    const result = runPromotionBin(['--promote', '--status']);
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('Exactly one of'),
    });
  });

  it('requires --release-id for --promote', () => {
    const result = runPromotionBin(['--promote', '--to', 'staging'], {
      MEERKAT_POSTGRES_URL: 'postgres://meerkat:secret@127.0.0.1:1/meerkat_test',
    });
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--release-id'),
    });
  });

  it('rejects a --to value outside the forward ladder', () => {
    const result = runPromotionBin(['--promote', '--release-id', 'rel-1', '--to', 'rolled_back'], {
      MEERKAT_POSTGRES_URL: 'postgres://meerkat:secret@127.0.0.1:1/meerkat_test',
    });
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--to must be one of'),
    });
  });

  it('requires --evidence with a passing verdict for canary-gated rungs', () => {
    const result = runPromotionBin(['--promote', '--release-id', 'rel-1', '--to', 'staging_canary'], {
      MEERKAT_POSTGRES_URL: 'postgres://meerkat:secret@127.0.0.1:1/meerkat_test',
    });
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--evidence'),
    });
  });

  it('requires --rollback-to for --rollback', () => {
    const result = runPromotionBin(['--rollback', '--release-id', 'rel-1'], {
      MEERKAT_POSTGRES_URL: 'postgres://meerkat:secret@127.0.0.1:1/meerkat_test',
    });
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--rollback-to'),
    });
  });

  it('requires --release-id for --status', () => {
    const result = runPromotionBin(['--status'], {
      MEERKAT_POSTGRES_URL: 'postgres://meerkat:secret@127.0.0.1:1/meerkat_test',
    });
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('--release-id'),
    });
  });

  it('reports missing MEERKAT_POSTGRES_URL without leaking anything for --history', () => {
    const result = runPromotionBin(['--history', '--release-id', 'rel-1']);
    expect(result.status).toBe(1);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({
      event: 'fatal',
      detail: expect.stringContaining('MEERKAT_POSTGRES_URL'),
    });
  });

  it('never leaks the connection-string password on a fatal path', () => {
    const secret = 'promotion-credential-sentinel';
    const result = runPromotionBin(['--status', '--release-id', 'rel-1'], {
      // A bad SSL mode forces a fatal before any query; the redactor must scrub the userinfo.
      MEERKAT_POSTGRES_URL: `postgres://meerkat:${secret}@127.0.0.1:1/meerkat_test`,
      MEERKAT_POSTGRES_SSL_MODE: 'prefer',
    });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain(secret);
    expect(stdoutLines(result.stdout).at(-1)).toMatchObject({ event: 'fatal', reason: 'promotion_cli_failed' });
  });
});
