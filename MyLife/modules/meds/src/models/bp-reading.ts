import { z } from 'zod';

// -- BP category (AHA classification) ----------------------------------------
export const BPCategorySchema = z.enum([
  'normal',
  'elevated',
  'hypertension_1',
  'hypertension_2',
  'crisis',
]);
export type BPCategory = z.infer<typeof BPCategorySchema>;

// -- Arm and position enums --------------------------------------------------
export const BPArmSchema = z.enum(['left', 'right']);
export type BPArm = z.infer<typeof BPArmSchema>;

export const BPPositionSchema = z.enum(['sitting', 'standing', 'lying']);
export type BPPosition = z.infer<typeof BPPositionSchema>;

export const BPContextSchema = z.enum([
  'morning',
  'evening',
  'after_exercise',
  'after_medication',
  'routine',
]);
export type BPContext = z.infer<typeof BPContextSchema>;

// -- Full record -------------------------------------------------------------
export const BPReadingSchema = z.object({
  id: z.string(),
  systolic: z.number().int().positive().max(300),
  diastolic: z.number().int().positive().max(200),
  pulse: z.number().int().positive().max(300).nullable(),
  arm: BPArmSchema.nullable(),
  position: BPPositionSchema.nullable(),
  context: BPContextSchema.nullable(),
  category: BPCategorySchema,
  notes: z.string().nullable(),
  measuredAt: z.string(),
  createdAt: z.string(),
});
export type BPReading = z.infer<typeof BPReadingSchema>;

// -- Create input ------------------------------------------------------------
export const CreateBPReadingInputSchema = z.object({
  systolic: z.number().int().positive().max(300),
  diastolic: z.number().int().positive().max(200),
  pulse: z.number().int().positive().max(300).optional(),
  arm: BPArmSchema.optional(),
  position: BPPositionSchema.optional(),
  context: BPContextSchema.optional(),
  notes: z.string().optional(),
  measuredAt: z.string().optional(),
});
export type CreateBPReadingInput = z.infer<typeof CreateBPReadingInputSchema>;

// -- Update input ------------------------------------------------------------
export const UpdateBPReadingInputSchema = z.object({
  systolic: z.number().int().positive().max(300).optional(),
  diastolic: z.number().int().positive().max(200).optional(),
  pulse: z.number().int().positive().max(300).optional().nullable(),
  arm: BPArmSchema.optional().nullable(),
  position: BPPositionSchema.optional().nullable(),
  context: BPContextSchema.optional().nullable(),
  notes: z.string().optional().nullable(),
  measuredAt: z.string().optional(),
});
export type UpdateBPReadingInput = z.infer<typeof UpdateBPReadingInputSchema>;

// -- Averages result ---------------------------------------------------------
export interface BPAverages {
  systolic: number;
  diastolic: number;
  pulse: number | null;
  count: number;
}

// -- Category distribution ---------------------------------------------------
export type BPCategoryDistribution = Record<BPCategory, number>;
