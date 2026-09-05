import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────

export const TrailDifficultySchema = z.enum(['easy', 'moderate', 'hard', 'expert']);
export type TrailDifficulty = z.infer<typeof TrailDifficultySchema>;

export const ActivityTypeSchema = z.enum(['hike', 'run', 'bike', 'walk']);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

// ── Core Entities ──────────────────────────────────────────────────────

export const TrailSchema = z.object({
  id: z.string(),
  name: z.string(),
  difficulty: TrailDifficultySchema,
  distanceMeters: z.number(),
  elevationGainMeters: z.number(),
  estimatedMinutes: z.number().int().nullable(),
  lat: z.number(),
  lng: z.number(),
  region: z.string().nullable(),
  description: z.string().nullable(),
  isSaved: z.boolean(),
  createdAt: z.string(),
});
export type Trail = z.infer<typeof TrailSchema>;

export const TrailRecordingSchema = z.object({
  id: z.string(),
  trailId: z.string().nullable(),
  name: z.string(),
  activityType: ActivityTypeSchema,
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  distanceMeters: z.number(),
  elevationGainMeters: z.number(),
  durationSeconds: z.number().int(),
  notes: z.string().nullable(),
  isPrivate: z.boolean(),
  activityRating: z.number().int().min(1).max(5).nullable(),
  gpxData: z.string().nullable(),
  createdAt: z.string(),
});
export type TrailRecording = z.infer<typeof TrailRecordingSchema>;

export const WaypointSchema = z.object({
  id: z.string(),
  recordingId: z.string(),
  lat: z.number(),
  lng: z.number(),
  elevation: z.number().nullable(),
  timestamp: z.string(),
  accuracy: z.number().nullable(),
  createdAt: z.string(),
});
export type Waypoint = z.infer<typeof WaypointSchema>;

export const TrailPhotoSchema = z.object({
  id: z.string(),
  recordingId: z.string().nullable(),
  trailId: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  uri: z.string(),
  caption: z.string().nullable(),
  takenAt: z.string(),
  createdAt: z.string(),
});
export type TrailPhoto = z.infer<typeof TrailPhotoSchema>;

// ── Aggregates ─────────────────────────────────────────────────────────

export const TrailStatsSchema = z.object({
  totalRecordings: z.number().int(),
  totalDistanceMeters: z.number(),
  totalElevationGainMeters: z.number(),
  totalDurationSeconds: z.number().int(),
  averagePaceMinPerKm: z.number().nullable(),
});
export type TrailStats = z.infer<typeof TrailStatsSchema>;

// ── Create Inputs ──────────────────────────────────────────────────────

export const CreateTrailInputSchema = z.object({
  name: z.string().min(1),
  difficulty: TrailDifficultySchema,
  distanceMeters: z.number().nonnegative(),
  elevationGainMeters: z.number().nonnegative(),
  estimatedMinutes: z.number().int().nullable().optional(),
  lat: z.number(),
  lng: z.number(),
  region: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});
export type CreateTrailInput = z.infer<typeof CreateTrailInputSchema>;

export const UpdateTrailInputSchema = z.object({
  name: z.string().min(1).optional(),
  difficulty: TrailDifficultySchema.optional(),
  distanceMeters: z.number().nonnegative().optional(),
  elevationGainMeters: z.number().nonnegative().optional(),
  estimatedMinutes: z.number().int().nullable().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  region: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  isSaved: z.boolean().optional(),
});
export type UpdateTrailInput = z.infer<typeof UpdateTrailInputSchema>;

export const CreateRecordingInputSchema = z.object({
  trailId: z.string().nullable().optional(),
  name: z.string().min(1),
  activityType: ActivityTypeSchema,
  startedAt: z.string(),
  endedAt: z.string().nullable().optional(),
  distanceMeters: z.number().nonnegative(),
  elevationGainMeters: z.number().nonnegative(),
  durationSeconds: z.number().int().nonnegative(),
  notes: z.string().nullable().optional(),
  isPrivate: z.boolean().optional(),
  activityRating: z.number().int().min(1).max(5).nullable().optional(),
  gpxData: z.string().nullable().optional(),
});
export type CreateRecordingInput = z.infer<typeof CreateRecordingInputSchema>;

export const UpdateRecordingInputSchema = z.object({
  trailId: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  activityType: ActivityTypeSchema.optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().nullable().optional(),
  distanceMeters: z.number().nonnegative().optional(),
  elevationGainMeters: z.number().nonnegative().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  notes: z.string().nullable().optional(),
  isPrivate: z.boolean().optional(),
  activityRating: z.number().int().min(1).max(5).nullable().optional(),
  gpxData: z.string().nullable().optional(),
});
export type UpdateRecordingInput = z.infer<typeof UpdateRecordingInputSchema>;

