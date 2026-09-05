import { z } from 'zod';

export const A1cSourceSchema = z.enum(['estimated', 'lab']);
export type A1cSource = z.infer<typeof A1cSourceSchema>;

export const A1cRecordSchema = z.object({
  id: z.string(),
  value: z.number().min(3.0).max(20.0),
  source: A1cSourceSchema,
  averageGlucose: z.number().nullable(),
  readingCount: z.number().int().nullable(),
  periodDays: z.number().int().nullable(),
  notes: z.string().nullable(),
  recordedAt: z.string(),
  createdAt: z.string(),
});
export type A1cRecord = z.infer<typeof A1cRecordSchema>;

export const CreateA1cRecordInputSchema = z.object({
  value: z.number().min(3.0).max(20.0),
  source: A1cSourceSchema,
  averageGlucose: z.number().optional(),
  readingCount: z.number().int().optional(),
  periodDays: z.number().int().optional(),
  notes: z.string().optional(),
  recordedAt: z.string().optional(),
});
export type CreateA1cRecordInput = z.infer<typeof CreateA1cRecordInputSchema>;

export type A1cConfidence = 'high' | 'medium' | 'low';

export interface A1cInterpretation {
  label: string;
  color: string;
}
