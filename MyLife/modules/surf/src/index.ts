// -- Module definition --
export { SURF_MODULE } from './definition';

// -- Zod schemas --
export {
  SurfBreakTypeSchema,
  SurfTideSchema,
  SkillLevelSchema,
  HazardSchema,
  RegionSchema,
  SurfSpotSchema,
  CreateSpotInputSchema,
  SurfSessionSchema,
  ConditionColorSchema,
  WindLabelSchema,
  SwellComponentSchema,
  ForecastSchema,
  TidePointSchema,
  NarrativeSchema,
  BuoyReadingSchema,
  SunTimesSchema,
  AlertParameterSchema,
  AlertOperatorSchema,
  AlertJoinSchema,
  AlertRuleSchema,
  SpotAlertSchema,
  SpotAlertNotificationSchema,
  SpotReviewSchema,
  SpotPhotoSchema,
  SpotGuideSchema,
  UserPinSchema,
  SessionWaveSchema,
  TrailDifficultySchema,
  TrailPointSchema,
  TrailSchema,
  RecordedHikeSchema,
  OfflineRegionSchema,
  // V4 schemas (zones + social)
  SurfZoneSchema,
  StokeLevelSchema,
  SurfProfileSchema,
  FollowSchema,
  SharedSessionSchema,
  SessionCommentSchema,
  SessionLikeSchema,
  CrewSchema,
  CrewMemberSchema,
} from './types';

// -- Inferred types --
export type {
  SurfBreakType,
  SurfTide,
  SkillLevel,
  Hazard,
  Region,
  SurfSpot,
  CreateSpotInput,
  SurfSession,
  ConditionColor,
  WindLabel,
  SwellComponent,
  Forecast,
  TidePoint,
  Narrative,
  BuoyReading,
  SunTimes,
  AlertParameter,
  AlertOperator,
  AlertJoin,
  AlertRule,
  SpotAlert,
  SpotAlertNotification,
  AlertConditions,
  SpotReview,
  SpotPhoto,
  SpotGuide,
  UserPin,
  SessionWave,
  TrailDifficulty,
  TrailPoint,
  Trail,
  RecordedHike,
  OfflineRegion,
  // V4 types (zones + social)
  SurfZone,
  StokeLevel,
  SurfProfile,
  Follow,
  SharedSession,
  SessionComment,
  SessionLike,
  Crew,
  CrewMember,
} from './types';

// -- Engine interfaces --
export type {
  SpotProfile,
  SwellInput,
  ForecastInput,
  RatingResult,
  GpsTrackPoint,
  DetectedWave,
  WaveDetectionOptions,
  TrailTrackPoint,
  TrailSummary,
  GpxTrackPoint,
} from './types';

// -- CRUD --
export {
  // Spots
  createSpot,
  getSpots,
  getSpotById,
  getSpotBySlug,
  updateSpotConditions,
  updateSpotProfile,
  toggleSpotFavorite,
  deleteSpot,
  countSpots,
  countFavoriteSpots,
  getAverageWaveHeightFt,
  // Sessions
  createSession,
  getSessions,
  deleteSession,
  countSessions,
  // Forecasts
  upsertForecast,
  upsertSwellComponents,
  getSpotForecast,
  // Tides
  upsertTide,
  getTides,
  // Buoy readings
  upsertBuoyReading,
  getLatestBuoyReading,
  getRecentBuoyReadings,
  // Narratives
  upsertNarrative,
  getSpotNarrative,
  getRegionNarrative,
  // User pins
  createUserPin,
  getUserPins,
  deleteUserPin,
  // Alerts
  createSpotAlert,
  getSpotAlerts,
  setSpotAlertActive,
  deleteSpotAlert,
  // Reviews
  createSpotReview,
  getSpotReviews,
  deleteSpotReview,
  // Photos
  createSpotPhoto,
  getSpotPhotos,
  deleteSpotPhoto,
  // Guides
  upsertSpotGuide,
  getSpotGuide,
  // Session waves
  recordSessionWave,
  getSessionWaves,
  // Trail hike summaries
  upsertTrailHikeSummary,
  getTrailHikeSummaries,
  // V4: Zones
  createZone,
  getZones,
  getZoneBySlug,
  updateZoneSpotCount,
  getSpotsByZone,
  // V4: Profiles
  createSurfProfile,
  getSurfProfile,
  updateSurfProfile,
  incrementProfileStats,
  // V4: Follows
  createFollow,
  deleteFollow,
  getFollowers,
  getFollowing,
  isFollowing,
  // V4: Shared sessions
  createSharedSession,
  getSharedSessionsByUser,
  getSharedSessionsBySpot,
  getFeedForUser,
  deleteSharedSession,
  // V4: Comments + likes
  createSessionComment,
  getSessionComments,
  deleteSessionComment,
  toggleSessionLike,
  getSessionLikes,
  // V4: Crews
  createCrew,
  getCrew,
  getUserCrews,
  addCrewMember,
  removeCrewMember,
  getCrewMembers,
  deleteCrew,
} from './db';

