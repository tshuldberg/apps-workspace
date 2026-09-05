import { z } from 'zod';

// -- Status enum -------------------------------------------------------------
export const DoseStatusSchema = z.enum(['taken', 'skipped', 'late', 'snoozed']);
export type DoseStatus = z.infer<typeof DoseStatusSchema>;

// -- Full record (new dose_logs table) ---------------------------------------
export const DoseLogSchema = z.object({
  id: z.string(),
  medicationId: z.string(),
  scheduledTime: z.string(),
  actualTime: z.string().nullable(),
  status: DoseStatusSchema,
  notes: z.string().nullable(),
  createdAt: z.string(),
});

// -- Legacy dose record (backward compat with md_doses) ----------------------
export const DoseSchema = z.object({
  id: z.string(),
  medicationId: z.string(),
  takenAt: z.string(),
  skipped: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});

// -- Create input ------------------------------------------------------------
export const CreateDoseLogInputSchema = z.object({
  medicationId: z.string().min(1),
  scheduledTime: z.string().min(1),
  actualTime: z.string().optional(),
  status: DoseStatusSchema,
  notes: z.string().optional(),
});

// -- Update input ------------------------------------------------------------
export const UpdateDoseLogInputSchema = z.object({
  actualTime: z.string().optional(),
  status: DoseStatusSchema.optional(),
  notes: z.string().optional(),
});

// -- Inferred types ----------------------------------------------------------
export type DoseLog = z.infer<typeof DoseLogSchema>;
export type Dose = z.infer<typeof DoseSchema>;
export type CreateDoseLogInput = z.infer<typeof CreateDoseLogInputSchema>;
export type UpdateDoseLogInput = z.infer<typeof UpdateDoseLogInputSchema>;
