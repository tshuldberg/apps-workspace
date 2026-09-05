import { z } from 'zod';

// -- Symptom definition ------------------------------------------------------
export const SymptomSchema = z.object({
  id: z.string(),
  name: z.string(),
  isCustom: z.boolean(),
  createdAt: z.string(),
});

// -- Create custom symptom input ---------------------------------------------
export const CreateSymptomInputSchema = z.object({
  name: z.string().min(1),
});

// -- Symptom log record ------------------------------------------------------
export const SymptomLogSchema = z.object({
  id: z.string(),
  symptomId: z.string(),
  severity: z.number().int().min(1).max(5),
  notes: z.string().nullable(),
  loggedAt: z.string(),
  createdAt: z.string(),
});

// -- Create symptom log input ------------------------------------------------
export const CreateSymptomLogInputSchema = z.object({
  symptomId: z.string().min(1),
  severity: z.number().int().min(1).max(5),
  notes: z.string().optional(),
  loggedAt: z.string().optional(),
});

// -- Predefined symptoms list ------------------------------------------------
export const PREDEFINED_SYMPTOMS = [
  'headache',
  'nausea',
  'fatigue',
  'insomnia',
  'dizziness',
  'anxiety',
  'appetite_change',
  'dry_mouth',
  'stomach_pain',
  'joint_pain',
  'brain_fog',
  'muscle_ache',
] as const;

// -- Inferred types ----------------------------------------------------------
export type Symptom = z.infer<typeof SymptomSchema>;
export type CreateSymptomInput = z.infer<typeof CreateSymptomInputSchema>;
export type SymptomLog = z.infer<typeof SymptomLogSchema>;
export type CreateSymptomLogInput = z.infer<typeof CreateSymptomLogInputSchema>;
