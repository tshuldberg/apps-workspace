/**
 * Re-export all types and Zod schemas from models/schemas.ts.
 * Domain types are derived from Zod schemas via z.infer.
 */

// All Zod schemas and inferred types
export {
  TagKind,
  TagSchema,
  CreateTagSchema,
  RestaurantSchema,
  CreateRestaurantSchema,
  UpdateRestaurantSchema,
  SortField,
  SortDirection,
  RestaurantFilterSchema,
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
} from './models/schemas';

export type {
  Tag,
  CreateTagInput,
  Restaurant,
  RestaurantWithTags,
  CreateRestaurantInput,
  UpdateRestaurantInput,
  RestaurantFilter,
  Visit,
  CreateVisitInput,
  UpdateVisitInput,
  VisitFilter,
  VisitWithRelations,
  VisitStats,
  VisitMonthCount,
  Photo,
  CreatePhotoInput,
  Companion,
  CreateCompanionInput,
} from './models/schemas';

/** A curated list of restaurants. Stub until P4. */
export interface DiningList {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// Dish types and schemas
export {
  DishCourse,
  DishSchema,
  CreateDishSchema,
  UpdateDishSchema,
} from './models/schemas';

export type {
  Dish,
  CreateDishInput,
  UpdateDishInput,
} from './models/schemas';

// Wine types and schemas
export {
  WineColor,
  WineSchema,
  CreateWineSchema,
  UpdateWineSchema,
} from './models/schemas';

export type {
  Wine,
  CreateWineInput,
  UpdateWineInput,
} from './models/schemas';

// Allergen types and schemas
export {
  COMMON_ALLERGENS,
  AllergenSchema,
} from './models/schemas';

export type {
  Allergen,
} from './models/schemas';

// Watchlist types and schemas
export {
  WatchlistStatus,
  WatchlistSchema,
  CreateWatchlistSchema,
  UpdateWatchlistSchema,
  WatchlistFilterSchema,
} from './models/schemas';

export type {
  WatchlistEntry,
  WatchlistEntryWithRestaurant,
  CreateWatchlistInput,
  UpdateWatchlistInput,
  WatchlistFilter,
} from './models/schemas';

// Reservation types and schemas
export {
  ReservationStatus,
  BookingPlatform,
  ReservationSchema,
  CreateReservationSchema,
  UpdateReservationSchema,
  ReservationSortField,
  ReservationFilterSchema,
} from './models/schemas';

export type {
  Reservation,
  CreateReservationInput,
  UpdateReservationInput,
  ReservationFilter,
} from './models/schemas';

// Import types and schemas
export {
  ImportSource,
  ImportStatus,
  ImportSchema,
  CreateImportSchema,
} from './models/schemas';

export type {
  ImportRecord,
  CreateImportInput,
} from './models/schemas';

// Year-in-review
export type { YearInReview } from './engine/year-review';

// CSV / Maps importer types
export type { CsvRow, ImportResult, GoogleMapsPlace } from './engine/csv-importer';
