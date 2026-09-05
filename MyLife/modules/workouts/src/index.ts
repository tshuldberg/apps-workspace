export { WORKOUTS_MODULE } from './definition';

// Cross-module interface
export { workoutsCrossModule } from './cross-module';

// ── Types (re-exported for consumers) ──
export type {
  WorkoutFocus,
  WorkoutCategory,
  MuscleGroup,
  WorkoutDifficulty,
  WorkoutAudioCue,
  WorkoutExerciseLibraryItem,
  WorkoutExerciseEntry,
  WorkoutDefinition,
  WorkoutSession,
  WorkoutFormRecording,
  WorkoutExerciseFilters,
  WorkoutMetrics,
  WorkoutDashboard,
  WorkoutSeedItem,
  WorkoutLog,
  WorkoutProgram,
  WorkoutCategoryCount,
  CompletedExercise,
  // Engine types
  PlayerState,
  PlayerStatus,
  PlayerAction,
  WorkoutExerciseInput,
  EngineCompletedExercise,
  SetType,
  WeightUnit,
  // Calculator types
  OneRMFormula,
  WarmupSet,
  PlateResult,
  // Body map types
  MuscleGroupDefinition,
  MuscleGroupRegion,
  MuscleGroupSide,
  BodyHighlightDatum,
  ExerciseMuscleMapping,
  // Voice types
  VoiceCommandCategory,
  VoiceCommand,
  // Progress types
  StreakInfo,
  VolumeStats,
  PersonalRecord,
  PeriodSummary,
  WorkoutHistoryEntry,
  WeightPR,
  ProgressSession,
  ProgressExercise,
  // Plan types
  WorkoutPlan,
  WorkoutPlanDay,
  WorkoutPlanWeek,
  // DB input/row types
  SetWeightInput,
  SetWeightRow,
  Record1RMInput,
  Exercise1RMRow,
  BodyMeasurementInput,
  BodyMeasurementRow,
  WorkoutPlanInput,
  PlanSubscriptionRow,
  // Previous performance
  PreviousSetData,
  PreviousPerformanceMap,
  // Overload types
  OverloadRule,
  ExercisePerformanceHistory,
  SessionSetData,
  SetData,
  // Generation types
  GenerationHistoryEntry,
  // GPS types
  GpsActivityType,
  GpsRoute,
  GpsPointInput,
  GpsPoint,
  // Plate inventory types
  PlateInventory,
  PlateInventoryInput,
  // Progress photo types
  ProgressPhoto,
  ProgressPhotoInput,
  PhotoViewType,
  // Sharing types
  WorkoutSummaryCard,
  // Demo types
  DemoAsset,
  DemoStatus,
  // Trainer video types
  ExerciseVideo,
  ExerciseVideoInput,
  Trainer,
  VideoAngle,
  StorageType,
  // Social types
  SocialPrivacySettings,
  SocialPost,
  SocialPostEnriched,
  SocialComment,
  SocialUserProfile,
} from './types';

// ── Schemas ──
export {
  WorkoutFocusSchema,
  WorkoutCategorySchema,
  MuscleGroupSchema,
  WorkoutDifficultySchema,
  WorkoutExerciseLibraryItemSchema,
  WorkoutExerciseEntrySchema,
  WorkoutDefinitionSchema,
  WorkoutSessionSchema,
  WorkoutFormRecordingSchema,
  WorkoutLogSchema,
  WorkoutProgramSchema,
  PlayerStateSchema,
  SetTypeSchema,
  WeightUnitSchema,
  OneRMFormulaSchema,
  WarmupSetSchema,
  PlateResultSchema,
  MuscleGroupRegionSchema,
  MuscleGroupSideSchema,
  VoiceCommandCategorySchema,
  SetWeightInputSchema,
  Record1RMInputSchema,
  BodyMeasurementInputSchema,
  WorkoutPlanInputSchema,
  WORKOUT_CATEGORIES,
  MUSCLE_GROUPS,
  WORKOUT_DIFFICULTIES,
  MUSCLE_GROUP_LABELS,
  REST_TIME_PRESETS,
  PlateInventorySchema,
  PlateInventoryInputSchema,
  ProgressPhotoSchema,
  ProgressPhotoInputSchema,
  PhotoViewTypeSchema,
  PHOTO_VIEW_TYPES,
  BAR_PRESETS,
  PLATE_COLORS,
  DEFAULT_SOCIAL_PRIVACY,
  VideoAngleSchema,
  ExerciseVideoInputSchema,
  VIDEO_ANGLES,
  VIDEO_ANGLE_LABELS,
} from './types';

