// Shared, documented native-module loader for the owned Meerkat transport package.
//
// This is the SINGLE place that reaches for a native module. It lazy-requires
// expo-modules-core and asks for a native module by name, returning null on ANY
// failure: expo-modules-core absent (plain Node / vitest), the native module
// absent (Expo Go, or a dev build that has not compiled the Swift/Kotlin yet),
// or a throwing require. Absent === null === the rung stays honestly
// unavailable. Nothing here fabricates a module.
//
// Why lazy + try/catch and not a static import: the Meerkat app resolves
// @mylife/sync (and this package) through its React Native barrel, but the same
// files are type-checked and unit-tested under plain Node/vitest where
// expo-modules-core is not installed. A static `import ... from
// 'expo-modules-core'` would throw at module-eval time and break both Expo Go
// boot and the test path. The existing nearby-backend.ts loader uses the same
// static-string-literal require + try/catch discipline for exactly this reason.

/**
 * Look up a registered Expo native module by name, or null when it (or
 * expo-modules-core) is absent. Never throws.
 *
 * @param name The native module registration name (e.g. 'MeerkatNearby').
 */
export function loadExpoNativeModule<T>(name: string): T | null {
  type ExpoModulesCore = { requireNativeModule?: (n: string) => unknown };
  let core: ExpoModulesCore | null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    core = require('expo-modules-core') as ExpoModulesCore;
  } catch {
    // expo-modules-core not installed (plain Node / vitest / non-Expo host).
    return null;
  }
  if (!core || typeof core.requireNativeModule !== 'function') return null;
  try {
    // requireNativeModule throws when the native module is not linked into the
    // running binary (Expo Go, or a dev build without the compiled sources).
    const mod = core.requireNativeModule(name);
    return (mod ?? null) as T | null;
  } catch {
    return null;
  }
}
