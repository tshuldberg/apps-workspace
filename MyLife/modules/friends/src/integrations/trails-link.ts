// ── Trails Integration ──────────────────────────────────────────────
// Links shared hikes/adventures from MyTrails to friend profiles.
// Stub: trails module does not yet track companions per hike.

import { createIntegration } from './base';
import type { ModuleIntegration, IntegrationActivity } from './types';

/**
 * Get shared adventures involving a person.
 * Stub: returns empty array until trails module adds companion tracking.
 */
export function getSharedAdventures(_personId: string): IntegrationActivity[] {
  // TODO: Query trails module for hikes where person was a companion
  return [];
}

export const trailsIntegration: ModuleIntegration = createIntegration('trails', {
  deepLinkPrefix: '/trails/hike',
  getActivities: getSharedAdventures,
});
