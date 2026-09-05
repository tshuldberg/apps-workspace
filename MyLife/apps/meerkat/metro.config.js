const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const workspaceRoot = path.resolve(__dirname, '../..');

const config = getDefaultConfig(__dirname);

config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), workspaceRoot]));

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  crypto: path.resolve(__dirname, 'shims/crypto.js'),
};

// Keep test files out of the app bundle. expo-router's require.context
// (`_ctx.ios.js`) eagerly includes every `.ts/.tsx` under the app root except
// `+api/+html/+middleware`, so a sibling `foo.test.ts` (e.g. one importing
// `node:zlib`, unavailable in RN) gets bundled and breaks `expo export`. The
// default blockList already drops `__tests__/` dirs; extend it to also drop
// sibling `.test.`/`.spec.` files. Vitest uses its own resolver, so this only
// affects Metro; runtime code never imports a test file.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  /\.(test|spec)\.[jt]sx?$/,
];

module.exports = config;
