// DoWork app config security contract (audit 2026-06-09, roadmap P7).
//
// Guards the store-facing security posture: exempt encryption declaration,
// hardening plugins registered and present on disk, and Android backup off.
// vitest runs with cwd = apps/dowork, so paths resolve from process.cwd().

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type PrivacyManifests = {
  NSPrivacyTracking: boolean;
  NSPrivacyTrackingDomains: string[];
  NSPrivacyCollectedDataTypes: {
    NSPrivacyCollectedDataType: string;
    NSPrivacyCollectedDataTypeLinked: boolean;
    NSPrivacyCollectedDataTypeTracking: boolean;
    NSPrivacyCollectedDataTypePurposes: string[];
  }[];
  NSPrivacyAccessedAPITypes: {
    NSPrivacyAccessedAPIType: string;
    NSPrivacyAccessedAPITypeReasons: string[];
  }[];
};

const appRoot = process.cwd();
const appJson = JSON.parse(readFileSync(join(appRoot, 'app.json'), 'utf8')) as {
  expo: {
    ios: {
      infoPlist: Record<string, unknown>;
      privacyManifests?: PrivacyManifests;
    };
    android: { allowBackup: boolean };
    plugins: unknown[];
  };
};

describe('DoWork app config security contract', () => {
  it('declares exempt encryption (TLS only)', () => {
    expect(appJson.expo.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
  });

  it('registers both security hardening plugins', () => {
    expect(appJson.expo.plugins).toContain('./plugins/withSecurityHardening');
    expect(appJson.expo.plugins).toContain('./plugins/withDataProtection');
  });

  it('ships the plugin implementations and android resources', () => {
    const required = [
      'plugins/withSecurityHardening.js',
      'plugins/withDataProtection.js',
      'plugins/android-res/data_extraction_rules.xml',
      'plugins/android-res/network_security_config.xml',
    ];
    for (const rel of required) {
      expect(existsSync(join(appRoot, rel)), `${rel} missing`).toBe(true);
    }
  });

  it('keeps Android backup disabled', () => {
    expect(appJson.expo.android.allowBackup).toBe(false);
  });
});

describe('DoWork iOS privacy manifest contract (LG-2)', () => {
  // Expo SDK 54's default iOS plugin chain (withIosExpoPlugins in
  // @expo/prebuild-config) runs IOSConfig.PrivacyInfo.withPrivacyInfo
  // automatically during prebuild and writes ios/<name>/PrivacyInfo.xcprivacy
  // straight from app.json's expo.ios.privacyManifests. That is the
  // officially supported mechanism for this SDK version, so no custom
  // config plugin is needed here.
  const manifests = appJson.expo.ios.privacyManifests;

  it('declares the privacy manifest block', () => {
    expect(manifests).toBeDefined();
  });

  it('declares no tracking and no tracking domains', () => {
    expect(manifests?.NSPrivacyTracking).toBe(false);
    expect(manifests?.NSPrivacyTrackingDomains).toEqual([]);
  });

  it('declares collected data types for app functionality only, never tracking', () => {
    const types = manifests?.NSPrivacyCollectedDataTypes ?? [];
    expect(types.length).toBeGreaterThan(0);
    for (const entry of types) {
      expect(entry.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(entry.NSPrivacyCollectedDataTypePurposes).toContain(
        'NSPrivacyCollectedDataTypePurposeAppFunctionality',
      );
    }
    const declaredTypes = types.map((entry) => entry.NSPrivacyCollectedDataType);
    // Account id/email, user content (incl. coaching media), device id for
    // push, and purchase history (RevenueCat + trainer-earnings ledger) -
    // matches what legal/privacy.html says DoWork collects.
    expect(declaredTypes).toContain('NSPrivacyCollectedDataTypeEmailAddress');
    expect(declaredTypes).toContain('NSPrivacyCollectedDataTypeUserID');
    expect(declaredTypes).toContain('NSPrivacyCollectedDataTypeDeviceID');
    expect(declaredTypes).toContain('NSPrivacyCollectedDataTypePurchaseHistory');
  });

  it('declares required-reason API categories for UserDefaults, file timestamps, and disk space', () => {
    const apiTypes = manifests?.NSPrivacyAccessedAPITypes ?? [];
    const byCategory = new Map(
      apiTypes.map((entry) => [entry.NSPrivacyAccessedAPIType, entry.NSPrivacyAccessedAPITypeReasons]),
    );

    expect(byCategory.get('NSPrivacyAccessedAPICategoryUserDefaults')).toContain('CA92.1');
    expect(byCategory.get('NSPrivacyAccessedAPICategoryFileTimestamp')).toContain('C617.1');
    expect(byCategory.get('NSPrivacyAccessedAPICategoryDiskSpace')).toContain('E174.1');
  });
});

describe('DoWork supabase security migrations', () => {
  const migrationsDir = join(appRoot, '..', '..', 'supabase', 'migrations');

  it('ships the RLS hardening migration (no trainer self-verification)', () => {
    const sql = readFileSync(
      join(migrationsDir, '20260609000001_dowork_security_hardening.sql'),
      'utf8',
    );
    expect(sql).toContain('drop policy if exists dw_trainers_owner_modify');
    expect(sql).toContain('is_verified = false');
    expect(sql).toContain('dw_trainers_protect_verified');
    expect(sql).toContain('dw_comment_rate_limit_ok');
  });

  it('ships storage buckets + policies for all three DoWork buckets', () => {
    const sql = readFileSync(
      join(migrationsDir, '20260609000002_dowork_storage_policies.sql'),
      'utf8',
    );
    for (const bucket of ['dowork-avatars', 'dowork-share-media', 'dowork-trainer-videos']) {
      expect(sql, `${bucket} missing`).toContain(`'${bucket}'`);
    }
    expect(sql).toContain('storage.foldername(name)');
  });
});
