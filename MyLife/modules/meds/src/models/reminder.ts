import { z } from 'zod';

// -- Full record -------------------------------------------------------------
export const MedReminderSchema = z.object({
  id: z.string(),
  medicationId: z.string(),
  time: z.string(), // HH:MM
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
  isActive: z.boolean().default(true),
  snoozeUntil: z.string().nullable(),
  createdAt: z.string(),
});

// -- Create input ------------------------------------------------------------
export const CreateMedReminderInputSchema = z.object({
  medicationId: z.string().min(1),
  time: z.string().min(1), // HH:MM
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  isActive: z.boolean().optional(),
  snoozeUntil: z.string().optional(),
});

// -- Update input ------------------------------------------------------------
export const UpdateMedReminderInputSchema = z.object({
  time: z.string().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  isActive: z.boolean().optional(),
  snoozeUntil: z.string().nullable().optional(),
});

// -- Inferred types ----------------------------------------------------------
export type MedReminder = z.infer<typeof MedReminderSchema>;
export type CreateMedReminderInput = z.infer<typeof CreateMedReminderInputSchema>;
export type UpdateMedReminderInput = z.infer<typeof UpdateMedReminderInputSchema>;
