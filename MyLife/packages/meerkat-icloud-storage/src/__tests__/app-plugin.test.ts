import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

interface TestConfig {
  entitlements: Record<string, unknown>;
  plist: Record<string, unknown>;
}

interface ModConfig { modResults: Record<string, unknown> }
type ModAction = (config: ModConfig) => ModConfig;
type Plugin = (config: TestConfig, options?: Record<string, unknown>) => TestConfig;

function loadPlugin(): Plugin {
  const source = readFileSync(resolve(__dirname, '..', '..', 'app.plugin.js'), 'utf8');
  const moduleBox: { exports: unknown } = { exports: {} };
  const configPlugins = {
    withEntitlementsPlist(config: TestConfig, action: ModAction): TestConfig {
      return { ...config, entitlements: action({ modResults: config.entitlements }).modResults };
    },
    withInfoPlist(config: TestConfig, action: ModAction): TestConfig {
      return { ...config, plist: action({ modResults: config.plist }).modResults };
    },
    createRunOncePlugin(plugin: Plugin): Plugin { return plugin; },
  };
  const localRequire = (id: string): unknown => {
    if (id === 'expo/config-plugins') return configPlugins;
    if (id === './package.json') return { name: '@mylife/meerkat-icloud-storage', version: '0.1.0' };
    throw new Error(`Unexpected plugin dependency: ${id}`);
  };
  runInNewContext(source, {
    module: moduleBox, exports: moduleBox.exports, require: localRequire,
  });
  return moduleBox.exports as Plugin;
}

describe('iCloud config plugin', () => {
  it('fails closed on a malformed container identifier', () => {
    const plugin = loadPlugin();
    expect(() => plugin({ entitlements: {}, plist: {} }, { containerIdentifier: 'group.not-icloud' }))
      .toThrow('must start with "iCloud."');
  });

  it('adds CloudDocuments entitlements and container metadata idempotently', () => {
    const plugin = loadPlugin();
    const initial: TestConfig = {
      entitlements: { 'com.apple.developer.icloud-services': ['CloudKit'] },
      plist: {},
    };
    const options = { containerIdentifier: 'iCloud.com.mylife.meerkat', displayName: 'Meerkat Data' };
    const result = plugin(plugin(initial, options), options);
    expect(result.entitlements['com.apple.developer.icloud-container-identifiers'])
      .toEqual(['iCloud.com.mylife.meerkat']);
    expect(result.entitlements['com.apple.developer.ubiquity-container-identifiers'])
      .toEqual(['iCloud.com.mylife.meerkat']);
    expect(result.entitlements['com.apple.developer.icloud-services'])
      .toEqual(['CloudKit', 'CloudDocuments']);
    expect(result.plist.NSUbiquitousContainers).toEqual({
      'iCloud.com.mylife.meerkat': {
        NSUbiquitousContainerIsDocumentScopePublic: true,
        NSUbiquitousContainerName: 'Meerkat Data',
        NSUbiquitousContainerSupportedFolderLevels: 'Any',
      },
    });
  });
});
