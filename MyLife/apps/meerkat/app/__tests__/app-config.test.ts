// App config invariants. These guard the identity bits that the deep link,
// store listing, and parity script all depend on. Reads the raw JSON so a
// hand edit that breaks the scheme or bundle id fails here.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import appConfig from '../../app.config';

const appRoot = resolve(__dirname, '../..');

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(appRoot, rel), 'utf8')) as Record<string, unknown>;
}

describe('app.json', () => {
  const app = readJson('app.json');
  const expo = app.expo as Record<string, unknown>;

  it('uses the meerkat scheme for deep links', () => {
    expect(expo.scheme).toBe('meerkat');
  });

  it('is named Meerkat with slug meerkat', () => {
    expect(expo.name).toBe('Meerkat');
    expect(expo.slug).toBe('meerkat');
  });

  it('declares the meerkat bundle and package ids', () => {
    const ios = expo.ios as Record<string, unknown>;
    const android = expo.android as Record<string, unknown>;
    expect(ios.bundleIdentifier).toBe('com.mylife.meerkat');
    expect(android.package).toBe('com.mylife.meerkat');
  });

  it('exposes the iOS documents folder to the Files app (bulk save destination)', () => {
    // The honest bulk-save path writes verified copies into documentDirectory/Meerkat Exports
    // and relies on these keys to make that folder browsable under On My iPhone > Meerkat.
    const ios = expo.ios as { infoPlist?: Record<string, unknown> };
    const infoPlist = ios.infoPlist ?? {};
    expect(infoPlist.UIFileSharingEnabled).toBe(true);
    expect(infoPlist.LSSupportsOpeningDocumentsInPlace).toBe(true);
  });

  it('leaves export compliance to the ASC questionnaire, never skips it (legal readiness, updated 2026-08-28)', () => {
    // Meerkat's core function is custom E2EE (X25519/Ed25519/secretbox in
    // @mylife/sync), which is NOT exempt under Apple's export questionnaire.
    // `false` is a legal-readiness red flag: it would skip the export
    // compliance questionnaire on a product whose primary function is
    // encryption. `true` is UNDELIVERABLE without an
    // ITSEncryptionExportComplianceCode (ITMS-90592 rejected build 12,
    // 2026-08-28), and Apple only issues codes for uploaded-documentation
    // lanes (France/CCATS), which the ASC declaration (standard algorithms,
    // no France) concluded Meerkat does not need. ABSENT is the honest,
    // deliverable state: every build answers the ASC export questionnaire.
    // Founder-ops remainder: per-build ASC answers, ECCN 5D992.c
    // self-classification + annual BIS report.
    const ios = expo.ios as { infoPlist?: Record<string, unknown> };
    expect((ios.infoPlist ?? {}).ITSAppUsesNonExemptEncryption).toBeUndefined();
  });

  it('follows the OS appearance and keeps New Architecture disabled for native transport compatibility', () => {
    expect(expo.userInterfaceStyle).toBe('automatic');
    expect((expo.splash as { backgroundColor: string }).backgroundColor).toBe('#F6F4EF');
    expect(expo.newArchEnabled).toBe(false);
  });

  it('keeps the plugin set minimal and crypto-capable', () => {
    const plugins = expo.plugins as string[];
    expect(plugins).toContain('expo-router');
    expect(plugins).toContain('expo-secure-store');
    expect(plugins).toContain('expo-sqlite');
  });
});

describe('package.json', () => {
  const pkg = readJson('package.json');

  it('is the @mylife/meerkat-app package', () => {
    expect(pkg.name).toBe('@mylife/meerkat-app');
  });

  it('depends on the sync node core', () => {
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['@mylife/sync']).toBeDefined();
    expect(deps['@mylife/meerkat-icloud-storage']).toBeDefined();
    expect(deps['tweetnacl-util']).toBeDefined();
    expect(deps['expo-secure-store']).toBeDefined();
    expect(deps['expo-clipboard']).toBeDefined();
  });

  it('declares react-native-purchases for the Plan 22 one-time app-unlock IAP rail', () => {
    // Intentional invariant change (Plan 22 Part 1, 2026-07-06): the $4.99 one-time
    // unlock is now a real StoreKit/Play purchase, so the IAP SDK is a declared dep.
    // It is imported ONLY by app/(root)/data/app-unlock.ts (lazy at the screen), and
    // the gate fails closed without a configured RevenueCat key, so Expo Go still
    // works. expo-calendar remains a twin-app-only dep Meerkat never uses.
    const deps = pkg.dependencies as Record<string, string>;
    expect(deps['react-native-purchases']).toBeDefined();
    expect(deps['expo-calendar']).toBeUndefined();
  });
});

