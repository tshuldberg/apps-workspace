import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(__dirname, '..', '..');
const moduleConfig = JSON.parse(
  readFileSync(resolve(packageRoot, 'expo-module.config.json'), 'utf8'),
) as { apple?: { modules?: string[] } };
const swift = readFileSync(
  resolve(packageRoot, 'ios', 'MeerkatICloudStorageModule.swift'),
  'utf8',
);
const podspec = readFileSync(
  resolve(packageRoot, 'ios', 'MeerkatICloudStorage.podspec'),
  'utf8',
);

const NATIVE_METHODS = [
  'getContainerState',
  'coordinatedWriteICloudFile',
  'coordinatedReadICloudFile',
  'queryICloudFileStatus',
  'startICloudDownload',
  'stopICloudDownload',
  'listICloudConflictVersions',
  'listICloudFiles',
  'deleteICloudFile',
  'persistBookmark',
  'resolveBookmark',
  'removeBookmark',
  'coordinatedWriteBookmarkFile',
  'coordinatedReadBookmarkFile',
  'listBookmarkFiles',
  'deleteBookmarkFile',
] as const;

describe('owned iCloud native source', () => {
  it('declares the same concrete Swift module in Expo config and source', () => {
    expect(moduleConfig.apple?.modules).toEqual(['MeerkatICloudStorageModule']);
    expect(swift).toContain('public final class MeerkatICloudStorageModule: Module');
    expect(swift).toContain('Name("MeerkatICloudStorage")');
    expect(podspec).toContain("s.source_files     = '*.{swift,h,m}'");
    expect(podspec).toContain("s.dependency 'ExpoModulesCore'");
  });

  it('binds every method promised by RawMeerkatICloudStorageModule', () => {
    for (const method of NATIVE_METHODS) {
      expect(swift).toContain(`AsyncFunction("${method}")`);
    }
    expect(swift).toContain('Events("accountChanged")');
    expect(swift).toContain('NSUbiquityIdentityDidChange');
  });

  it('uses coordinated I/O, ubiquity status, conflict inspection, and scoped bookmarks', () => {
    for (const invariant of [
      'NSFileCoordinator',
      'ICloudStorageInput: Record',
      '@Field var bytes: Data?',
      'startDownloadingUbiquitousItem',
      'evictUbiquitousItem',
      'unresolvedConflictVersionsOfItem',
      '.minimalBookmark',
      'startAccessingSecurityScopedResource',
      'resolvingSymlinksInPath',
      'path.contains("\\0")',
      '$0 != ".."',
    ]) {
      expect(swift).toContain(invariant);
    }
  });
});
