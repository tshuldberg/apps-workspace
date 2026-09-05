import { z } from 'zod';

// -- Insulin type ------------------------------------------------------------
export const InsulinTypeSchema = z.enum([
  'rapid',
  'short',
  'intermediate',
  'long',
  'mixed',
  'ultra_rapid',
]);
export type InsulinType = z.infer<typeof InsulinTypeSchema>;

// -- Dose category -----------------------------------------------------------
export const DoseCategorySchema = z.enum(['basal', 'bolus', 'correction', 'mixed']);
export type DoseCategory = z.infer<typeof DoseCategorySchema>;

// -- Injection site ----------------------------------------------------------
export const InjectionSiteNameSchema = z.enum([
  'abdomen_left',
  'abdomen_right',
  'thigh_left',
  'thigh_right',
  'arm_left',
  'arm_right',
  'buttock_left',
  'buttock_right',
]);
export type InjectionSiteName = z.infer<typeof InjectionSiteNameSchema>;

// -- Full insulin entry record -----------------------------------------------
export const InsulinEntrySchema = z.object({
  id: z.string(),
  medicationId: z.string().nullable(),
  insulinType: InsulinTypeSchema,
  units: z.number().positive(),
  doseCategory: DoseCategorySchema,
  injectionSite: InjectionSiteNameSchema.nullable(),
  carbsCovered: z.number().int().nonnegative().nullable(),
  bloodGlucoseBefore: z.number().positive().nullable(),
  notes: z.string().nullable(),
  administeredAt: z.string(),
  createdAt: z.string(),
});
export type InsulinEntry = z.infer<typeof InsulinEntrySchema>;

// -- Create input ------------------------------------------------------------
export const CreateInsulinEntryInputSchema = z.object({
  medicationId: z.string().optional(),
  insulinType: InsulinTypeSchema,
  units: z.number().positive(),
  doseCategory: DoseCategorySchema.optional(),
  injectionSite: InjectionSiteNameSchema.optional(),
  carbsCovered: z.number().int().nonnegative().optional(),
  bloodGlucoseBefore: z.number().positive().optional(),
  notes: z.string().optional(),
  administeredAt: z.string().optional(),
});
export type CreateInsulinEntryInput = z.infer<typeof CreateInsulinEntryInputSchema>;

// -- Injection site record ---------------------------------------------------
export const InjectionSiteSchema = z.object({
  id: z.string(),
  siteName: InjectionSiteNameSchema,
  lastUsedAt: z.string(),
  useCount: z.number().int().positive(),
  createdAt: z.string(),
});
export type InjectionSite = z.infer<typeof InjectionSiteSchema>;

// -- IOB duration by type (in hours) -----------------------------------------
export const IOB_DURATION_HOURS: Record<InsulinType, number> = {
  ultra_rapid: 3,
  rapid: 4,
  short: 6,
  mixed: 8,
  intermediate: 12,
  long: 24,
};

// -- Daily totals result -----------------------------------------------------
export interface DailyInsulinTotals {
  date: string;
  basal: number;
  bolus: number;
  correction: number;
  mixed: number;
  total: number;
}
