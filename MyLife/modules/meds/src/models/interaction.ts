import { z } from 'zod';

// -- Severity enum -----------------------------------------------------------
export const InteractionSeveritySchema = z.enum(['mild', 'moderate', 'severe']);
export type InteractionSeverity = z.infer<typeof InteractionSeveritySchema>;

// -- Full record -------------------------------------------------------------
export const DrugInteractionSchema = z.object({
  id: z.string(),
  drugA: z.string(),
  drugB: z.string(),
  severity: InteractionSeveritySchema,
  description: z.string(),
  source: z.string(),
});

// -- Create input (for seeding) ----------------------------------------------
export const CreateDrugInteractionInputSchema = z.object({
  drugA: z.string().min(1),
  drugB: z.string().min(1),
  severity: InteractionSeveritySchema,
  description: z.string().min(1),
  source: z.string().optional(),
});

// -- Interaction warning (returned by checker) -------------------------------
export const InteractionWarningSchema = z.object({
  drug: z.string(),
  severity: InteractionSeveritySchema,
  description: z.string(),
});

// -- Inferred types ----------------------------------------------------------
export type DrugInteraction = z.infer<typeof DrugInteractionSchema>;
export type CreateDrugInteractionInput = z.infer<typeof CreateDrugInteractionInputSchema>;
export type InteractionWarning = z.infer<typeof InteractionWarningSchema>;
