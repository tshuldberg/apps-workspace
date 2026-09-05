import { z } from 'zod';

// -- Frequency enum ----------------------------------------------------------
export const MedFrequencySchema = z.enum([
  'daily',
  'twice_daily',
  'weekly',
  'as_needed',
  'custom',
]);
export type MedFrequency = z.infer<typeof MedFrequencySchema>;

// -- Full record -------------------------------------------------------------
export const MedicationSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  dosage: z.string().nullable(),
  unit: z.string().nullable(),
  frequency: MedFrequencySchema,
  instructions: z.string().nullable(),
  prescriber: z.string().nullable(),
  pharmacy: z.string().nullable(),
  refillDate: z.string().nullable(),
  pillCount: z.number().int().nonnegative().nullable(),
  pillsPerDose: z.number().int().positive().default(1),
  timeSlots: z.array(z.string()).default([]),
  endDate: z.string().nullable(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// -- Create input ------------------------------------------------------------
export const CreateMedicationInputSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().optional(),
  unit: z.string().optional(),
  frequency: MedFrequencySchema.optional(),
  instructions: z.string().optional(),
  prescriber: z.string().optional(),
  pharmacy: z.string().optional(),
  refillDate: z.string().optional(),
  pillCount: z.number().int().nonnegative().optional(),
  pillsPerDose: z.number().int().positive().optional(),
  timeSlots: z.array(z.string()).optional(),
  endDate: z.string().optional(),
  sortOrder: z.number().int().optional(),
  notes: z.string().optional(),
});

// -- Update input ------------------------------------------------------------
export const UpdateMedicationInputSchema = CreateMedicationInputSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// -- Inferred types ----------------------------------------------------------
export type Medication = z.infer<typeof MedicationSchema>;
export type CreateMedicationInput = z.infer<typeof CreateMedicationInputSchema>;
export type UpdateMedicationInput = z.infer<typeof UpdateMedicationInputSchema>;
