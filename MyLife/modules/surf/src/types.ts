import { z } from 'zod';

// ---------------------------------------------------------------------------
// Spot Types
// ---------------------------------------------------------------------------

export const SurfBreakTypeSchema = z.enum([
  'beach',
  'point',
  'reef',
  'river-mouth',
  'other',
]);
export type SurfBreakType = z.infer<typeof SurfBreakTypeSchema>;

export const SurfTideSchema = z.enum(['low', 'mid', 'high', 'all']);
export type SurfTide = z.infer<typeof SurfTideSchema>;

export const SkillLevelSchema = z.enum([
  'beginner',
  'intermediate',
  'advanced',
  'all',
]);
export type SkillLevel = z.infer<typeof SkillLevelSchema>;

export const HazardSchema = z.enum([
  'rocks',
  'rip_currents',
  'sharks',
  'localism',
  'shallow_reef',
  'strong_currents',
  'shore_break',
  'jellyfish',
  'pollution',
]);
export type Hazard = z.infer<typeof HazardSchema>;

export const RegionSchema = z.enum([
  'humboldt',
  'mendocino',
  'san_francisco',
  'santa_cruz',
  'monterey',
  'san_luis_obispo',
  'santa_barbara',
  'ventura',
  'la_north',
  'la_south_bay',
  'orange_county',
  'san_diego_north',
  'san_diego_south',
]);
export type Region = z.infer<typeof RegionSchema>;

export const SurfSpotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  region: z.string().min(1),
  breakType: SurfBreakTypeSchema,
  waveHeightFt: z.number().nonnegative(),
  windKts: z.number().nonnegative(),
  tide: SurfTideSchema,
  swellDirection: z.string().min(1),
  isFavorite: z.boolean(),
  lastUpdated: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // V2 enrichment fields (optional for backward compat)
  slug: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  orientationDeg: z.number().min(0).max(360).optional(),
  skillLevel: SkillLevelSchema.optional(),
  hazards: z.array(HazardSchema).optional(),
  idealSwellDirMin: z.number().min(0).max(360).optional(),
  idealSwellDirMax: z.number().min(0).max(360).optional(),
  idealTideLow: z.number().optional(),
  idealTideHigh: z.number().optional(),
  description: z.string().optional(),
  crowdFactor: z.number().min(1).max(5).optional(),
});
export type SurfSpot = z.infer<typeof SurfSpotSchema>;

export const CreateSpotInputSchema = z.object({
  name: z.string().min(1),
  region: z.string().min(1),
  breakType: SurfBreakTypeSchema,
  waveHeightFt: z.number().nonnegative().optional(),
  windKts: z.number().nonnegative().optional(),
  tide: SurfTideSchema.optional(),
  swellDirection: z.string().optional(),
  isFavorite: z.boolean().optional(),
  slug: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  orientationDeg: z.number().min(0).max(360).optional(),
  skillLevel: SkillLevelSchema.optional(),
  hazards: z.array(HazardSchema).optional(),
  idealSwellDirMin: z.number().min(0).max(360).optional(),
  idealSwellDirMax: z.number().min(0).max(360).optional(),
  idealTideLow: z.number().optional(),
  idealTideHigh: z.number().optional(),
  description: z.string().optional(),
  crowdFactor: z.number().min(1).max(5).optional(),
});
export type CreateSpotInput = z.input<typeof CreateSpotInputSchema>;

// ---------------------------------------------------------------------------
// Session Types
// ---------------------------------------------------------------------------