export const CreateWaypointInputSchema = z.object({
  recordingId: z.string(),
  lat: z.number(),
  lng: z.number(),
  elevation: z.number().nullable().optional(),
  timestamp: z.string(),
  accuracy: z.number().nullable().optional(),
});
export type CreateWaypointInput = z.infer<typeof CreateWaypointInputSchema>;

export const CreateTrailPhotoInputSchema = z.object({
  recordingId: z.string().nullable().optional(),
  trailId: z.string().nullable().optional(),
  lat: z.number(),
  lng: z.number(),
  uri: z.string().min(1),
  caption: z.string().nullable().optional(),
  takenAt: z.string(),
});
export type CreateTrailPhotoInput = z.infer<typeof CreateTrailPhotoInputSchema>;

// ── Offline Map Downloads ─────────────────────────────────────────────

export const OfflineRegionStatusSchema = z.enum([
  'pending',
  'downloading',
  'ready',
  'error',
  'stale',
]);
export type OfflineRegionStatus = z.infer<typeof OfflineRegionStatusSchema>;

export const OfflineRegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  regionKey: z.string(),
  minLat: z.number(),
  maxLat: z.number(),
  minLng: z.number(),
  maxLng: z.number(),
  minZoom: z.number().int(),
  maxZoom: z.number().int(),
  tileCount: z.number().int(),
  sizeBytes: z.number().int(),
  status: OfflineRegionStatusSchema,
  progress: z.number(),
  downloadedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OfflineRegion = z.infer<typeof OfflineRegionSchema>;

export const CreateOfflineRegionInputSchema = z.object({
  name: z.string().min(1),
  regionKey: z.string().min(1),
  minLat: z.number(),
  maxLat: z.number(),
  minLng: z.number(),
  maxLng: z.number(),
  minZoom: z.number().int().optional(),
  maxZoom: z.number().int().optional(),
});
export type CreateOfflineRegionInput = z.infer<typeof CreateOfflineRegionInputSchema>;

export const RegionCatalogEntrySchema = z.object({
  regionKey: z.string(),
  name: z.string(),
  area: z.string(),
  minLat: z.number(),
  maxLat: z.number(),
  minLng: z.number(),
  maxLng: z.number(),
  estimatedTiles: z.number().int(),
  estimatedSizeMb: z.number(),
});
export type RegionCatalogEntry = z.infer<typeof RegionCatalogEntrySchema>;

// ── Wrong-Turn Alerts ─────────────────────────────────────────────────

export const DeviationStateSchema = z.enum(['normal', 'deviated', 'returning', 'muted']);
export type DeviationState = z.infer<typeof DeviationStateSchema>;

export const AlertSettingsSchema = z.object({
  id: z.string(),
  deviationThresholdMeters: z.number(),
  alertCooldownSeconds: z.number().int(),
  vibrationEnabled: z.boolean(),
  soundEnabled: z.boolean(),
  autoPauseOnDeviation: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AlertSettings = z.infer<typeof AlertSettingsSchema>;

export const UpdateAlertSettingsInputSchema = z.object({
  deviationThresholdMeters: z.number().optional(),
  alertCooldownSeconds: z.number().int().optional(),
  vibrationEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  autoPauseOnDeviation: z.boolean().optional(),
});
export type UpdateAlertSettingsInput = z.infer<typeof UpdateAlertSettingsInputSchema>;

export const DeviationEventSchema = z.object({
  id: z.string(),
  recordingId: z.string(),
  trailId: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  deviationMeters: z.number(),
  nearestTrailLat: z.number(),
  nearestTrailLng: z.number(),
  acknowledged: z.boolean(),
  createdAt: z.string(),
});
export type DeviationEvent = z.infer<typeof DeviationEventSchema>;

export const CreateDeviationEventInputSchema = z.object({
  recordingId: z.string(),
  trailId: z.string().nullable().optional(),
  lat: z.number(),
  lng: z.number(),
  deviationMeters: z.number(),
  nearestTrailLat: z.number(),
  nearestTrailLng: z.number(),
});
export type CreateDeviationEventInput = z.infer<typeof CreateDeviationEventInputSchema>;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DeviationResult {
  distance: number;
  nearestPoint: GeoPoint;
}

// ── Weather ───────────────────────────────────────────────────────────

export const WeatherConditionSchema = z.object({
  code: z.number().int(),
  description: z.string(),
  icon: z.string(),
  temperature: z.number(),
  humidity: z.number(),
  windSpeed: z.number(),
  windDirection: z.number(),
  precipitationProbability: z.number(),
});
export type WeatherCondition = z.infer<typeof WeatherConditionSchema>;

export const HourlyWeatherSchema = z.object({
  hour: z.string(),
  temperature: z.number(),
  precipitationProbability: z.number(),
  weatherCode: z.number().int(),
  icon: z.string(),
});
export type HourlyWeather = z.infer<typeof HourlyWeatherSchema>;

export const WeatherForecastSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  current: WeatherConditionSchema,
  hourly: z.array(HourlyWeatherSchema),
  sunrise: z.string(),
  sunset: z.string(),
  fetchedAt: z.string(),
});
export type WeatherForecast = z.infer<typeof WeatherForecastSchema>;

