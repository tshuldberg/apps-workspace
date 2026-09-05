import { describe, expect, it } from 'vitest';

import { extractVenueGeoPoints } from '../engine/venue-geo';
import type { Venue } from '../types';

function makeVenue(partial: Partial<Venue> = {}): Venue {
  return {
    id: 'v-default',
    name: 'Default Stadium',
    city: null,
    country: null,
    sport: null,
    team: null,
    capacity: null,
    visited: 0,
    first_visit_at: null,
    last_visit_at: null,
    rating: null,
    bucket_list: 0,
    lat: 40.0,
    lng: -74.0,
    notes_md: null,
    created_at: 0,
    updated_at: 0,
    ...partial,
  };
}

describe('extractVenueGeoPoints', () => {
  it('filters out venues with null lat or null lng', () => {
    const venues: Venue[] = [
      makeVenue({ id: 'a', name: 'A', lat: 40, lng: -74 }),
      makeVenue({ id: 'b', name: 'B', lat: null, lng: -74 }),
      makeVenue({ id: 'c', name: 'C', lat: 40, lng: null }),
      makeVenue({ id: 'd', name: 'D', lat: null, lng: null }),
    ];
    const out = extractVenueGeoPoints(venues);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('a');
  });

  it('filters out non-finite lat or lng values', () => {
    const venues: Venue[] = [
      makeVenue({ id: 'ok', name: 'Ok', lat: 1, lng: 2 }),
      makeVenue({ id: 'nan-lat', name: 'NaN Lat', lat: Number.NaN, lng: 2 }),
      makeVenue({ id: 'inf-lng', name: 'Inf Lng', lat: 1, lng: Number.POSITIVE_INFINITY }),
    ];
    const out = extractVenueGeoPoints(venues);
    expect(out.map((p) => p.id)).toEqual(['ok']);
  });

  it('sorts output alphabetically by name', () => {
    const venues: Venue[] = [
      makeVenue({ id: '1', name: 'Wrigley Field', lat: 41.9, lng: -87.6 }),
      makeVenue({ id: '2', name: 'Arrowhead', lat: 39.0, lng: -94.5 }),
      makeVenue({ id: '3', name: 'MetLife', lat: 40.8, lng: -74.0 }),
    ];
    const out = extractVenueGeoPoints(venues);
    expect(out.map((p) => p.name)).toEqual(['Arrowhead', 'MetLife', 'Wrigley Field']);
  });

  it('projects SqliteBool visited / bucket_list to boolean', () => {
    const venues: Venue[] = [
      makeVenue({ id: '1', name: 'A', visited: 1, bucket_list: 0 }),
      makeVenue({ id: '2', name: 'B', visited: 0, bucket_list: 1 }),
    ];
    const out = extractVenueGeoPoints(venues);
    expect(out[0]).toMatchObject({ name: 'A', visited: true, bucketList: false });
    expect(out[1]).toMatchObject({ name: 'B', visited: false, bucketList: true });
  });

  it('carries lat/lng through unchanged', () => {
    const out = extractVenueGeoPoints([
      makeVenue({ id: '1', name: 'A', lat: 40.123, lng: -74.456 }),
    ]);
    expect(out[0]).toMatchObject({ lat: 40.123, lng: -74.456 });
  });

  it('returns an empty list for an empty input', () => {
    expect(extractVenueGeoPoints([])).toEqual([]);
  });
});
