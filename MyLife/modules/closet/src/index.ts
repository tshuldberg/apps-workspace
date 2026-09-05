export { CLOSET_MODULE } from './definition';

// ── V1/V2 types ──
export type {
  ClothingCategory,
  ClothingStatus,
  ClothingCondition,
  LaundryStatus,
  CareInstruction,
  LaundryEventType,
  PackingListMode,
  PackingListSeason,
  ClothingItem,
  Outfit,
  WearLog,
  LaundryEvent,
  PackingListItem,
  PackingList,
  ClosetTag,
  ClosetSetting,
  ClosetDashboard,
  CreateClothingItemInput,
  UpdateClothingItemInput,
  ClothingItemFilter,
  CreateOutfitInput,
  CreateWearLogInput,
  MarkLaundryItemsCleanInput,
  CreatePackingListInput,
  AddPackingListCustomItemInput,
  ExportClosetDataInput,
  ClosetExportBundle,
} from './types';

// ── V3 types ──
export type {
  WishlistPriority,
  WishlistItem,
  CreateWishlistItemInput,
  UpdateWishlistItemInput,
  WishlistSummary,
  CapsuleWardrobe,
  CreateCapsuleInput,
  ColorCategory,
  ColorDistributionEntry,
  WeatherCondition,
  WeatherRecommendation,
  OutfitSuggestion,
  SuggestionFeedback,
  Season,
  Hemisphere,
  SeasonalRotationStatus,
} from './types';

// ── V1/V2 schemas ──
export {
  ClothingCategorySchema,
  ClothingStatusSchema,
  ClothingConditionSchema,
  LaundryStatusSchema,
  CareInstructionSchema,
  LaundryEventTypeSchema,
  PackingListModeSchema,
  PackingListSeasonSchema,
  ClothingItemSchema,
  OutfitSchema,
  WearLogSchema,
  LaundryEventSchema,
  PackingListItemSchema,
  PackingListSchema,
  ClosetTagSchema,
  ClosetSettingSchema,
  ClosetDashboardSchema,
  CreateClothingItemInputSchema,
  UpdateClothingItemInputSchema,
  ClothingItemFilterSchema,
  CreateOutfitInputSchema,
  CreateWearLogInputSchema,
  MarkLaundryItemsCleanInputSchema,
  CreatePackingListInputSchema,
  AddPackingListCustomItemInputSchema,
  ExportClosetDataInputSchema,
  ClosetExportBundleSchema,
} from './types';

// ── V3 schemas ──
export {
  WishlistPrioritySchema,
  WishlistItemSchema,
  CreateWishlistItemInputSchema,
  UpdateWishlistItemInputSchema,
  WishlistSummarySchema,
  CapsuleWardrobeSchema,
  CreateCapsuleInputSchema,
  ColorCategorySchema,
  ColorDistributionEntrySchema,
  WeatherConditionSchema,
  WeatherRecommendationSchema,
  OutfitSuggestionSchema,
  SuggestionFeedbackSchema,
  SeasonSchema,
  HemisphereSchema,
  SeasonalRotationStatusSchema,
} from './types';

// ── V1/V2 CRUD ──
export {
  createClothingItem,
  updateClothingItem,
  getClothingItemById,
  listClothingItems,
  listDirtyClothingItems,
  listClosetTags,
  createOutfit,
  getOutfitById,
  listOutfits,
  logWearEvent,
  getWearLogById,
  listWearLogs,
  listLaundryEventsForItem,
  markLaundryItemsClean,
  getAverageWearsBetweenWashes,
  createPackingList,
  getPackingListById,
  listPackingLists,
  togglePackingListItemPacked,
  addPackingListCustomItem,
  getClosetSetting,
  setClosetSetting,
  listClosetSettings,
  listDonationCandidates,
  exportClosetData,
  getClosetDashboard,
} from './db';

// ── V3 CRUD: Wishlist ──
export {
  createWishlistItem,
  getWishlistItemById,
  listWishlistItems,
  updateWishlistItem,
  deleteWishlistItem,
  markWishlistItemPurchased,
  getWishlistSummary,
} from './db';

// ── V3 CRUD: Capsules ──
export {
  createCapsule,
  getCapsuleById,
  listCapsules,
  setActiveCapsule,
  addCapsuleItem,
  removeCapsuleItem,
  deleteCapsule,
} from './db';

// ── V3 CRUD: Suggestion Feedback ──
export {
  recordSuggestionFeedback,
  listSuggestionFeedback,
  getFeedbackForHash,
} from './db';

// ── Engines ──
export {
  calculateWardrobeValue,
  calculateCostPerWear,
  summarizeClosetDashboard,
} from './engine/analytics';

export {
  calculateAverageWearsBetweenWashes,
  groupDirtyItemsByCare,
} from './engine/laundry';

export {
  inferPackingSeason,
  generatePackingSuggestions,
} from './engine/packing';

export {
  serializeClosetExport,
} from './engine/export';

// ── V3 engines ──
export {
  getCPWLeaderboard,
  getCPWByCategory,
  getCPWSummary,
} from './engine/cpw';
export type { CPWLeaderboardEntry, CPWSummary, CPWCategoryAverage } from './engine/cpw';

export {
  scoreItemForWeather,
  recommendForWeather,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  getLayerLabel,
  getRecommendedCategories,
} from './engine/weather';

export {
  detectCurrentSeason,
  getSeasonBoundaryDate,
  shouldShowRotationReminder,
  getItemsToStore,
  getItemsToActivate,
  getPreviousSeason,
} from './engine/seasonal';

export {
  generateOutfitSuggestions,
  hashOutfitItems,
} from './engine/outfit-suggest';

export {
  calculateVersatilityScore,
  suggestCapsuleItems,
  analyzeCapsuleGaps,
  estimateOutfitCombinations,
} from './engine/capsule';

export {
  normalizeColor,
  getColorDistribution,
  getColorDistributionByCategory,
  generateColorInsights,
  getColorHarmonyPairs,
} from './engine/color';

// ── Cross-Module Integrations ──
export {
  importFromPurchase,
  getPendingShopImports,
  getSharedSizesFromShop,
  type ClosetItemSuggestion,
} from './integrations/shop-import';
