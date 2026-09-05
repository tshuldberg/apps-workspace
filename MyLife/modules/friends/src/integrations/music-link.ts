// ── Music Integration ───────────────────────────────────────────────
// Links concert/show attendance from a future MyMusic module.
// Stub: music module does not exist yet.

import { createIntegration } from './base';
import type { ModuleIntegration, IntegrationActivity } from './types';

/**
 * Get concerts/shows attended with a person.
 * Stub: returns empty array (music module may not exist yet).
 */
export function getConcertCompanions(_personId: string): IntegrationActivity[] {
  // TODO: Query music module for concerts where person was a companion
  return [];
}

export const musicIntegration: ModuleIntegration = createIntegration('music', {
  deepLinkPrefix: '/music/concert',
  getActivities: getConcertCompanions,
});
