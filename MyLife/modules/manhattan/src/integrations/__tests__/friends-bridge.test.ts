import { describe, it, expect } from 'vitest';
import {
  eventTypeToActivityTag,
  mapEventToHangoutInput,
} from '../friends-bridge';

describe('eventTypeToActivityTag', () => {
  it('maps music to concert', () => {
    expect(eventTypeToActivityTag('Music')).toBe('concert');
    expect(eventTypeToActivityTag('music')).toBe('concert');
    expect(eventTypeToActivityTag('concert')).toBe('concert');
    expect(eventTypeToActivityTag('Live Music')).toBe('concert');
  });

  it('maps nightlife/social/party to party', () => {
    expect(eventTypeToActivityTag('Nightlife/Social')).toBe('party');
    expect(eventTypeToActivityTag('nightlife')).toBe('party');
    expect(eventTypeToActivityTag('social')).toBe('party');
    expect(eventTypeToActivityTag('party')).toBe('party');
    expect(eventTypeToActivityTag('rsvp')).toBe('party');
  });

  it('maps unknown categories to random', () => {
    expect(eventTypeToActivityTag('Comedy')).toBe('random');
    expect(eventTypeToActivityTag('Theater')).toBe('random');
    expect(eventTypeToActivityTag('Markets & Fairs')).toBe('random');
    expect(eventTypeToActivityTag('something weird')).toBe('random');
  });

  it('returns null for null/undefined/empty category', () => {
    expect(eventTypeToActivityTag(null)).toBeNull();
    expect(eventTypeToActivityTag(undefined)).toBeNull();
    expect(eventTypeToActivityTag('')).toBeNull();
    expect(eventTypeToActivityTag('   ')).toBeNull();
  });
});

describe('mapEventToHangoutInput', () => {
  const baseEvent = {
    id: 'evt-1',
    title: 'Rooftop Mixer',
    start_at: '2026-07-04T20:00:00.000Z',
    venue_name: 'Le Bain',
    category: 'rsvp',
  };

  it('maps an rsvp event to a party hangout input', () => {
    const result = mapEventToHangoutInput(baseEvent, ['p1', 'p2']);
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      people_ids: ['p1', 'p2'],
      happened_at: '2026-07-04',
      activity_tags: ['party'],
      location_name: 'Le Bain',
      notes_md: 'Attended: Rooftop Mixer',
    });
    // rsvp/party is not a concert, so no linked_concert_id
    expect(result?.linked_concert_id).toBeUndefined();
  });

  it('maps a music event to a concert hangout input with linked_concert_id', () => {
    const event = {
      id: 'evt-music',
      title: 'Jazz at Blue Note',
      start_at: '2026-08-15T19:30:00.000Z',
      venue_name: 'Blue Note',
      category: 'music',
    };
    const result = mapEventToHangoutInput(event, ['p1']);
    expect(result).not.toBeNull();
    expect(result?.activity_tags).toEqual(['concert']);
    expect(result?.linked_concert_id).toBe('evt-music');
    expect(result?.happened_at).toBe('2026-08-15');
    expect(result?.location_name).toBe('Blue Note');
    expect(result?.notes_md).toBe('Attended: Jazz at Blue Note');
  });

  it('returns null when there are no attendees', () => {
    expect(mapEventToHangoutInput(baseEvent, [])).toBeNull();
  });

  it('returns null when start_at is null', () => {
    const event = { ...baseEvent, start_at: null };
    expect(mapEventToHangoutInput(event, ['p1'])).toBeNull();
  });

  it('omits activity_tags when category yields no tag', () => {
    const event = {
      id: 'evt-2',
      title: 'Comedy Night',
      start_at: '2026-09-01T21:00:00.000Z',
      venue_name: 'Comedy Cellar',
      category: 'Comedy',
    };
    const result = mapEventToHangoutInput(event, ['p1']);
    expect(result?.activity_tags).toEqual(['random']);
    expect(result?.linked_concert_id).toBeUndefined();
  });

  it('handles missing venue_name and null category', () => {
    const event = {
      id: 'evt-3',
      title: 'Mystery Plans',
      start_at: '2026-10-10T18:00:00.000Z',
      category: null,
    };
    const result = mapEventToHangoutInput(event, ['p1']);
    expect(result).not.toBeNull();
    expect(result?.location_name).toBeUndefined();
    expect(result?.activity_tags).toEqual([]);
    expect(result?.photo_ids).toEqual([]);
    expect(result?.happened_at).toBe('2026-10-10');
  });
});
