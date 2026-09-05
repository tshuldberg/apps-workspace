import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkBuildEnv,
  readManifestSchema,
  schemaRequiredPaths,
} from '../../scripts/check-build-env.mjs';

const PROJECT_REF = 'abcdefghijklmnopqrst';
const GOOD_ENV = {
  EAS_BUILD_PROFILE: 'production',
  EAS_BUILD_PLATFORM: 'ios',
  EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS: 'appl_live_public_key',
  EXPO_PUBLIC_MYNEWS_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
  EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY: 'sb_publishable_live_1234567890',
  EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL: `https://${PROJECT_REF}.supabase.co/functions/v1`,
  EXPO_PUBLIC_MYNEWS_PAYMENTS_ENABLED: 'true',
  EXPO_PUBLIC_MYNEWS_PAYMENTS_PROVIDER: 'stripe',
  EXPO_PUBLIC_MYNEWS_LEGAL_EMAIL: 'legal@controlled-domain.net',
  EXPO_PUBLIC_MYNEWS_SAFETY_EMAIL: 'safety@controlled-domain.net',
  EXPO_PUBLIC_MYNEWS_DMCA_EMAIL: 'dmca@controlled-domain.net',
};

const temporaryDirectories = [];

function manifest(overrides = {}) {
  return {
    schemaVersion: 1,
    appVersion: '1.0.0',
    backendProjectRef: PROJECT_REF,
    controlledOrigin: 'https://news.controlled-domain.net',
    paymentsLive: true,
    legalContacts: {
      support: 'support@controlled-domain.net',
      legal: 'legal@controlled-domain.net',
      safety: 'safety@controlled-domain.net',
      privacy: 'privacy@controlled-domain.net',
      dmca: 'dmca@controlled-domain.net',
    },
    policyVersions: {
      terms: '2026-07-05',
      privacy: '2026-07-05',
      guidelines: '2026-07-05',
    },
    smokeReceipt: {
      timestamp: '2026-07-12T12:00:00.000Z',
      checklist: {
        cloudConnection: true,
        readerFeed: true,
        subscriptionPurchase: true,
        subscriptionRestore: true,
        supportCheckout: true,
        paymentWebhook: true,
        supportHistory: true,
        journalistPayoutStatus: true,
      },
    },
    deployAttestation: {
      attestedBy: 'release-operator',
      attestedAt: '2026-07-12T12:00:00.000Z',
      workerSecrets: {
        nciiWorker: true,
        supportWorker: true,
        paymentsWebhook: true,
        accountWorker: true,
      },
    },
    ...overrides,
  };
}

/** Deletes a dotted path from a plain object clone. */
function without(value, dottedPath) {
  const clone = structuredClone(value);
  const parts = dottedPath.split('.');
  let cursor = clone;
  for (const part of parts.slice(0, -1)) {
    if (!cursor || typeof cursor !== 'object') return clone;
    cursor = cursor[part];
  }
  if (cursor && typeof cursor === 'object') delete cursor[parts[parts.length - 1]];
  return clone;
}