export const SurfSessionSchema = z.object({
  id: z.string().min(1),
  spotId: z.string().min(1),
  sessionDate: z.string(),
  durationMin: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type SurfSession = z.infer<typeof SurfSessionSchema>;

// ---------------------------------------------------------------------------
// Forecast Types
// ---------------------------------------------------------------------------

export const ConditionColorSchema = z.enum([
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
]);
export type ConditionColor = z.infer<typeof ConditionColorSchema>;

export const WindLabelSchema = z.enum([
  'offshore',
  'cross-offshore',
  'cross-shore',
  'cross-onshore',
  'onshore',
  'light',
]);
export type WindLabel = z.infer<typeof WindLabelSchema>;

export const SwellComponentSchema = z.object({
  heightFt: z.number().min(0),
  periodSeconds: z.number().min(0),
  directionDegrees: z.number().min(0).max(360),
  directionLabel: z.string(),
  componentOrder: z.number().min(1).max(3),
});
export type SwellComponent = z.infer<typeof SwellComponentSchema>;

export const ForecastSchema = z.object({
  id: z.string().min(1),
  spotId: z.string().min(1),
  forecastTime: z.string(),
  waveHeightMinFt: z.number().min(0),
  waveHeightMaxFt: z.number().min(0),
  waveHeightLabel: z.string().optional(),
  rating: z.number().min(1).max(5),
  conditionColor: ConditionColorSchema,
  swellComponents: z.array(SwellComponentSchema),
  windSpeedKts: z.number().min(0),
  windGustKts: z.number().min(0),
  windDirectionDegrees: z.number().min(0).max(360),
  windLabel: WindLabelSchema,
  energyKj: z.number().min(0),
  consistencyScore: z.number().min(0).max(100),
  waterTempF: z.number().optional(),
  airTempF: z.number().optional(),
  modelRun: z.string(),
  modelName: z.string().optional(),
});
export type Forecast = z.infer<typeof ForecastSchema>;

export const TidePointSchema = z.object({
  timestamp: z.string(),
  heightFt: z.number(),
  type: z.enum(['high', 'low', 'intermediate']),
});
export type TidePoint = z.infer<typeof TidePointSchema>;

export const NarrativeSchema = z.object({
  id: z.string().min(1),
  spotId: z.string().optional(),
  region: z.string().optional(),
  forecastDate: z.string(),
  summary: z.string(),
  body: z.string(),
  generatedAt: z.string(),
  helpfulVotes: z.number().default(0),
  unhelpfulVotes: z.number().default(0),
});
export type Narrative = z.infer<typeof NarrativeSchema>;

export const BuoyReadingSchema = z.object({
  buoyId: z.string(),
  buoyName: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  timestamp: z.string(),
  waveHeightFt: z.number().optional(),
  dominantPeriodSeconds: z.number().optional(),
  averagePeriodSeconds: z.number().optional(),
  waveDirectionDegrees: z.number().optional(),
  waterTempF: z.number().optional(),
  airTempF: z.number().optional(),
  windSpeedKts: z.number().optional(),
  windDirectionDegrees: z.number().optional(),
});
export type BuoyReading = z.infer<typeof BuoyReadingSchema>;

export const SunTimesSchema = z.object({
  firstLight: z.string(),
  sunrise: z.string(),
  sunset: z.string(),
  lastLight: z.string(),
});
export type SunTimes = z.infer<typeof SunTimesSchema>;

// ---------------------------------------------------------------------------
// Alert Types
// ---------------------------------------------------------------------------

export const AlertParameterSchema = z.enum([
  'swell_height_ft',
  'wind_speed_kts',
  'wind_speed_mph',
  'rating',
  'consistency',
  'energy_kj',
  'water_temp_f',
]);
export type AlertParameter = z.infer<typeof AlertParameterSchema>;

export const AlertOperatorSchema = z.enum(['gt', 'gte', 'lt', 'lte', 'eq']);
export type AlertOperator = z.infer<typeof AlertOperatorSchema>;

export const AlertJoinSchema = z.enum(['and', 'or']);
export type AlertJoin = z.infer<typeof AlertJoinSchema>;

export const AlertRuleSchema = z.object({
  id: z.string().optional(),
  alertId: z.string().optional(),
  parameter: AlertParameterSchema,
  operator: AlertOperatorSchema,
  value: z.number(),
  joinWith: AlertJoinSchema.default('and'),
  sortOrder: z.number().int().nonnegative().default(0),
});
export type AlertRule = z.infer<typeof AlertRuleSchema>;

export const SpotAlertSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  spotId: z.string().min(1),
  name: z.string().min(1),
  isActive: z.boolean().default(true),
  cooldownMinutes: z.number().int().min(1).max(1440).default(30),
  lastTriggeredAt: z.string().optional(),
  rules: z.array(AlertRuleSchema).min(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type SpotAlert = z.infer<typeof SpotAlertSchema>;

export const SpotAlertNotificationSchema = z.object({
  id: z.string().min(1),
  alertId: z.string().min(1),
  userId: z.string().min(1),
  spotId: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  deliveredAt: z.string().optional(),
  createdAt: z.string().optional(),
});
export type SpotAlertNotification = z.infer<typeof SpotAlertNotificationSchema>;

export type AlertConditions = Partial<Record<AlertParameter, number>>;

// ---------------------------------------------------------------------------
// Community Types
// ---------------------------------------------------------------------------

export const SpotReviewSchema = z.object({
  id: z.string().min(1),
  spotId: z.string().min(1),
  userId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(120).optional(),
  body: z.string().min(1).max(4000),
  photoCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type SpotReview = z.infer<typeof SpotReviewSchema>;

export const SpotPhotoSchema = z.object({
  id: z.string().min(1),
  spotId: z.string().min(1),
  reviewId: z.string().optional(),
  userId: z.string().min(1),
  imageUrl: z.string().url(),
  caption: z.string().max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  takenAt: z.string().optional(),
  createdAt: z.string().optional(),
});
export type SpotPhoto = z.infer<typeof SpotPhotoSchema>;

export const SpotGuideSchema = z.object({
  spotId: z.string().min(1),
  bestTideWindow: z.string().min(1),
  bestSwellDirection: z.string().min(1),
  hazards: z.array(z.string()).default([]),
  parkingNotes: z.string().min(1),
  crowdNotes: z.string().min(1),
  localTips: z.string().min(1),
  updatedAt: z.string().optional(),
});
export type SpotGuide = z.infer<typeof SpotGuideSchema>;

// ---------------------------------------------------------------------------
// User Types (cloud-enriched profile + pins)
// ---------------------------------------------------------------------------

export const UserPinSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  name: z.string().min(1),
  notes: z.string().optional(),
  isPublic: z.boolean().default(false),
  createdAt: z.string().optional(),
});
export type UserPin = z.infer<typeof UserPinSchema>;

export const SessionWaveSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  waveNumber: z.number().int().positive(),
  durationSeconds: z.number().nonnegative(),
  maxSpeedKts: z.number().nonnegative(),
  distanceMeters: z.number().nonnegative(),
  direction: z.number().min(0).max(360).optional(),
  detectedAt: z.string(),
});
export type SessionWave = z.infer<typeof SessionWaveSchema>;

// ---------------------------------------------------------------------------
// Trail Types
// ---------------------------------------------------------------------------

export const TrailDifficultySchema = z.enum([
  'easy',
  'moderate',
  'hard',
  'expert',
]);
export type TrailDifficulty = z.infer<typeof TrailDifficultySchema>;

export const TrailPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  elevationMeters: z.number().optional(),
  timestamp: z.string().optional(),
});
export type TrailPoint = z.infer<typeof TrailPointSchema>;

