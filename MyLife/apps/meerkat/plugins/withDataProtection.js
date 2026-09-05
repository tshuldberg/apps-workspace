const { withEntitlementsPlist } = require('expo/config-plugins');

/**
 * iOS data-protection hardening (ported from Manhattan).
 *
 * Sets the app's default data-protection class to
 * NSFileProtectionCompleteUntilFirstUserAuthentication via entitlements so the
 * on-device SQLite (meerkat.db), the sealed ciphertext blocks, and the staged
 * OS-share payloads are encrypted at rest and unreadable until the device is
 * first unlocked after boot, while still letting a headless background drain run
 * after that first unlock.
 *
 * Only explicit exports belong in Documents/Meerkat Exports. The shared boot
 * migrates SQLite, blobs, snapshots and internal files into Application Support
 * before opening the database. Files-app keys remain enabled for exports only.
 */
function withDataProtection(config) {
  return withEntitlementsPlist(config, (modConfig) => {
    modConfig.modResults['com.apple.developer.default-data-protection'] =
      'NSFileProtectionCompleteUntilFirstUserAuthentication';
    return modConfig;
  });
}

module.exports = withDataProtection;
