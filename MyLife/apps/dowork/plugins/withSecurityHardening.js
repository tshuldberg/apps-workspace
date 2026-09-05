const path = require('path');
const fs = require('fs');
const {
  withAndroidManifest,
  withInfoPlist,
  withDangerousMod,
} = require('@expo/config-plugins');

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
    // DoWork only requests when-in-use location for GPS workouts. Strip
    // any Always-location strings libraries may inject during prebuild.
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
