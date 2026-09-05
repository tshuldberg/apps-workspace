import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────

export const GiftDirection = z.enum(['given', 'received']);
export type GiftDirection = z.infer<typeof GiftDirection>;

export const GiftOccasion = z.enum([
  'birthday',
  'holiday',
  'just_because',
  'thank_you',
  'anniversary',
  'graduation',
  'other',
]);
export type GiftOccasion = z.infer<typeof GiftOccasion>;

// ── Gift input schema ─────────────────────────────────────────────

export const GiftInputSchema = z.object({
  person_id: z.string().min(1, 'Person is required'),
  direction: GiftDirection,
  description: z.string().min(1, 'Description is required'),
  occasion: GiftOccasion.optional(),
  amount_cents: z.number().int().nonnegative().optional(),
  date: z.string().optional(),
  reaction_notes: z.string().optional(),
  photo_id: z.string().optional(),
  link_url: z.string().optional(),
});
export type GiftInput = z.infer<typeof GiftInputSchema>;

// ── Gift row (raw SQLite row) ─────────────────────────────────────

export interface GiftRow {
  id: string;
  person_id: string;
  direction: string;
  description: string;
  occasion: string | null;
  amount_cents: number | null;
  date: string | null;
  reaction_notes: string | null;
  photo_id: string | null;
  link_url: string | null;
  created_at: string;
}

// ── Gift record (deserialized) ────────────────────────────────────

export interface GiftRecord {
  id: string;
  person_id: string;
  direction: string;
  description: string;
  occasion: string | null;
  amount_cents: number | null;
  date: string | null;
  reaction_notes: string | null;
  photo_id: string | null;
  link_url: string | null;
  created_at: string;
}

// ── Gift idea input schema ────────────────────────────────────────

export const GiftIdeaInputSchema = z.object({
  person_id: z.string().min(1, 'Person is required'),
  description: z.string().min(1, 'Description is required'),
  estimated_price_cents: z.number().int().nonnegative().optional(),
  priority: z.number().int().min(0).max(5).optional().default(0),
  source_note: z.string().optional(),
  link_url: z.string().optional(),
});
export type GiftIdeaInput = z.input<typeof GiftIdeaInputSchema>;

// ── Gift idea update schema ───────────────────────────────────────

export const GiftIdeaUpdateSchema = GiftIdeaInputSchema.partial().extend({
  is_purchased: z.boolean().optional(),
});
export type GiftIdeaUpdate = z.infer<typeof GiftIdeaUpdateSchema>;

// ── Gift idea row (raw SQLite row) ────────────────────────────────

export interface GiftIdeaRow {
  id: string;
  person_id: string;
  description: string;
  estimated_price_cents: number | null;
  priority: number;
  source_note: string | null;
  link_url: string | null;
  is_purchased: number;
  created_at: string;
  updated_at: string;
}

// ── Gift idea record (deserialized) ───────────────────────────────

export interface GiftIdeaRecord {
  id: string;
  person_id: string;
  description: string;
  estimated_price_cents: number | null;
  priority: number;
  source_note: string | null;
  link_url: string | null;
  is_purchased: boolean;
  created_at: string;
  updated_at: string;
}
