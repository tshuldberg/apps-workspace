import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { resolveMeerkatStoreRuntimeConfig } from '../runtime-config';

describe('resolveMeerkatStoreRuntimeConfig function quality gate', () => {
  it('keeps self-hosted file mode explicit and isolated from stray database URLs', () => {
    expect(resolveMeerkatStoreRuntimeConfig({
      service: 'humanity',
      env: {
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        MEERKAT_POSTGRES_URL: 'postgres://must-not-be-selected/example',
        DATA_DIR: '/srv/meerkat/humanity',
      },
    })).toEqual({
      profile: 'self-host',
      backend: 'file',
      productionMode: false,
      service: 'humanity',
      dataDir: '/srv/meerkat/humanity',
    });
  });

  it('requires a verified PostgreSQL authority for first-party production', () => {
    expect(resolveMeerkatStoreRuntimeConfig({
      service: 'community',
      productionMode: true,
      env: {
        MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
        MEERKAT_STORE_BACKEND: 'postgres',
        MEERKAT_POSTGRES_URL: 'postgres://community@example.test/meerkat',
        MEERKAT_POSTGRES_SSL_CA_FILE: '/run/secrets/postgres-ca.pem',
      },
    })).toEqual({
      profile: 'first-party',
      backend: 'postgres',
      productionMode: true,
      service: 'community',
      postgres: {
        connectionString: 'postgres://community@example.test/meerkat',
        sslMode: 'verify-full',
        sslCaFile: '/run/secrets/postgres-ca.pem',
        applicationName: 'meerkat-community',
      },
    });

    expect(() => resolveMeerkatStoreRuntimeConfig({
      service: 'community',
      productionMode: true,
      env: {
        MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: '/srv/meerkat/community',
      },
    })).toThrow(/require the PostgreSQL store backend/);
    expect(() => resolveMeerkatStoreRuntimeConfig({
      service: 'community',
      productionMode: true,
      env: {
        MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
        MEERKAT_STORE_BACKEND: 'postgres',
        MEERKAT_POSTGRES_URL: 'postgres://community@example.test/meerkat',
      },
    })).toThrow(/SSL_CA_FILE/);
    expect(() => resolveMeerkatStoreRuntimeConfig({
      service: 'community',
      productionMode: true,
      env: {
        MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
        MEERKAT_STORE_BACKEND: 'postgres',
        MEERKAT_POSTGRES_URL: 'postgres://community@example.test/meerkat',
        MEERKAT_POSTGRES_SSL_MODE: 'require',
      },
    })).toThrow(/verify-full TLS/);
  });

  it('resolves shadow mode with BOTH file and PostgreSQL config', () => {
    expect(resolveMeerkatStoreRuntimeConfig({
      service: 'community',
      productionMode: true,
      env: {
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'shadow',
        DATA_DIR: '/srv/meerkat/community',
        MEERKAT_POSTGRES_URL: 'postgres://community@example.test/meerkat',
        MEERKAT_POSTGRES_SSL_CA_FILE: '/run/secrets/postgres-ca.pem',
      },
    })).toEqual({
      profile: 'self-host',
      backend: 'shadow',
      productionMode: true,
      service: 'community',
      dataDir: '/srv/meerkat/community',
      postgres: {
        connectionString: 'postgres://community@example.test/meerkat',
        sslMode: 'verify-full',
        sslCaFile: '/run/secrets/postgres-ca.pem',
        applicationName: 'meerkat-community',
      },
    });
  });

  it('fails shadow mode closed when either the file dir OR the PostgreSQL URL is missing', () => {
    // Missing DATA_DIR (the file primary): fail closed naming DATA_DIR first.
    expect(() => resolveMeerkatStoreRuntimeConfig({
      service: 'community',
      env: {
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'shadow',
        MEERKAT_POSTGRES_URL: 'postgres://community@example.test/meerkat',
        MEERKAT_POSTGRES_SSL_MODE: 'disable',
      },
    })).toThrow(/DATA_DIR is required/);
    // Missing MEERKAT_POSTGRES_URL (the shadow mirror): fail closed naming it.
    expect(() => resolveMeerkatStoreRuntimeConfig({
      service: 'community',
      env: {
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'shadow',
        DATA_DIR: '/srv/meerkat/community',
      },
    })).toThrow(/MEERKAT_POSTGRES_URL is required/);
  });

  it('forbids shadow mode in the first-party profile (first-party stays PostgreSQL-only)', () => {
    expect(() => resolveMeerkatStoreRuntimeConfig({
      service: 'community',
      productionMode: true,
      env: {
        MEERKAT_DEPLOYMENT_PROFILE: 'first-party',
        MEERKAT_STORE_BACKEND: 'shadow',
        DATA_DIR: '/srv/meerkat/community',
        MEERKAT_POSTGRES_URL: 'postgres://community@example.test/meerkat',
        MEERKAT_POSTGRES_SSL_CA_FILE: '/run/secrets/postgres-ca.pem',
      },
    })).toThrow(/require the PostgreSQL store backend/);
  });

  it('requires explicit authority selection in production', () => {
    expect(() => resolveMeerkatStoreRuntimeConfig({
      service: 'persona',
      productionMode: true,
      env: { DATA_DIR: '/tmp/persona' },
    })).toThrow(/DEPLOYMENT_PROFILE/);
    expect(() => resolveMeerkatStoreRuntimeConfig({
      service: 'persona',
      productionMode: true,
      env: { MEERKAT_DEPLOYMENT_PROFILE: 'self-host', DATA_DIR: '/tmp/persona' },
    })).toThrow(/STORE_BACKEND/);
  });

  it('passes deterministic mode-combination fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'resolveMeerkatStoreRuntimeConfig fuzz',
      iterations: 100,
      seed: 44,
      makeCase: (rng) => ({
        profile: rng() < 0.5 ? 'self-host' : 'first-party',
        backend: rng() < 0.5 ? 'file' : 'postgres',
        productionMode: rng() < 0.5,
      }),
      assertCase: ({ profile, backend, productionMode }) => {
        const effectiveProfile = !productionMode && profile === 'first-party'
          ? 'self-host'
          : profile;
        const env = {
          MEERKAT_DEPLOYMENT_PROFILE: effectiveProfile,
          MEERKAT_STORE_BACKEND: backend,
          DATA_DIR: '/tmp/meerkat',
          MEERKAT_POSTGRES_URL: 'postgres://localhost/meerkat',
          MEERKAT_POSTGRES_SSL_MODE: productionMode ? 'verify-full' : 'disable',
          MEERKAT_POSTGRES_SSL_CA_FILE: productionMode ? '/tmp/test-ca.pem' : undefined,
        };
        if (effectiveProfile === 'first-party' && backend === 'file') {
          expect(() => resolveMeerkatStoreRuntimeConfig({
            service: 'hosted', env, productionMode,
          })).toThrow(/PostgreSQL/);
        } else {
          const resolved = resolveMeerkatStoreRuntimeConfig({
            service: 'hosted', env, productionMode,
          });
          expect(resolved.profile).toBe(effectiveProfile);
          expect(resolved.backend).toBe(backend);
        }
      },
    });
  });

  it('stays within constant complexity and bounded memory', async () => {
    const setup = () => ({
      service: 'directory',
      env: {
        MEERKAT_DEPLOYMENT_PROFILE: 'self-host',
        MEERKAT_STORE_BACKEND: 'file',
        DATA_DIR: '/tmp/directory',
      },
    });
    await assertComplexitySlope({
      label: 'resolveMeerkatStoreRuntimeConfig',
      sizes: [100, 500, 1000],
      expected: 'constant',
      setup,
      run: resolveMeerkatStoreRuntimeConfig,
    });
    await assertMemoryBudget({
      label: 'resolveMeerkatStoreRuntimeConfig',
      repeats: 500,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup,
      run: resolveMeerkatStoreRuntimeConfig,
    });
  });
});
