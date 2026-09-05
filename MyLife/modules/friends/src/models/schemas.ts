import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────

export const RelationshipType = z.enum([
  'close_friend',
  'friend',
  'acquaintance',
  'family',
  'partner',
  'ex',
  'colleague',
  'mentor',
  'neighbor',
]);
export type RelationshipType = z.infer<typeof RelationshipType>;

export const EnergyTag = z.enum([
  'energizing',
  'neutral',
  'draining',
  'complicated',
]);
export type EnergyTag = z.infer<typeof EnergyTag>;

export const CommunicationPreference = z.enum([
  'text',
  'call',
  'in_person',
  'social_dm',
]);
export type CommunicationPreference = z.infer<typeof CommunicationPreference>;

export const PersonSort = z.enum([
  'name_asc',
  'name_desc',
  'created_at_desc',
  'last_seen_desc',
  'birthday_upcoming',
]);
export type PersonSort = z.infer<typeof PersonSort>;

// ── Person input (create) ──────────────────────────────────────────

export const PersonInputSchema = z.object({
  display_name: z.string().min(1, 'Display name is required'),
  relationship_type: RelationshipType.default('friend'),
  photo_local_uri: z.string().optional(),
  how_met: z.string().optional(),
  where_met: z.string().optional(),
  when_met: z.string().optional(),
  birthday: z.string().optional(),
  anniversary: z.string().optional(),
  city: z.string().optional(),
  contact_info: z.record(z.string(), z.string()).optional(),
  quick_facts: z.record(z.string(), z.string()).optional(),
  interests: z.array(z.string()).optional(),
  communication_preference: CommunicationPreference.optional(),
  energy_tag: EnergyTag.optional(),
  frequency_goal_days: z.number().int().positive().optional(),
  notes_md: z.string().optional(),
});
export type PersonInput = z.infer<typeof PersonInputSchema>;

// ── Person update (partial) ────────────────────────────────────────

export const PersonUpdateSchema = PersonInputSchema.partial();
export type PersonUpdate = z.infer<typeof PersonUpdateSchema>;

// ── Person filter ──────────────────────────────────────────────────

export const PersonFilterSchema = z.object({
  relationship_type: RelationshipType.optional(),
  energy_tag: EnergyTag.optional(),
  city: z.string().optional(),
  is_archived: z.boolean().optional(),
  search: z.string().optional(),
});
export type PersonFilter = z.infer<typeof PersonFilterSchema>;

// ── Person row (raw SQLite row, JSON fields as TEXT) ───────────────

export interface PersonRow {
  id: string;
  display_name: string;
  photo_local_uri: string | null;
  relationship_type: string;
  how_met: string | null;
  where_met: string | null;
  when_met: string | null;
  birthday: string | null;
  anniversary: string | null;
  city: string | null;
  contact_info: string | null;
  quick_facts: string | null;
  interests: string | null;
  communication_preference: string | null;
  energy_tag: string | null;
  frequency_goal_days: number | null;
  is_archived: number;
  notes_md: string | null;
  created_at: string;
  updated_at: string;
}

// ── Person record (deserialized JSON fields) ───────────────────────

export interface PersonRecord {
  id: string;
  display_name: string;
  photo_local_uri: string | null;
  relationship_type: string;
  how_met: string | null;
  where_met: string | null;
  when_met: string | null;
  birthday: string | null;
  anniversary: string | null;
  city: string | null;
  contact_info: Record<string, string> | null;
  quick_facts: Record<string, string> | null;
  interests: string[] | null;
  communication_preference: string | null;
  energy_tag: string | null;
  frequency_goal_days: number | null;
  is_archived: boolean;
  notes_md: string | null;
  created_at: string;
  updated_at: string;
}
