const {
  withDangerousMod,
  withXcodeProject,
  withEntitlementsPlist,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const WATCH_APP_NAME = "MyFastWatch";
const WATCH_WIDGET_NAME = "MyFastWatchWidgets";
const APP_GROUP = "group.com.mytoolbox.mylife";
const WATCHOS_DEPLOYMENT_TARGET = "10.0";

// Swift source files for the watch app target
const WATCH_APP_FILES = [
  "MyFastWatchApp.swift",
  "FastState.swift",
  "TimerView.swift",
  "WaterLogView.swift",
  "WatchConnectivityManager.swift",
];

// Swift source files for the watch widget extension target
const WATCH_WIDGET_FILES = ["ComplicationProvider.swift"];

// Shared entitlements
const ENTITLEMENTS_FILE = "MyFastWatch.entitlements";

/**
 * Expo config plugin that adds the watchOS companion app to the iOS project.
 *
 * Architecture:
 * - MyFastWatch: watchOS app target (SwiftUI, WatchConnectivity)
 * - MyFastWatchWidgets: WidgetKit extension for watch face complications
 * - Both share App Group UserDefaults for state synchronization
 *
 * Steps:
 * 1. Adds App Group entitlement to the main iOS app
 * 2. Copies Swift source files into ios/ subdirectories
 * 3. Adds watchOS app target + widget extension target to Xcode project
 */
const withWatch = (config) => {
  // Step 1: Add App Group entitlement to the main iOS app
  config = withEntitlementsPlist(config, (mod) => {
    const groups =
      mod.modResults["com.apple.security.application-groups"] || [];
    if (!groups.includes(APP_GROUP)) {
      groups.push(APP_GROUP);
    }
    mod.modResults["com.apple.security.application-groups"] = groups;
    return mod;
  });

  // Step 2: Copy Swift source files into ios/ subdirectories
  config = withDangerousMod(config, [
    "ios",
    (mod) => {
      const iosDir = mod.modRequest.platformProjectRoot;
      const sourceDir = path.join(mod.modRequest.projectRoot, "watch", "ios");

      // Create watch app directory (nested to match Xcode group path)
      const watchAppDir = path.join(iosDir, WATCH_APP_NAME, WATCH_APP_NAME);
      fs.mkdirSync(watchAppDir, { recursive: true });

      // Copy watch app Swift files
      for (const file of WATCH_APP_FILES) {
        const src = path.join(sourceDir, file);
        const dest = path.join(watchAppDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }

      // Copy entitlements for watch app
      const entSrc = path.join(sourceDir, ENTITLEMENTS_FILE);
      const entDest = path.join(watchAppDir, ENTITLEMENTS_FILE);
      if (fs.existsSync(entSrc)) {
        fs.copyFileSync(entSrc, entDest);
      }

      // Create watch widget directory (nested to match Xcode group path)
      const watchWidgetDir = path.join(iosDir, WATCH_WIDGET_NAME, WATCH_WIDGET_NAME);
      fs.mkdirSync(watchWidgetDir, { recursive: true });

      // Copy widget Swift files
      for (const file of WATCH_WIDGET_FILES) {
        const src = path.join(sourceDir, file);
        const dest = path.join(watchWidgetDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }

      // Copy entitlements for widget extension
      const widgetEntDest = path.join(watchWidgetDir, ENTITLEMENTS_FILE);
      if (fs.existsSync(entSrc)) {
        fs.copyFileSync(entSrc, widgetEntDest);
      }

      // Create Info.plist for watch app
      const watchInfoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>CFBundleDevelopmentRegion</key>
\t<string>$(DEVELOPMENT_LANGUAGE)</string>
\t<key>CFBundleDisplayName</key>
\t<string>MyFast</string>
\t<key>CFBundleExecutable</key>
\t<string>$(EXECUTABLE_NAME)</string>
\t<key>CFBundleIdentifier</key>
\t<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
\t<key>CFBundleInfoDictionaryVersion</key>
\t<string>6.0</string>
\t<key>CFBundleName</key>
\t<string>$(PRODUCT_NAME)</string>
\t<key>CFBundlePackageType</key>
\t<string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
\t<key>CFBundleShortVersionString</key>
\t<string>$(MARKETING_VERSION)</string>
\t<key>CFBundleVersion</key>
\t<string>$(CURRENT_PROJECT_VERSION)</string>
\t<key>WKApplication</key>
\t<true/>
</dict>
</plist>`;
      fs.writeFileSync(path.join(watchAppDir, "Info.plist"), watchInfoPlist);

      // Create Info.plist for watch widget extension
      const widgetInfoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>CFBundleDevelopmentRegion</key>
\t<string>$(DEVELOPMENT_LANGUAGE)</string>
\t<key>CFBundleDisplayName</key>
\t<string>MyFast Complications</string>
\t<key>CFBundleExecutable</key>
\t<string>$(EXECUTABLE_NAME)</string>
\t<key>CFBundleIdentifier</key>
\t<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
\t<key>CFBundleInfoDictionaryVersion</key>
\t<string>6.0</string>
\t<key>CFBundleName</key>
\t<string>$(PRODUCT_NAME)</string>
\t<key>CFBundlePackageType</key>
\t<string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
\t<key>CFBundleShortVersionString</key>
\t<string>$(MARKETING_VERSION)</string>
\t<key>CFBundleVersion</key>
\t<string>$(CURRENT_PROJECT_VERSION)</string>
\t<key>NSExtension</key>
\t<dict>
\t\t<key>NSExtensionPointIdentifier</key>
\t\t<string>com.apple.widgetkit-extension</string>
\t</dict>
</dict>
</plist>`;
      fs.writeFileSync(
        path.join(watchWidgetDir, "Info.plist"),
        widgetInfoPlist
      );

      return mod;
    },
  ]);

  // Step 3: Add watchOS targets to Xcode project
  config = withXcodeProject(config, (mod) => {
    const proj = mod.modResults;
    const mainBundleId = mod.ios?.bundleIdentifier ?? "com.mylife.app";
    const watchBundleId = mainBundleId + ".watchkitapp";
    const widgetBundleId = mainBundleId + ".watchkitapp.widgets";

    // --- Watch App Target ---
    if (!proj.pbxTargetByName(WATCH_APP_NAME)) {
      const watchTarget = proj.addTarget(
        WATCH_APP_NAME,
        "watch2_app",
        WATCH_APP_NAME,
        watchBundleId
      );

      const watchGroupKey = proj.pbxCreateGroup(
        WATCH_APP_NAME,
        WATCH_APP_NAME
      );
      const mainGroupId = proj.getFirstProject().firstProject.mainGroup;
      proj.addToPbxGroup(watchGroupKey, mainGroupId);

      // Add Swift source files
      for (const file of WATCH_APP_FILES) {
        proj.addSourceFile(
          `${WATCH_APP_NAME}/${file}`,
          { target: watchTarget.uuid },
          watchGroupKey
        );
      }

      // Entitlements and Info.plist are referenced via build settings,
      // not added as resource build phase files.

      // Configure build settings
      const configurations = proj.pbxXCBuildConfigurationSection();
      for (const key in configurations) {
        const cfg = configurations[key];
        if (
          typeof cfg === "object" &&
          cfg.buildSettings &&
          cfg.buildSettings.PRODUCT_NAME === `"${WATCH_APP_NAME}"`
        ) {
          cfg.buildSettings.SDKROOT = "watchos";
          cfg.buildSettings.WATCHOS_DEPLOYMENT_TARGET =
            WATCHOS_DEPLOYMENT_TARGET;
          cfg.buildSettings.TARGETED_DEVICE_FAMILY = '"4"';
          cfg.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${watchBundleId}"`;
          cfg.buildSettings.SWIFT_VERSION = "5.0";
          cfg.buildSettings.CODE_SIGN_ENTITLEMENTS = `"${WATCH_APP_NAME}/${WATCH_APP_NAME}/${ENTITLEMENTS_FILE}"`;
          cfg.buildSettings.INFOPLIST_FILE = `"${WATCH_APP_NAME}/${WATCH_APP_NAME}/Info.plist"`;
          cfg.buildSettings.GENERATE_INFOPLIST_FILE = "YES";
          cfg.buildSettings.MARKETING_VERSION = "1.0";
          cfg.buildSettings.CURRENT_PROJECT_VERSION = "1";
          cfg.buildSettings.ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME =
            '"AccentColor"';
          cfg.buildSettings.LD_RUNPATH_SEARCH_PATHS =
            '"$(inherited) @executable_path/Frameworks"';
          cfg.buildSettings.SKIP_INSTALL = "YES";
        }
      }

      // Add frameworks
      proj.addFramework("SwiftUI.framework", {
        target: watchTarget.uuid,
        link: true,
      });
      proj.addFramework("WatchConnectivity.framework", {
        target: watchTarget.uuid,
        link: true,
      });
      proj.addFramework("WatchKit.framework", {
        target: watchTarget.uuid,
        link: true,
      });
    }

    // --- Watch Widget Extension Target ---
    if (!proj.pbxTargetByName(WATCH_WIDGET_NAME)) {
      const widgetTarget = proj.addTarget(
        WATCH_WIDGET_NAME,
        "app_extension",
        WATCH_WIDGET_NAME,
        widgetBundleId
      );

      const widgetGroupKey = proj.pbxCreateGroup(
        WATCH_WIDGET_NAME,
        WATCH_WIDGET_NAME
      );
      const mainGroupId = proj.getFirstProject().firstProject.mainGroup;
      proj.addToPbxGroup(widgetGroupKey, mainGroupId);

      // Add Swift source files
      for (const file of WATCH_WIDGET_FILES) {
        proj.addSourceFile(
          `${WATCH_WIDGET_NAME}/${file}`,
          { target: widgetTarget.uuid },
          widgetGroupKey
        );
      }

      // Entitlements and Info.plist are referenced via build settings,
      // not added as resource build phase files.

      // Configure build settings
      const configurations = proj.pbxXCBuildConfigurationSection();
      for (const key in configurations) {
        const cfg = configurations[key];
        if (
          typeof cfg === "object" &&
          cfg.buildSettings &&
          cfg.buildSettings.PRODUCT_NAME === `"${WATCH_WIDGET_NAME}"`
        ) {
          cfg.buildSettings.SDKROOT = "watchos";
          cfg.buildSettings.WATCHOS_DEPLOYMENT_TARGET =
            WATCHOS_DEPLOYMENT_TARGET;
          cfg.buildSettings.TARGETED_DEVICE_FAMILY = '"4"';
          cfg.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${widgetBundleId}"`;
          cfg.buildSettings.SWIFT_VERSION = "5.0";
          cfg.buildSettings.CODE_SIGN_ENTITLEMENTS = `"${WATCH_WIDGET_NAME}/${WATCH_WIDGET_NAME}/${ENTITLEMENTS_FILE}"`;
          cfg.buildSettings.INFOPLIST_FILE = `"${WATCH_WIDGET_NAME}/${WATCH_WIDGET_NAME}/Info.plist"`;
          cfg.buildSettings.GENERATE_INFOPLIST_FILE = "YES";
          cfg.buildSettings.MARKETING_VERSION = "1.0";
          cfg.buildSettings.CURRENT_PROJECT_VERSION = "1";
          cfg.buildSettings.LD_RUNPATH_SEARCH_PATHS =
            '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"';
          cfg.buildSettings.SKIP_INSTALL = "YES";
        }
      }

      // Add frameworks
      proj.addFramework("WidgetKit.framework", {
        target: widgetTarget.uuid,
        link: true,
      });
      proj.addFramework("SwiftUI.framework", {
        target: widgetTarget.uuid,
        link: true,
      });
    }

    return mod;
  });

  return config;
};

module.exports = withWatch;
