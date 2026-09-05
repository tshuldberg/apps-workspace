import { z } from 'zod';

// ── Memory input schema ───────────────────────────────────────────

export const MemoryInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description_md: z.string().optional(),
  person_ids: z.array(z.string()).optional(),
  circle_id: z.string().optional(),
  happened_at: z.string().optional(),
  photo_ids: z.array(z.string()).optional(),
  voice_memo_id: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_inside_joke: z.boolean().optional(),
});
export type MemoryInput = z.infer<typeof MemoryInputSchema>;

// ── Memory update schema ──────────────────────────────────────────

export const MemoryUpdateSchema = MemoryInputSchema.partial();
export type MemoryUpdate = z.infer<typeof MemoryUpdateSchema>;

// ── Memory filter ─────────────────────────────────────────────────

export const MemoryFilterSchema = z.object({
  person_id: z.string().optional(),
  circle_id: z.string().optional(),
  is_inside_joke: z.boolean().optional(),
  tag: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});
export type MemoryFilter = z.infer<typeof MemoryFilterSchema>;

// ── Memory row (raw SQLite row, JSON fields as TEXT) ──────────────

export interface MemoryRow {
  id: string;
  person_ids: string; // JSON TEXT
  circle_id: string | null;
  title: string;
  description_md: string | null;
  happened_at: string | null;
  photo_ids: string; // JSON TEXT
  voice_memo_id: string | null;
  tags: string; // JSON TEXT
  is_inside_joke: number; // 0 | 1
  type: string;
  created_at: string;
}

// ── Deserialized memory record ────────────────────────────────────

export interface MemoryRecord {
  id: string;
  person_ids: string[];
  circle_id: string | null;
  title: string;
  description_md: string | null;
  happened_at: string | null;
  photo_ids: string[];
  voice_memo_id: string | null;
  tags: string[];
  is_inside_joke: boolean;
  type: 'memory';
  created_at: string;
}
