/**
 * Shared Places — types.
 *
 * Canonical place + GPS track store with polymorphic module origin.
 * Backed by hub_places, hub_places_geo_idx, and hub_gps_tracks.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Place
// ---------------------------------------------------------------------------

/** Allowed place kinds. Matches product taxonomy, not a DB CHECK. */
export const PlaceKindSchema = z.enum([
  'home',
  'trailhead',
  'surf',
  'restaurant',
  'garden_zone',
  'parking',
  'other',
]);

export type PlaceKind = z.infer<typeof PlaceKindSchema>;

export const PlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: PlaceKindSchema,
  lat: z.number(),
  lng: z.number(),
  geohash: z.string().nullable(),
  addressJson: z.string().nullable(),
  moduleOrigin: z.string().nullable(),
  createdAt: z.string(),
});

export type Place = z.infer<typeof PlaceSchema>;

export const CreatePlaceInputSchema = z.object({
  name: z.string().min(1, 'name is required'),
  kind: PlaceKindSchema,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  geohash: z.string().optional(),
  addressJson: z.string().optional(),
  moduleOrigin: z.string().optional(),
});

export type CreatePlaceInput = z.infer<typeof CreatePlaceInputSchema>;

// ---------------------------------------------------------------------------
// GpsTrack
// ---------------------------------------------------------------------------

export const GpsTrackSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  entityRef: z.string().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  distanceM: z.number().nullable(),
  polyline: z.string().nullable(),
  createdAt: z.string(),
});

export type GpsTrack = z.infer<typeof GpsTrackSchema>;

export const CreateGpsTrackInputSchema = z.object({
  moduleId: z.string().min(1, 'moduleId is required'),
  entityRef: z.string().optional(),
  startedAt: z.string().min(1, 'startedAt is required'),
  endedAt: z.string().optional(),
  distanceM: z.number().nonnegative().optional(),
  polyline: z.string().optional(),
});

export type CreateGpsTrackInput = z.infer<typeof CreateGpsTrackInputSchema>;
