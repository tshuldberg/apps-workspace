import { z } from 'zod';
import {
  SleepDateSchema,
  SleepDateTimeSchema,
} from './schemas';

export const DREAM_THEME_TAXONOMY = [
  'flying',
  'falling',
  'water',
  'school',
  'work',
  'family',
  'chase',
  'lost',
  'death',
  'animals',
  'travel',
  'house',
  'car',
  'food',
  'nature',
  'supernatural',
  'technology',
  'music',
  'sports',
  'childhood',
] as const;

const DreamListItemSchema = z.string().trim().min(1).max(120);
const DreamContentSchema = z.string().trim().min(1).max(50_000);

export const DreamTypeSchema = z.enum([
  'normal',
  'vivid',
  'nightmare',
  'lucid',
  'recurring',
]);

export type DreamType = z.infer<typeof DreamTypeSchema>;

export function normalizeDreamListItem(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeDreamStringList(
  values: readonly string[] | null | undefined,
  transform?: (value: string) => string,
): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const next = transform
      ? transform(normalizeDreamListItem(value))
      : normalizeDreamListItem(value);

    if (!next) {
      continue;
    }

    const key = next.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(next);
  }

  return normalized;
}

export function normalizeDreamThemes(
  values: readonly string[] | null | undefined,
): string[] {
  return normalizeDreamStringList(
    values,
    (value) => value.toLocaleLowerCase(),
  );
}

export function normalizeDreamPeople(
  values: readonly string[] | null | undefined,
): string[] {
  return normalizeDreamStringList(values);
}

export function normalizeDreamEmotions(
  values: readonly string[] | null | undefined,
): string[] {
  return normalizeDreamStringList(
    values,
    (value) => value.toLocaleLowerCase(),
  );
}

export function stringifyDreamStringArray(
  values: readonly string[] | null | undefined,
): string {
  return JSON.stringify(values ?? []);
}

function parseDreamJsonArray(
  raw: unknown,
  transform?: (value: string) => string,
): string[] {
  if (Array.isArray(raw)) {
    return normalizeDreamStringList(
      raw.filter((value): value is string => typeof value === 'string'),
      transform,
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

    return normalizeDreamStringList(
      parsed.filter((value): value is string => typeof value === 'string'),
      transform,
    );
  } catch {
    return [];
  }
}

export const DreamSchema = z.object({
  id: z.string().min(1),
  sleep_entry_id: z.string().min(1).nullable(),
  date: SleepDateSchema,
  content_md: DreamContentSchema,
  type: DreamTypeSchema,
  themes: z.array(DreamListItemSchema).max(50),
  people: z.array(DreamListItemSchema).max(50),
  emotions: z.array(DreamListItemSchema).max(50),
  is_lucid: z.boolean(),
  is_recurring: z.boolean(),
  recurring_group_id: z.string().min(1).nullable(),
  sketch_photo_id: z.string().min(1).nullable(),
  created_at: SleepDateTimeSchema,
});

export type Dream = z.infer<typeof DreamSchema>;

export const DreamCreateSchema = z.object({
  sleep_entry_id: z.string().min(1).optional(),
  date: SleepDateSchema,
  content_md: DreamContentSchema,
  type: DreamTypeSchema.default('normal'),
  themes: z.array(DreamListItemSchema).max(50).default([]),
  people: z.array(DreamListItemSchema).max(50).default([]),
  emotions: z.array(DreamListItemSchema).max(50).default([]),
  is_lucid: z.boolean().default(false),
  is_recurring: z.boolean().default(false),
  recurring_group_id: z.string().min(1).optional(),
});

export type DreamCreateInput = z.input<typeof DreamCreateSchema>;

export const DreamUpdateSchema = DreamCreateSchema.partial();

export type DreamUpdateInput = z.input<typeof DreamUpdateSchema>;

export const DreamListOptionsSchema = z
  .object({
    startDate: SleepDateSchema.optional(),
    endDate: SleepDateSchema.optional(),
    type: DreamTypeSchema.optional(),
    theme: DreamListItemSchema.optional(),
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

export type DreamListOptions = z.infer<typeof DreamListOptionsSchema>;

export const DreamStatItemSchema = z.object({
  value: z.string().min(1),
  count: z.number().int().nonnegative(),
});

export type DreamStatItem = z.infer<typeof DreamStatItemSchema>;

export const DreamStatsSchema = z.object({
  totalDreams: z.number().int().nonnegative(),
  lucidCount: z.number().int().nonnegative(),
  nightmareCount: z.number().int().nonnegative(),
  recurringCount: z.number().int().nonnegative(),
  topThemes: z.array(DreamStatItemSchema),
  topEmotions: z.array(DreamStatItemSchema),
});

export type DreamStats = z.infer<typeof DreamStatsSchema>;

export function rowToDream(row: Record<string, unknown>): Dream {
  return DreamSchema.parse({
    id: row.id,
    sleep_entry_id: row.sleep_entry_id ?? null,
    date: row.date,
    content_md: row.content_md,
    type: row.type,
    themes: parseDreamJsonArray(
      row.themes,
      (value) => value.toLocaleLowerCase(),
    ),
    people: parseDreamJsonArray(row.people),
    emotions: parseDreamJsonArray(
      row.emotions,
      (value) => value.toLocaleLowerCase(),
    ),
    is_lucid: Number(row.is_lucid) === 1,
    is_recurring: Number(row.is_recurring) === 1,
    recurring_group_id: row.recurring_group_id ?? null,
    sketch_photo_id: row.sketch_photo_id ?? null,
    created_at: row.created_at,
  });
}
