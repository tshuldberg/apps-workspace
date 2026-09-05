import { z } from 'zod';

// -- Tag kinds --

export const TagKind = z.enum(['cuisine', 'vibe', 'occasion', 'custom']);
export type TagKind = z.infer<typeof TagKind>;

// -- Tags --

export const TagSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string().nullable(),
  kind: TagKind,
  created_at: z.string(),
});
export type Tag = z.infer<typeof TagSchema>;

export const CreateTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().nullable().optional(),
  kind: TagKind,
});
export type CreateTagInput = z.infer<typeof CreateTagSchema>;

// -- Restaurants --

export const RestaurantSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  address: z.string().nullable(),
  city: z.string().nullable(),
  neighborhood: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  cuisines: z.string().nullable(), // JSON array stored as TEXT
  price_tier: z.number().int().min(1).max(4).nullable(),
  website_url: z.string().nullable(),
  resy_url: z.string().nullable(),
  opentable_url: z.string().nullable(),
  tock_url: z.string().nullable(),
  yelp_url: z.string().nullable(),
  instagram_handle: z.string().nullable(),
  notes_md: z.string().nullable(),
  is_wishlist: z.number().int().min(0).max(1),
  is_visited: z.number().int().min(0).max(1),
  first_visited_at: z.string().nullable(),
  last_visited_at: z.string().nullable(),
  visit_count: z.number().int().nonnegative(),
  average_rating: z.number().nullable(),
  photo_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Restaurant = z.infer<typeof RestaurantSchema>;

/** Restaurant with its associated tags. */
export type RestaurantWithTags = Restaurant & { tags: Tag[] };

export const CreateRestaurantSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  cuisines: z.string().nullable().optional(),
  price_tier: z.number().int().min(1).max(4).nullable().optional(),
  website_url: z.string().nullable().optional(),
  resy_url: z.string().nullable().optional(),
  opentable_url: z.string().nullable().optional(),
  tock_url: z.string().nullable().optional(),
  yelp_url: z.string().nullable().optional(),
  instagram_handle: z.string().nullable().optional(),
  notes_md: z.string().nullable().optional(),
  is_wishlist: z.number().int().min(0).max(1).optional(),
  is_visited: z.number().int().min(0).max(1).optional(),
  photo_id: z.string().nullable().optional(),
});
export type CreateRestaurantInput = z.infer<typeof CreateRestaurantSchema>;

export const UpdateRestaurantSchema = CreateRestaurantSchema.partial();
export type UpdateRestaurantInput = z.infer<typeof UpdateRestaurantSchema>;

// -- Restaurant filters --

export const SortField = z.enum([
  'name',
  'created_at',
  'visit_count',
  'average_rating',
  'last_visited_at',
]);
export type SortField = z.infer<typeof SortField>;

export const SortDirection = z.enum(['ASC', 'DESC']);
export type SortDirection = z.infer<typeof SortDirection>;

