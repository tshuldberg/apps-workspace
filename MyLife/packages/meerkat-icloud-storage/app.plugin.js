// UNVERIFIED - pending dev build / physical device QA.
//
// Parameterized Expo config plugin for the app-owned iCloud Documents
// container. An empty containerIdentifier leaves entitlements untouched so an
// unconfigured build stays honestly unavailable. Founder operations must supply
// the real identifier and signing profile before device proof.

const {
  createRunOncePlugin,
  withEntitlementsPlist,
  withInfoPlist,
} = require('expo/config-plugins');
const pkg = require('./package.json');

function normalizeContainerIdentifier(value) {
  const identifier = typeof value === 'string' ? value.trim() : '';
  if (!identifier) return null;
  if (!identifier.startsWith('iCloud.') || /\s/u.test(identifier)) {
    throw new Error('Meerkat iCloud containerIdentifier must start with "iCloud." and contain no spaces.');
  }
  return identifier;
}

function appendUnique(values, additions) {
  return Array.from(new Set([...(Array.isArray(values) ? values : []), ...additions]));
}

function withICloudEntitlements(config, identifier) {
  return withEntitlementsPlist(config, (cfg) => {
    const entitlements = cfg.modResults;
    entitlements['com.apple.developer.icloud-container-identifiers'] = appendUnique(
      entitlements['com.apple.developer.icloud-container-identifiers'],
      [identifier],
    );
    entitlements['com.apple.developer.ubiquity-container-identifiers'] = appendUnique(
      entitlements['com.apple.developer.ubiquity-container-identifiers'],
      [identifier],
    );
    entitlements['com.apple.developer.icloud-services'] = appendUnique(
      entitlements['com.apple.developer.icloud-services'],
      ['CloudDocuments'],
    );
    return cfg;
  });
}

function withICloudDocumentsInfo(config, identifier, displayName) {
  return withInfoPlist(config, (cfg) => {
    const current = cfg.modResults.NSUbiquitousContainers;
    const containers = current && typeof current === 'object' && !Array.isArray(current)
      ? current
      : {};
    containers[identifier] = {
      ...(containers[identifier] && typeof containers[identifier] === 'object'
        ? containers[identifier]
        : {}),
      NSUbiquitousContainerIsDocumentScopePublic: true,
      NSUbiquitousContainerName: displayName,
      NSUbiquitousContainerSupportedFolderLevels: 'Any',
    };
    cfg.modResults.NSUbiquitousContainers = containers;
    return cfg;
  });
}

/** @param {import('expo/config-plugins').ExpoConfig} config */
function withMeerkatICloudStorage(config, options = {}) {
  const identifier = normalizeContainerIdentifier(options.containerIdentifier);
  if (!identifier) return config;
  const displayName = typeof options.displayName === 'string' && options.displayName.trim()
    ? options.displayName.trim()
    : 'Meerkat';
  config = withICloudEntitlements(config, identifier);
  config = withICloudDocumentsInfo(config, identifier, displayName);
  return config;
}

module.exports = createRunOncePlugin(
  withMeerkatICloudStorage,
  pkg.name,
  pkg.version,
);

module.exports.normalizeContainerIdentifier = normalizeContainerIdentifier;
module.exports.withMeerkatICloudStorage = withMeerkatICloudStorage;
