import { z } from 'zod';
import {
  SleepDateSchema,
  SleepDateTimeSchema,
} from './schemas';

export const SLEEP_HYGIENE_PRACTICE_IDS = [
  'no_caffeine_after_2pm',
  'no_screens_1h',
  'consistent_bedtime_30m',
  'cool_dark_room',
  'no_alcohol_3h',
  'exercise_timing',
  'relaxation_routine',
  'no_heavy_meals_2h',
] as const;

export const SleepHygienePracticeIdSchema = z.enum(
  SLEEP_HYGIENE_PRACTICE_IDS,
);

export const SleepHygieneCheckSourceSchema = z.enum(['manual', 'auto']);

export const SleepHygieneCheckSchema = z.object({
  id: z.string().min(1),
  date: SleepDateSchema,
  practice_id: SleepHygienePracticeIdSchema,
  met: z.boolean(),
  source: SleepHygieneCheckSourceSchema,
  notes: z.string().nullable(),
  created_at: SleepDateTimeSchema,
  updated_at: SleepDateTimeSchema,
});

export type SleepHygienePracticeId = z.infer<
  typeof SleepHygienePracticeIdSchema
>;

export type SleepHygieneCheckSource = z.infer<
  typeof SleepHygieneCheckSourceSchema
>;

export type SleepHygieneCheck = z.infer<typeof SleepHygieneCheckSchema>;

export const SleepHygieneCheckCreateSchema = z.object({
  date: SleepDateSchema,
  practice_id: SleepHygienePracticeIdSchema,
  met: z.boolean(),
  source: SleepHygieneCheckSourceSchema.default('manual'),
  notes: z.string().max(2_000).nullable().optional(),
});

export type SleepHygieneCheckCreateInput = z.input<
  typeof SleepHygieneCheckCreateSchema
>;

export const SleepHygieneCheckListOptionsSchema = z
  .object({
    date: SleepDateSchema.optional(),
    startDate: SleepDateSchema.optional(),
    endDate: SleepDateSchema.optional(),
  })
  .refine(
    (value) =>
      !value.startDate ||
      !value.endDate ||
      value.startDate <= value.endDate,
    'startDate must be on or before endDate',
  );

export type SleepHygieneCheckListOptions = z.infer<
  typeof SleepHygieneCheckListOptionsSchema
>;

export function rowToSleepHygieneCheck(
  row: Record<string, unknown>,
): SleepHygieneCheck {
  return SleepHygieneCheckSchema.parse({
    id: row.id,
    date: row.date,
    practice_id: row.practice_id,
    met: (row.met as number) === 1,
    source: row.source ?? 'manual',
    notes: row.notes ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}
