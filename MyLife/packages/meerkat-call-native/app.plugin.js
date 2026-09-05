// Expo config plugin for @mylife/meerkat-call-native.
//
// Adds only the host configuration required by the owned OS call surfaces:
// iOS VoIP push background delivery and Android self-managed calling. Changes
// are additive and idempotent. Existing host values are never overwritten.
//
// HONESTY: manifest and plist entries do not prove native behavior. The Swift
// and Kotlin implementations remain UNVERIFIED until a signed dev build compiles
// them and the physical-device matrix proves the call lifecycle.

const {
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig,
  createRunOncePlugin,
} = require('expo/config-plugins');

const pkg = require('./package.json');

// PushKit has no user-facing Info.plist usage-description key. The supported
// declarations are the audio and VoIP background modes. remote-notification is
// also retained because the host receives APNs wake traffic. The APNs
// entitlement and VoIP topic come from signed app credentials, not a hard-coded
// plist value.
const IOS_BACKGROUND_MODES = ['audio', 'voip', 'remote-notification'];

function withMeerkatCallIos(config) {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    const existing = Array.isArray(plist.UIBackgroundModes)
      ? plist.UIBackgroundModes
      : [];
    plist.UIBackgroundModes = Array.from(
      new Set([...existing, ...IOS_BACKGROUND_MODES]),
    );
    return cfg;
  });
}

const ANDROID_PERMISSIONS = ['android.permission.MANAGE_OWN_CALLS'];

function withMeerkatCallAndroid(config) {
  return withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.ensurePermissions(
      cfg.modResults,
      ANDROID_PERMISSIONS,
    );
    return cfg;
  });
}

/** @param {import('expo/config-plugins').ExpoConfig} config */
const withMeerkatCallNative = (config) => {
  config = withMeerkatCallIos(config);
  config = withMeerkatCallAndroid(config);
  return config;
};

module.exports = createRunOncePlugin(
  withMeerkatCallNative,
  pkg.name,
  pkg.version,
);