export const TrailSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  region: z.string().min(1),
  difficulty: TrailDifficultySchema,
  distanceMeters: z.number().nonnegative(),
  elevationGainMeters: z.number().nonnegative(),
  estimatedDurationMinutes: z.number().nonnegative(),
  points: z.array(TrailPointSchema).default([]),
  source: z.string().default('osm'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Trail = z.infer<typeof TrailSchema>;

export const RecordedHikeSchema = z.object({
  id: z.string().min(1),
  localId: z.string().min(1),
  userId: z.string().optional(),
  trailId: z.string().optional(),
  name: z.string().min(1),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  durationSeconds: z.number().nonnegative().default(0),
  distanceMeters: z.number().nonnegative().default(0),
  elevationGainMeters: z.number().nonnegative().default(0),
  elevationLossMeters: z.number().nonnegative().default(0),
  paceMinutesPerKm: z.number().nonnegative().optional(),
  gpx: z.string().optional(),
  syncedAt: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type RecordedHike = z.infer<typeof RecordedHikeSchema>;

export const OfflineRegionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  minLat: z.number().min(-90).max(90),
  minLng: z.number().min(-180).max(180),
  maxLat: z.number().min(-90).max(90),
  maxLng: z.number().min(-180).max(180),
  minZoom: z.number().int().min(0).max(24),
  maxZoom: z.number().int().min(0).max(24),
  tileCount: z.number().int().nonnegative().default(0),
  sizeBytes: z.number().nonnegative().default(0),
  downloadedAt: z.string().optional(),
});
export type OfflineRegion = z.infer<typeof OfflineRegionSchema>;

// ---------------------------------------------------------------------------
// Rating Engine Types
// ---------------------------------------------------------------------------

export interface SpotProfile {
  orientationDegrees: number;
  spotType: SurfBreakType;
  idealSwellDirMin: number;
  idealSwellDirMax: number;
  idealTideLow: number;
  idealTideHigh: number;
}

export interface SwellInput {
  heightFt: number;
  periodSeconds: number;
  directionDegrees: number;
}

export interface ForecastInput {
  swellComponents: SwellInput[];
  windSpeedKts: number;
  windDirectionDegrees: number;
  tideHeightFt: number;
  consistency: number;
}

export interface RatingResult {
  stars: number;
  color: ConditionColor;
  swellScore: number;
  windScore: number;
  tideScore: number;
  consistencyScore: number;
}

// ---------------------------------------------------------------------------
// Wave Detection Types
// ---------------------------------------------------------------------------

export interface GpsTrackPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  speedMps?: number | null;
  headingDegrees?: number | null;
}

