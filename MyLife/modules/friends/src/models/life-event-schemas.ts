import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────

export const LifeEventType = z.enum([
  'move',
  'job',
  'baby',
  'engaged',
  'married',
  'graduated',
  'other',
]);
export type LifeEventType = z.infer<typeof LifeEventType>;

// ── Input schema ───────────────────────────────────────────────────

export const LifeEventInputSchema = z.object({
  person_id: z.string().min(1, 'Person is required'),
  type: LifeEventType,
  description: z.string().optional(),
  happened_at: z.string().optional(),
  notes_md: z.string().optional(),
});
export type LifeEventInput = z.infer<typeof LifeEventInputSchema>;

// ── Row (raw SQLite) ──────────────────────────────────────────────

export interface LifeEventRow {
  id: string;
  person_id: string;
  type: string;
  description: string | null;
  happened_at: string | null;
  acknowledged: number;
  notes_md: string | null;
  created_at: string;
}

// ── Deserialized record ───────────────────────────────────────────

export interface LifeEventRecord {
  id: string;
  person_id: string;
  type: string;
  description: string | null;
  happened_at: string | null;
  acknowledged: boolean;
  notes_md: string | null;
  created_at: string;
}
