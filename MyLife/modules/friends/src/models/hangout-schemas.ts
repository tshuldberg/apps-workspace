import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────

export const ActivityTag = z.enum([
  'coffee',
  'dinner',
  'lunch',
  'drinks',
  'hike',
  'movie',
  'gaming',
  'party',
  'study',
  'work',
  'gym',
  'shopping',
  'concert',
  'travel',
  'random',
]);
export type ActivityTag = z.infer<typeof ActivityTag>;

export const QualityRating = z.number().int().min(1).max(5);
export type QualityRating = z.infer<typeof QualityRating>;

// ── Hangout input schema ───────────────────────────────────────────

export const HangoutInputSchema = z.object({
  people_ids: z.array(z.string()).min(1, 'At least one person is required'),
  happened_at: z.string().min(1, 'Date is required'),
  duration_minutes: z.number().int().positive().optional(),
  location_name: z.string().optional(),
  location_lat: z.number().optional(),
  location_lng: z.number().optional(),
  activity_tags: z.array(ActivityTag).default([]),
  quality_rating: QualityRating.optional(),
  notes_md: z.string().optional(),
  photo_ids: z.array(z.string()).default([]),
  group_id: z.string().optional(),
  linked_dining_visit_id: z.string().optional(),
  linked_concert_id: z.string().optional(),
  linked_trail_id: z.string().optional(),
});
export type HangoutInput = z.infer<typeof HangoutInputSchema>;

// ── Hangout update schema ──────────────────────────────────────────

export const HangoutUpdateSchema = HangoutInputSchema.partial();
export type HangoutUpdate = z.infer<typeof HangoutUpdateSchema>;

// ── Hangout filter ─────────────────────────────────────────────────

export const HangoutFilterSchema = z.object({
  person_id: z.string().optional(),
  activity_tag: ActivityTag.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  quality_rating_min: z.number().int().min(1).max(5).optional(),
});
export type HangoutFilter = z.infer<typeof HangoutFilterSchema>;

// ── Hangout row (raw SQLite row, JSON fields as TEXT) ──────────────

export interface HangoutRow {
  id: string;
  people_ids: string; // JSON TEXT
  happened_at: string;
  duration_minutes: number | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  activity_tags: string; // JSON TEXT
  quality_rating: number | null;
  notes_md: string | null;
  photo_ids: string; // JSON TEXT
  group_id: string | null;
  linked_dining_visit_id: string | null;
  linked_concert_id: string | null;
  linked_trail_id: string | null;
  created_at: string;
}

// ── Deserialized hangout record ────────────────────────────────────

export interface HangoutRecord {
  id: string;
  people_ids: string[];
  happened_at: string;
  duration_minutes: number | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  activity_tags: string[];
  quality_rating: number | null;
  notes_md: string | null;
  photo_ids: string[];
  group_id: string | null;
  linked_dining_visit_id: string | null;
  linked_concert_id: string | null;
  linked_trail_id: string | null;
  created_at: string;
}