export const RestaurantFilterSchema = z.object({
  search: z.string().optional(),
  cuisine_tag_ids: z.array(z.string()).optional(),
  neighborhood: z.string().optional(),
  price_tier_min: z.number().int().min(1).max(4).optional(),
  price_tier_max: z.number().int().min(1).max(4).optional(),
  is_wishlist: z.number().int().min(0).max(1).optional(),
  is_visited: z.number().int().min(0).max(1).optional(),
  sort_by: SortField.optional(),
  sort_dir: SortDirection.optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type RestaurantFilter = z.infer<typeof RestaurantFilterSchema>;

// -- Visit occasion + reservation platform enums --

export const VisitOccasion = z.enum([
  'Birthday',
  'Anniversary',
  'Date Night',
  'Business',
  'Casual',
  'Special',
]);
export type VisitOccasion = z.infer<typeof VisitOccasion>;

export const ReservationPlatform = z.enum(['resy', 'opentable', 'tock', 'yelp']);
export type ReservationPlatform = z.infer<typeof ReservationPlatform>;

// -- Visits --

export const VisitSchema = z.object({
  id: z.string(),
  restaurant_id: z.string(),
  visited_at: z.string(),
  party_size: z.number().int().positive().nullable(),
  occasion: z.string().nullable(),
  reservation_platform: z.string().nullable(),
  reservation_confirmation_code: z.string().nullable(),
  overall_rating: z.number().int().min(1).max(5),
  vibe_rating: z.number().int().min(1).max(5).nullable(),
  food_rating: z.number().int().min(1).max(5).nullable(),
  service_rating: z.number().int().min(1).max(5).nullable(),
  notes_md: z.string().nullable(),
  total_cost_cents: z.number().int().nonnegative().nullable(),
  who_paid: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Visit = z.infer<typeof VisitSchema>;

export const CreateVisitSchema = z.object({
  restaurant_id: z.string().min(1),
  visited_at: z.string().min(1),
  overall_rating: z.number().int().min(1).max(5),
  party_size: z.number().int().positive().nullable().optional(),
  occasion: VisitOccasion.nullable().optional(),
  reservation_platform: ReservationPlatform.nullable().optional(),
  reservation_confirmation_code: z.string().nullable().optional(),
  vibe_rating: z.number().int().min(1).max(5).nullable().optional(),
  food_rating: z.number().int().min(1).max(5).nullable().optional(),
  service_rating: z.number().int().min(1).max(5).nullable().optional(),
  notes_md: z.string().nullable().optional(),
  total_cost_cents: z.number().int().nonnegative().nullable().optional(),
  who_paid: z.string().nullable().optional(),
});
export type CreateVisitInput = z.infer<typeof CreateVisitSchema>;

export const UpdateVisitSchema = CreateVisitSchema.partial().omit({ restaurant_id: true });
export type UpdateVisitInput = z.infer<typeof UpdateVisitSchema>;

// -- Visit filters --

export const VisitSortField = z.enum(['visited_at', 'overall_rating', 'created_at']);
export type VisitSortField = z.infer<typeof VisitSortField>;

export const VisitFilterSchema = z.object({
  restaurant_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  sort_by: VisitSortField.optional(),
  sort_dir: SortDirection.optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type VisitFilter = z.infer<typeof VisitFilterSchema>;

// -- Photos --

export const PhotoKind = z.enum(['dish', 'interior', 'menu', 'receipt', 'company', 'other']);
export type PhotoKind = z.infer<typeof PhotoKind>;

export const PhotoSchema = z.object({
  id: z.string(),
  visit_id: z.string().nullable(),
  dish_id: z.string().nullable(),
  kind: PhotoKind,
  local_uri: z.string(),
  caption: z.string().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  size_bytes: z.number().int().nonnegative().nullable(),
  taken_at: z.string().nullable(),
  exif_stripped: z.number().int().min(0).max(1),
  created_at: z.string(),
});
export type Photo = z.infer<typeof PhotoSchema>;

export const CreatePhotoSchema = z.object({
  visit_id: z.string().nullable().optional(),
  dish_id: z.string().nullable().optional(),
  kind: PhotoKind,
  local_uri: z.string().min(1),
  caption: z.string().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  size_bytes: z.number().int().nonnegative().nullable().optional(),
  taken_at: z.string().nullable().optional(),
  exif_stripped: z.number().int().min(0).max(1).optional(),
});
export type CreatePhotoInput = z.infer<typeof CreatePhotoSchema>;

// -- Companions --

export const CompanionSchema = z.object({
  id: z.string(),
  visit_id: z.string(),
  display_name: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type Companion = z.infer<typeof CompanionSchema>;

export const CreateCompanionSchema = z.object({
  visit_id: z.string().min(1),
  display_name: z.string().min(1).max(255),
  notes: z.string().nullable().optional(),
});
export type CreateCompanionInput = z.infer<typeof CreateCompanionSchema>;

// -- Visit with relations --

/** Visit with its associated photos and companions. */
export type VisitWithRelations = Visit & { photos: Photo[]; companions: Companion[] };

// -- Visit stats --

export interface VisitMonthCount {
  month: string;
  count: number;
}

export interface VisitStats {
  totalVisits: number;
  avgRating: number | null;
  visitsByMonth: VisitMonthCount[];
}

// -- Dishes --

export const DishCourse = z.enum(['appetizer', 'main', 'dessert', 'side', 'drink', 'other']);
export type DishCourse = z.infer<typeof DishCourse>;

export const DishSchema = z.object({
  id: z.string(),
  visit_id: z.string().nullable(),
  restaurant_id: z.string(),
  name: z.string().min(1),
  course: z.string().nullable(),
  price_cents: z.number().int().nonnegative().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  would_order_again: z.number().int().min(0).max(1),
  allergens: z.string().nullable(), // JSON array stored as TEXT
  notes: z.string().nullable(),
  photo_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Dish = z.infer<typeof DishSchema>;

export const CreateDishSchema = z.object({
  restaurant_id: z.string().min(1),
  name: z.string().min(1).max(255),
  visit_id: z.string().nullable().optional(),
  course: DishCourse.nullable().optional(),
  price_cents: z.number().int().nonnegative().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  would_order_again: z.number().int().min(0).max(1).optional(),
  allergens: z.string().nullable().optional(), // JSON array as TEXT
  notes: z.string().nullable().optional(),
  photo_id: z.string().nullable().optional(),
});
export type CreateDishInput = z.infer<typeof CreateDishSchema>;

export const UpdateDishSchema = CreateDishSchema.partial().omit({ restaurant_id: true });
export type UpdateDishInput = z.infer<typeof UpdateDishSchema>;

// -- Wines --

export const WineColor = z.enum(['red', 'white', 'rose', 'sparkling', 'orange', 'dessert']);
export type WineColor = z.infer<typeof WineColor>;

export const WineSchema = z.object({
  id: z.string(),
  visit_id: z.string().nullable(),
  restaurant_id: z.string(),
  producer: z.string().min(1),
  name: z.string().min(1),
  vintage: z.number().int().nullable(),
  region: z.string().nullable(),
  varietal: z.string().nullable(),
  color: z.string().nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  price_cents: z.number().int().nonnegative().nullable(),
  by_glass: z.number().int().min(0).max(1),
  pairing_notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Wine = z.infer<typeof WineSchema>;

export const CreateWineSchema = z.object({
  restaurant_id: z.string().min(1),
  producer: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  visit_id: z.string().nullable().optional(),
  vintage: z.number().int().nullable().optional(),
  region: z.string().nullable().optional(),
  varietal: z.string().nullable().optional(),
  color: WineColor.nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  price_cents: z.number().int().nonnegative().nullable().optional(),
  by_glass: z.number().int().min(0).max(1).optional(),
  pairing_notes: z.string().nullable().optional(),
});
export type CreateWineInput = z.infer<typeof CreateWineSchema>;

export const UpdateWineSchema = CreateWineSchema.partial().omit({ restaurant_id: true });
export type UpdateWineInput = z.infer<typeof UpdateWineSchema>;

// -- Allergens --

export const COMMON_ALLERGENS = [
  'Dairy', 'Eggs', 'Fish', 'Shellfish', 'Tree Nuts', 'Peanuts',
  'Wheat', 'Soy', 'Sesame', 'Gluten', 'Sulfites', 'Mustard',
  'Celery', 'Lupin', 'Mollusks',
] as const;

export const AllergenSchema = z.enum(COMMON_ALLERGENS);
export type Allergen = z.infer<typeof AllergenSchema>;

// -- Watchlist --

export const WatchlistStatus = z.enum(['active', 'fulfilled', 'expired', 'cancelled']);
export type WatchlistStatus = z.infer<typeof WatchlistStatus>;

export const WatchlistSchema = z.object({
  id: z.string(),
  restaurant_id: z.string(),
  party_size: z.number().int().positive(),
  date_range_start: z.string().nullable(),
  date_range_end: z.string().nullable(),
  notify_enabled: z.number().int().min(0).max(1),
  notes: z.string().nullable(),
  status: WatchlistStatus,
  created_at: z.string(),
  updated_at: z.string(),
});
export type WatchlistEntry = z.infer<typeof WatchlistSchema>;

export type WatchlistEntryWithRestaurant = WatchlistEntry & { restaurant_name: string };

export const CreateWatchlistSchema = z.object({
  restaurant_id: z.string().min(1),
  party_size: z.number().int().min(1).max(12),
  date_range_start: z.string().nullable().optional(),
  date_range_end: z.string().nullable().optional(),
  notify_enabled: z.number().int().min(0).max(1).optional(),
  notes: z.string().nullable().optional(),
});
export type CreateWatchlistInput = z.infer<typeof CreateWatchlistSchema>;

export const UpdateWatchlistSchema = CreateWatchlistSchema.partial().omit({ restaurant_id: true });
export type UpdateWatchlistInput = z.infer<typeof UpdateWatchlistSchema>;

export const WatchlistFilterSchema = z.object({
  status: WatchlistStatus.optional(),
  restaurant_id: z.string().optional(),
});
export type WatchlistFilter = z.infer<typeof WatchlistFilterSchema>;

// -- Reservations (V6) --

export const ReservationStatus = z.enum(['upcoming', 'completed', 'cancelled', 'no_show']);
export type ReservationStatus = z.infer<typeof ReservationStatus>;

export const BookingPlatform = z.enum(['resy', 'opentable', 'tock', 'yelp', 'phone', 'walkin', 'other']);
export type BookingPlatform = z.infer<typeof BookingPlatform>;

export const ReservationSchema = z.object({
  id: z.string(),
  restaurant_id: z.string(),
  reserved_at: z.string(),
  party_size: z.number().int().positive(),
  confirmation_code: z.string().nullable(),
  platform: z.string().nullable(),
  status: ReservationStatus,
  cancel_reason: z.string().nullable(),
  reminder_minutes: z.number().int().nonnegative().nullable(),
  notes: z.string().nullable(),
  visit_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Reservation = z.infer<typeof ReservationSchema>;

export const CreateReservationSchema = z.object({
  restaurant_id: z.string().min(1),
  reserved_at: z.string().min(1),
  party_size: z.number().int().positive(),
  confirmation_code: z.string().nullable().optional(),
  platform: BookingPlatform.nullable().optional(),
  status: ReservationStatus.optional(),
  cancel_reason: z.string().nullable().optional(),
  reminder_minutes: z.number().int().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  visit_id: z.string().nullable().optional(),
});
export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const UpdateReservationSchema = CreateReservationSchema.partial().omit({ restaurant_id: true });
export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;

// -- Reservation filters --

export const ReservationSortField = z.enum(['reserved_at', 'created_at']);
export type ReservationSortField = z.infer<typeof ReservationSortField>;

export const ReservationFilterSchema = z.object({
  restaurant_id: z.string().optional(),
  status: ReservationStatus.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  sort_by: ReservationSortField.optional(),
  sort_dir: SortDirection.optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type ReservationFilter = z.infer<typeof ReservationFilterSchema>;

// -- Imports (V6) --

export const ImportSource = z.enum(['email_resy', 'email_opentable', 'email_tock', 'email_yelp', 'csv', 'manual_paste']);
export type ImportSource = z.infer<typeof ImportSource>;

export const ImportStatus = z.enum(['pending', 'confirmed', 'rejected']);
export type ImportStatus = z.infer<typeof ImportStatus>;

export const ImportSchema = z.object({
  id: z.string(),
  source: ImportSource,
  raw_text: z.string(),
  parsed_data: z.string().nullable(),
  status: ImportStatus,
  reservation_id: z.string().nullable(),
  created_at: z.string(),
});
export type ImportRecord = z.infer<typeof ImportSchema>;

export const CreateImportSchema = z.object({
  source: ImportSource,
  raw_text: z.string().min(1),
  parsed_data: z.string().nullable().optional(),
});
export type CreateImportInput = z.infer<typeof CreateImportSchema>;