// ── DB CRUD ──
export {
  // Exercise library
  seedWorkoutExerciseLibrary,
  getWorkoutExercises,
  getWorkoutExerciseById,
  getWorkoutExerciseCount,
  getWorkoutCategoryCounts,
  // Workout CRUD
  createWorkout,
  updateWorkout,
  deleteWorkout,
  getWorkouts,
  getWorkoutById,
  // Session lifecycle
  createWorkoutSession,
  completeWorkoutSession,
  annotateWorkoutSession,
  getWorkoutSessions,
  deleteWorkoutSession,
  // Form recordings
  createWorkoutFormRecording,
  getWorkoutFormRecordings,
  deleteWorkoutFormRecording,
  // Dashboard + metrics
  getWorkoutDashboard,
  getWorkoutMetrics,
  // Set weight tracking
  recordSetWeight,
  getSetWeightsForSession,
  getSetWeightsForExercise,
  // Previous performance
  getPreviousPerformance,
  // 1RM history
  record1RM,
  get1RMHistory,
  getLatest1RM,
  // Body measurements
  createBodyMeasurement,
  getBodyMeasurements,
  deleteBodyMeasurement,
  // Workout plans
  createWorkoutPlan,
  getWorkoutPlans,
  getWorkoutPlanById,
  updateWorkoutPlan,
  deleteWorkoutPlan,
  // Plan subscriptions
  subscribeToPlan,
  unsubscribeFromPlan,
  getActivePlanSubscription,
  // Overload rules
  createOverloadRule,
  getOverloadRules,
  getOverloadRuleForExercise,
  updateOverloadRule,
  deleteOverloadRule,
  getExercisePerformanceHistory,
  // Generation history
  createGenerationEntry,
  markGenerationAccepted,
  getGenerationHistory,
  // GPS routes
  createGpsRoute,
  completeGpsRoute,
  getGpsRoutes,
  getGpsRouteById,
  deleteGpsRoute,
  // GPS points
  insertGpsPoints,
  getGpsPoints,
  // Plate inventories
  createPlateInventory,
  getPlateInventories,
  getPlateInventoryById,
  updatePlateInventory,
  deletePlateInventory,
  // Progress photos
  createProgressPhoto,
  getProgressPhotos,
  getProgressPhotoById,
  deleteProgressPhoto,
  getProgressPhotoCount,
  // Trainers
  createTrainer,
  getActiveTrainer,
  getTrainerById,
  deactivateTrainer,
  // Exercise videos
  createExerciseVideo,
  getExerciseVideos,
  getExerciseVideoById,
  getPrimaryVideo,
  setPrimaryVideo,
  updateVideoOrder,
  deleteExerciseVideo,
  getExerciseVideoCount,
  // Legacy
  createWorkoutLog,
  getWorkoutLogs,
  deleteWorkoutLog,
  createWorkoutProgram,
  getWorkoutPrograms,
  setActiveWorkoutProgram,
  deleteWorkoutProgram,
} from './db';

// ── Workout Engine ──
export {
  createPlayerStatus,
  createStartedPlayerStatus,
  reducePlayer,
  playerProgress,
  formatTime,
  buildGroupNavigation,
  SPEED_OPTIONS,
  calculateEpley1RM,
  calculateBrzycki1RM,
  calculate1RM,
  calculateWarmupSets,
  calculatePlates,
  STANDARD_PLATES_LBS,
  STANDARD_PLATES_KG,
  type InventoryPlate,
  DAY_NAMES,
  getWeekSchedule,
  getCurrentPlanPosition,
  getTodaysWorkout,
  getAllPlanWorkoutIds,
  getPlanProgress,
  getCurrentWeekDay,
  createEmptyWeek,
} from './workout';

// ── Body Map ──
export {
  BODY_MAP_MUSCLE_GROUPS,
  SLUG_TO_MUSCLE_GROUP,
  MUSCLE_GROUP_TO_SLUGS,
  slugToMuscleGroup,
  muscleGroupToSlugs,
  muscleGroupLabel,
  buildHighlightData,
  EXERCISE_MUSCLE_MAPPINGS,
  getExercisesForMuscleGroup,
  getMuscleGroupsByRegion,
} from './body-map';

