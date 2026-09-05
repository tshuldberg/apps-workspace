import { z } from 'zod';
import {
  SleepDateSchema,
  SleepDateTimeSchema,
} from './schemas';

function isValidFactorDate(value: string): boolean {
  return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function isTooFarInFuture(value: string): boolean {
  const tomorrow = new Date();
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return value > tomorrow.toISOString().slice(0, 10);
}

export const PRE_SLEEP_ACTIVITY_TAXONOMY = [
  'screen_time',
  'reading',
  'meditation',
  'exercise',
  'eating',
  'alcohol',
  'caffeine',
  'shower',
  'bath',
  'music',
  'podcast',
  'tv_show',
  'movie',
  'sex',
  'argument',
  'work',
  'study',
  'social_media',
  'gaming',
  'journaling',
] as const;

export const SLEEP_SUPPLEMENT_TAXONOMY = [
  'melatonin',
  'magnesium',
  'valerian',
  'cbd',
  'chamomile',
  'lavender',
  'zinc',
  'l_theanine',
  'gaba',
  'tryptophan',
] as const;

export const FactorRoomTempSchema = z.enum([
  'cold',
  'cool',
  'comfortable',
  'warm',
  'hot',
]);

export const FactorRoomLightSchema = z.enum([
  'dark',
  'dim',
  'moderate',
  'bright',
]);

export const FactorRoomNoiseSchema = z.enum([
  'silent',
  'quiet',
  'moderate',
  'loud',
]);

export const SleepClockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');

export const FactorDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine(isValidFactorDate, 'Invalid date')
  .refine(
    (value) => !isTooFarInFuture(value),
    'Date cannot be more than one day in the future',
  );

export type PreSleepActivity = typeof PRE_SLEEP_ACTIVITY_TAXONOMY[number];
export type SleepSupplement = typeof SLEEP_SUPPLEMENT_TAXONOMY[number];
export type FactorRoomTemp = z.infer<typeof FactorRoomTempSchema>;
export type FactorRoomLight = z.infer<typeof FactorRoomLightSchema>;
export type FactorRoomNoise = z.infer<typeof FactorRoomNoiseSchema>;

const FactorOptionalNotesSchema = z.string().max(5_000);
const FactorRawListItemSchema = z.string().trim().min(1).max(64);

function normalizeSeededTaxonomyValue(value: string): string {
  return value.trim().replace(/[\s-]+/g, '_').toLocaleLowerCase();
}

function normalizeFactorListItem(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function buildSeededOptionArraySchema<T extends readonly [string, ...string[]]>(
  taxonomy: T,
  label: string,
) {
  const allowed = new Set<string>(taxonomy);

  return z
    .array(FactorRawListItemSchema)
    .max(taxonomy.length)
    .transform((values, ctx) => {
      const seen = new Set<string>();
      const normalized: T[number][] = [];

      for (const value of values) {
        const next = normalizeSeededTaxonomyValue(value);
        if (!allowed.has(next)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid ${label}: ${value}`,
          });
          return z.NEVER;
        }
        if (seen.has(next)) {
          continue;
        }

        seen.add(next);
        normalized.push(next as T[number]);
      }

      return normalized;
    });
}

function normalizeSeededOptionArray<T extends string>(
  values: readonly string[] | null | undefined,
  taxonomy: readonly T[],
): T[] {
  if (!values || values.length === 0) {
    return [];
  }

  const allowed = new Set<string>(taxonomy);
  const seen = new Set<string>();
  const normalized: T[] = [];

  for (const value of values) {
    const next = normalizeSeededTaxonomyValue(value);
    if (!next || !allowed.has(next) || seen.has(next)) {
      continue;
    }

    seen.add(next);
    normalized.push(next as T);
  }

  return normalized;
}

function parseFactorJsonArray<T extends string>(
  raw: unknown,
  taxonomy: readonly T[],
): T[] {
  if (Array.isArray(raw)) {
    return normalizeSeededOptionArray(
      raw.filter((value): value is string => typeof value === 'string'),
      taxonomy,
    );
  }

  if (typeof raw !== 'string' || !raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeSeededOptionArray(
      parsed.filter((value): value is string => typeof value === 'string'),
      taxonomy,
    );
  } catch {
    return [];
  }
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = normalizeFactorListItem(value);
  return normalized ? normalized : null;
}

export function clockTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours * 60) + minutes;
}

export function stringifyFactorStringArray(
  values: readonly string[] | null | undefined,
): string {
  return JSON.stringify(values ?? []);
}

export function normalizeFactorActivities(
  values: readonly string[] | null | undefined,
): PreSleepActivity[] {
  return normalizeSeededOptionArray(values, PRE_SLEEP_ACTIVITY_TAXONOMY);
}

export function normalizeFactorSupplements(
  values: readonly string[] | null | undefined,
): SleepSupplement[] {
  return normalizeSeededOptionArray(values, SLEEP_SUPPLEMENT_TAXONOMY);
}

const FactorActivitiesSchema = buildSeededOptionArraySchema(
  PRE_SLEEP_ACTIVITY_TAXONOMY,
  'pre_sleep_activity',
);

const FactorSupplementsSchema = buildSeededOptionArraySchema(
  SLEEP_SUPPLEMENT_TAXONOMY,
  'supplement',
);

export const FactorSchema = z.object({
  id: z.string().min(1),
  sleep_entry_id: z.string().min(1).nullable(),
  date: FactorDateSchema,
  last_caffeine_time: SleepClockTimeSchema.nullable(),
  last_meal_time: SleepClockTimeSchema.nullable(),
  alcohol_drinks: z.number().int().min(0).max(10),
  exercise_today: z.boolean(),
  exercise_time: SleepClockTimeSchema.nullable(),
  screen_cutoff_time: SleepClockTimeSchema.nullable(),
  room_temp: FactorRoomTempSchema.nullable(),
  room_light: FactorRoomLightSchema.nullable(),
  room_noise: FactorRoomNoiseSchema.nullable(),
  supplements: z.array(z.enum(SLEEP_SUPPLEMENT_TAXONOMY)),
  stress_level: z.number().int().min(1).max(5).nullable(),
  pre_sleep_activities: z.array(z.enum(PRE_SLEEP_ACTIVITY_TAXONOMY)),
  notes: z.string().nullable(),
  created_at: SleepDateTimeSchema,
});

export type Factor = z.infer<typeof FactorSchema>;

export const FactorCreateSchema = z
  .object({
    sleep_entry_id: z.string().min(1).optional(),
    date: FactorDateSchema,
    last_caffeine_time: SleepClockTimeSchema.nullable().default(null),
    last_meal_time: SleepClockTimeSchema.nullable().default(null),
    alcohol_drinks: z.number().int().min(0).max(10).default(0),
    exercise_today: z.boolean().default(false),
    exercise_time: SleepClockTimeSchema.nullable().default(null),
    screen_cutoff_time: SleepClockTimeSchema.nullable().default(null),
    room_temp: FactorRoomTempSchema.nullable().default(null),
    room_light: FactorRoomLightSchema.nullable().default(null),
    room_noise: FactorRoomNoiseSchema.nullable().default(null),
    supplements: FactorSupplementsSchema.default([]),
    stress_level: z.number().int().min(1).max(5).nullable().default(null),
    pre_sleep_activities: FactorActivitiesSchema.default([]),
    notes: FactorOptionalNotesSchema.nullable().default(null),
  })
  .refine(
    (value) => value.exercise_today || !value.exercise_time,
    'exercise_time requires exercise_today to be true',
  );

export type FactorCreateInput = z.input<typeof FactorCreateSchema>;

export const FactorUpdateSchema = z.object({
  sleep_entry_id: z.string().min(1).nullable().optional(),
  date: FactorDateSchema.optional(),
  last_caffeine_time: SleepClockTimeSchema.nullable().optional(),
  last_meal_time: SleepClockTimeSchema.nullable().optional(),
  alcohol_drinks: z.number().int().min(0).max(10).optional(),
  exercise_today: z.boolean().optional(),
  exercise_time: SleepClockTimeSchema.nullable().optional(),
  screen_cutoff_time: SleepClockTimeSchema.nullable().optional(),
  room_temp: FactorRoomTempSchema.nullable().optional(),
  room_light: FactorRoomLightSchema.nullable().optional(),
  room_noise: FactorRoomNoiseSchema.nullable().optional(),
  supplements: FactorSupplementsSchema.optional(),
  stress_level: z.number().int().min(1).max(5).nullable().optional(),
  pre_sleep_activities: FactorActivitiesSchema.optional(),
  notes: FactorOptionalNotesSchema.nullable().optional(),
});

export type FactorUpdateInput = z.input<typeof FactorUpdateSchema>;

export const FactorListOptionsSchema = z
  .object({
    startDate: FactorDateSchema.optional(),
    endDate: FactorDateSchema.optional(),
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

export type FactorListOptions = z.infer<typeof FactorListOptionsSchema>;

export const FactorAssociationSummarySchema = z.object({
  value: z.string().min(1),
  count: z.number().int().nonnegative(),
  averageQualityRating: z.number().min(1).max(5).nullable(),
  averageDurationMinutes: z.number().nonnegative().nullable(),
  averageWakeCount: z.number().nonnegative().nullable(),
});

export type FactorAssociationSummary = z.infer<
  typeof FactorAssociationSummarySchema
>;

export const FactorCorrelationMetricSchema = z.enum([
  'alcoholDrinks',
  'stressLevel',
  'exerciseToday',
  'lastCaffeineMinutesBeforeBed',
  'lastMealMinutesBeforeBed',
  'screenCutoffMinutesBeforeBed',
  'exerciseMinutesBeforeBed',
]);

export type FactorCorrelationMetric = z.infer<
  typeof FactorCorrelationMetricSchema
>;

export const FactorMetricCorrelationSchema = z.object({
  metric: FactorCorrelationMetricSchema,
  coefficient: z.number().min(-1).max(1).nullable(),
  sampleSize: z.number().int().nonnegative(),
});

export type FactorMetricCorrelation = z.infer<
  typeof FactorMetricCorrelationSchema
>;

export const FactorCorrelationPointSchema = z.object({
  factorId: z.string().min(1),
  sleepEntryId: z.string().min(1).nullable(),
  date: SleepDateSchema,
  qualityRating: z.number().int().min(1).max(5).nullable(),
  durationMinutes: z.number().int().positive().nullable(),
  wakeCount: z.number().int().nonnegative().nullable(),
  alcoholDrinks: z.number().int().nonnegative(),
  exerciseToday: z.boolean(),
  stressLevel: z.number().int().min(1).max(5).nullable(),
  roomTemp: FactorRoomTempSchema.nullable(),
  roomLight: FactorRoomLightSchema.nullable(),
  roomNoise: FactorRoomNoiseSchema.nullable(),
  supplements: z.array(z.enum(SLEEP_SUPPLEMENT_TAXONOMY)),
  preSleepActivities: z.array(z.enum(PRE_SLEEP_ACTIVITY_TAXONOMY)),
  lastCaffeineMinutesBeforeBed: z.number().int().nonnegative().nullable(),
  lastMealMinutesBeforeBed: z.number().int().nonnegative().nullable(),
  screenCutoffMinutesBeforeBed: z.number().int().nonnegative().nullable(),
  exerciseMinutesBeforeBed: z.number().int().nonnegative().nullable(),
});

export type FactorCorrelationPoint = z.infer<
  typeof FactorCorrelationPointSchema
>;

export const FactorCorrelationsSchema = z.object({
  sampleSize: z.number().int().nonnegative(),
  points: z.array(FactorCorrelationPointSchema),
  activityAssociations: z.array(FactorAssociationSummarySchema),
  supplementAssociations: z.array(FactorAssociationSummarySchema),
  roomTempAssociations: z.array(FactorAssociationSummarySchema),
  roomLightAssociations: z.array(FactorAssociationSummarySchema),
  roomNoiseAssociations: z.array(FactorAssociationSummarySchema),
  numericCorrelations: z.array(FactorMetricCorrelationSchema),
});

export type FactorCorrelations = z.infer<typeof FactorCorrelationsSchema>;

export function rowToFactor(row: Record<string, unknown>): Factor {
  return FactorSchema.parse({
    id: row.id,
    sleep_entry_id: row.sleep_entry_id ?? null,
    date: row.date,
    last_caffeine_time: row.last_caffeine_time ?? null,
    last_meal_time: row.last_meal_time ?? null,
    alcohol_drinks: row.alcohol_drinks ?? 0,
    exercise_today: (row.exercise_today as number) === 1,
    exercise_time: row.exercise_time ?? null,
    screen_cutoff_time: row.screen_cutoff_time ?? null,
    room_temp: row.room_temp ?? null,
    room_light: row.room_light ?? null,
    room_noise: row.room_noise ?? null,
    supplements: parseFactorJsonArray(
      row.supplements,
      SLEEP_SUPPLEMENT_TAXONOMY,
    ),
    stress_level: row.stress_level ?? null,
    pre_sleep_activities: parseFactorJsonArray(
      row.pre_sleep_activities,
      PRE_SLEEP_ACTIVITY_TAXONOMY,
    ),
    notes: normalizeOptionalText(row.notes as string | null | undefined),
    created_at: row.created_at,
  });
}