export const WeatherCacheSchema = z.object({
  id: z.string(),
  lat: z.number(),
  lng: z.number(),
  conditionsJson: z.string(),
  fetchedAt: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type WeatherCache = z.infer<typeof WeatherCacheSchema>;

// ── Difficulty ────────────────────────────────────────────────────────

export const DifficultyFactorsSchema = z.object({
  distanceScore: z.number().int().min(0).max(3),
  elevationScore: z.number().int().min(0).max(3),
  gradeScore: z.number().int().min(0).max(3).nullable(),
  totalScore: z.number().int(),
  suggestedDifficulty: TrailDifficultySchema,
});
export type DifficultyFactors = z.infer<typeof DifficultyFactorsSchema>;

// ── Segments ──────────────────────────────────────────────────────────

export const SegmentSchema = z.object({
  id: z.string(),
  trailId: z.string(),
  name: z.string(),
  startLat: z.number(),
  startLng: z.number(),
  endLat: z.number(),
  endLng: z.number(),
  distanceMeters: z.number(),
  elevationGainMeters: z.number(),
  createdAt: z.string(),
});
export type Segment = z.infer<typeof SegmentSchema>;

export const SegmentEffortSchema = z.object({
  id: z.string(),
  segmentId: z.string(),
  recordingId: z.string(),
  durationSeconds: z.number().int(),
  paceMinPerKm: z.number().nullable(),
  startedAt: z.string(),
  endedAt: z.string(),
  isPersonalBest: z.boolean(),
  createdAt: z.string(),
});
export type SegmentEffort = z.infer<typeof SegmentEffortSchema>;

export const CreateSegmentInputSchema = z.object({
  trailId: z.string(),
  name: z.string().min(1),
  startLat: z.number(),
  startLng: z.number(),
  endLat: z.number(),
  endLng: z.number(),
  distanceMeters: z.number().nonnegative(),
  elevationGainMeters: z.number().nonnegative(),
});
export type CreateSegmentInput = z.infer<typeof CreateSegmentInputSchema>;

export const CreateSegmentEffortInputSchema = z.object({
  segmentId: z.string(),
  recordingId: z.string(),
  durationSeconds: z.number().int().nonnegative(),
  paceMinPerKm: z.number().nullable().optional(),
  startedAt: z.string(),
  endedAt: z.string(),
});
export type CreateSegmentEffortInput = z.infer<typeof CreateSegmentEffortInputSchema>;

// ── Navigation ────────────────────────────────────────────────────────

export const TurnTypeSchema = z.enum([
  'straight',
  'slight_left',
  'left',
  'sharp_left',
  'slight_right',
  'right',
  'sharp_right',
  'u_turn',
]);
export type TurnType = z.infer<typeof TurnTypeSchema>;

export const NavigationInstructionSchema = z.object({
  index: z.number().int(),
  turnType: TurnTypeSchema,
  distanceFromPrevious: z.number(),
  lat: z.number(),
  lng: z.number(),
  description: z.string(),
});
export type NavigationInstruction = z.infer<typeof NavigationInstructionSchema>;

// ── Packing ───────────────────────────────────────────────────────────

export const PackingTemplateTypeSchema = z.enum([
  'day_hike',
  'overnight',
  'backpacking',
  'winter',
  'trail_run',
  'custom',
]);
export type PackingTemplateType = z.infer<typeof PackingTemplateTypeSchema>;

export const PackingTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: PackingTemplateTypeSchema,
  isBuiltIn: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PackingTemplate = z.infer<typeof PackingTemplateSchema>;

export const PackingItemSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  name: z.string(),
  category: z.string(),
  isChecked: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});
export type PackingItem = z.infer<typeof PackingItemSchema>;

export const CreatePackingItemInputSchema = z.object({
  templateId: z.string(),
  name: z.string().min(1),
  category: z.string().min(1),
  sortOrder: z.number().int().optional(),
});
export type CreatePackingItemInput = z.infer<typeof CreatePackingItemInputSchema>;

export const UpdatePackingItemInputSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  isChecked: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdatePackingItemInput = z.infer<typeof UpdatePackingItemInputSchema>;

// ── Trips ─────────────────────────────────────────────────────────────

export const TripActivityTypeSchema = z.enum(['hike', 'drive', 'camp', 'rest', 'other']);
export type TripActivityType = z.infer<typeof TripActivityTypeSchema>;

