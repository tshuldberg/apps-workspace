// ── Integration Base Helpers ────────────────────────────────────────
// Factory and utilities for building module integrations.

import type { ModuleIntegration, IntegrationActivity, HangoutSuggestion } from './types';

/** Known module IDs in the registry. Placeholder until we can query the live registry. */
const KNOWN_MODULES = new Set([
  'books', 'budget', 'car', 'classes', 'closet', 'cycle', 'dining',
  'fast', 'flash', 'forums', 'friends', 'garden', 'habits', 'health',
  'homes', 'journal', 'mail', 'market', 'meds', 'mood', 'notes',
  'nutrition', 'payments', 'pets', 'presence', 'recipes', 'rsvp',
  'stars', 'subs', 'surf', 'trails', 'voice', 'words', 'workouts',
]);

/**
 * Check if a module is registered and enabled.
 * Placeholder: returns true for known module IDs. When the runtime registry
 * is injectable, this will delegate to the actual enabled-module check.
 */
export function isModuleEnabled(moduleId: string): boolean {
  return KNOWN_MODULES.has(moduleId);
}

/** Configuration for creating an integration stub. */
interface IntegrationConfig {
  deepLinkPrefix: string;
  getActivities?: (personId: string) => IntegrationActivity[];
  suggestHangout?: (activityData: unknown) => HangoutSuggestion | null;
}

/**
 * Factory to create a standard ModuleIntegration.
 * Defaults return empty arrays / null when partner module has no companion data.
 */
export function createIntegration(
  moduleId: string,
  config: IntegrationConfig,
): ModuleIntegration {
  return {
    moduleId,
    isAvailable: () => isModuleEnabled(moduleId),
    getActivitiesForPerson: config.getActivities ?? (() => []),
    suggestHangout: config.suggestHangout ?? (() => null),
  };
}
