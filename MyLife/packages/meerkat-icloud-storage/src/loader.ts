// Lazy native-module lookup. Expo Go, Node, and builds without the compiled
// Swift module return null. No caller sees a module-shaped fake.

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
