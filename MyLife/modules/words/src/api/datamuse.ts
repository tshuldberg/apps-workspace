import { z } from 'zod';

const BASE_URL = process.env.MYWORDS_DATAMUSE_BASE_URL?.trim() || 'https://api.datamuse.com';
const TIMEOUT_MS = 6000;
const MAX_PREFIX_RESULTS = 1000;

const DatamuseWordSchema = z.object({
  word: z.string().min(1),
});

const DatamuseScoredWordSchema = DatamuseWordSchema.extend({
  score: z.number().optional(),
});

export interface DatamuseContextCandidate {
  word: string;
  score: number;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

async function fetchWords(url: string): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Datamuse request returned ${response.status}.`);
    }
    const parsed = z.array(DatamuseWordSchema).parse(await response.json());
    return dedupe(parsed.map((item) => item.word));
  } finally {
    clearTimeout(timer);
  }
}

async function fetchScoredWords(url: string): Promise<DatamuseContextCandidate[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Datamuse request returned ${response.status}.`);
    }
    const parsed = z.array(DatamuseScoredWordSchema).parse(await response.json());
    const bestByWord = new Map<string, DatamuseContextCandidate>();
    for (const item of parsed) {
      const normalized = item.word.trim();
      if (!normalized) continue;
      const key = normalized.toLocaleLowerCase();
      const score = typeof item.score === 'number' ? item.score : 0;
      const previous = bestByWord.get(key);
      if (!previous || score > previous.score) {
        bestByWord.set(key, { word: normalized, score });
      }
    }
    return Array.from(bestByWord.values()).sort((a, b) => b.score - a.score);
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRelation(word: string, relation: 'rel_syn' | 'rel_ant' | 'rel_rhy'): Promise<string[]> {
  return fetchWords(`${BASE_URL}/words?${relation}=${encodeURIComponent(word)}&max=32`);
}

export async function fetchWordsByPrefixFromDatamuse(prefix: string): Promise<string[]> {
  const normalizedPrefix = prefix.trim().toLocaleLowerCase();
  if (!normalizedPrefix) return [];

  const words = await fetchWords(
    `${BASE_URL}/words?sp=${encodeURIComponent(`${normalizedPrefix}*`)}&max=${MAX_PREFIX_RESULTS}`,
  );

  return words
    .filter((word) => word.toLocaleLowerCase().startsWith(normalizedPrefix))
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

export async function fetchEnglishThesaurusFromDatamuse(word: string): Promise<{ synonyms: string[]; antonyms: string[] }> {
  const term = word.trim();
  if (!term) return { synonyms: [], antonyms: [] };
  const [synonyms, antonyms] = await Promise.all([
    fetchRelation(term, 'rel_syn'),
    fetchRelation(term, 'rel_ant'),
  ]);
  return { synonyms, antonyms };
}

export async function fetchEnglishRhymesFromDatamuse(word: string): Promise<string[]> {
  const term = word.trim();
  if (!term) return [];
  return fetchRelation(term, 'rel_rhy');
}

export async function fetchEnglishContextualMeaningFromDatamuse(input: {
  word: string;
  leftContext?: string;
  rightContext?: string;
  max?: number;
}): Promise<DatamuseContextCandidate[]> {
  const term = input.word.trim();
  if (!term) return [];

  const params = new URLSearchParams();
  params.set('ml', term);
  params.set('max', String(Math.max(8, Math.min(input.max ?? 96, 256))));
  if (input.leftContext?.trim()) params.set('lc', input.leftContext.trim());
  if (input.rightContext?.trim()) params.set('rc', input.rightContext.trim());

  return fetchScoredWords(`${BASE_URL}/words?${params.toString()}`);
}
