const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const workspaceRoot = path.resolve(__dirname, '../..');

const config = getDefaultConfig(__dirname);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  crypto: path.resolve(__dirname, 'shims/crypto.js'),
};

module.exports = config;
