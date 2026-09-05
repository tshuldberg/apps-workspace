/**
 * MyTravel schemas (models).
 *
 * Row shapes match the SQLite columns exactly (snake_case, integers where
 * SQLite stores booleans as 0/1). Insert/Update schemas are input shapes
 * used by CRUD helpers.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export const TripStatusSchema = z.enum([
  'planning',
  'upcoming',
  'active',
  'completed',
  'cancelled',
]);
export type TripStatus = z.infer<typeof TripStatusSchema>;

export const TripTypeSchema = z.enum([
  'vacation',
  'business',
  'family',
  'solo',
  'road_trip',
  'backpacking',
]);
export type TripType = z.infer<typeof TripTypeSchema>;

export const ActivityTypeSchema = z.enum([
  'flight',
  'hotel',
  'restaurant',
  'sight',
  'tour',
  'hike',
  'transport',
  'other',
]);
export type ActivityType = z.infer<typeof ActivityTypeSchema>;

// ---------------------------------------------------------------------------
// Trip
// ---------------------------------------------------------------------------

/** SQLite row shape for tv_trips. */
export const TripRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  destination_ids: z.string().nullable().default('[]'),
  trip_type: TripTypeSchema.nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  status: TripStatusSchema.default('planning'),
  companion_ids: z.string().nullable().default('[]'),
  budget_planned_cents: z.number().int().nullable().optional(),
  budget_actual_cents: z.number().int().default(0),
  cover_photo_id: z.string().nullable().optional(),
  notes_md: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  template_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TripRow = z.infer<typeof TripRowSchema>;

export const TripInsertSchema = z.object({
  name: z.string().min(1),
  destination_ids: z.array(z.string()).optional(),
  trip_type: TripTypeSchema.optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: TripStatusSchema.optional(),
  companion_ids: z.array(z.string()).optional(),
  budget_planned_cents: z.number().int().nonnegative().optional(),
  budget_actual_cents: z.number().int().nonnegative().optional(),
  cover_photo_id: z.string().optional(),
  notes_md: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  template_id: z.string().optional(),
});
export type TripInsert = z.infer<typeof TripInsertSchema>;

export const TripUpdateSchema = TripInsertSchema.partial();
export type TripUpdate = z.infer<typeof TripUpdateSchema>;

export const TripListFilterSchema = z.object({
  status: TripStatusSchema.optional(),
  trip_type: TripTypeSchema.optional(),
  start_after: z.string().optional(),
  start_before: z.string().optional(),
});
export type TripListFilter = z.infer<typeof TripListFilterSchema>;

// ---------------------------------------------------------------------------
// Itinerary Day
// ---------------------------------------------------------------------------

export const ItineraryDayRowSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  date: z.string().nullable().optional(),
  day_number: z.number().int().nonnegative(),
  location: z.string().nullable().optional(),
  weather_notes: z.string().nullable().optional(),
  summary_md: z.string().nullable().optional(),
  photo_ids: z.string().nullable().default('[]'),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ItineraryDayRow = z.infer<typeof ItineraryDayRowSchema>;

export const ItineraryDayInsertSchema = z.object({
  trip_id: z.string(),
  day_number: z.number().int().nonnegative(),
  date: z.string().optional(),
  location: z.string().optional(),
  weather_notes: z.string().optional(),
  summary_md: z.string().optional(),
  photo_ids: z.array(z.string()).optional(),
});
export type ItineraryDayInsert = z.infer<typeof ItineraryDayInsertSchema>;

export const ItineraryDayUpdateSchema = z.object({
  day_number: z.number().int().nonnegative().optional(),
  date: z.string().optional(),
  location: z.string().optional(),
  weather_notes: z.string().optional(),
  summary_md: z.string().optional(),
  photo_ids: z.array(z.string()).optional(),
});
export type ItineraryDayUpdate = z.infer<typeof ItineraryDayUpdateSchema>;

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export const ActivityRowSchema = z.object({
  id: z.string(),
  day_id: z.string(),
  trip_id: z.string(),
  time: z.string().nullable().optional(),
  end_time: z.string().nullable().optional(),
  title: z.string(),
  type: ActivityTypeSchema.nullable().optional(),
  location: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  confirmation_code: z.string().nullable().optional(),
  cost_cents: z.number().int().nullable().optional(),
  notes_md: z.string().nullable().optional(),
  booking_url: z.string().nullable().optional(),
  photo_id: z.string().nullable().optional(),
  created_at: z.string(),
});
export type ActivityRow = z.infer<typeof ActivityRowSchema>;