export interface DetectedWave {
  startTime: string;
  endTime: string;
  durationSeconds: number;
  maxSpeedKts: number;
  distanceMeters: number;
  startIndex: number;
  endIndex: number;
}

export interface WaveDetectionOptions {
  minSpeedKts?: number;
  minDurationSeconds?: number;
  minDirectionChangeDegrees?: number;
}

// ---------------------------------------------------------------------------
// Trail Analytics Types
// ---------------------------------------------------------------------------

export interface TrailTrackPoint {
  latitude: number;
  longitude: number;
  elevationMeters?: number | null;
  timestamp: string;
}

export interface TrailSummary {
  distanceMeters: number;
  durationSeconds: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  paceMinutesPerKm: number;
}

// ---------------------------------------------------------------------------
// GPX Types
// ---------------------------------------------------------------------------

export interface GpxTrackPoint {
  latitude: number;
  longitude: number;
  elevationMeters?: number | null;
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// V4: Zone Types (Multi-Region Expansion)
// ---------------------------------------------------------------------------

export const SurfZoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  country: z.string().min(1).default('US'),
  sortOrder: z.number().int().nonnegative().default(0),
  boundingBox: z
    .object({
      minLat: z.number(),
      maxLat: z.number(),
      minLng: z.number(),
      maxLng: z.number(),
    })
    .optional(),
  timezone: z.string().default('America/Los_Angeles'),
  isActive: z.boolean().default(true),
  spotCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type SurfZone = z.infer<typeof SurfZoneSchema>;

// ---------------------------------------------------------------------------
// V4: Surf Social Types
// ---------------------------------------------------------------------------

export const StokeLevelSchema = z.enum(['1', '2', '3', '4', '5']);
export type StokeLevel = z.infer<typeof StokeLevelSchema>;

export const SurfProfileSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().min(1),
  avatarUrl: z.string().optional(),
  bio: z.string().optional(),
  homeSpotId: z.string().optional(),
  skillLevel: SkillLevelSchema.default('intermediate'),
  boardQuiver: z.array(z.string()).default([]),
  sessionCount: z.number().int().nonnegative().default(0),
  totalWaves: z.number().int().nonnegative().default(0),
  totalHours: z.number().nonnegative().default(0),
  isPublic: z.boolean().default(false),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type SurfProfile = z.infer<typeof SurfProfileSchema>;

export const FollowSchema = z.object({
  id: z.string().min(1),
  followerId: z.string().min(1),
  followingId: z.string().min(1),
  createdAt: z.string().optional(),
});
export type Follow = z.infer<typeof FollowSchema>;

export const SharedSessionSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  spotId: z.string().min(1),
  caption: z.string().optional(),
  waveCount: z.number().int().nonnegative().optional(),
  bestWaveDurationS: z.number().nonnegative().optional(),
  conditionsSummary: z.string().optional(),
  photoUrls: z.array(z.string()).default([]),
  stokeLevel: z.number().int().min(1).max(5).default(3),
  isPublic: z.boolean().default(false),
  likesCount: z.number().int().nonnegative().default(0),
  commentsCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().optional(),
});
export type SharedSession = z.infer<typeof SharedSessionSchema>;

export const SessionCommentSchema = z.object({
  id: z.string().min(1),
  sharedSessionId: z.string().min(1),
  userId: z.string().min(1),
  body: z.string().min(1).max(1000),
  createdAt: z.string().optional(),
});
export type SessionComment = z.infer<typeof SessionCommentSchema>;

export const SessionLikeSchema = z.object({
  id: z.string().min(1),
  sharedSessionId: z.string().min(1),
  userId: z.string().min(1),
  createdAt: z.string().optional(),
});
export type SessionLike = z.infer<typeof SessionLikeSchema>;

export const CrewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  creatorId: z.string().min(1),
  description: z.string().optional(),
  homeSpotId: z.string().optional(),
  memberCount: z.number().int().positive().default(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Crew = z.infer<typeof CrewSchema>;

export const CrewMemberSchema = z.object({
  id: z.string().min(1),
  crewId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(['creator', 'admin', 'member']).default('member'),
  joinedAt: z.string().optional(),
});
export type CrewMember = z.infer<typeof CrewMemberSchema>;
