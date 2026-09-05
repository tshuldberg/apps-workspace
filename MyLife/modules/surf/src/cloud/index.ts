// Cloud query adapters for Supabase-backed operations.
// All functions accept a SupabaseClient as the first parameter for testability.
// These are the remote-read counterparts to the local SQLite CRUD in ../db/.

export {
  cloudGetSpotsByRegion,
  cloudGetSpotBySlug,
  cloudGetNearbySpots,
  cloudGetUserFavoriteSpots,
  cloudGetSpotGuide,
  cloudToggleFavorite,
} from './spots';

export {
  cloudGetSpotForecast,
  cloudGetTides,
  cloudGetLatestBuoyReading,
  cloudGetRecentBuoyReadings,
  cloudGetSpotNarrative,
  cloudGetRegionNarrative,
  cloudVoteOnNarrative,
} from './forecasts';

export {
  cloudCreateSpotAlert,
  cloudGetSpotAlerts,
  cloudSetSpotAlertActive,
  cloudDeleteSpotAlert,
} from './alerts';
export type { CreateCloudAlertInput } from './alerts';

export {
  cloudGetSpotReviews,
  cloudGetSpotPhotos,
  cloudCreateSpotReview,
  cloudDeleteSpotReview,
} from './community';

export {
  cloudCreateUserPin,
  cloudGetUserPins,
  cloudDeleteUserPin,
  cloudCreateSurfSession,
  cloudGetSurfSessions,
  cloudDeleteSurfSession,
} from './user';

export {
  cloudSyncTrailHikeSummary,
  cloudGetTrailHikeSummaries,
} from './trails';

export {
  cloudGetSurfProfile,
  cloudUpdateSurfProfile,
  cloudFollow,
  cloudUnfollow,
  cloudGetFollowers,
  cloudGetFollowing,
  cloudShareSession,
  cloudGetFeed,
  cloudCreateCrew,
  cloudGetUserCrews,
} from './social';
