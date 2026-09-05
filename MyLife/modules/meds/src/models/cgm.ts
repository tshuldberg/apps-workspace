import { z } from 'zod';

export const CGMSourceSchema = z.enum(['healthkit', 'manual', 'import']);
export type CGMSource = z.infer<typeof CGMSourceSchema>;

export const CGMReadingSchema = z.object({
  id: z.string(),
  value: z.number().positive(),
  unit: z.enum(['mg/dL', 'mmol/L']),
  rangeStatus: z.enum(['very_low', 'low', 'in_range', 'high', 'very_high']),
  source: CGMSourceSchema,
  deviceName: z.string().nullable(),
  measuredAt: z.string(),
  createdAt: z.string(),
});
export type CGMReading = z.infer<typeof CGMReadingSchema>;

export const CreateCGMReadingInputSchema = z.object({
  value: z.number().positive().max(600),
  unit: z.enum(['mg/dL', 'mmol/L']).optional(),
  source: CGMSourceSchema.optional(),
  deviceName: z.string().optional(),
  measuredAt: z.string(),
});
export type CreateCGMReadingInput = z.infer<typeof CreateCGMReadingInputSchema>;

export const CGMSyncStateSchema = z.object({
  id: z.string(),
  lastSyncAt: z.string(),
  lastAnchor: z.string().nullable(),
  readingsSynced: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CGMSyncState = z.infer<typeof CGMSyncStateSchema>;

export type TrendArrow = 'rising_fast' | 'rising' | 'rising_slow' | 'flat' | 'falling_slow' | 'falling' | 'falling_fast';

export interface AGPBin {
  timeMinutes: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface CGMStats {
  averageGlucose: number;
  gmi: number;
  cv: number;
  sd: number;
  timeInRange: number;
  timeBelowRange: number;
  timeAboveRange: number;
  readingCount: number;
}
