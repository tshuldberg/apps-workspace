import type { DatabaseAdapter } from '@mylife/db';
import { z } from 'zod';
import { SleepDateSchema } from '../models/schemas';
import {
  DreamTypeSchema,
  rowToDream,
  type Dream,
} from '../models/dream-schemas';
import { listDreams } from '../db/crud/dreams';

const DreamSearchDateRangeSchema = z
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

export const DreamSearchOptionsSchema = z.object({
  type: DreamTypeSchema.optional(),
  dateRange: DreamSearchDateRangeSchema.optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type DreamSearchOptions = z.infer<typeof DreamSearchOptionsSchema>;

export interface DreamSearchIndexEntry {
  content_md: string;
  themes: string;
  people: string;
  searchable_text: string;
}

export function indexDream(
  dream: Pick<Dream, 'content_md' | 'themes' | 'people'>,
): DreamSearchIndexEntry {
  const content_md = dream.content_md.trim();
  const themes = dream.themes.join(' ');
  const people = dream.people.join(' ');

  return {
    content_md,
    themes,
    people,
    searchable_text: [content_md, themes, people]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase(),
  };
}

function escapeDreamFtsQuery(input: string): string {
  if (!input.trim()) {
    return '';
  }

  const cleaned = input.replace(/[()]/g, '');
  const parts: string[] = [];
  const phrasePattern = /"([^"]+)"/g;
  let phraseMatch: RegExpExecArray | null;

  while ((phraseMatch = phrasePattern.exec(cleaned)) !== null) {
    const phrase = phraseMatch[1].trim();
    if (phrase) {
      parts.push(`"${phrase.replace(/"/g, '')}"`);
    }
  }

  const remaining = cleaned.replace(phrasePattern, '').trim();
  if (remaining) {
    for (const token of remaining.split(/\s+/).filter(Boolean)) {
      const next = token.replace(/['"*]/g, '');
      if (next) {
        parts.push(`"${next}"*`);
      }
    }
  }

  return parts.join(' ');
}

function matchesFallbackQuery(dream: Dream, query: string): boolean {
  const haystack = indexDream(dream).searchable_text;
  const tokens = query
    .toLocaleLowerCase()
    .trim()
    .replace(/"/g, '')
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) {
    return false;
  }

  return tokens.every((token) => haystack.includes(token));
}

function searchDreamsWithoutFts(
  db: DatabaseAdapter,
  query: string,
  options: DreamSearchOptions,
): Dream[] {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const candidates = listDreams(db, {
    startDate: options.dateRange?.startDate,
    endDate: options.dateRange?.endDate,
    type: options.type,
    limit: Math.max(limit + offset + 100, 250),
    offset: 0,
  });

  return candidates
    .filter((dream) => matchesFallbackQuery(dream, query))
    .slice(offset, offset + limit);
}

export function searchDreams(
  db: DatabaseAdapter,
  query: string,
  rawOptions?: DreamSearchOptions,
): Dream[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const options = DreamSearchOptionsSchema.parse(rawOptions ?? {});
  const escapedQuery = escapeDreamFtsQuery(trimmedQuery);
  if (!escapedQuery) {
    return [];
  }

  const where: string[] = ['f.sl_dreams_fts MATCH ?'];
  const params: unknown[] = [escapedQuery];

  if (options.type) {
    where.push('d.type = ?');
    params.push(options.type);
  }
  if (options.dateRange?.startDate) {
    where.push('d.date >= ?');
    params.push(options.dateRange.startDate);
  }
  if (options.dateRange?.endDate) {
    where.push('d.date <= ?');
    params.push(options.dateRange.endDate);
  }

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  try {
    const rows = db.query<Record<string, unknown>>(
      `SELECT d.*
       FROM sl_dreams d
       JOIN sl_dreams_fts f ON d.rowid = f.rowid
       WHERE ${where.join(' AND ')}
       ORDER BY bm25(sl_dreams_fts), d.date DESC, d.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    return rows.map(rowToDream);
  } catch {
    return searchDreamsWithoutFts(db, trimmedQuery, options);
  }
}
