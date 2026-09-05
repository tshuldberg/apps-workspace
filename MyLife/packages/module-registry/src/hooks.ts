'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ModuleDefinition, ModuleId } from './types';
import type { ModuleRegistry } from './registry';

/**
 * React context that holds the singleton ModuleRegistry instance.
 * Wrap your app root with `ModuleRegistryContext.Provider` to make
 * the registry available to all hooks below.
 */
export const ModuleRegistryContext = createContext<ModuleRegistry | null>(null);

/**
 * Access the ModuleRegistry from any component in the tree.
 * Throws if used outside of a ModuleRegistryContext.Provider.
 */
export function useModuleRegistry(): ModuleRegistry {
  const registry = useContext(ModuleRegistryContext);
  if (!registry) {
    throw new Error(
      'useModuleRegistry must be used within a ModuleRegistryContext.Provider',
    );
  }
  return registry;
}

/**
 * Internal hook that subscribes to registry changes and forces
 * a re-render whenever enable/disable state changes.
 */
function useRegistrySubscription(registry: ModuleRegistry): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    return registry.subscribe(() => setTick((t) => t + 1));
  }, [registry]);
}

/**
 * Return the list of currently enabled module definitions.
 * Automatically re-renders when modules are enabled or disabled.
 */
export function useEnabledModules(): ModuleDefinition[] {
  const registry = useModuleRegistry();
  useRegistrySubscription(registry);
  return registry.getEnabled();
}

/**
 * Look up a single module definition by ID.
 * Returns undefined if the module is not registered.
 */
export function useModule(id: ModuleId): ModuleDefinition | undefined {
  const registry = useModuleRegistry();
  return registry.get(id);
}
