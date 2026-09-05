const {
  withEntitlementsPlist,
  withInfoPlist,
} = require('@expo/config-plugins');

/**
 * iOS data protection hardening.
 *
 * Sets the app's default data protection class to
 * NSFileProtectionCompleteUntilFirstUserAuthentication via entitlements.
 * This ensures that app files are encrypted at rest and inaccessible until
 * the device is first unlocked after boot, while still allowing the app to
 * function as a background process after that first unlock.
 *
 * Also disables iTunes / Files app document sharing via Info.plist so that
 * the app sandbox is not exposed to the user's Files app by default.
 */
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
