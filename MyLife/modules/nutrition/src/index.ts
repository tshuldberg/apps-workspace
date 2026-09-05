export { NUTRITION_MODULE } from './definition';
export { nutritionCrossModule } from './cross-module';

// Re-export all models
export * from './models';

// Re-export CRUD operations
export {
  createFood,
  createCustomFood,
  getFoodById,
  getFoodByBarcode,
  getRecentFoods,
  searchFoodsFTS,
  searchFoods,
  updateFood,
  deleteFood,
  createFoodFromAIEstimate,
  createNutrient,
  getNutrients,
  getNutrientById,
  deleteNutrient,
  setFoodNutrient,
  getFoodNutrients,
  deleteFoodNutrient,
  deleteFoodNutrients,
  getDailyNutrientTotals,
  createFoodLogEntry,
  getFoodLogEntries,
  getFoodLogEntryById,
  updateFoodLogEntry,
  deleteFoodLogEntry,
  addFoodLogItem,
  getFoodLogItems,
  updateFoodLogItem,
  deleteFoodLogItem,
  getDailyTotals,
  copyFoodLog,
  createDailyGoals,
  getDailyGoals,
  getActiveGoals,
  updateDailyGoals,
  deleteDailyGoals,
  getSetting,
  setSetting,
  deleteSetting,
  getAllSettings,
  getCachedBarcode,
  getRecentBarcodeScans,
  setCachedBarcode,
  deleteCachedBarcode,
  purgeExpiredCache,
} from './db';
export type { RecentBarcodeScan } from './db';
export type { DailyTotals } from './db';
export type { DailyNutrientTotal } from './db';

// Re-export favorites
export {
  addFavorite,
  removeFavorite,
  isFavorite,
  getFavoriteIds,
  getFavoriteCount,
} from './db';
export type { FavoriteFood } from './db';

// Re-export meal templates
export {
  createMealTemplate,
  getMealTemplates,
  getMealTemplateById,
  deleteMealTemplate,
  addMealTemplateItem,
  getMealTemplateItems,
  deleteMealTemplateItem,
  getMealTemplateCount,
  logMealTemplate,
} from './db';
export type { MealTemplate, MealTemplateItem } from './db';

// Re-export migration for external use
export { NUTRITION_MIGRATION_V2, NUTRITION_MIGRATION_V3, NUTRITION_MIGRATION_V4, NUTRITION_MIGRATION_V5, NUTRITION_MIGRATION_V6, NUTRITION_MIGRATION_V7, NUTRITION_MIGRATION_V8 } from './db/migrations';

// Re-export search
export { searchLocalFoods } from './search';
export type { FoodSearchOptions } from './search';

// Re-export seed data helpers
export { ALL_NUTRIENT_DEFS, getNutrientInserts, getUSDAFoodInserts, getUSDAFTSInserts } from './data';

// Re-export API clients and unified search
export { searchFoodUnified, lookupBarcode, searchOFF, lookupBarcodeOFF, searchFatSecret, lookupFatSecretFood, createRateLimiter, RateLimiter } from './api';
export type { FoodSearchResult, APIFoodSearchOptions, BarcodeResult, RateLimitConfig } from './api';

// Re-export barcode scanner
export { handleBarcodeScan } from './barcode';
export type { BarcodeScanResult } from './barcode';

// Re-export AI photo logging
export { analyzePhotoForFoods, isPhotoAnalysisError, FOOD_IDENTIFICATION_SYSTEM_PROMPT, buildUserPrompt } from './ai';
export type { AIFoodEstimate, PhotoAnalysisResult, PhotoAnalysisError } from './ai';

// Re-export stats and analytics
export {
  getDailySummary,
  getDailyGoalProgress,
  getMealBreakdown,
  getWeeklyTrends,
  getMonthlyTrends,
  getCalorieHistory,
  getMacroRatios,
  getMicronutrientSummary,
  getMicronutrientDeficiencies,
  getTopNutrientSources,
} from './stats';
export type { DailySummary, GoalProgress, MealBreakdown, DayTotal, MacroRatios, NutrientStatus, NutrientSummaryItem, NutrientDeficiency, TopNutrientSource, StreakInfo, AggregateTargetScore, DailyReport } from './stats';

// Re-export streak
export { getStreakInfo } from './stats';

// Re-export daily report
export { getAggregateTargetScore, getDailyReport } from './stats';

// Re-export MyFast integration
export { getEatingWindow, isInEatingWindow } from './integration';
export type { EatingWindow } from './integration';

// Re-export CSV export
export { exportFoodLogCSV, exportNutritionSummaryCSV } from './export';

// Re-export water tracking
export {
  createWaterEntry,
  createWaterLogEntry,
  getWaterEntriesForDate,
  getWaterLogByDate,
  deleteWaterEntry,
  deleteWaterLogEntry,
  updateWaterEntry,
  updateWaterLogEntry,
  getDailyWaterTotal,
  getWaterEntriesInRange,
  getWaterLogRange,
  convertMlToOz,
  convertOzToMl,
  getWaterGoalMl,
  getWaterContainers,
  getWaterUnit,
  getWeeklyWaterTotals,
} from './water';
export type { WaterEntry, WaterDayTotal, WeeklyWaterTotals, WaterSource } from './water';