function writeManifest(value = manifest()) {
  const directory = mkdtempSync(join(tmpdir(), 'mynews-release-'));
  temporaryDirectories.push(directory);
  const path = join(directory, 'release-manifest.json');
  writeFileSync(path, JSON.stringify(value));
  return path;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('checkBuildEnv production release gate', () => {
  it('skips non-production profiles without reading a manifest', () => {
    expect(checkBuildEnv({ EAS_BUILD_PROFILE: 'preview' }).skipped).toBe(true);
  });

  it('passes a complete production environment and release manifest', () => {
    const result = checkBuildEnv(GOOD_ENV, { manifestPath: writeManifest() });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('passes Android only with a goog_ platform key', () => {
    const result = checkBuildEnv(
      {
        ...GOOD_ENV,
        EAS_BUILD_PLATFORM: 'android',
        EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS: undefined,
        EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_ANDROID: 'goog_live_public_key',
      },
      { manifestPath: writeManifest() },
    );
    expect(result.ok).toBe(true);
  });

  it('lists every missing required environment key by exact name', () => {
    const result = checkBuildEnv(
      { EAS_BUILD_PROFILE: 'production', EAS_BUILD_PLATFORM: 'ios' },
      { manifestPath: writeManifest() },
    );
    expect(result.ok).toBe(false);
    const errors = result.errors.join('\n');
    expect(errors).toContain('EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS:');
    expect(errors).toContain('EXPO_PUBLIC_MYNEWS_SUPABASE_URL:');
    expect(errors).toContain('EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY:');
    expect(errors).toContain('EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL:');
  });

  it('rejects wrong RevenueCat prefixes, insecure URLs, and test entitlement mode', () => {
    const result = checkBuildEnv(
      {
        ...GOOD_ENV,
        EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS: 'goog_wrong_store',
        EXPO_PUBLIC_MYNEWS_SUPABASE_URL: 'http://local',
        EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL: 'https://replace-me.invalid',
        EXPO_PUBLIC_MYNEWS_ENTITLEMENTS_TEST_MODE: 'true',
      },
      { manifestPath: writeManifest() },
    );
    const errors = result.errors.join('\n');
    expect(errors).toContain('EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS:');
    expect(errors).toContain('EXPO_PUBLIC_MYNEWS_SUPABASE_URL:');
    expect(errors).toContain('EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL:');
    expect(errors).toContain('EXPO_PUBLIC_MYNEWS_ENTITLEMENTS_TEST_MODE:');
  });

  it('fails with the manifest path key when the file is absent', () => {
    const result = checkBuildEnv(GOOD_ENV, {
      manifestPath: '/tmp/definitely-missing-mynews-release-manifest.json',
    });
    expect(result.errors.join('\n')).toContain('apps/mynews/release-manifest.json:');
  });

  it('rejects placeholder origin, project ref, and every @mynews.app contact', () => {
    const result = checkBuildEnv(GOOD_ENV, {
      manifestPath: writeManifest(
        manifest({
          backendProjectRef: 'REPLACE_ME_PROJECT_REF',
          controlledOrigin: 'https://mynews.app',
          legalContacts: {
            support: 'support@mynews.app',
            legal: 'legal@mynews.app',
            safety: 'safety@mynews.app',
            privacy: 'privacy@mynews.app',
            dmca: 'dmca@mynews.app',
          },
        }),
      ),
    });
    const errors = result.errors.join('\n');
    expect(errors).toContain('releaseManifest.backendProjectRef:');
    expect(errors).toContain('releaseManifest.controlledOrigin:');
    for (const key of ['support', 'legal', 'safety', 'privacy', 'dmca']) {
      expect(errors).toContain(`releaseManifest.legalContacts.${key}:`);
    }
  });

  it('pins appVersion and the terms policy to source files', () => {
    const result = checkBuildEnv(GOOD_ENV, {
      manifestPath: writeManifest(
        manifest({
          appVersion: '9.9.9',
          policyVersions: {
            terms: 'old-version',
            privacy: '2026-07-05',
            guidelines: '2026-07-05',
          },
        }),
      ),
    });
    expect(result.errors.join('\n')).toContain('releaseManifest.appVersion:');
    expect(result.errors.join('\n')).toContain('releaseManifest.policyVersions.terms:');
  });

  it('requires a timestamp and every true production smoke check', () => {
    const result = checkBuildEnv(GOOD_ENV, {
      manifestPath: writeManifest(
        manifest({
          smokeReceipt: {
            timestamp: 'not-a-date',
            checklist: {
              cloudConnection: true,
              readerFeed: true,
              subscriptionPurchase: false,
            },
          },
        }),
      ),
    });
    const errors = result.errors.join('\n');
    expect(errors).toContain('releaseManifest.smokeReceipt.timestamp:');
    expect(errors).toContain('releaseManifest.smokeReceipt.checklist.subscriptionPurchase:');
    expect(errors).toContain('releaseManifest.smokeReceipt.checklist.paymentWebhook:');
  });

  it('validates the manifest against the schema FILE, so a schema-required field cannot be dropped without failing the gate', () => {
    const schema = readManifestSchema();
    const requiredPaths = schemaRequiredPaths(schema);
    // Guards the derivation itself: a schema that stopped declaring required
    // fields would make the loop below vacuously pass.
    expect(requiredPaths).toContain('paymentsLive');
    expect(requiredPaths).toContain('deployAttestation.workerSecrets.supportWorker');
    expect(requiredPaths.length).toBeGreaterThan(20);

    for (const path of requiredPaths) {
      const result = checkBuildEnv(GOOD_ENV, {
        manifestPath: writeManifest(without(manifest(), path)),
      });
      expect(result.ok, `removing ${path} must fail the gate`).toBe(false);
      expect(result.errors.join('\n'), `removing ${path} must be reported by name`).toContain(
        `releaseManifest.${path}`,
      );
    }
  });

  it('rejects a manifest property the schema does not allow', () => {
    const result = checkBuildEnv(GOOD_ENV, {
      manifestPath: writeManifest(manifest({ sneakyExtraField: 'nope' })),
    });
    expect(result.errors.join('\n')).toContain('releaseManifest.sneakyExtraField:');
  });

  it('requires the payments env to agree with releaseManifest.paymentsLive in both directions', () => {
    const liveManifestOffEnv = checkBuildEnv(
      {
        ...GOOD_ENV,
        EXPO_PUBLIC_MYNEWS_PAYMENTS_ENABLED: 'false',
        EXPO_PUBLIC_MYNEWS_PAYMENTS_PROVIDER: undefined,
      },
      { manifestPath: writeManifest() },
    );
    const liveErrors = liveManifestOffEnv.errors.join('\n');
    expect(liveErrors).toContain('EXPO_PUBLIC_MYNEWS_PAYMENTS_ENABLED:');
    expect(liveErrors).toContain('EXPO_PUBLIC_MYNEWS_PAYMENTS_PROVIDER:');

    const offManifestLiveEnv = checkBuildEnv(GOOD_ENV, {
      manifestPath: writeManifest(
        manifest({
          paymentsLive: false,
          smokeReceipt: {
            timestamp: '2026-07-12T12:00:00.000Z',
            checklist: {
              cloudConnection: true,
              readerFeed: true,
              subscriptionPurchase: true,
              subscriptionRestore: true,
              supportCheckout: false,
              paymentWebhook: false,
              supportHistory: false,
              journalistPayoutStatus: false,
            },
          },
        }),
      ),
    });
    const offErrors = offManifestLiveEnv.errors.join('\n');
    expect(offErrors).toContain('EXPO_PUBLIC_MYNEWS_PAYMENTS_ENABLED:');
    expect(offErrors).toContain('EXPO_PUBLIC_MYNEWS_PAYMENTS_PROVIDER:');
  });

  it('passes a payments-off release whose env and smoke receipt both say off', () => {
    const result = checkBuildEnv(
      {
        ...GOOD_ENV,
        EXPO_PUBLIC_MYNEWS_PAYMENTS_ENABLED: undefined,
        EXPO_PUBLIC_MYNEWS_PAYMENTS_PROVIDER: undefined,
      },
      {
        manifestPath: writeManifest(
          manifest({
            paymentsLive: false,
            smokeReceipt: {
              timestamp: '2026-07-12T12:00:00.000Z',
              checklist: {
                cloudConnection: true,
                readerFeed: true,
                subscriptionPurchase: true,
                subscriptionRestore: true,
                supportCheckout: false,
                paymentWebhook: false,
                supportHistory: false,
                journalistPayoutStatus: false,
              },
            },
          }),
        ),
      },
    );
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('refuses a payments-off release that claims a support smoke pass', () => {
    const result = checkBuildEnv(
      {
        ...GOOD_ENV,
        EXPO_PUBLIC_MYNEWS_PAYMENTS_ENABLED: undefined,
        EXPO_PUBLIC_MYNEWS_PAYMENTS_PROVIDER: undefined,
      },
      { manifestPath: writeManifest(manifest({ paymentsLive: false })) },
    );
    expect(result.errors.join('\n')).toContain(
      'releaseManifest.smokeReceipt.checklist.supportCheckout:',
    );
  });

  it('requires the in-app legal contact envs the app reads, matching the manifest', () => {
    const missing = checkBuildEnv(
      {
        ...GOOD_ENV,
        EXPO_PUBLIC_MYNEWS_LEGAL_EMAIL: undefined,
        EXPO_PUBLIC_MYNEWS_SAFETY_EMAIL: 'safety@mynews.app',
        EXPO_PUBLIC_MYNEWS_DMCA_EMAIL: 'dmca@REPLACE_ME.invalid',
      },
      { manifestPath: writeManifest() },
    );
    const errors = missing.errors.join('\n');
    expect(errors).toContain('EXPO_PUBLIC_MYNEWS_LEGAL_EMAIL:');
    expect(errors).toContain('EXPO_PUBLIC_MYNEWS_SAFETY_EMAIL:');
    expect(errors).toContain('EXPO_PUBLIC_MYNEWS_DMCA_EMAIL:');

    const mismatched = checkBuildEnv(
      { ...GOOD_ENV, EXPO_PUBLIC_MYNEWS_LEGAL_EMAIL: 'other@controlled-domain.net' },
      { manifestPath: writeManifest() },
    );
    expect(mismatched.errors.join('\n')).toContain(
      'EXPO_PUBLIC_MYNEWS_LEGAL_EMAIL: must equal releaseManifest.legalContacts.legal',
    );
  });

  it('requires an explicit operator attestation for every deploy-side worker secret', () => {
    const result = checkBuildEnv(GOOD_ENV, {
      manifestPath: writeManifest(
        manifest({
          deployAttestation: {
            attestedBy: 'release-operator',
            attestedAt: '2026-07-12T12:00:00.000Z',
            workerSecrets: {
              nciiWorker: true,
              supportWorker: false,
              paymentsWebhook: false,
              accountWorker: false,
            },
          },
        }),
      ),
    });
    const errors = result.errors.join('\n');
    expect(errors).toContain('releaseManifest.deployAttestation.workerSecrets.supportWorker:');
    expect(errors).toContain('releaseManifest.deployAttestation.workerSecrets.paymentsWebhook:');
    expect(errors).toContain('releaseManifest.deployAttestation.workerSecrets.accountWorker:');
    expect(errors).not.toContain('releaseManifest.deployAttestation.workerSecrets.nciiWorker:');
  });

  it('requires backendProjectRef to match the configured Supabase URL', () => {
    const result = checkBuildEnv(GOOD_ENV, {
      manifestPath: writeManifest(manifest({ backendProjectRef: 'zyxwvutsrqponmlkjihg' })),
    });
    expect(result.errors.join('\n')).toContain(
      'releaseManifest.backendProjectRef: must match EXPO_PUBLIC_MYNEWS_SUPABASE_URL',
    );
  });

  it('proves the CLI failure and pass paths by spawning the checker', () => {
    const script = resolve(process.cwd(), 'scripts/check-build-env.mjs');
    const goodManifest = writeManifest();
    expect(() =>
      execFileSync(process.execPath, [script], {
        cwd: resolve(process.cwd()),
        env: { ...process.env, ...GOOD_ENV, MYNEWS_RELEASE_MANIFEST_PATH: goodManifest },
        encoding: 'utf8',
        stdio: 'pipe',
      }),
    ).not.toThrow();

    const badManifest = writeManifest(
      manifest({ controlledOrigin: 'https://mynews.app' }),
    );
    try {
      execFileSync(process.execPath, [script], {
        cwd: resolve(process.cwd()),
        env: { ...process.env, ...GOOD_ENV, MYNEWS_RELEASE_MANIFEST_PATH: badManifest },
        encoding: 'utf8',
        stdio: 'pipe',
      });
      throw new Error('expected checker failure');
    } catch (error) {
      const stderr = String(error.stderr ?? '');
      expect(stderr).toContain('releaseManifest.controlledOrigin:');
    }
  });
});