export const TripSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  notes: z.string().nullable(),
  packingTemplateId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Trip = z.infer<typeof TripSchema>;

export const TripDaySchema = z.object({
  id: z.string(),
  tripId: z.string(),
  dayNumber: z.number().int(),
  date: z.string().nullable(),
  title: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type TripDay = z.infer<typeof TripDaySchema>;

export const TripActivitySchema = z.object({
  id: z.string(),
  dayId: z.string(),
  trailId: z.string().nullable(),
  type: TripActivityTypeSchema,
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
});
export type TripActivity = z.infer<typeof TripActivitySchema>;

export const CreateTripInputSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type CreateTripInput = z.infer<typeof CreateTripInputSchema>;

export const CreateTripDayInputSchema = z.object({
  tripId: z.string(),
  dayNumber: z.number().int(),
  date: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type CreateTripDayInput = z.infer<typeof CreateTripDayInputSchema>;

export const CreateTripActivityInputSchema = z.object({
  dayId: z.string(),
  trailId: z.string().nullable().optional(),
  type: TripActivityTypeSchema,
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateTripActivityInput = z.infer<typeof CreateTripActivityInputSchema>;

// ── Trail Database ────────────────────────────────────────────────────

export const TrailTypeSchema = z.enum(['hiking', 'cycling', 'running', 'multi_use']);
export type TrailType = z.infer<typeof TrailTypeSchema>;

export const TrailDatabaseEntrySchema = z.object({
  id: z.string(),
  osmId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  difficulty: TrailDifficultySchema.nullable(),
  distanceMeters: z.number().nullable(),
  elevationGainMeters: z.number().nullable(),
  lat: z.number(),
  lng: z.number(),
  region: z.string().nullable(),
  trailType: TrailTypeSchema,
  surface: z.string().nullable(),
  routeGeometry: z.string().nullable(),
  source: z.string(),
  fetchedAt: z.string(),
  createdAt: z.string(),
});
export type TrailDatabaseEntry = z.infer<typeof TrailDatabaseEntrySchema>;

// ── Route Planning ────────────────────────────────────────────────────

export const PlannedRouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  distanceMeters: z.number(),
  elevationGainMeters: z.number(),
  estimatedMinutes: z.number().int().nullable(),
  isLoop: z.boolean(),
  routeGeometry: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlannedRoute = z.infer<typeof PlannedRouteSchema>;

export const RouteWaypointSchema = z.object({
  id: z.string(),
  routeId: z.string(),
  lat: z.number(),
  lng: z.number(),
  sortOrder: z.number().int(),
  label: z.string().nullable(),
  createdAt: z.string(),
});
export type RouteWaypoint = z.infer<typeof RouteWaypointSchema>;

export const CreatePlannedRouteInputSchema = z.object({
  name: z.string().min(1),
  distanceMeters: z.number().nonnegative().optional(),
  elevationGainMeters: z.number().nonnegative().optional(),
  estimatedMinutes: z.number().int().nullable().optional(),
  isLoop: z.boolean().optional(),
  routeGeometry: z.string().nullable().optional(),
});
export type CreatePlannedRouteInput = z.infer<typeof CreatePlannedRouteInputSchema>;

export const CreateRouteWaypointInputSchema = z.object({
  routeId: z.string(),
  lat: z.number(),
  lng: z.number(),
  sortOrder: z.number().int(),
  label: z.string().nullable().optional(),
});
export type CreateRouteWaypointInput = z.infer<typeof CreateRouteWaypointInputSchema>;

// ── Reviews ───────────────────────────────────────────────────────────

export const TrailConditionSchema = z.enum([
  'clear',
  'muddy',
  'snowy',
  'icy',
  'buggy',
  'crowded',
  'overgrown',
  'well_maintained',
]);
export type TrailCondition = z.infer<typeof TrailConditionSchema>;

export const TrailReviewSchema = z.object({
  id: z.string(),
  trailId: z.string(),
  recordingId: z.string().nullable(),
  rating: z.number().int().min(1).max(5),
  title: z.string().nullable(),
  body: z.string().nullable(),
  photoUris: z.string().nullable(),
  conditions: z.string().nullable(),
  visitedAt: z.string().nullable(),
  isShared: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TrailReview = z.infer<typeof TrailReviewSchema>;

export const CreateReviewInputSchema = z.object({
  trailId: z.string(),
  recordingId: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  photoUris: z.string().nullable().optional(),
  conditions: z.string().nullable().optional(),
  visitedAt: z.string().nullable().optional(),
});
export type CreateReviewInput = z.infer<typeof CreateReviewInputSchema>;

export const ReviewSummarySchema = z.object({
  averageRating: z.number().nullable(),
  reviewCount: z.number().int(),
  recentConditions: z.array(z.string()),
});
export type ReviewSummary = z.infer<typeof ReviewSummarySchema>;
