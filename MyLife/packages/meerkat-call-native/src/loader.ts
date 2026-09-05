// Shared native-module loader for the owned Meerkat call package.
//
// This is the only file that reaches for expo-modules-core. It lazy-requires
// the package and returns null on every absence or linking failure. Plain Node,
// vitest, Expo Go, and a binary without this package therefore remain import-safe
// and honestly unavailable.

/** Look up a registered Expo native module by name. Never throws. */
export function loadExpoNativeModule<T>(name: string): T | null {
  type ExpoModulesCore = { requireNativeModule?: (moduleName: string) => unknown };
  let core: ExpoModulesCore | null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    core = require('expo-modules-core') as ExpoModulesCore;
  } catch {
    return null;
  }
  if (!core || typeof core.requireNativeModule !== 'function') return null;
  try {
    return (core.requireNativeModule(name) ?? null) as T | null;
  } catch {
    return null;
  }
}