// Re-export energy balance and wearable sync
export {
  calculateBMR,
  applyActivityMultiplier,
  getUserProfile,
  hasUserProfile,
  upsertEnergyLog,
  getEnergyLog,
  deleteEnergyLog,
  getNetCalories,
  getEnergyBalance,
  getWeeklyEnergyBalance,
  calculateAndStoreExpenditure,
  readActiveCaloriesFromHealth,
  isSyncEnabled,
  getSyncDirection,
  syncEnergyForDate,
  getDietaryCaloriesForWriteBack,
  ACTIVITY_MULTIPLIERS,
  DEFAULT_USER_PROFILE,
} from './sync';
export type {
  EnergySource,
  ActivityLevel,
  UserSex,
  EnergyLogEntry,
  UserProfile,
  EnergyBalance,
  DailyEnergyBreakdown,
} from './sync';

// Re-export food diary notes
export {
  createDailyNote,
  getDailyNote,
  getDailyNotes,
  getDailyNotesByDate,
  updateDailyNote,
  deleteDailyNote,
  upsertDailyNote,
  searchNotes,
  parseTags,
  serializeTags,
  DEFAULT_NOTE_PROMPTS,
  DEFAULT_NOTE_TAGS,
} from './notes';
export type { DailyNote, NoteSearchResult } from './notes';

// Re-export restaurant menus
export {
  createRestaurant,
  getRestaurants,
  getRestaurantById,
  getRestaurantVisitStats,
  getRestaurantsByCategory,
  getPopularChains,
  getAllRestaurants,
  deleteRestaurant,
  createMenuItem,
  getMenuItems,
  getMenuItemById,
  updateMenuItem,
  deleteMenuItem,
  logMenuItemAsMeal,
  searchRestaurants,
  searchMenuItems,
  getRestaurantSeedInserts,
} from './restaurant';
export type {
  Restaurant,
  MenuItem,
  RestaurantWithCount,
  RestaurantVisitStats,
  RestaurantCategory,
  RestaurantSource,
  MenuItemSource,
} from './restaurant';

// Re-export intelligence engine
export {
  detectRestaurantImpact,
  detectWaterSnacking,
  detectFastingBreakQuality,
  detectMealTimingEnergy,
  detectGymDayDelta,
  detectProteinWorkoutAdherence,
  generateNutritionInsights,
  getNutritionDays,
  getFastingDays,
  getWorkoutDays,
  getMoodDays,
  getCalorieGoal,
  calculateTDEE,
  calculateDailyCalories,
  calculateMacroGrams,
  normalizeMacroSplit,
  lbsToKg,
  kgToLbs,
  ftInToCm,
  cmToFtIn,
  NutritionInsightSchema,
  NutritionInsightTypeSchema,
  NutritionInsightSeveritySchema,
  MIN_DAYS_INTERNAL,
  MIN_DAYS_CROSS_MODULE,
  MIN_DAYS_COMPLEX,
} from './engine';
export type {
  NutritionInsight,
  NutritionInsightType,
  NutritionInsightSeverity,
  DayNutritionData,
  DayFastingData,
  DayWorkoutData,
  DayMoodData,
  InsightInput,
  WeightGoalDirection,
  MacroSplitPercents,
  MacroGramTargets,
} from './engine';

// Re-export community/social
export {
  generateShareCode,
  createProfile,
  getProfile,
  getProfileById,
  updateProfile,
  deleteProfile,
  sendConnectionRequest,
  acceptConnection,
  declineConnection,
  blockConnection,
  removeConnection,
  getAcceptedConnections,
  getPendingRequests,
  getAcceptedProfileIds,
  isBlocked,
  createFeedItem,
  getFeed,
  getOwnFeed,
  cheerFeedItem,
  uncheerFeedItem,
  createChallenge,
  joinChallenge,
  updateChallengeProgress,
  getChallengeById,
  getActiveChallenges,
  getCompletedChallenges,
  getChallengeLeaderboard,
  getChallengeMember,
  transitionChallengeStatuses,
  getActiveChallengesByType,
  isActivityVisible,
  getVisibleActivityTypes,
  AVATAR_EMOJIS,
  STREAK_MILESTONES,
} from './community';
export type {
  CommunityProfile,
  CommunityConnection,
  CommunityFeedItem,
  FeedItemWithProfile,
  CommunityChallenge,
  ChallengeMember,
  LeaderboardEntry,
  ProfileVisibility,
  ConnectionStatus,
  ActivityType,
  ChallengeType,
  ChallengeJoinType,
  ChallengeStatus,
  ChallengeMemberRole,
} from './community';

// UI barrel: `./ui/index.ts` has web-safe tokens only; full RN component
// surface lives in `./ui/index.native.ts` which Metro picks on mobile.
export * from './ui';
