import type { DatabaseAdapter } from '@mylife/db';
import type {
  DeviationEvent,
  PackingItem,
  UpdatePackingItemInput,
} from './types';
import * as trailsCrud from './db/crud';

// Definition
export { TRAILS_MODULE } from './definition';
export { crossModule as trailsCrossModule } from './cross-module';

// UI barrel: `./ui/index.ts` has web-safe tokens only; full RN component
// surface lives in `./ui/index.native.ts` which Metro picks on mobile.
export * from './ui';

// Types and schemas
export type {
  TrailDifficulty,
  ActivityType,
  Trail,
  TrailRecording,
  Waypoint,
  TrailPhoto,
  TrailStats,
  CreateTrailInput,
  UpdateTrailInput,
  CreateRecordingInput,
  UpdateRecordingInput,
  CreateWaypointInput,
  CreateTrailPhotoInput,
  // Offline map types
  OfflineRegionStatus,
  OfflineRegion,
  CreateOfflineRegionInput,
  RegionCatalogEntry,
  // Wrong-turn alert types
  DeviationState,
  AlertSettings,
  UpdateAlertSettingsInput,
  DeviationEvent,
  CreateDeviationEventInput,
  GeoPoint,
  DeviationResult,
  // Weather types
  WeatherCondition,
  HourlyWeather,
  WeatherForecast,
  WeatherCache,
  // Difficulty types
  DifficultyFactors,
  // Segment types
  Segment,
  SegmentEffort,
  CreateSegmentInput,
  CreateSegmentEffortInput,
  // Navigation types
  TurnType,
  NavigationInstruction,
  // Packing types
  PackingTemplateType,
  PackingTemplate,
  PackingItem,
  CreatePackingItemInput,
  UpdatePackingItemInput,
  // Trip types
  TripActivityType,
  Trip,
  TripDay,
  TripActivity,
  CreateTripInput,
  CreateTripDayInput,
  CreateTripActivityInput,
  // Trail database types
  TrailType,
  TrailDatabaseEntry,
  // Route planning types
  PlannedRoute,
  RouteWaypoint,
  CreatePlannedRouteInput,
  CreateRouteWaypointInput,
  // Review types
  TrailCondition,
  TrailReview,
  CreateReviewInput,
  ReviewSummary,
} from './types';

export {
  TrailDifficultySchema,
  ActivityTypeSchema,
  TrailSchema,
  TrailRecordingSchema,
  WaypointSchema,
  TrailPhotoSchema,
  TrailStatsSchema,
  CreateTrailInputSchema,
  UpdateTrailInputSchema,
  CreateRecordingInputSchema,
  UpdateRecordingInputSchema,
  CreateWaypointInputSchema,
  CreateTrailPhotoInputSchema,
  // Offline map schemas
  OfflineRegionStatusSchema,
  OfflineRegionSchema,
  CreateOfflineRegionInputSchema,
  RegionCatalogEntrySchema,
  // Wrong-turn alert schemas
  DeviationStateSchema,
  AlertSettingsSchema,
  UpdateAlertSettingsInputSchema,
  DeviationEventSchema,
  CreateDeviationEventInputSchema,
  // Weather schemas
  WeatherConditionSchema,
  HourlyWeatherSchema,
  WeatherForecastSchema,
  WeatherCacheSchema,
  // Difficulty schemas
  DifficultyFactorsSchema,
  // Segment schemas
  SegmentSchema,
  SegmentEffortSchema,
  CreateSegmentInputSchema,
  CreateSegmentEffortInputSchema,
  // Navigation schemas
  TurnTypeSchema,
  NavigationInstructionSchema,
  // Packing schemas
  PackingTemplateTypeSchema,
  PackingTemplateSchema,
  PackingItemSchema,
  CreatePackingItemInputSchema,
  UpdatePackingItemInputSchema,
  // Trip schemas
  TripActivityTypeSchema,
  TripSchema,
  TripDaySchema,
  TripActivitySchema,
  CreateTripInputSchema,
  CreateTripDayInputSchema,
  CreateTripActivityInputSchema,
  // Trail database schemas
  TrailTypeSchema,
  TrailDatabaseEntrySchema,
  // Route planning schemas
  PlannedRouteSchema,
  RouteWaypointSchema,
  CreatePlannedRouteInputSchema,
  CreateRouteWaypointInputSchema,
  // Review schemas
  TrailConditionSchema,
  TrailReviewSchema,
  CreateReviewInputSchema,
  ReviewSummarySchema,
} from './types';

