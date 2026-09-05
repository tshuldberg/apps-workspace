import type { AutomationRule } from './types';

const registry = new Map<string, AutomationRule<unknown, unknown, unknown>>();

export function registerRule<T, P, R>(rule: AutomationRule<T, P, R>): void {
  if (registry.has(rule.id)) {
    throw new Error(`automation rule "${rule.id}" is already registered`);
  }
  registry.set(rule.id, rule as AutomationRule<unknown, unknown, unknown>);
}

export function getRule(
  id: string,
): AutomationRule<unknown, unknown, unknown> | undefined {
  return registry.get(id);
}

export function listRules(): AutomationRule<unknown, unknown, unknown>[] {
  return Array.from(registry.values());
}

export function clearRegistryForTests(): void {
  registry.clear();
}