export const ActivityInsertSchema = z.object({
  day_id: z.string(),
  trip_id: z.string(),
  title: z.string().min(1),
  time: z.string().optional(),
  end_time: z.string().optional(),
  type: ActivityTypeSchema.optional(),
  location: z.string().optional(),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  confirmation_code: z.string().optional(),
  cost_cents: z.number().int().optional(),
  notes_md: z.string().optional(),
  booking_url: z.string().optional(),
  photo_id: z.string().optional(),
});
export type ActivityInsert = z.infer<typeof ActivityInsertSchema>;

export const ActivityUpdateSchema = ActivityInsertSchema.partial().omit({
  day_id: true,
  trip_id: true,
});
export type ActivityUpdate = z.infer<typeof ActivityUpdateSchema>;

// ---------------------------------------------------------------------------
// Destination
// ---------------------------------------------------------------------------

/**
 * Input for creating a destination. `name` is required; everything else is
 * optional. `country_code` is a 2-letter ISO 3166-1 alpha-2 code when provided.
 */
export const DestinationInputSchema = z.object({
  name: z.string().min(1, 'Destination name is required').max(200),
  country: z.string().max(100).optional(),
  country_code: z
    .string()
    .length(2, 'country_code must be a 2-letter ISO code')
    .optional(),
  region: z.string().max(100).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  bucket_list: z.boolean().default(false),
  priority: z.number().int().optional(),
  notes_md: z.string().optional(),
  best_season: z.string().max(50).optional(),
  photo_id: z.string().optional(),
});
export type DestinationInput = z.infer<typeof DestinationInputSchema>;

/** Partial update — every field optional. */
export const DestinationUpdateSchema = DestinationInputSchema.partial();
export type DestinationUpdate = z.infer<typeof DestinationUpdateSchema>;

