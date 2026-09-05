import { z } from 'zod';
import { SleepDateSchema, SleepDateTimeSchema } from './schemas';

const CLOCK_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const SleepGoalTypeSchema = z.enum([
  'duration',
  'bedtime',
  'wake_time',
  'consistency',
]);

export const SleepStreakTypeSchema = z.enum([
  'quality_above_3',
  'on_time_bed',
  'target_hours',
  'no_snooze',
]);

export type SleepGoalType = z.infer<typeof SleepGoalTypeSchema>;
export type SleepStreakType = z.infer<typeof SleepStreakTypeSchema>;

export const SLEEP_STREAK_TYPES: readonly SleepStreakType[] = [
  'quality_above_3',
  'on_time_bed',
  'target_hours',
  'no_snooze',
];

export const SleepGoalSchema = z.object({
  id: z.string().min(1),
  type: SleepGoalTypeSchema,
  target_value: z.string().min(1),
  start_date: SleepDateSchema.nullable(),
  end_date: SleepDateSchema.nullable(),
  is_active: z.boolean(),
  notes: z.string().nullable(),
  created_at: SleepDateTimeSchema,
  updated_at: SleepDateTimeSchema,
});

export type SleepGoal = z.infer<typeof SleepGoalSchema>;

export const SleepGoalCreateSchema = z
  .object({
    type: SleepGoalTypeSchema,
    target_value: z.union([z.string(), z.number()]),
    start_date: SleepDateSchema.optional(),
    end_date: SleepDateSchema.nullable().optional(),
    is_active: z.boolean().default(true),
    notes: z.string().max(5_000).nullable().optional(),
  })
  .refine(
    (value) =>
      !value.start_date ||
      !value.end_date ||
      value.start_date <= value.end_date,
    'start_date must be on or before end_date',
  );

export type SleepGoalCreateInput = z.input<typeof SleepGoalCreateSchema>;
export type SleepGoalCreate = z.output<typeof SleepGoalCreateSchema>;

export const SleepGoalUpdateSchema = z
  .object({
    type: SleepGoalTypeSchema.optional(),
    target_value: z.union([z.string(), z.number()]).optional(),
    start_date: SleepDateSchema.nullable().optional(),
    end_date: SleepDateSchema.nullable().optional(),
    is_active: z.boolean().optional(),
    notes: z.string().max(5_000).nullable().optional(),
  })
  .refine(
    (value) =>
      !value.start_date ||
      !value.end_date ||
      value.start_date <= value.end_date,
    'start_date must be on or before end_date',
  );

export type SleepGoalUpdateInput = z.input<typeof SleepGoalUpdateSchema>;
export type SleepGoalUpdate = z.output<typeof SleepGoalUpdateSchema>;

export const SleepGoalDateRangeSchema = z
  .object({
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

export type SleepGoalDateRange = z.infer<typeof SleepGoalDateRangeSchema>;

export const SleepGoalProgressSchema = z.object({
  goalId: z.string().min(1),
  type: SleepGoalTypeSchema,
  met: z.number().int().nonnegative(),
  missed: z.number().int().nonnegative(),
  streak: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
  totalEvaluated: z.number().int().nonnegative(),
});

export type SleepGoalProgress = z.infer<typeof SleepGoalProgressSchema>;

export const SleepStreakSchema = z.object({
  id: z.string().min(1),
  type: SleepStreakTypeSchema,
  current_count: z.number().int().nonnegative(),
  longest_count: z.number().int().nonnegative(),
  last_date: SleepDateSchema.nullable(),
  created_at: SleepDateTimeSchema,
});

export type SleepStreak = z.infer<typeof SleepStreakSchema>;

export const SleepStreakHistoryPointSchema = z.object({
  id: z.string().min(1),
  type: SleepStreakTypeSchema,
  date: SleepDateSchema,
  met: z.boolean(),
  current_count: z.number().int().nonnegative(),
  longest_count: z.number().int().nonnegative(),
  created_at: SleepDateTimeSchema,
});

export type SleepStreakHistoryPoint = z.infer<
  typeof SleepStreakHistoryPointSchema
>;

function normalizeNotes(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed : null;
}

function normalizeNumericTarget(
  value: string | number,
  label: string,
  min: number,
  max: number,
): string {
  const numeric =
    typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw new Error(`${label} target must be between ${min} and ${max}`);
  }

  return Number.isInteger(numeric)
    ? String(numeric)
    : String(Number(numeric.toFixed(2)));
}

export function normalizeGoalTargetValue(
  type: SleepGoalType,
  value: string | number,
): string {
  if (type === 'duration') {
    return normalizeNumericTarget(value, 'duration', 1, 24);
  }
  if (type === 'consistency') {
    return normalizeNumericTarget(value, 'consistency', 5, 180);
  }

  const text = String(value).trim();
  if (!CLOCK_TIME_RE.test(text)) {
    throw new Error(`${type} target must use HH:MM`);
  }
  return text;
}

export function parseGoalTargetNumber(goal: SleepGoal): number {
  const value = Number(goal.target_value);
  if (!Number.isFinite(value)) {
    throw new Error(`${goal.type} target must be numeric`);
  }
  return value;
}

export function rowToGoal(row: Record<string, unknown>): SleepGoal {
  return SleepGoalSchema.parse({
    id: row.id,
    type: row.type,
    target_value: row.target_value,
    start_date: row.start_date ?? null,
    end_date: row.end_date ?? null,
    is_active: (row.is_active as number) === 1,
    notes: normalizeNotes(row.notes as string | null | undefined),
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

export function rowToStreak(row: Record<string, unknown>): SleepStreak {
  return SleepStreakSchema.parse({
    id: row.id,
    type: row.type,
    current_count: row.current_count ?? 0,
    longest_count: row.longest_count ?? 0,
    last_date: row.last_date ?? null,
    created_at: row.created_at,
  });
}

export function rowToStreakHistoryPoint(
  row: Record<string, unknown>,
): SleepStreakHistoryPoint {
  return SleepStreakHistoryPointSchema.parse({
    id: row.id,
    type: row.type,
    date: row.date,
    met: (row.met as number) === 1,
    current_count: row.current_count ?? 0,
    longest_count: row.longest_count ?? 0,
    created_at: row.created_at,
  });
}

export function normalizeGoalNotes(
  value: string | null | undefined,
): string | null {
  return normalizeNotes(value);
}
