import { z } from 'zod';
import type { MyWordsEntry, MyWordsLanguage, MyWordsLookupResult, MyWordsSense } from '../types';

const BASE_URL = process.env.MYWORDS_FREE_DICTIONARY_BASE_URL?.trim() || 'https://freedictionaryapi.com/api/v1';
const TIMEOUT_MS = 10000;

const LanguageSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  words: z.number().int().nonnegative(),
});

const QuoteSchema = z.object({
  text: z.string().min(1),
  reference: z.string().optional(),
});

type RawSense = {
  definition: string;
  tags?: string[];
  examples?: string[];
  quotes?: z.infer<typeof QuoteSchema>[];
  synonyms?: string[];
  antonyms?: string[];
  subsenses?: RawSense[];
};

const SenseSchema: z.ZodType<RawSense> = z.lazy(() =>
  z.object({
    definition: z.string().min(1),
    tags: z.array(z.string()).optional(),
    examples: z.array(z.string()).optional(),
    quotes: z.array(QuoteSchema).optional(),
    synonyms: z.array(z.string()).optional(),
    antonyms: z.array(z.string()).optional(),
    subsenses: z.array(SenseSchema).optional(),
  }),
);

const PronunciationSchema = z.object({
  text: z.string().min(1),
  type: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
});

const FormSchema = z.object({
  word: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
});

const EntrySchema = z.object({
  language: z.object({ code: z.string().min(1), name: z.string().min(1) }),
  partOfSpeech: z.string().optional().default('unknown'),
  pronunciations: z.array(PronunciationSchema).optional().default([]),
  forms: z.array(FormSchema).optional().default([]),
  senses: z.array(SenseSchema).optional().default([]),
  synonyms: z.array(z.string()).optional().default([]),
  antonyms: z.array(z.string()).optional().default([]),
});

const LookupSchema = z.object({
  word: z.string().min(1),
  entries: z.array(EntrySchema).default([]),
});

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

function dedupeQuotes(quotes: Array<{ text: string; reference?: string }>): Array<{ text: string; reference?: string }> {
  const seen = new Set<string>();
  const out: Array<{ text: string; reference?: string }> = [];
  for (const quote of quotes) {
    const text = quote.text.trim();
    const reference = quote.reference?.trim() ?? '';
    if (!text) continue;
    const key = `${text.toLocaleLowerCase()}::${reference.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(reference ? { text, reference } : { text });
  }
  return out;
}

async function fetchJson(url: string): Promise<{ status: number; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: controller.signal });
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeSense(raw: RawSense): MyWordsSense {
  return {
    definition: raw.definition.trim(),
    tags: dedupe(raw.tags ?? []),
    examples: dedupe(raw.examples ?? []),
    quotes: dedupeQuotes(raw.quotes ?? []),
    synonyms: dedupe(raw.synonyms ?? []),
    antonyms: dedupe(raw.antonyms ?? []),
    subsenses: (raw.subsenses ?? []).map(normalizeSense).filter((sense) => sense.definition.length > 0),
  };
}

function normalizeEntry(raw: z.infer<typeof EntrySchema>): MyWordsEntry {
  return {
    partOfSpeech: raw.partOfSpeech.trim() || 'unknown',
    pronunciations: raw.pronunciations
      .map((item) => ({ text: item.text.trim(), type: item.type.trim(), tags: dedupe(item.tags) }))
      .filter((item) => item.text.length > 0)
      .map((item) => (item.type ? item : { text: item.text, tags: item.tags })),
    forms: raw.forms
      .map((item) => ({ word: item.word.trim(), tags: dedupe(item.tags) }))
      .filter((item) => item.word.length > 0),
    senses: raw.senses.map(normalizeSense),
    synonyms: dedupe(raw.synonyms),
    antonyms: dedupe(raw.antonyms),
  };
}

function flattenSenses(senses: MyWordsSense[]): MyWordsSense[] {
  const out: MyWordsSense[] = [];
  for (const sense of senses) {
    out.push(sense);
    if (sense.subsenses.length > 0) {
      out.push(...flattenSenses(sense.subsenses));
    }
  }
  return out;
}

export async function fetchSupportedLanguagesFromFreeDictionary(): Promise<MyWordsLanguage[]> {
  const { status, data } = await fetchJson(`${BASE_URL}/languages`);
  if (status !== 200) {
    throw new Error(`Free Dictionary API /languages returned ${status}.`);
  }
  const parsed = z.array(LanguageSchema).parse(data);
  return parsed
    .slice()
    .sort((a, b) => b.words - a.words)
    .map((item) => ({ code: item.code, name: item.name, words: item.words }));
}

export async function lookupWordInFreeDictionary(
  languageCode: string,
  word: string,
): Promise<Omit<MyWordsLookupResult, 'providers' | 'attributions' | 'requestedLanguageCode'> | null> {
  const code = languageCode.trim().toLocaleLowerCase();
  const term = word.trim();
  const { status, data } = await fetchJson(
    `${BASE_URL}/entries/${encodeURIComponent(code)}/${encodeURIComponent(term)}?limit=24`,
  );

  if (status === 404) return null;
  if (status !== 200) {
    throw new Error(`Free Dictionary API /entries returned ${status}.`);
  }

  const parsed = LookupSchema.parse(data);
  if (parsed.entries.length === 0) return null;

  const entries = parsed.entries.map(normalizeEntry).filter((entry) => entry.senses.length > 0);
  if (entries.length === 0) return null;
  const allSenses = entries.flatMap((entry) => flattenSenses(entry.senses));

  return {
    word: parsed.word,
    language: parsed.entries[0].language,
    entries,
    synonyms: dedupe([...entries.flatMap((entry) => entry.synonyms), ...allSenses.flatMap((sense) => sense.synonyms)]),
    antonyms: dedupe([...entries.flatMap((entry) => entry.antonyms), ...allSenses.flatMap((sense) => sense.antonyms)]),
  };
}
