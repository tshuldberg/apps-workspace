// ── Gaming Integration ──────────────────────────────────────────────
// Links gaming sessions from a future MyGaming module.
// Stub: gaming module does not exist yet.

import { createIntegration } from './base';
import type { ModuleIntegration, IntegrationActivity } from './types';

/**
 * Get gaming sessions involving a person.
 * Stub: returns empty array (gaming module may not exist yet).
 */
export function getGamingBuddyStats(_personId: string): IntegrationActivity[] {
  // TODO: Query gaming module for sessions where person was a co-player
  return [];
}

export const gamingIntegration: ModuleIntegration = createIntegration('gaming', {
  deepLinkPrefix: '/gaming/session',
  getActivities: getGamingBuddyStats,
});
