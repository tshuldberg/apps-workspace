// @mylife/dining -- MyDining module

// Module definition
export { DINING_MODULE } from './definition';
export { diningCrossModule } from './cross-module';

// Types and Zod schemas
export type { Restaurant, RestaurantWithTags, CreateRestaurantInput, UpdateRestaurantInput, RestaurantFilter } from './types';
export type { Tag, CreateTagInput } from './types';
export type { Visit, CreateVisitInput, UpdateVisitInput, VisitFilter, VisitWithRelations, VisitStats, VisitMonthCount } from './types';
export type { Photo, CreatePhotoInput } from './types';
export type { Companion, CreateCompanionInput } from './types';
export type { Dish, CreateDishInput, UpdateDishInput } from './types';
export type { Wine, CreateWineInput, UpdateWineInput } from './types';
export type { Allergen } from './types';
export type { DiningList } from './types';
export type { WatchlistEntry, WatchlistEntryWithRestaurant, CreateWatchlistInput, UpdateWatchlistInput, WatchlistFilter } from './types';
export type { Reservation, CreateReservationInput, UpdateReservationInput, ReservationFilter } from './types';
export type { ImportRecord, CreateImportInput } from './types';
export type { YearInReview } from './types';
export {
  RestaurantSchema,
  CreateRestaurantSchema,
  UpdateRestaurantSchema,
  RestaurantFilterSchema,
  TagSchema,
  CreateTagSchema,
  TagKind,
  SortField,
  SortDirection,
  VisitOccasion,
  ReservationPlatform,
  VisitSchema,
  CreateVisitSchema,
  UpdateVisitSchema,
  VisitSortField,
  VisitFilterSchema,
  PhotoKind,
  PhotoSchema,
  CreatePhotoSchema,
  CompanionSchema,
  CreateCompanionSchema,
  WatchlistStatus,
  WatchlistSchema,
  CreateWatchlistSchema,
  UpdateWatchlistSchema,
  WatchlistFilterSchema,
  DishCourse,
  DishSchema,
  CreateDishSchema,
  UpdateDishSchema,
  WineColor,
  WineSchema,
  CreateWineSchema,
  UpdateWineSchema,
  COMMON_ALLERGENS,
  AllergenSchema,
  ReservationStatus,
  BookingPlatform,
  ReservationSchema,
  CreateReservationSchema,
  UpdateReservationSchema,
  ReservationSortField,
  ReservationFilterSchema,
  ImportSource,
  ImportStatus,
  ImportSchema,
  CreateImportSchema,
} from './types';

// Database schema
export { ALL_TABLES, CREATE_INDEXES, CREATE_SETTINGS, V2_TABLES, V2_INDEXES, V3_TABLES, V3_INDEXES, V4_TABLES, V4_INDEXES, V5_TABLES, V5_INDEXES, V6_TABLES, V6_INDEXES } from './db/schema';

// CRUD operations
export {
  createRestaurant,
  getRestaurant,
  updateRestaurant,
  deleteRestaurant,
  listRestaurants,
  markVisited,
  incrementVisitCount,
  decrementVisitCount,
  recalcAverageRating,
  createTag,
  listTags,
  addTagToRestaurant,
  removeTagFromRestaurant,
  getTagsForRestaurant,
  createVisit,
  getVisit,
  updateVisit,
  deleteVisit,
  listVisitsByRestaurant,
  listVisitsChronological,
  getVisitStats,
  createPhoto,
  getPhoto,
  deletePhoto,
  listPhotosByVisit,
  listPhotosByDish,
  createCompanion,
  listCompanionsByVisit,
  deleteCompanion,
  createWatchlistEntry,
  getWatchlistEntry,
  updateWatchlistEntry,
  deleteWatchlistEntry,
  listWatchlistEntries,
  fulfillWatchlistEntry,
  expireStaleEntries,
  createDish,
  getDish,
  updateDish,
  deleteDish,
  listDishesByVisit,
  listDishesByRestaurant,
  listTopDishes,
  checkAllergens,
  createWine,
  getWine,
  updateWine,
  deleteWine,
  listWinesByVisit,
  listWinesByRestaurant,
  createReservation,
  getReservation,
  updateReservation,
  deleteReservation,
  listReservations,
  listUpcomingReservations,
  cancelReservation,
  completeReservation,
  markNoShow,
  getReservationsByDateRange,
  createImport,
  getImport,
  confirmImport,
  rejectImport,
  listPendingImports,
  importCsvRows,
} from './db/crud';
export type { AllergenMatch } from './db/crud';

// Seeds
export { seedCuisineTags, CUISINE_SEEDS } from './db/seeds';

// Engine
export {
  parseRestaurantUrl,
  detectPlatform,
  parseGoogleMapsUrl,
  extractMetaFromHtml,
  isValidUrl,
  platformToUrlField,
  buildDeeplink,
  getBestBookingPlatform,
  buildBookingUrl,
  parseConfirmationEmail,
  detectEmailPlatform,
} from './engine';
export type { Platform, ParsedRestaurant, DeeplinkPlatform, DeeplinkOptions, DeeplinkResult, ParsedReservation } from './engine';

// Year-in-review engine
export { generateYearInReview } from './engine';

// CSV / Maps import
export { parseCsvText, parseGoogleMapsExport } from './engine';
export type { CsvRow, ImportResult, GoogleMapsPlace } from './engine';
