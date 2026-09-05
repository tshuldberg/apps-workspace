// Expo config plugin for @mylife/meerkat-native-transport.
//
// Declares the native permission + service-discovery wiring the owned Nearby
// (MultipeerConnectivity / Wi-Fi Direct + DNS-SD) and BLE wake-only rungs need,
// so a `expo prebuild` / dev build has the correct Info.plist and
// AndroidManifest entries. It is INTENTIONALLY idempotent and additive: the app
// (apps/meerkat/app.config.ts) already sets NSBluetoothAlwaysUsageDescription
// and the four Android BLUETOOTH_* / NEARBY_WIFI_DEVICES permissions, so this
// plugin only ADDS what is missing (local-network usage description, Bonjour
// service types, and the Android FOREGROUND_SERVICE entries a user-visible
// nearby transfer needs) and never overwrites an existing value.
//
// HONESTY: this plugin only writes native manifest/plist config. It does NOT
// bundle a native implementation on its own; the Swift/Kotlin sources under
// ios/ and android/ are UNVERIFIED scaffolding (WP-42C authors the real bodies).
// Until a signed dev build compiles them, the JS bridge finds no native module
// and every rung stays honestly unavailable.

const {
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig,
  createRunOncePlugin,
} = require('expo/config-plugins');

const pkg = require('./package.json');

// The Bonjour service type Meerkat's LAN + Nearby discovery advertises. Kept in
// sync with the app's `_mylife-sync._tcp` service (see mesh-sync docs); the
// plist requires the `.local.` suffix form Apple validates against.
const MEERKAT_BONJOUR_SERVICES = ['_mylife-sync._tcp', '_meerkat-nearby._tcp'];

const LOCAL_NETWORK_USAGE =
  'Meerkat uses your local network only to discover and sync directly with a '
  + 'paired device nearby. No data is sent to any server during a local sync.';

const BLUETOOTH_USAGE =
  'Meerkat uses Bluetooth only to wake a nearby paired device so it can sync '
  + 'over Wi-Fi. No file data is sent over Bluetooth.';

/** iOS: add local-network + Bonjour + Bluetooth usage keys without clobbering. */
function withMeerkatIos(config) {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    // Never overwrite a value the app already set (app.config.ts owns the
    // Bluetooth string); only fill what is missing.
    if (!plist.NSLocalNetworkUsageDescription) {
      plist.NSLocalNetworkUsageDescription = LOCAL_NETWORK_USAGE;
    }
    if (!plist.NSBluetoothAlwaysUsageDescription) {
      plist.NSBluetoothAlwaysUsageDescription = BLUETOOTH_USAGE;
    }
    const existing = Array.isArray(plist.NSBonjourServices) ? plist.NSBonjourServices : [];
    plist.NSBonjourServices = Array.from(new Set([...existing, ...MEERKAT_BONJOUR_SERVICES]));
    return cfg;
  });
}

// Android permissions the Nearby data path + BLE wake rung need. The four
// Bluetooth / nearby-Wi-Fi entries are also set by app.config.ts;
// ensurePermissions dedupes, so listing them here keeps the package
// self-contained for any host. ACCESS_FINE_LOCATION and the Wi-Fi/foreground
// entries are ADDED by this plugin (app.config.ts does not declare them);
// document any the operator must add appears in the package README.
const ANDROID_PERMISSIONS = [
  'android.permission.BLUETOOTH_ADVERTISE',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.NEARBY_WIFI_DEVICES',
  // ACCESS_FINE_LOCATION is required by the BLE scanner on Android 11 and below
  // (BLUETOOTH_SCAN's usesPermissionFlags="neverForLocation" only exempts
  // Android 12+), and by Wi-Fi Direct service discovery on older OS versions.
  // The native BleWake/Nearby scanners will not surface results without it on
  // those OS versions, so it is declared here to keep the package self-contained.
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_WIFI_STATE',
  'android.permission.ACCESS_NETWORK_STATE',
  // A user-visible nearby transfer runs a bounded foreground service only while
  // the transfer is on screen (Phase 2); declared here, started/stopped by the
  // native module, never a persistent always-on service.
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE',
];

/** Android: add the nearby/BLE permissions (deduped by addPermission). */
function withMeerkatAndroid(config) {
  return withAndroidManifest(config, (cfg) => {
    AndroidConfig.Permissions.ensurePermissions(
      cfg.modResults,
      ANDROID_PERMISSIONS,
    );
    return cfg;
  });
}

/** @param {import('expo/config-plugins').ExpoConfig} config */
const withMeerkatNativeTransport = (config) => {
  config = withMeerkatIos(config);
  config = withMeerkatAndroid(config);
  return config;
};

module.exports = createRunOncePlugin(
  withMeerkatNativeTransport,
  pkg.name,
  pkg.version,
);
