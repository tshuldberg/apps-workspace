// ── Workouts Integration ────────────────────────────────────────────
// Links workout sessions with partners from MyWorkouts.
// Stub: workouts module does not yet track workout partners.

import { createIntegration } from './base';
import type { ModuleIntegration, IntegrationActivity } from './types';

/**
 * Get workout sessions involving a person as a partner.
 * Stub: returns empty array until workouts module adds partner tracking.
 */
export function getWorkoutPartnerStats(_personId: string): IntegrationActivity[] {
  // TODO: Query workouts module for sessions where person was a partner
  return [];
}

export const workoutsIntegration: ModuleIntegration = createIntegration('workouts', {
  deepLinkPrefix: '/workouts/session',
  getActivities: getWorkoutPartnerStats,
});