// ── Voice ──
export { parseVoiceCommand, getSupportedCommands } from './voice';
export {
  parsePlayerCommand,
  stepRate,
  getSupportedPlayerCommands,
  PLAYER_RATE_LADDER,
} from './voice/player-commands';
export type { PlayerVoiceAction, PlayerVoiceMatch } from './voice/player-commands';

// ── Progress ──
export {
  calculateStreaks,
  calculateVolume,
  calculatePersonalRecords,
  getWeeklySummaries,
  buildHistory,
  calculateWeightPRs,
} from './progress';

// ── Recovery ──
export {
  calculateMuscleRecovery,
  buildRecoveryMap,
  getBestToTrain,
} from './recovery/engine';

export type {
  RecoveryScore,
  RecoveryMap,
  TrainingSuggestion,
  SessionMuscleData,
  MuscleVolumeEntry,
} from './recovery/types';

// ── Overload Engine ──
export {
  evaluateTrigger,
  calculateSuggestion,
  getEffectiveRule,
  generateOverloadSuggestion,
} from './overload/engine';

export type {
  OverloadRuleType,
  OverloadTrigger,
  OverloadSuggestion,
} from './overload/types';

export { DEFAULT_OVERLOAD_RULE, OVERLOAD_PRESETS } from './overload/types';

// ── AI Generation ──
export { generateLocalWorkout } from './ai/generator';
export type { GenerationGoal, EquipmentType, GenerationRequest, GeneratedWorkout } from './ai/generator';

// ── GPS Metrics ──
export {
  haversineDistance,
  calculateTotalDistance,
  calculatePace,
  calculateSpeed,
  calculateElevationGain,
  filterByAccuracy,
  filterNoise,
  estimateCalories,
  downsampleRoute,
  formatPace,
} from './gps/metrics';

// ── Watch Sync Protocol ──
export {
  buildWatchWorkoutSummary,
  isValidWatchMessage,
} from './watch/sync-protocol';

export type {
  PhoneToWatchMessage,
  WatchToPhoneMessage,
  WatchWorkoutSync,
  WatchWorkoutSummary,
  WatchExerciseEntry,
  WatchSettingsSync,
  WatchSetCompleted,
  WatchSessionStarted,
  WatchSessionCompleted,
  WatchGpsPoints,
  WatchGpsPoint,
} from './watch/sync-protocol';

// ── Sharing ──
export { buildWorkoutSummary } from './sharing';

// CSV export (data ownership)
export { exportWorkoutHistoryCSV, exportSetWeightsCSV } from './export/csv';

// ── Demo ──
export { resolveDemoAsset, getDemoStatus, isBundledAsset, extractAssetPath } from './demo';

// ── Intelligence (cross-module insights) ──
export {
  generateWorkoutInsights,
  detectMoodLiftCorrelation,
  detectFastingPerformance,
  detectProteinRecovery,
  detectConsistencyMomentum,
  detectTimeOfDayPerformance,
  detectVolumeMoodFeedback,
  getWorkoutDays as getWorkoutDaysForInsights,
  getMoodDays as getMoodDaysForInsights,
  getNutritionDays as getNutritionDaysForInsights,
  getFastingDays as getFastingDaysForInsights,
} from './intelligence';

export type {
  WorkoutInsight,
  WorkoutInsightType,
  WorkoutInsightSeverity,
  InsightInput,
} from './intelligence';

export { MIN_DAYS_INTERNAL, MIN_DAYS_CROSS_MODULE } from './intelligence';

// ── Social ──
export {
  applyPrivacyFilter,
  normalizePrivacySettings,
  sortFeedChronological,
  paginateFeed,
  isPostVisible,
  enrichPost,
  FEED_PAGE_SIZE,
} from './social';

// UI tokens, typography, and shared components (Phase 0 foundation).
// `./ui/index.ts` exports only web-safe design tokens; the full RN component
// surface lives in `./ui/index.native.ts` which Metro picks on mobile. Web
// bundlers ignore `.native.ts` and see tokens only, so `@expo/vector-icons`
// `.ttf` assets never enter the web dependency graph.
// See modules/budget/src/index.ts for the documented pattern.
export * from './ui';
