import { z } from 'zod';

/** Trip lifecycle status. */
export const TripStatusSchema = z.enum([
  'planning',
  'upcoming',
  'active',
  'completed',
  'cancelled',
]);
export type TripStatus = z.infer<typeof TripStatusSchema>;

/** Trip type classification. */
export const TripTypeSchema = z.enum([
  'vacation',
  'business',
  'family',
  'solo',
  'road_trip',
  'backpacking',
]);
export type TripType = z.infer<typeof TripTypeSchema>;

/** A single trip record (placeholder shape; full CRUD comes in a later phase). */
export const TripSchema = z.object({
  id: z.string(),
  name: z.string(),
  destinationIds: z.array(z.string()).default([]),
  tripType: TripTypeSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: TripStatusSchema.default('planning'),
  companionIds: z.array(z.string()).default([]),
  budgetPlannedCents: z.number().int().nonnegative().optional(),
  budgetActualCents: z.number().int().nonnegative().default(0),
  coverPhotoId: z.string().optional(),
  notesMd: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  templateId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Trip = z.infer<typeof TripSchema>;

/** A destination record (place the user has visited or wants to visit). */
export const DestinationSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string().optional(),
  countryCode: z.string().optional(),
  region: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  firstVisited: z.string().optional(),
  lastVisited: z.string().optional(),
  visitCount: z.number().int().nonnegative().default(0),
  rating: z.number().int().min(1).max(5).optional(),
  bucketList: z.boolean().default(false),
  priority: z.number().int().optional(),
  notesMd: z.string().optional(),
  bestSeason: z.string().optional(),
  photoId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Destination = z.infer<typeof DestinationSchema>;

/** Module-scoped key/value settings row. */
export const TravelSettingSchema = z.object({
  key: z.string(),
  value: z.string().nullable(),
});
export type TravelSetting = z.infer<typeof TravelSettingSchema>;
