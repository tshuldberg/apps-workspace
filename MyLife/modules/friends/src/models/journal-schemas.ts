import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────

export const JournalType = z.enum(['gratitude', 'conflict', 'growth']);
export type JournalType = z.infer<typeof JournalType>;

// ── Input schema ───────────────────────────────────────────────────

export const JournalEntryInputSchema = z.object({
  person_id: z.string().min(1, 'Person is required'),
  type: JournalType,
  title: z.string().min(1, 'Title is required'),
  description_md: z.string().optional(),
});
export type JournalEntryInput = z.infer<typeof JournalEntryInputSchema>;

// ── Row (raw SQLite) ───────────────────────────────────────────────

export interface JournalEntryRow {
  id: string;
  person_ids: string;
  circle_id: string | null;
  title: string;
  description_md: string | null;
  happened_at: string | null;
  photo_ids: string;
  voice_memo_id: string | null;
  tags: string;
  is_inside_joke: number;
  type: string;
  created_at: string;
}

// ── Record (deserialized) ──────────────────────────────────────────

export interface JournalEntryRecord {
  id: string;
  person_ids: string[];
  type: JournalType;
  title: string;
  description_md: string | null;
  happened_at: string | null;
  created_at: string;
}

// ── Count result ───────────────────────────────────────────────────

export interface JournalCountByType {
  gratitude: number;
  conflict: number;
  growth: number;
}
