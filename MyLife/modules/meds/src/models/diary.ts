import { z } from 'zod';
import { DoseStatusSchema } from './dose-log';

export const DiaryEntrySchema = z.object({
  id: z.string(),
  medicationId: z.string(),
  doseLogId: z.string().nullable(),
  mood: z.string().nullable(),
  painLevel: z.number().int().min(0).max(10).nullable(),
  effectiveness: z.number().int().min(1).max(5),
  sideEffects: z.array(z.string()).default([]),
  notes: z.string().nullable(),
  recordedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateDiaryEntryInputSchema = z.object({
  medicationId: z.string().min(1),
  doseLogId: z.string().optional(),
  mood: z.string().optional(),
  painLevel: z.number().int().min(0).max(10).optional(),
  effectiveness: z.number().int().min(1).max(5).optional(),
  sideEffects: z.array(z.string()).optional(),
  notes: z.string().optional(),
  recordedAt: z.string().optional(),
});

export const UpdateDiaryEntryInputSchema = z.object({
  doseLogId: z.string().nullable().optional(),
  mood: z.string().nullable().optional(),
  painLevel: z.number().int().min(0).max(10).nullable().optional(),
  effectiveness: z.number().int().min(1).max(5).optional(),
  sideEffects: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  recordedAt: z.string().optional(),
});

export const DiaryEntryDetailSchema = DiaryEntrySchema.extend({
  medicationName: z.string(),
  dosage: z.string().nullable(),
  scheduledTime: z.string().nullable(),
  actualTime: z.string().nullable(),
  doseStatus: DoseStatusSchema.nullable(),
});

export const DiaryInsightsSchema = z.object({
  entryCount: z.number().int().nonnegative(),
  missedDoseCount: z.number().int().nonnegative(),
  averageEffectiveness: z.number().nullable(),
  mostCommonSideEffect: z.string().nullable(),
  highestRatedMedication: z
    .object({
      medicationId: z.string(),
      name: z.string(),
      averageEffectiveness: z.number(),
    })
    .nullable(),
  patterns: z.array(z.string()),
});

export type DiaryEntry = z.infer<typeof DiaryEntrySchema>;
export type CreateDiaryEntryInput = z.infer<typeof CreateDiaryEntryInputSchema>;
export type UpdateDiaryEntryInput = z.infer<typeof UpdateDiaryEntryInputSchema>;
export type DiaryEntryDetail = z.infer<typeof DiaryEntryDetailSchema>;
export type DiaryInsights = z.infer<typeof DiaryInsightsSchema>;
