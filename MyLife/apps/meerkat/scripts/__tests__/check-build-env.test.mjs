import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkBuildEnv } from '../check-build-env.mjs';

const validProduction = {
  EAS_BUILD_PROFILE: 'production',
  EAS_BUILD_PLATFORM: 'ios',
  EXPO_PUBLIC_MEERKAT_RC_KEY_IOS: 'appl_public_key',
  MEERKAT_HOSTED_API_URL: 'https://api.meerkat.example',
  MEERKAT_HUMANITY_SERVICE_URL: 'https://humanity.meerkat.example',
  MEERKAT_HUMANITY_SERVICE_PUBLIC_KEY: 'ab'.repeat(32),
  MEERKAT_PERSONA_SERVICE_URL: 'https://accounts.meerkat.example',
  MEERKAT_COMMONS_NODE_URL: 'https://commons.meerkat.example',
  MEERKAT_COMMONS_TOPICS: JSON.stringify([{
    channelId: 'general',
    publicationId: 'publication-1',
    nodeKeyHex: 'cd'.repeat(32),
  }]),
  MEERKAT_DEFAULT_RELAY_URL: 'wss://relay.meerkat.example',
  MEERKAT_TURN_URL: 'turns://turn.meerkat.example:5349',
  MEERKAT_TURN_USERNAME: 'meerkat',
  MEERKAT_TURN_CREDENTIAL: 'secret-from-eas',
  MEERKAT_PRIVACY_POLICY_URL: 'https://meerkat.example/privacy',
  MEERKAT_TERMS_URL: 'https://meerkat.example/terms',
  MEERKAT_COMMUNITY_STANDARDS_URL: 'https://meerkat.example/standards',
  MEERKAT_SUPPORT_URL: 'https://meerkat.example/support',
};

describe('Meerkat store build environment', () => {
  it('keeps paid hosted access optional, secure and separate from the free default', () => {
    expect(checkBuildEnv(validProduction).ok).toBe(true);
    for (const relay of ['ws://paid.example', 'wss://user:password@paid.example', 'wss://paid.example/#secret', validProduction.MEERKAT_DEFAULT_RELAY_URL]) {
      expect(checkBuildEnv({ ...validProduction, MEERKAT_HOSTED_RELAY_URL: relay }).ok).toBe(false);
    }
    expect(checkBuildEnv({ ...validProduction, MEERKAT_HOSTED_RELAY_URL: 'wss://paid.example' }).ok).toBe(true);
  });

  it('skips internal profiles', () => {
    expect(checkBuildEnv({ EAS_BUILD_PROFILE: 'preview' })).toMatchObject({ ok: true, skipped: true });
  });

  it('validates TestFlight against the same capabilities as production', () => {
    expect(checkBuildEnv({ ...validProduction, EAS_BUILD_PROFILE: 'testflight' }))
      .toEqual({ ok: true, errors: [], warnings: [], skipped: false });
    const result = checkBuildEnv({ EAS_BUILD_PROFILE: 'testflight', EAS_BUILD_PLATFORM: 'ios' });
    expect(result).toMatchObject({ ok: false, skipped: false });
    expect(result.errors).toEqual(checkBuildEnv({ EAS_BUILD_PROFILE: 'production', EAS_BUILD_PLATFORM: 'ios' }).errors);
  });

  it.each(['production', 'testflight'])('rejects entitlement bypasses in %s', (profile) => {
    for (const override of ['EXPO_PUBLIC_MEERKAT_TEST_MODE', 'EXPO_PUBLIC_MEERKAT_DEV_UNLOCK']) {
      const result = checkBuildEnv({ ...validProduction, EAS_BUILD_PROFILE: profile, [override]: 'true' });
      expect(result.ok).toBe(false);
      expect(result.errors.join('\n')).toContain(override);
    }
  });

  it('fails unknown profiles and missing EAS profiles closed', () => {
    expect(checkBuildEnv({ ...validProduction, EAS_BUILD_PROFILE: 'store-candidate' }))
      .toMatchObject({ ok: false, skipped: false });
    expect(checkBuildEnv({ ...validProduction, EAS_BUILD_PROFILE: '', EAS_BUILD: 'true' }))
      .toMatchObject({ ok: false, skipped: false });
    expect(checkBuildEnv({})).toMatchObject({ ok: true, skipped: true });
  });

  it('rejects an unsupported private-only or unknown capability declaration', () => {
    for (const capabilities of ['private-only', 'unknown', '']) {
      expect(checkBuildEnv({ ...validProduction, MEERKAT_RELEASE_CAPABILITIES: capabilities }).ok).toBe(false);
    }
  });

  it('accepts a complete iOS production configuration', () => {
    expect(checkBuildEnv(validProduction)).toEqual({ ok: true, errors: [], warnings: [], skipped: false });
  });

  it('requires the matching Android RevenueCat key', () => {
    const result = checkBuildEnv({
      ...validProduction,
      EAS_BUILD_PLATFORM: 'android',
      EXPO_PUBLIC_MEERKAT_RC_KEY_ANDROID: 'appl_wrong_store',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/goog_/u);
  });

  it('rejects every launch-critical empty value instead of producing a disconnected binary', () => {
    const result = checkBuildEnv({ EAS_BUILD_PROFILE: 'production', EAS_BUILD_PLATFORM: 'ios' });
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(15);
    expect(result.errors.join('\n')).toContain('EXPO_PUBLIC_MEERKAT_RC_KEY_IOS');
    expect(result.errors.join('\n')).toContain('MEERKAT_COMMONS_TOPICS');
    expect(result.errors.join('\n')).toContain('MEERKAT_TURN_CREDENTIAL');
  });

  it('rejects insecure endpoints, malformed pins, invalid topics, and test mode', () => {
    const result = checkBuildEnv({
      ...validProduction,
      EXPO_PUBLIC_MEERKAT_TEST_MODE: 'true',
      MEERKAT_HOSTED_API_URL: 'http://api.meerkat.example',
      MEERKAT_DEFAULT_RELAY_URL: 'ws://relay.meerkat.example',
      MEERKAT_HUMANITY_SERVICE_PUBLIC_KEY: 'not-a-key',
      MEERKAT_COMMONS_TOPICS: '[{"channelId":"general"}]',
      MEERKAT_TURN_URL: 'turn://turn.meerkat.example',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/must never|https|wss|64-character|pinned node keys|turns/u);
  });
});


describe('pre-install command invocation', () => {
  const script = fileURLToPath(new URL('../check-build-env.mjs', import.meta.url));

  it('fails a missing TestFlight environment before dependency installation', () => {
    const result = spawnSync(process.execPath, [script], {
      cwd: '/',
      env: { EAS_BUILD: 'true', EAS_BUILD_PROFILE: 'testflight', EAS_BUILD_PLATFORM: 'ios' },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('EXPO_PUBLIC_MEERKAT_RC_KEY_IOS');
    expect(result.stdout).not.toContain('skipping');
  });

  it('accepts complete store config from an unrelated working directory', () => {
    const result = spawnSync(process.execPath, [script], {
      cwd: '/', env: { ...validProduction, EAS_BUILD_PROFILE: 'testflight' }, encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Store env is complete.');
  });
});