// -- Rating engines --
export {
  computeSpotRating,
  starsToColor,
  computeEnergy,
  classifyWind,
  windScore,
  scoreTide,
} from './rating';

// -- Quick glance scoring (V5) --
export { quickGlance } from './rating/quick-glance';
export type { QuickGlanceResult, GlanceVerdict } from './rating/quick-glance';

// -- Feed engine (V4 social) --
export {
  buildFeed,
  buildProfileTimeline,
} from './engine';

// -- Utilities --
export {
  angleDifference,
  degreesToCompass,
  computeDirectionFit,
  haversineDistance,
  feetToMeters,
  metersToFeet,
  detectWaves,
  evaluateAlertRule,
  evaluateAlertRules,
  computeTrackDistanceMeters,
  computeElevationGainLoss,
  computeDurationSeconds,
  computePaceMinutesPerKm,
  summarizeTrail,
  exportTrackToGpx,
  importTrackFromGpx,
} from './utils';

// -- Seed data + NOAA station mappings --
export {
  SEED_ZONES,
  CALIFORNIA_SPOTS,
  HAWAII_SPOTS,
  EAST_COAST_NORTH_SPOTS,
  EAST_COAST_SOUTH_SPOTS,
  PORTUGAL_SPOTS,
  ALL_SEED_SPOTS,
  ZONE_STATIONS,
  getStationsForZone,
  getClosestBuoy,
  getClosestTideStation,
} from './data';
export type { SeedZone, SeedSpot, BuoyStation, TideStation, ZoneStations } from './data';

// -- Cloud query adapters (Supabase) --
export {
  cloudGetSpotsByRegion,
  cloudGetSpotBySlug,
  cloudGetNearbySpots,
  cloudGetUserFavoriteSpots,
  cloudGetSpotGuide,
  cloudToggleFavorite,
  cloudGetSpotForecast,
  cloudGetTides,
  cloudGetLatestBuoyReading,
  cloudGetRecentBuoyReadings,
  cloudGetSpotNarrative,
  cloudGetRegionNarrative,
  cloudVoteOnNarrative,
  cloudCreateSpotAlert,
  cloudGetSpotAlerts,
  cloudSetSpotAlertActive,
  cloudDeleteSpotAlert,
  cloudGetSpotReviews,
  cloudGetSpotPhotos,
  cloudCreateSpotReview,
  cloudDeleteSpotReview,
  cloudCreateUserPin,
  cloudGetUserPins,
  cloudDeleteUserPin,
  cloudCreateSurfSession,
  cloudGetSurfSessions,
  cloudDeleteSurfSession,
  cloudSyncTrailHikeSummary,
  cloudGetTrailHikeSummaries,
  // V4: Social
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
} from './cloud';
export type { CreateCloudAlertInput } from './cloud';
