const path = require('path');
const fs = require('fs');
const {
  withAndroidManifest,
  withInfoPlist,
  withDangerousMod,
} = require('expo/config-plugins');

/**
 * Android + iOS security hardening (ported from Manhattan).
 *
 * - Strips location usage strings from the iOS Info.plist (Meerkat never asks
 *   for location; the LAN rung only needs Local Network, which app.json owns).
 * - Locks the Android app down: no cloud backup, no legacy external storage, no
 *   cleartext traffic (all transport is TLS/WSS), and Android 12+ backup +
 *   device-transfer exclusion rules so local SQLite / secure store / staged
 *   share payloads never leave the device outside Meerkat's own sync paths.
 * - Copies the xml resources into android/app/src/main/res/xml/ during prebuild.
 */
function copyXmlResource(projectRoot, srcName) {
  const src = path.join(__dirname, 'android-res', srcName);
  const destDir = path.join(
    projectRoot,
    'android',
    'app',
    'src',
    'main',
    'res',
    'xml',
  );
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, path.join(destDir, srcName));
}

function withSecurityHardening(config) {
  config = withInfoPlist(config, (modConfig) => {
    delete modConfig.modResults.NSLocationAlwaysAndWhenInUseUsageDescription;
    delete modConfig.modResults.NSLocationAlwaysUsageDescription;
    return modConfig;
  });

  config = withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0]?.$;
    if (application) {
      application['android:allowBackup'] = 'false';
      application['android:requestLegacyExternalStorage'] = 'false';
      application['android:usesCleartextTraffic'] = 'false';
      // Android 12+ backup/device-transfer rules.
      application['android:dataExtractionRules'] = '@xml/data_extraction_rules';
      // Legacy (pre-Android 12) full-backup content rules.
      application['android:fullBackupContent'] = '@xml/data_extraction_rules';
      application['android:networkSecurityConfig'] =
        '@xml/network_security_config';
    }
    return modConfig;
  });

  // Copy xml resources into android/app/src/main/res/xml/ during prebuild.
  config = withDangerousMod(config, [
    'android',
    (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      copyXmlResource(projectRoot, 'data_extraction_rules.xml');
      copyXmlResource(projectRoot, 'network_security_config.xml');
      return modConfig;
    },
  ]);

  return config;
}

module.exports = withSecurityHardening;