// CRUD
export {
  createTrail,
  getTrail,
  getTrails,
  getNearbyTrails,
  updateTrail,
  deleteTrail,
  createRecording,
  getRecording,
  getRecordings,
  getRecordingsByTrail,
  updateRecording,
  deleteRecording,
  exportRecordingAsGPX,
  createWaypoint,
  getWaypointsByRecording,
  createPhoto,
  getTrailPhotos,
  getPhotos,
  getPhotosByRecording,
  getPhotosByTrail,
  getPhotosByDateRange,
  getTrailStats,
  // Offline regions
  createOfflineRegion,
  getOfflineRegion,
  getOfflineRegions,
  getReadyRegions,
  getStaleRegions,
  updateRegionProgress,
  markRegionReady,
  markRegionError,
  resetRegionToPending,
  deleteOfflineRegion,
  // Alert settings
  getAlertSettings,
  createAlertSettings,
  updateAlertSettings,
  // Deviation events
  createDeviationEvent,
  getDeviationsByRecording,
  acknowledgeDeviation,
  // Weather cache
  cacheWeather,
  getCachedWeather,
  cleanExpiredCache,
  // Segments
  createSegment,
  getSegmentsByTrail,
  createSegmentEffort,
  getEffortsBySegment,
  getSegmentEffortsByRecording,
  getPersonalBest,
  recalculatePersonalBest,
  // Packing
  createPackingTemplate,
  getPackingTemplates,
  getPackingTemplate,
  createPackingItem,
  getPackingItems,
  checkItem,
  uncheckItem,
  uncheckAll,
  deletePackingTemplate,
  deletePackingItem,
  getPackingProgress,
  // Trips
  createTrip,
  getTrip,
  getTrips,
  updateTrip,
  deleteTrip,
  createTripDay,
  getTripDays,
  updateTripDay,
  deleteTripDay,
  createTripActivity,
  getTripActivities,
  updateTripActivity,
  deleteTripActivity,
  reorderActivities,
  // Trail database
  upsertDatabaseEntry,
  getDatabaseEntries,
  searchDatabaseTrails,
  getDatabaseEntry,
  saveDatabaseTrailToMyTrails,
  // Planned routes
  createPlannedRoute,
  getPlannedRoute,
  getPlannedRoutes,
  deletePlannedRoute,
  createRouteWaypoint,
  getRouteWaypoints,
  deleteRouteWaypoint,
  // Reviews
  createReview,
  getReviewsByTrail,
  updateReview,
  deleteReview,
  getAverageRating,
  getReviewCount,
  getRecentConditions,
  getRatingDistribution,
  getSetting,
  setSetting,
} from './db/crud';

export function getDeviationEvents(
  db: DatabaseAdapter,
  limit = 20,
): DeviationEvent[] {
  return (
    trailsCrud as typeof trailsCrud & {
      getDeviationEvents: (
        db: DatabaseAdapter,
        limit?: number,
      ) => DeviationEvent[];
    }
  ).getDeviationEvents(db, limit);
}

export function updatePackingItem(
  db: DatabaseAdapter,
  id: string,
  input: UpdatePackingItemInput,
): PackingItem | null {
  return (
    trailsCrud as typeof trailsCrud & {
      updatePackingItem: (
        db: DatabaseAdapter,
        id: string,
        input: UpdatePackingItemInput,
      ) => PackingItem | null;
    }
  ).updatePackingItem(db, id, input);
}

// Cross-module place readers (Phase 1c Wave A read-side)
export {
  getTrailByHubPlaceId,
  getTrailsNearGeohash,
} from './db/places';

// Discovery selectors
export {
  searchTrailDatabase,
  getFeaturedRegions,
  getTrendingTrails,
  getCollections,
  getRecommendedTrails,
} from './discovery';
export type {
  TrailFeaturedRegion,
  TrailDiscoveryCollection,
  TrailRecommendation,
} from './discovery';

// Geo engine
export {
  haversineDistance,
  calculateElevationGain,
  calculatePace,
  formatDuration,
  estimateCalories,
} from './engine/geo';

// Offline map engines
export {
  REGION_CATALOG,
  getCatalogByArea,
  getCatalogEntry,
} from './offline/region-catalog';

export {
  tilesAtZoom,
  estimateRegionTileCount,
  estimateRegionSizeBytes,
  tilePathForCoordinate,
  exceedsTileLimit,
} from './offline/tile-manager';

export {
  totalStorageBytes,
  summarizeStorageUsage,
  formatBytes,
  isLowStorage,
  regionTileDir,
} from './offline/storage';

// Deviation detection engine
export {
  deviationDistance,
  effectiveThreshold,
  DeviationStateMachine,
} from './engine/deviation-detector';

// Route geofence engine
export {
  buildRouteGeofence,
  SpatialRouteIndex,
} from './engine/route-geofence';

// Difficulty calculator engine
export {
  calculateDifficultyScore,
  calculateDifficulty,
  difficultyColor,
} from './engine/difficulty-calculator';

// Navigation engine
export {
  calculateBearing,
  angleBetweenBearings,
  classifyTurn,
  buildRoute,
  calculateRouteStats,
  generateInstructions,
} from './engine/navigation-engine';
export type {
  RouteBuildMode,
  RouteStats,
  RouteTravelMode,
} from './engine/navigation-engine';

// Weather formatter
export {
  weatherDescription,
  weatherIcon,
  formatTemperature,
  formatWindSpeed,
  roundCoordinates,
  isWeatherCacheValid,
  temperatureAtElevation,
  formatRelativeTime,
} from './weather/weather-formatter';

// Packing defaults
export { DEFAULT_TEMPLATES } from './packing/default-templates';

// Segment matcher
export {
  isWithinRadius,
  matchSegmentEntry,
  matchSegmentExit,
} from './engine/segment-matcher';
