// Config plugin tests run against a small Expo mod harness to stay import-safe.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

interface TestConfig {
  plist: Record<string, unknown>;
  manifest: Record<string, unknown>;
}

interface ModConfig {
  modResults: Record<string, unknown>;
}

type ModAction = (config: ModConfig) => ModConfig;
type ConfigPlugin = (config: TestConfig) => TestConfig;

function loadPlugin(): ConfigPlugin {
  const source = readFileSync(resolve(__dirname, '..', '..', 'app.plugin.js'), 'utf8');
  const moduleBox: { exports: unknown } = { exports: {} };

  const configPlugins = {
    withInfoPlist(config: TestConfig, action: ModAction): TestConfig {
      const result = action({ modResults: config.plist });
      return { ...config, plist: result.modResults };
    },
    withAndroidManifest(config: TestConfig, action: ModAction): TestConfig {
      const result = action({ modResults: config.manifest });
      return { ...config, manifest: result.modResults };
    },
    AndroidConfig: {
      Permissions: {
        ensurePermissions(manifest: Record<string, unknown>, permissions: string[]) {
          const existing = Array.isArray(manifest.permissions)
            ? manifest.permissions.filter((value): value is string => typeof value === 'string')
            : [];
          manifest.permissions = Array.from(new Set([...existing, ...permissions]));
        },
      },
    },
    createRunOncePlugin(plugin: ConfigPlugin): ConfigPlugin {
      return plugin;
    },
  };

  const localRequire = (id: string): unknown => {
    if (id === 'expo/config-plugins') return configPlugins;
    if (id === './package.json') {
      return { name: '@mylife/meerkat-call-native', version: '0.1.0' };
    }
    throw new Error(`Unexpected plugin dependency: ${id}`);
  };

  runInNewContext(source, {
    module: moduleBox,
    exports: moduleBox.exports,
    require: localRequire,
  });
  return moduleBox.exports as ConfigPlugin;
}

describe('Meerkat call config plugin', () => {
  it('adds required iOS modes and Android permission without replacing host values', () => {
    const plugin = loadPlugin();
    const result = plugin({
      plist: { UIBackgroundModes: ['fetch'] },
      manifest: { permissions: ['android.permission.INTERNET'] },
    });

    expect(result.plist.UIBackgroundModes).toEqual([
      'fetch',
      'audio',
      'voip',
      'remote-notification',
    ]);
    expect(result.manifest.permissions).toEqual([
      'android.permission.INTERNET',
      'android.permission.MANAGE_OWN_CALLS',
    ]);
  });

  it('is idempotent when applied repeatedly', () => {
    const plugin = loadPlugin();
    const initial: TestConfig = {
      plist: { UIBackgroundModes: ['audio', 'voip'] },
      manifest: { permissions: ['android.permission.MANAGE_OWN_CALLS'] },
    };

    const result = plugin(plugin(initial));
    expect(result.plist.UIBackgroundModes).toEqual([
      'audio',
      'voip',
      'remote-notification',
    ]);
    expect(result.manifest.permissions).toEqual([
      'android.permission.MANAGE_OWN_CALLS',
    ]);
  });
});
