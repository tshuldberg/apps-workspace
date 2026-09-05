import { z } from 'zod';

export const FacetAxis = z.enum([
  'category',
  'format',
  'genre',
  'vibe',
  'price',
  'time',
]);
export type FacetAxis = z.infer<typeof FacetAxis>;

// Pin schemas
export const PinInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  category: z.string().nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  neighborhood: z.string().nullish(),
  photoRef: z.string().nullish(),
  isShareable: z.boolean().default(false),
});
export type PinInput = z.input<typeof PinInputSchema>;

export interface PinRow {
  id: string;
  name: string;
  category: string | null;
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
  photo_ref: string | null;
  is_shareable: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// Plan schemas
export const PlanInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  startAt: z.string().min(1),
  endAt: z.string().nullish(),
  eventId: z.string().nullish(),
  pinId: z.string().nullish(),
  reminderMinutes: z.number().int().nullish(),
  hasReservation: z.boolean().default(false),
  partySize: z.number().int().default(1),
  source: z.string().default('manual'),
});
export type PlanInput = z.input<typeof PlanInputSchema>;

export interface PlanRow {
  id: string; title: string; start_at: string; end_at: string | null;
  event_id: string | null; pin_id: string | null; reminder_minutes: number | null;
  calendar_event_id: string | null; has_reservation: number; party_size: number;
  source: string; status: string; created_at: string; updated_at: string; deleted_at: string | null;
}

export const PlanMemberInputSchema = z.object({
  id: z.string().optional(),
  planId: z.string().min(1),
  personRef: z.string().min(1),
  role: z.string().default('guest'),
});
export type PlanMemberInput = z.input<typeof PlanMemberInputSchema>;
export interface PlanMemberRow {
  id: string; plan_id: string; person_ref: string; role: string; created_at: string; updated_at: string;
}

// Facet schemas
export const FacetInputSchema = z.object({
  id: z.string().optional(),
  eventId: z.string().min(1),
  axis: FacetAxis,
  value: z.string().min(1),
});
export type FacetInput = z.input<typeof FacetInputSchema>;

export interface FacetRow {
  id: string;
  event_id: string;
  axis: string;
  value: string;
  created_at: string;
}

// Source schemas
export const SourceInputSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().default(true),
  configJson: z.string().default('{}'),
});
export type SourceInput = z.input<typeof SourceInputSchema>;

export interface SourceRow {
  id: string;
  enabled: number;
  last_synced_at: string | null;
  config_json: string;
  created_at: string;
  updated_at: string;
}

export const EventInputSchema = z.object({
  id: z.string().optional(),
  sourceId: z.string().default('manual'),
  externalId: z.string().nullish(),
  title: z.string().min(1),
  description: z.string().nullish(),
  venueName: z.string().nullish(),
  address: z.string().nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  neighborhood: z.string().nullish(),
  startAt: z.string().nullish(),
  endAt: z.string().nullish(),
  allDay: z.boolean().default(false),
  category: z.string().nullish(),
  purchaseUrl: z.string().nullish(),
  ticketProvider: z.string().nullish(),
  imageUrl: z.string().nullish(),
  priceMin: z.number().nullish(),
  priceMax: z.number().nullish(),
  isFree: z.boolean().default(false),
  saved: z.boolean().default(false),
});
export type EventInput = z.input<typeof EventInputSchema>;

export interface EventRow {
  id: string;
  source_id: string;
  external_id: string | null;
  title: string;
  description: string | null;
  venue_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
  start_at: string | null;
  end_at: string | null;
  all_day: number;
  category: string | null;
  purchase_url: string | null;
  ticket_provider: string | null;
  image_url: string | null;
  price_min: number | null;
  price_max: number | null;
  is_free: number;
  saved: number;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
