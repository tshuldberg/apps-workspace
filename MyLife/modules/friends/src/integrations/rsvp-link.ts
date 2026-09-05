// ── RSVP Integration ────────────────────────────────────────────────
// Links shared events from MyRSVP to friend profiles.
// Stub: rsvp module does not yet track attendees per event.

import { createIntegration } from './base';
import type { ModuleIntegration, IntegrationActivity } from './types';

/**
 * Get shared events involving a person.
 * Stub: returns empty array until rsvp module adds attendee tracking.
 */
export function getSharedEvents(_personId: string): IntegrationActivity[] {
  // TODO: Query rsvp module for events where person was an attendee
  return [];
}

export const rsvpIntegration: ModuleIntegration = createIntegration('rsvp', {
  deepLinkPrefix: '/rsvp/event',
  getActivities: getSharedEvents,
});