describe('app.config.ts (Plan 20 dynamic env layer)', () => {
  const base = { name: 'Meerkat', slug: 'meerkat', extra: { eas: { projectId: 'x' } } };

  it('describes current camera and microphone uses consistently across plugins', () => {
    const cfg = appConfig({ config: base } as unknown as Parameters<typeof appConfig>[0]);
    const plugin = cfg.plugins?.find((entry) =>
      Array.isArray(entry) && entry[0] === '@config-plugins/react-native-webrtc');
    expect(plugin).toEqual([
      '@config-plugins/react-native-webrtc',
      {
        cameraPermission: 'Meerkat uses your camera for video calls and to scan QR codes.',
        microphonePermission: 'Meerkat uses your microphone for voice and video calls and audio rooms.',
      },
    ]);
    const staticExpo = readJson('app.json').expo as { plugins: unknown[] };
    expect(staticExpo.plugins).toContainEqual([
      'expo-camera',
      { cameraPermission: 'Meerkat uses your camera for video calls and to scan QR codes.' },
    ]);
  });

  it('bakes MEERKAT_DEFAULT_RELAY_URL into extra.defaultRelayUrl', () => {
    const prev = process.env.MEERKAT_DEFAULT_RELAY_URL;
    process.env.MEERKAT_DEFAULT_RELAY_URL = 'wss://relay.test';
    try {
      const cfg = appConfig({ config: base } as unknown as Parameters<typeof appConfig>[0]);
      expect(cfg.extra?.defaultRelayUrl).toBe('wss://relay.test');
      // preserves the static base (extra is merged, top-level fields kept)
      expect(cfg.extra?.eas).toEqual({ projectId: 'x' });
      expect(cfg.name).toBe('Meerkat');
    } finally {
      if (prev === undefined) delete process.env.MEERKAT_DEFAULT_RELAY_URL;
      else process.env.MEERKAT_DEFAULT_RELAY_URL = prev;
    }
  });

  it("defaults extra.defaultRelayUrl to '' when the env is unset (honest no-default)", () => {
    const prev = process.env.MEERKAT_DEFAULT_RELAY_URL;
    delete process.env.MEERKAT_DEFAULT_RELAY_URL;
    try {
      const cfg = appConfig({ config: base } as unknown as Parameters<typeof appConfig>[0]);
      expect(cfg.extra?.defaultRelayUrl).toBe('');
    } finally {
      if (prev !== undefined) process.env.MEERKAT_DEFAULT_RELAY_URL = prev;
    }
  });

  it('passes the founder-supplied iCloud container id to the owned plugin', () => {
    const previous = process.env.MEERKAT_ICLOUD_CONTAINER_ID;
    process.env.MEERKAT_ICLOUD_CONTAINER_ID = 'iCloud.test.meerkat';
    try {
      const cfg = appConfig({ config: base } as unknown as Parameters<typeof appConfig>[0]);
      const plugin = cfg.plugins?.find((entry) =>
        Array.isArray(entry) && entry[0] === '@mylife/meerkat-icloud-storage');
      expect(plugin).toEqual([
        '@mylife/meerkat-icloud-storage',
        { containerIdentifier: 'iCloud.test.meerkat', displayName: 'Meerkat' },
      ]);
    } finally {
      if (previous === undefined) delete process.env.MEERKAT_ICLOUD_CONTAINER_ID;
      else process.env.MEERKAT_ICLOUD_CONTAINER_ID = previous;
    }
  });
});
