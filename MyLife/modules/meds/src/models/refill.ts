import { z } from 'zod';

// -- Full record -------------------------------------------------------------
export const RefillSchema = z.object({
  id: z.string(),
  medicationId: z.string(),
  quantity: z.number().int().positive(),
  refillDate: z.string(),
  pharmacy: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});

// -- Create input ------------------------------------------------------------
export const CreateRefillInputSchema = z.object({
  medicationId: z.string().min(1),
  quantity: z.number().int().positive(),
  refillDate: z.string().optional(),
  pharmacy: z.string().optional(),
  notes: z.string().optional(),
});

// -- Inferred types ----------------------------------------------------------
export type Refill = z.infer<typeof RefillSchema>;
export type CreateRefillInput = z.infer<typeof CreateRefillInputSchema>;
