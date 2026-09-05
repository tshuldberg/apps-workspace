/**
 * Production-safe app restart for the RTL layout-direction switch (audit M6).
 *
 * react-native's `DevSettings.reload()` is a dev-bridge method: in a release
 * build it is a no-op, so a switch to/from a RTL language would silently
 * never mirror the layout. `expo-updates`' `Updates.reloadAsync()` works in
 * release builds regardless of whether OTA updates are enabled, so it is the
 * production path. `updates.enabled: false` in app.json means this call only
 * ever reloads the currently-installed bundle; it never fetches or applies
 * an OTA update.
 */

export interface RestartDeps {
  isDev: boolean;
  devReload: () => void;
  /** Returns a promise so failures can fall back to the manual-restart UI. */
  productionReloadAsync: () => Promise<void>;
  onManualRestartRequired: () => void;
}

export async function restartAppForRtlChange(deps: RestartDeps): Promise<void> {
  const { isDev, devReload, productionReloadAsync, onManualRestartRequired } = deps;

  if (isDev) {
    try {
      devReload();
    } catch {
      onManualRestartRequired();
    }
    return;
  }

  try {
    await productionReloadAsync();
  } catch {
    onManualRestartRequired();
  }
}
