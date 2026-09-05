const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  crypto: path.resolve(__dirname, 'shims/crypto.js'),
};

module.exports = config;