/** Raw SQLite row for tv_destinations (bucket_list is 0/1). */
export interface DestinationRow {
  id: string;
  name: string;
  country: string | null;
  country_code: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  first_visited: string | null;
  last_visited: string | null;
  visit_count: number;
  rating: number | null;
  bucket_list: number;
  priority: number | null;
  notes_md: string | null;
  best_season: string | null;
  photo_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Deserialized destination record returned to consumers. */
export interface DestinationRecord {
  id: string;
  name: string;
  country: string | null;
  country_code: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  first_visited: string | null;
  last_visited: string | null;
  visit_count: number;
  rating: number | null;
  bucket_list: boolean;
  priority: number | null;
  notes_md: string | null;
  best_season: string | null;
  photo_id: string | null;
  created_at: string;
  updated_at: string;
}

export const DestinationFilterSchema = z.object({
  country: z.string().optional(),
  country_code: z.string().length(2).optional(),
  region: z.string().optional(),
  bucketList: z.boolean().optional(),
  visited: z.boolean().optional(),
});
export type DestinationFilter = z.infer<typeof DestinationFilterSchema>;

// ---------------------------------------------------------------------------
// Document (v3 logistics)
// ---------------------------------------------------------------------------

export const DocumentTypeSchema = z.enum([
  'passport',
  'visa',
  'insurance',
  'vaccination',
  'membership',
  'other',
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DocumentInputSchema = z.object({
  type: DocumentTypeSchema,
  name: z.string().min(1, 'Document name is required').max(200),
  number: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
  renewal_reminder_days: z.number().int().nonnegative().optional(),
  notes_md: z.string().optional(),
  photo_id: z.string().optional(),
});
export type DocumentInput = z.infer<typeof DocumentInputSchema>;

export const DocumentUpdateSchema = DocumentInputSchema.partial();
export type DocumentUpdate = z.infer<typeof DocumentUpdateSchema>;

export interface DocumentRow {
  id: string;
  type: DocumentType;
  name: string;
  number: string | null;
  country: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  renewal_reminder_days: number | null;
  notes_md: string | null;
  photo_id: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Loyalty Program (v3 logistics)
// ---------------------------------------------------------------------------

export const LoyaltyTypeSchema = z.enum(['airline', 'hotel', 'car']);
export type LoyaltyType = z.infer<typeof LoyaltyTypeSchema>;

export const LoyaltyProgramInputSchema = z.object({
  type: LoyaltyTypeSchema,
  provider: z.string().min(1, 'Provider is required').max(200),
  member_number: z.string().max(100).optional(),
  status_tier: z.string().max(100).optional(),
  points_balance: z.number().int().nonnegative().optional(),
  miles_balance: z.number().int().nonnegative().optional(),
  expiry_date: z.string().optional(),
  notes: z.string().optional(),
});
export type LoyaltyProgramInput = z.infer<typeof LoyaltyProgramInputSchema>;

export const LoyaltyProgramUpdateSchema = LoyaltyProgramInputSchema.partial();
export type LoyaltyProgramUpdate = z.infer<typeof LoyaltyProgramUpdateSchema>;

export interface LoyaltyProgramRow {
  id: string;
  type: LoyaltyType;
  provider: string;
  member_number: string | null;
  status_tier: string | null;
  points_balance: number;
  miles_balance: number;
  expiry_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Booking (v4 bookings)
// ---------------------------------------------------------------------------

export const BookingTypeSchema = z.enum([
  'flight',
  'hotel',
  'car',
  'train',
  'ferry',
  'tour',
  'other',
]);
export type BookingType = z.infer<typeof BookingTypeSchema>;

export const BookingInputSchema = z.object({
  trip_id: z.string().min(1, 'trip_id is required'),
  type: BookingTypeSchema,
  provider: z.string().min(1, 'Provider is required').max(200),
  confirmation_code: z.string().max(100).optional(),
  start_ts: z.string().min(1, 'start_ts is required'),
  end_ts: z.string().optional(),
  location: z.string().max(200).optional(),
  cost_cents: z.number().int().nonnegative().optional(),
  currency: z
    .string()
    .length(3, 'currency must be a 3-letter ISO-4217 code')
    .optional(),
  notes: z.string().optional(),
  attachments_ref: z.string().optional(),
});
export type BookingInput = z.infer<typeof BookingInputSchema>;

export const BookingUpdateSchema = BookingInputSchema.partial().omit({
  trip_id: true,
});
export type BookingUpdate = z.infer<typeof BookingUpdateSchema>;

export interface BookingRow {
  id: string;
  trip_id: string;
  type: BookingType;
  provider: string;
  confirmation_code: string | null;
  start_ts: string;
  end_ts: string | null;
  location: string | null;
  cost_cents: number | null;
  currency: string | null;
  notes: string | null;
  attachments_ref: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Emergency Contact (v5 extended logistics)
// ---------------------------------------------------------------------------

export const EmergencyContactInputSchema = z.object({
  trip_id: z.string().optional(),
  name: z.string().min(1, 'Contact name is required').max(200),
  relationship: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(200).optional(),
  country_code: z
    .string()
    .length(2, 'country_code must be a 2-letter ISO code')
    .optional(),
  notes: z.string().optional(),
});
export type EmergencyContactInput = z.infer<typeof EmergencyContactInputSchema>;

export const EmergencyContactUpdateSchema =
  EmergencyContactInputSchema.partial();
export type EmergencyContactUpdate = z.infer<
  typeof EmergencyContactUpdateSchema
>;

export interface EmergencyContactRow {
  id: string;
  trip_id: string | null;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  country_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Currency Rate (v5 extended logistics)
// ---------------------------------------------------------------------------

export const CurrencyRateInputSchema = z.object({
  trip_id: z.string().optional(),
  base: z.string().length(3, 'base must be a 3-letter ISO-4217 code'),
  quote: z.string().length(3, 'quote must be a 3-letter ISO-4217 code'),
  rate: z.number().positive('rate must be positive'),
  fetched_at: z.string().min(1, 'fetched_at is required'),
  source: z.string().max(100).optional(),
});
export type CurrencyRateInput = z.infer<typeof CurrencyRateInputSchema>;

export interface CurrencyRateRow {
  id: string;
  trip_id: string | null;
  base: string;
  quote: string;
  rate: number;
  fetched_at: string;
  source: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Checklist Item (v5 extended logistics)
// ---------------------------------------------------------------------------

export const ChecklistItemInputSchema = z.object({
  trip_id: z.string().min(1, 'trip_id is required'),
  label: z.string().min(1, 'label is required').max(300),
  category: z.string().max(100).optional(),
  done: z.boolean().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});
export type ChecklistItemInput = z.infer<typeof ChecklistItemInputSchema>;

export const ChecklistItemUpdateSchema = ChecklistItemInputSchema.partial().omit(
  { trip_id: true },
);
export type ChecklistItemUpdate = z.infer<typeof ChecklistItemUpdateSchema>;

export interface ChecklistItemRow {
  id: string;
  trip_id: string;
  label: string;
  category: string | null;
  done: number;
  done_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Packing List / Packing Item (v6 packing)
// ---------------------------------------------------------------------------

export const PackingTemplateKeySchema = z.enum([
  'weekend',
  'beach',
  'ski',
  'business',
  'backpacking',
]);
export type PackingTemplateKey = z.infer<typeof PackingTemplateKeySchema>;

export const PackingListInputSchema = z.object({
  trip_id: z.string().optional(),
  name: z.string().min(1, 'name is required').max(200),
  template: z.boolean().optional(),
});
export type PackingListInput = z.infer<typeof PackingListInputSchema>;

export const PackingListUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  template: z.boolean().optional(),
  trip_id: z.string().nullable().optional(),
});
export type PackingListUpdate = z.infer<typeof PackingListUpdateSchema>;

export interface PackingListRow {
  id: string;
  trip_id: string | null;
  name: string;
  template: number;
  created_at: string;
  updated_at: string;
}

export const PackingItemInputSchema = z.object({
  list_id: z.string().min(1, 'list_id is required'),
  label: z.string().min(1, 'label is required').max(300),
  quantity: z.number().int().positive().optional(),
  category: z.string().max(100).optional(),
  packed: z.boolean().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});
export type PackingItemInput = z.infer<typeof PackingItemInputSchema>;

export const PackingItemUpdateSchema = PackingItemInputSchema.partial().omit({
  list_id: true,
});
export type PackingItemUpdate = z.infer<typeof PackingItemUpdateSchema>;

export interface PackingItemRow {
  id: string;
  list_id: string;
  label: string;
  quantity: number;
  category: string | null;
  packed: number;
  packed_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Journal Entry / Journal Memory (v7 journal)
// ---------------------------------------------------------------------------

export const JournalMoodSchema = z.number().int().min(1).max(5);
export type JournalMood = z.infer<typeof JournalMoodSchema>;

export const JournalEntryInputSchema = z.object({
  trip_id: z.string().nullable().optional(),
  destination_id: z.string().nullable().optional(),
  day_number: z.number().int().nonnegative().optional(),
  entry_date: z.string().min(1, 'entry_date is required'),
  title: z.string().max(300).optional(),
  body_md: z.string().optional(),
  mood: JournalMoodSchema.optional(),
  weather: z.string().max(100).optional(),
  location_label: z.string().max(200).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type JournalEntryInput = z.infer<typeof JournalEntryInputSchema>;

export const JournalEntryUpdateSchema = z.object({
  trip_id: z.string().nullable().optional(),
  destination_id: z.string().nullable().optional(),
  day_number: z.number().int().nonnegative().nullable().optional(),
  entry_date: z.string().min(1).optional(),
  title: z.string().max(300).nullable().optional(),
  body_md: z.string().optional(),
  mood: JournalMoodSchema.nullable().optional(),
  weather: z.string().max(100).nullable().optional(),
  location_label: z.string().max(200).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
});
export type JournalEntryUpdate = z.infer<typeof JournalEntryUpdateSchema>;

export interface JournalEntryRow {
  id: string;
  trip_id: string | null;
  destination_id: string | null;
  day_number: number | null;
  entry_date: string;
  title: string | null;
  body_md: string;
  mood: number | null;
  weather: string | null;
  location_label: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
  updated_at: string;
}

export const JournalMemoryKindSchema = z.enum([
  'photo',
  'quote',
  'souvenir',
  'video',
  'audio',
  'other',
]);
export type JournalMemoryKind = z.infer<typeof JournalMemoryKindSchema>;

export const JournalMemoryInputSchema = z.object({
  entry_id: z.string().min(1, 'entry_id is required'),
  kind: JournalMemoryKindSchema,
  media_ref: z.string().max(500).optional(),
  caption: z.string().max(500).optional(),
  sort_order: z.number().int().nonnegative().optional(),
});
export type JournalMemoryInput = z.infer<typeof JournalMemoryInputSchema>;

export const JournalMemoryUpdateSchema = z.object({
  kind: JournalMemoryKindSchema.optional(),
  media_ref: z.string().max(500).nullable().optional(),
  caption: z.string().max(500).nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});
export type JournalMemoryUpdate = z.infer<typeof JournalMemoryUpdateSchema>;

export interface JournalMemoryRow {
  id: string;
  entry_id: string;
  kind: JournalMemoryKind;
  media_ref: string | null;
  caption: string | null;
  sort_order: number;
  created_at: string;
}
