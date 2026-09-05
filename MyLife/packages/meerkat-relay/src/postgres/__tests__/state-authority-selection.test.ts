import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const runnerModule = fileURLToPath(new URL('../../../bin/run-local-tsx.mjs', import.meta.url));
const source = `import { runLocalTsx } from ${JSON.stringify(runnerModule)}; await runLocalTsx('./meerkat-verification-service.mjs');`;

function runVerificationService(overrides: NodeJS.ProcessEnv) {
  const env = { ...process.env };
  for (const key of [
    'DATA_DIR',
    'MEERKAT_DEPLOYMENT_PROFILE',
    'MEERKAT_STORE_BACKEND',
    'MEERKAT_POSTGRES_URL',
    'MEERKAT_POSTGRES_SSL_MODE',
    'MEERKAT_POSTGRES_SSL_CA_FILE',
  ]) delete env[key];
  return spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...env,
      NODE_ENV: 'production',
      HUMANITY_SIGNING_KEY: '11'.repeat(32),
      TURNSTILE_SECRET: 'test-turnstile-secret',
      MEERKAT_ALLOWED_ORIGINS: 'https://app.example.test',
      ...overrides,
    },
  });
}

describe('humanity state authority selection', () => {
  it('refuses a first-party file backend before opening a server', () => {
    const result = runVerificationService({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'file',
      DATA_DIR: '/tmp/must-not-open',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      event: 'fatal',
      reason: 'state_authority_unavailable',
    });
    expect(result.stdout).toContain('require the PostgreSQL store backend');
    expect(result.stdout).not.toContain('listening');
  });

  it('refuses an incomplete first-party PostgreSQL configuration without fallback', () => {
    const result = runVerificationService({
      MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
      MEERKAT_STORE_BACKEND: 'postgres',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toMatchObject({
      event: 'fatal',
      reason: 'state_authority_unavailable',
      detail: 'MEERKAT_POSTGRES_URL is required',
    });
    expect(result.stdout).not.toContain('listening');
  });
});
