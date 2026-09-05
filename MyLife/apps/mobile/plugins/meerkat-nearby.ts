/**
 * Expo config plugin for Meerkat nearby peer sync.
 *
 * Adds native permissions and capabilities required by the nearby peer
 * transport (MultipeerConnectivity / Wi-Fi P2P) and BLE wake-up transport
 * (CoreBluetooth / android.bluetooth).
 *
 * iOS:
 * - NSLocalNetworkUsageDescription (Bonjour/LAN discovery)
 * - NSBonjourServices (_mylife-sync._tcp)
 * - NSBluetoothAlwaysUsageDescription (BLE scanning in background)
 * - NSBluetoothPeripheralUsageDescription (BLE advertising)
 *
 * Android:
 * - ACCESS_WIFI_STATE, CHANGE_WIFI_STATE (Wi-Fi P2P)
 * - ACCESS_FINE_LOCATION (required for Wi-Fi P2P discovery)
 * - NEARBY_WIFI_DEVICES (Android 13+)
 * - BLUETOOTH, BLUETOOTH_ADMIN (legacy BLE)
 * - BLUETOOTH_CONNECT, BLUETOOTH_SCAN, BLUETOOTH_ADVERTISE (Android 12+)
 */

import type { ConfigPlugin } from 'expo/config-plugins';
import { withInfoPlist, withAndroidManifest } from 'expo/config-plugins';

const ANDROID_PERMISSIONS = [
  // Wi-Fi P2P (nearby peer transport)
  'android.permission.ACCESS_WIFI_STATE',
  'android.permission.CHANGE_WIFI_STATE',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.NEARBY_WIFI_DEVICES',
  // BLE (wake-up transport)
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.BLUETOOTH_ADVERTISE',
] as const;

const withMeerkatNearby: ConfigPlugin = (config) => {
  // iOS: Add Bonjour services, local network usage, and BLE usage descriptions.
  config = withInfoPlist(config, (plistConfig) => {
    plistConfig.modResults.NSLocalNetworkUsageDescription =
      'MyLife uses the local network to sync data between your devices.';
    plistConfig.modResults.NSBonjourServices = [
      '_mylife-sync._tcp',
    ];
    plistConfig.modResults.NSBluetoothAlwaysUsageDescription =
      'MyLife uses Bluetooth to detect nearby devices for sync.';
    plistConfig.modResults.NSBluetoothPeripheralUsageDescription =
      'MyLife uses Bluetooth to wake up nearby devices for sync.';
    return plistConfig;
  });

  // Android: Add Wi-Fi P2P and BLE permissions.
  config = withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;

    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    for (const perm of ANDROID_PERMISSIONS) {
      const exists = manifest['uses-permission'].some(
        (p: { $: { 'android:name': string } }) => p.$['android:name'] === perm,
      );
      if (!exists) {
        manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    return manifestConfig;
  });

  return config;
};

export default withMeerkatNearby;
