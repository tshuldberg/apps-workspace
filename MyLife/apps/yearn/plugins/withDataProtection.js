const {
  withEntitlementsPlist,
  withInfoPlist,
} = require('@expo/config-plugins');

function withDataProtection(config) {
  config = withEntitlementsPlist(config, (modConfig) => {
    modConfig.modResults['com.apple.developer.default-data-protection'] =
      'NSFileProtectionCompleteUntilFirstUserAuthentication';
    return modConfig;
  });

  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults.UIFileSharingEnabled = false;
    modConfig.modResults.LSSupportsOpeningDocumentsInPlace = false;
    return modConfig;
  });

  return config;
}

module.exports = withDataProtection;
