import { z } from 'zod';

export const AffirmationCategorySchema = z.enum([
  'self_worth', 'resilience', 'growth', 'health',
  'relationships', 'gratitude', 'productivity', 'peace',
]);
export type AffirmationCategory = z.infer<typeof AffirmationCategorySchema>;

export const AffirmationActionSchema = z.enum(['shown', 'affirmed', 'wrote_entry', 'dismissed']);
export type AffirmationAction = z.infer<typeof AffirmationActionSchema>;

export const AffirmationSchema = z.object({
  id: z.string(),
  text: z.string(),
  category: AffirmationCategorySchema,
  isBuiltin: z.boolean(),
  isFavorite: z.boolean(),
  isDismissed: z.boolean(),
  timesShown: z.number().int(),
  timesAffirmed: z.number().int(),
  lastShownDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Affirmation = z.infer<typeof AffirmationSchema>;

export const AffirmationLogSchema = z.object({
  id: z.string(),
  affirmationId: z.string(),
  logDate: z.string(),
  action: AffirmationActionSchema,
  entryId: z.string().nullable(),
  createdAt: z.string(),
});
export type AffirmationLog = z.infer<typeof AffirmationLogSchema>;
