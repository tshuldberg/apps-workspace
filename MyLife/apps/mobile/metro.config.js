const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

// Monorepo workspace root
const workspaceRoot = path.resolve(__dirname, '../..');

const config = getDefaultConfig(__dirname);

// Watch the entire monorepo for changes (modules/, packages/)
config.watchFolders = [workspaceRoot];

// Let Metro resolve packages from the workspace root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Polyfill crypto for React Native
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  crypto: path.resolve(__dirname, 'shims/crypto.js'),
};

module.exports = config;
