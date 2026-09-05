import type { ModuleDefinition, ModuleId } from './types';
import { ModuleDefinitionSchema } from './types';

/**
 * Central store for all registered MyLife modules.
 *
 * Modules register themselves at app startup. The hub app queries the
 * registry to discover which modules exist, which are enabled, and
 * how to render their navigation.
 *
 * Supports a subscribe/notify pattern so React hooks can re-render
 * when enabled state changes.
 */
export class ModuleRegistry {
  private modules = new Map<ModuleId, ModuleDefinition>();
  private enabled = new Set<ModuleId>();
  private listeners = new Set<() => void>();

  /**
   * Subscribe to state changes (enable/disable).
   * Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  /**
   * Register a module definition. Validates the definition with Zod
   * and throws if it fails. Overwrites any previous registration for
   * the same module ID.
   */
  register(definition: ModuleDefinition): void {
    const parsed = ModuleDefinitionSchema.parse(definition);
    this.modules.set(parsed.id, parsed);
  }

  /**
   * Retrieve a module definition by ID.
   * Returns undefined if the module has not been registered.
   */
  get(id: ModuleId): ModuleDefinition | undefined {
    return this.modules.get(id);
  }

  /** Return all registered module definitions. */
  getAll(): ModuleDefinition[] {
    return Array.from(this.modules.values());
  }

  /** Return only the module definitions that are currently enabled. */
  getEnabled(): ModuleDefinition[] {
    return this.getAll().filter((m) => this.enabled.has(m.id));
  }

  /** Return the set of enabled module IDs. */
  getEnabledIds(): Set<ModuleId> {
    return new Set(this.enabled);
  }

  /** Enable a module by ID. No-op if already enabled or not registered. */
  enable(id: ModuleId): void {
    if (this.modules.has(id) && !this.enabled.has(id)) {
      this.enabled.add(id);
      this.notify();
    }
  }

  /** Disable a module by ID. No-op if already disabled. */
  disable(id: ModuleId): void {
    if (this.enabled.has(id)) {
      this.enabled.delete(id);
      this.notify();
    }
  }

  /** Check whether a specific module is currently enabled. */
  isEnabled(id: ModuleId): boolean {
    return this.enabled.has(id);
  }

  /** Return the total number of registered modules. */
  get size(): number {
    return this.modules.size;
  }
}
