/**
 * Shared Places — canonical location + GPS track store.
 *
 * Provides typed CRUD over hub_places and hub_gps_tracks, including a
 * vendored geohash encoder for nearby-place prefix search.
 */

// Types
export type {
  Place,
  PlaceKind,
  CreatePlaceInput,
  GpsTrack,
  CreateGpsTrackInput,
} from './types';
export {
  PlaceSchema,
  PlaceKindSchema,
  CreatePlaceInputSchema,
  GpsTrackSchema,
  CreateGpsTrackInputSchema,
} from './types';

// Helpers
export { encodeGeohash } from './helpers';

// Operations
export {
  createPlace,
  getPlace,
  findNearbyPlaces,
  updatePlace,
  deletePlace,
  createGpsTrack,
  getGpsTrack,
  getGpsTracksFor,
} from './operations';
