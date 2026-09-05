// ── Dining Integration ──────────────────────────────────────────────
// Links shared meals from MyDining to friend profiles.
// Stub: dining module does not yet track companions per visit.

import { createIntegration } from './base';
import type { ModuleIntegration, IntegrationActivity } from './types';

/**
 * Get shared meals involving a person.
 * Stub: returns empty array until dining module adds companion tracking.
 */
export function getSharedMeals(_personId: string): IntegrationActivity[] {
  // TODO: Query dining module for visits where person was a companion
  return [];
}

export const diningIntegration: ModuleIntegration = createIntegration('dining', {
  deepLinkPrefix: '/dining/visit',
  getActivities: getSharedMeals,
});
