// ── Friends Bridge ──────────────────────────────────────────────────
// Pure, decoupled mapping from a Manhattan event to a @mylife/friends
// hangout input. Attending a Manhattan event can log a friends hangout.
//
// This stays standalone-safe: it imports ONLY the HangoutInput type
// (erased at compile time) and never touches friends data or createHangout.
// The hub caller is responsible for invoking createHangout with the result.

import type { HangoutInput } from '@mylife/friends';

/** Manhattan ActivityTag subset this bridge can produce. */
type BridgeActivityTag = 'concert' | 'party' | 'random';

/** Patterns that map an event category to a friends ActivityTag. */
const CONCERT_RE = /music|concert|gig|\bdj\b|live music|jazz|festival/i;
const PARTY_RE = /nightlife|social|party|rsvp|club|rave/i;

/**
 * Map a Manhattan event category to a @mylife/friends ActivityTag.
 *
 * - music / concert / live music -> 'concert'
 * - nightlife / social / party / rsvp -> 'party'
 * - any other non-empty category -> 'random'
 * - null / undefined / blank -> null
 */
export function eventTypeToActivityTag(
  category: string | null | undefined,
): BridgeActivityTag | null {
  if (category == null) return null;
  const trimmed = category.trim();
  if (trimmed.length === 0) return null;
  if (CONCERT_RE.test(trimmed)) return 'concert';
  if (PARTY_RE.test(trimmed)) return 'party';
  return 'random';
}

/** Minimal event shape this bridge needs. */
export interface BridgeEvent {
  id: string;
  title: string;
  start_at: string | null;
  venue_name?: string | null;
  category?: string | null;
}

/**
 * Build a @mylife/friends HangoutInput from a Manhattan event and the
 * people who attended.
 *
 * Returns null when there are no attendees or the event has no start time.
 * - people_ids: attendingPersonIds
 * - happened_at: the date portion (YYYY-MM-DD) of start_at
 * - activity_tags: derived from category ([] when category yields no tag)
 * - photo_ids: [] (no photos attached at map time)
 * - location_name: venue_name (omitted when absent)
 * - notes_md: 'Attended: <title>'
 * - linked_concert_id: event.id when the event is a concert/music event
 */
export function mapEventToHangoutInput(
  event: BridgeEvent,
  attendingPersonIds: string[],
): HangoutInput | null {
  if (attendingPersonIds.length === 0) return null;
  if (event.start_at == null || event.start_at.trim().length === 0) return null;

  const tag = eventTypeToActivityTag(event.category);

  const input: HangoutInput = {
    people_ids: attendingPersonIds,
    happened_at: event.start_at.slice(0, 10),
    activity_tags: tag ? [tag] : [],
    photo_ids: [],
    notes_md: `Attended: ${event.title}`,
  };

  if (event.venue_name) input.location_name = event.venue_name;
  if (tag === 'concert') input.linked_concert_id = event.id;

  return input;
}
