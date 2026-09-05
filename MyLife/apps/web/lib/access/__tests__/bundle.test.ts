import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createSignedBundleToken,
  isBundleTokenExpired,
  issueSignedBundleDownloadUrl,
  resolveBundleZipPath,
  verifySignedBundleToken,
} from '../bundle';

const ORIGINAL_ENV = { ...process.env };

describe('bundle access helpers', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.MYLIFE_BUNDLE_BASE_URL;
    delete process.env.MYLIFE_BUNDLE_SIGNING_SECRET;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('creates and verifies signed tokens', () => {
    const token = createSignedBundleToken(
      {
        bundleId: 'self-host-v1',
        eventId: 'evt_1',
        purchaserRef: 'alice@example.com',
        exp: 2_000_000_000,
      },
      'secret-value',
    );

    const verified = verifySignedBundleToken(token, 'secret-value');

    expect(verified.ok).toBe(true);
    expect(verified.payload).toEqual({
      bundleId: 'self-host-v1',
      eventId: 'evt_1',
      purchaserRef: 'alice@example.com',
      exp: 2_000_000_000,
    });
  });

  it('rejects malformed or tampered tokens', () => {
    expect(verifySignedBundleToken('bad-token', 'secret')).toEqual({
      ok: false,
      reason: 'malformed_token',
    });

    const token = createSignedBundleToken(
      {
        bundleId: 'self-host-v1',
        eventId: 'evt_1',
        exp: 2_000_000_000,
      },
      'secret',
    );
    const tampered = `${token}x`;

    expect(verifySignedBundleToken(tampered, 'secret')).toEqual({
      ok: false,
      reason: 'invalid_signature',
    });
  });

  it('evaluates token expiry and bundle path sanitization', () => {
    expect(
      isBundleTokenExpired(
        {
          bundleId: 'self-host-v1',
          eventId: 'evt_1',
          exp: 100,
        },
        100_000,
      ),
    ).toBe(true);
    expect(
      isBundleTokenExpired(
        {
          bundleId: 'self-host-v1',
          eventId: 'evt_1',
          exp: 200,
        },
        100_000,
      ),
    ).toBe(false);

    expect(resolveBundleZipPath('../escape')).toBeNull();
    expect(resolveBundleZipPath('')).toBeNull();
    expect(resolveBundleZipPath('self-host-v1')).toMatch(
      /deploy\/self-host\/releases\/self-host-v1\.zip$/,
    );
  });

  it('issues signed bundle download URLs with validated inputs', () => {
    expect(
      issueSignedBundleDownloadUrl({
        bundleId: 'self-host-v1',
        eventId: 'evt_1',
      }),
    ).toEqual({ ok: false, reason: 'missing_bundle_secret' });

    process.env.MYLIFE_BUNDLE_SIGNING_SECRET = 'secret';
    expect(
      issueSignedBundleDownloadUrl({
        bundleId: '../bad',
        eventId: 'evt_1',
      }),
    ).toEqual({ ok: false, reason: 'invalid_bundle_id' });

    expect(
      issueSignedBundleDownloadUrl({
        bundleId: 'self-host-v1',
        eventId: 'evt_1',
      }),
    ).toEqual({ ok: false, reason: 'missing_bundle_base_url' });

    process.env.MYLIFE_BUNDLE_BASE_URL = 'https://downloads.example.com/';
    const issued = issueSignedBundleDownloadUrl({
      bundleId: 'self-host-v1',
      eventId: 'evt_1',
      purchaserRef: 'alice@example.com',
      expiresInSeconds: 1,
    });

    expect(issued.ok).toBe(true);
    expect(issued.url).toMatch(
      /^https:\/\/downloads\.example\.com\/api\/access\/bundle\/download\?token=/,
    );
    expect(typeof issued.token).toBe('string');
    expect(typeof issued.expiresAt).toBe('string');

    const verified = verifySignedBundleToken(issued.token!, 'secret');
    expect(verified.ok).toBe(true);
    expect(verified.payload?.bundleId).toBe('self-host-v1');
    expect(verified.payload?.eventId).toBe('evt_1');
    expect(verified.payload?.purchaserRef).toBe('alice@example.com');
  });
});
