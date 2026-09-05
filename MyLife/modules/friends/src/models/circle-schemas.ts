import { z } from 'zod';

// ── Circle input schema ─────────────────────────────────────────────

export const CircleInputSchema = z.object({
  name: z.string().min(1, 'Circle name is required'),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a 6-digit hex string')
    .optional(),
  member_ids: z.array(z.string()).default([]),
});

// ── Circle update schema ────────────────────────────────────────────

export const CircleUpdateSchema = CircleInputSchema.partial();

// ── Circle row (matches fn_circles table) ───────────────────────────

export interface CircleRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  member_ids: string; // JSON TEXT in SQLite
  created_at: string;
  updated_at: string;
}

// ── Deserialized circle (member_ids as string[]) ────────────────────

export interface CircleRecord {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  member_ids: string[];
  created_at: string;
  updated_at: string;
}
