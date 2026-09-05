import { z } from 'zod';
import { SleepWakeFeelingSchema } from '../types';

function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function isValidDateTime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function isFutureDate(value: string): boolean {
  return value > new Date().toISOString().slice(0, 10);
}

function isFutureDateTime(value: string): boolean {
  return Date.parse(value) > Date.now();
}

export const SleepDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine(isValidDate, 'Invalid date')
  .refine((value) => !isFutureDate(value), 'Date cannot be in the future');

export const SleepDateTimeSchema = z
  .string()
  .refine(isValidDateTime, 'Invalid datetime string');

export const SleepPastOrPresentDateTimeSchema = SleepDateTimeSchema.refine(
  (value) => !isFutureDateTime(value),
  'Datetime cannot be in the future',
);

export const SleepEntrySchema = z.object({
  id: z.string().min(1),
  date: SleepDateSchema,
  bedtime: SleepDateTimeSchema,
  sleep_onset_time: SleepDateTimeSchema.nullable(),
  wake_time: SleepDateTimeSchema,
  duration_minutes: z.number().int().positive(),
  quality_rating: z.number().int().min(1).max(5),
  wake_count: z.number().int().nonnegative(),
  sleep_latency_minutes: z.number().int().nonnegative().nullable(),
  alarm_time: SleepDateTimeSchema.nullable(),
  snooze_count: z.number().int().nonnegative(),
  wake_feeling: SleepWakeFeelingSchema,
  notes_md: z.string().nullable(),
  created_at: SleepDateTimeSchema,
  updated_at: SleepDateTimeSchema,
});

export type SleepEntry = z.infer<typeof SleepEntrySchema>;

export const SleepEntryCreateSchema = z.object({
  bedtime: SleepPastOrPresentDateTimeSchema,
  sleep_onset_time: SleepPastOrPresentDateTimeSchema.optional(),
  wake_time: SleepPastOrPresentDateTimeSchema,
  quality_rating: z.number().int().min(1).max(5),
  wake_count: z.number().int().nonnegative().default(0),
  sleep_latency_minutes: z.number().int().nonnegative().optional(),
  alarm_time: SleepPastOrPresentDateTimeSchema.optional(),
  snooze_count: z.number().int().nonnegative().default(0),
  wake_feeling: SleepWakeFeelingSchema,
  notes_md: z.string().max(10_000).optional(),
});

export type SleepEntryCreateInput = z.input<typeof SleepEntryCreateSchema>;

export const SleepEntryUpdateSchema = SleepEntryCreateSchema.partial();

export type SleepEntryUpdateInput = z.input<typeof SleepEntryUpdateSchema>;

export const SleepEntryListOptionsSchema = z
  .object({
    startDate: SleepDateSchema.optional(),
    endDate: SleepDateSchema.optional(),
    limit: z.number().int().positive().max(500).optional(),
    offset: z.number().int().nonnegative().optional(),
  })
  .refine(
    (value) =>
      !value.startDate ||
      !value.endDate ||
      value.startDate <= value.endDate,
    'startDate must be on or before endDate',
  );

export type SleepEntryListOptions = z.infer<typeof SleepEntryListOptionsSchema>;

export const NapSchema = z.object({
  id: z.string().min(1),
  date: SleepDateSchema,
  start_time: SleepDateTimeSchema,
  duration_minutes: z.number().int().positive(),
  intentional: z.boolean(),
  quality: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  created_at: SleepDateTimeSchema,
});

export type Nap = z.infer<typeof NapSchema>;

export const NapCreateSchema = z
  .object({
    date: SleepDateSchema,
    start_time: SleepPastOrPresentDateTimeSchema,
    duration_minutes: z.number().int().positive(),
    intentional: z.boolean().default(true),
    quality: z.number().int().min(1).max(5).optional(),
    notes: z.string().max(5_000).optional(),
  })
  .refine(
    (value) => value.start_time.slice(0, 10) === value.date,
    'Nap date must match the start_time date',
  );

export type NapCreateInput = z.input<typeof NapCreateSchema>;

export const NapListOptionsSchema = z
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

export type NapListOptions = z.infer<typeof NapListOptionsSchema>;
