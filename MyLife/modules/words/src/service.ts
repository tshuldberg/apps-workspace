import {
  fetchEnglishContextualMeaningFromDatamuse,
  fetchEnglishRhymesFromDatamuse,
  fetchEnglishThesaurusFromDatamuse,
  fetchWordsByPrefixFromDatamuse,
} from './api/datamuse';
import { fetchSupportedLanguagesFromFreeDictionary, lookupWordInFreeDictionary } from './api/free-dictionary';
import { fetchEnglishWordHistoryFromWiktionary } from './api/wiktionary';
import type {
  BrowseAlphabeticalWordsInput,
  LookupWordInput,
  MyWordsAlphabeticalBrowseResult,
  MyWordsAttribution,
  MyWordsEntry,
  MyWordsLanguage,
  MyWordsLookupResult,
  MyWordsProvider,
  MyWordsSense,
  MyWordsWordHelperResult,
  MyWordsWordHelperSuggestion,
  WordHelperInput,
} from './types';

const LANG_CACHE_MS = 24 * 60 * 60 * 1000;
const LOOKUP_CACHE_MS = 5 * 60 * 1000;
const ALPHABETICAL_CACHE_MS = 10 * 60 * 1000;
const WORD_HELPER_CACHE_MS = 5 * 60 * 1000;
const MAX_LOOKUP_CACHE_SIZE = 500;
const MAX_ALPHABETICAL_CACHE_SIZE = 52;
const MAX_WORD_HELPER_CACHE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 60;
const MAX_PAGE_SIZE = 120;
const DEFAULT_WORD_HELPER_SUGGESTIONS = 24;
const MAX_WORD_HELPER_SUGGESTIONS = 64;

const FALLBACK_LANGUAGES: MyWordsLanguage[] = [
  { code: 'en', name: 'English', words: 1343902 },
  { code: 'es', name: 'Spanish', words: 759364 },
  { code: 'fr', name: 'French', words: 386156 },
  { code: 'de', name: 'German', words: 344102 },
  { code: 'pt', name: 'Portuguese', words: 404401 },
  { code: 'it', name: 'Italian', words: 586801 },
  { code: 'ru', name: 'Russian', words: 425090 },
  { code: 'zh', name: 'Chinese', words: 170344 },
  { code: 'ja', name: 'Japanese', words: 57692 },
  { code: 'ar', name: 'Arabic', words: 52015 },
];

const ATTR_FREE_DICTIONARY: MyWordsAttribution = {
  name: 'Free Dictionary API (Wiktionary-backed)',
  url: 'https://freedictionaryapi.com',
  license: 'Wiktionary content under CC BY-SA 4.0.',
};

const ATTR_DATAMUSE: MyWordsAttribution = {
  name: 'Datamuse API',
  url: 'https://www.datamuse.com/api/',
  license: 'Datamuse public API terms.',
};

const ATTR_WIKTIONARY: MyWordsAttribution = {
  name: 'Wiktionary API (MediaWiki)',
  url: 'https://en.wiktionary.org/w/api.php',
  license: 'Wiktionary content under CC BY-SA 4.0.',
};

let languageCache: { expiresAt: number; value: MyWordsLanguage[] } | null = null;
const lookupCache = new Map<string, { expiresAt: number; value: MyWordsLookupResult | null }>();
const alphabeticalCache = new Map<string, { expiresAt: number; value: string[] }>();
const wordHelperCache = new Map<string, { expiresAt: number; value: MyWordsWordHelperResult }>();

function evictIfOverLimit<T>(cache: Map<string, T>, maxSize: number): void {
  if (cache.size <= maxSize) return;
  const iter = cache.keys();
  while (cache.size > maxSize) {
    const next = iter.next();
    if (next.done) break;
    cache.delete(next.value);
  }
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

function ensureProvider(
  result: MyWordsLookupResult,
  provider: MyWordsProvider,
  attribution: MyWordsAttribution,
): void {
  if (!result.providers.includes(provider)) {
    result.providers.push(provider);
  }
  if (!result.attributions.some((item) => item.url === attribution.url && item.name === attribution.name)) {
    result.attributions.push(attribution);
  }
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

function extractChronologyMarkers(entries: MyWordsEntry[], wordHistory: string[]): string[] {
  const candidates: Array<{ score: number; label: string }> = [];
  const texts = [
    ...entries.flatMap((entry) =>
      flattenSenses(entry.senses).flatMap((sense) => [
        sense.definition,
        ...sense.examples,
        ...sense.quotes.map((quote) => quote.reference ?? ''),
      ]),
    ),
    ...wordHistory,
  ];

  for (const text of texts) {
    const centuryMatches = Array.from(text.matchAll(/\bfrom\s+(\d{1,2})(?:st|nd|rd|th)\s*c(?:entury|\.)?/gi));
    for (const match of centuryMatches) {
      const century = Number(match[1]);
      if (!Number.isFinite(century) || century < 1 || century > 30) continue;
      const suffix = century % 10 === 1 && century % 100 !== 11
        ? 'st'
        : century % 10 === 2 && century % 100 !== 12
          ? 'nd'
          : century % 10 === 3 && century % 100 !== 13
            ? 'rd'
            : 'th';
      candidates.push({ score: century * 100, label: `${century}${suffix} century` });
    }

    const yearMatches = Array.from(text.matchAll(/\b(\d{4})\b/g));
    for (const match of yearMatches) {
      const year = Number(match[1]);
      if (!Number.isFinite(year) || year < 500 || year > 2500) continue;
      candidates.push({ score: year, label: String(year) });
    }
  }

  if (candidates.length === 0) return [];
  candidates.sort((a, b) => a.score - b.score);
  return dedupe(candidates.map((candidate) => candidate.label)).slice(0, 24);
}

function inferFirstKnownUse(chronology: string[]): string | null {
  const earliest = chronology[0];
  if (!earliest) return null;
  return `${earliest} (earliest attestation marker from Wiktionary data)`;
}

function inferWordFamily(word: string, entries: MyWordsEntry[], nearbyWords: string[]): string[] {
  const normalizedWord = word.trim().toLocaleLowerCase();
  if (!normalizedWord) return [];
  const stem = normalizedWord.replace(/[^a-z]/g, '').slice(0, 4);

  const forms = entries.flatMap((entry) => entry.forms.map((form) => form.word));
  const nearby = nearbyWords.filter((item) => {
    const normalized = item.toLocaleLowerCase();
    if (!stem) return false;
    return normalized.startsWith(stem) || normalized.includes(normalizedWord);
  });

  return dedupe([...forms, ...nearby]).filter((item) => item.toLocaleLowerCase() !== normalizedWord).slice(0, 24);
}

function cacheKey(input: LookupWordInput): string {
  return `${input.languageCode.trim().toLocaleLowerCase()}::${input.word.trim().toLocaleLowerCase()}`;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.floor(value);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function normalizeLetter(value: string): string {
  const normalized = value.trim().toLocaleLowerCase();
  if (!/^[a-z]$/.test(normalized)) {
    throw new Error('Letter must be A-Z.');
  }
  return normalized;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeContextToken(value: string): string {
  return value.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '').toLocaleLowerCase();
}

function splitSentenceWords(sentence: string): string[] {
  const matches = sentence.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  return dedupe(matches.map((word) => word.trim()).filter(Boolean));
}

function findWordInSentence(sentence: string, targetWord: string): { index: number; matched: string } | null {
  const escaped = escapeRegex(targetWord);
  const wordBoundaryRegex = new RegExp(`\\b${escaped}\\b`, 'i');
  const byBoundary = wordBoundaryRegex.exec(sentence);
  if (byBoundary && typeof byBoundary.index === 'number') {
    return { index: byBoundary.index, matched: byBoundary[0] };
  }

  const lowerSentence = sentence.toLocaleLowerCase();
  const lowerTarget = targetWord.toLocaleLowerCase();
  const fallbackIndex = lowerSentence.indexOf(lowerTarget);
  if (fallbackIndex < 0) return null;
  return { index: fallbackIndex, matched: sentence.slice(fallbackIndex, fallbackIndex + targetWord.length) };
}

function applyMatchCase(templateWord: string, replacement: string): string {
  if (!replacement) return replacement;
  if (templateWord.toUpperCase() === templateWord) return replacement.toUpperCase();
  const capitalizedTemplate = templateWord[0]?.toUpperCase() === templateWord[0]
    && templateWord.slice(1).toLowerCase() === templateWord.slice(1);
  if (capitalizedTemplate) {
    return `${replacement[0]?.toUpperCase() ?? ''}${replacement.slice(1)}`;
  }
  return replacement;
}

function collectSynonymCandidates(lookup: MyWordsLookupResult, normalizedTargetWord: string): string[] {
  const senseSynonyms = lookup.entries.flatMap((entry) =>
    flattenSenses(entry.senses).flatMap((sense) => sense.synonyms),
  );
  const entrySynonyms = lookup.entries.flatMap((entry) => entry.synonyms);
  return dedupe([...lookup.synonyms, ...entrySynonyms, ...senseSynonyms])
    .filter((candidate) => candidate.toLocaleLowerCase() !== normalizedTargetWord);
}

function dedupeAttributions(attributions: MyWordsAttribution[]): MyWordsAttribution[] {
  const seen = new Set<string>();
  const out: MyWordsAttribution[] = [];
  for (const attribution of attributions) {
    const key = `${attribution.name}::${attribution.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(attribution);
  }
  return out;
}

function wordHelperCacheKey(input: WordHelperInput): string {
  return [
    input.languageCode.trim().toLocaleLowerCase(),
    input.targetWord.trim().toLocaleLowerCase(),
    input.sentence.trim().toLocaleLowerCase(),
    String(clampInt(input.maxSuggestions, DEFAULT_WORD_HELPER_SUGGESTIONS, 1, MAX_WORD_HELPER_SUGGESTIONS)),
  ].join('::');
}

export async function getMyWordsLanguages(): Promise<MyWordsLanguage[]> {
  const now = Date.now();
  if (languageCache && languageCache.expiresAt > now) {
    return languageCache.value;
  }

  try {
    const languages = await fetchSupportedLanguagesFromFreeDictionary();
    languageCache = { expiresAt: now + LANG_CACHE_MS, value: languages };
    return languages;
  } catch {
    languageCache = { expiresAt: now + 15 * 60 * 1000, value: FALLBACK_LANGUAGES };
    return FALLBACK_LANGUAGES;
  }
}

export async function lookupWord(input: LookupWordInput): Promise<MyWordsLookupResult | null> {
  const languageCode = input.languageCode.trim().toLocaleLowerCase();
  const word = input.word.trim();
  if (!languageCode) throw new Error('Language code is required.');
  if (!word) throw new Error('Word is required.');

  const key = cacheKey({ languageCode, word });
  const now = Date.now();
  const cached = lookupCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const primary = await lookupWordInFreeDictionary(languageCode, word);
  if (!primary) {
    lookupCache.set(key, { expiresAt: now + LOOKUP_CACHE_MS, value: null });
    evictIfOverLimit(lookupCache, MAX_LOOKUP_CACHE_SIZE);
    return null;
  }

  const result: MyWordsLookupResult = {
    ...primary,
    requestedLanguageCode: languageCode,
    wordHistory: [],
    chronology: [],
    firstKnownUse: null,
    didYouKnow: null,
    wordFamily: [],
    rhymes: [],
    nearbyWords: [],
    providers: ['freeDictionaryApi'],
    attributions: [ATTR_FREE_DICTIONARY],
  };

  if (languageCode === 'en' && (result.synonyms.length < 6 || result.antonyms.length < 3)) {
    try {
      const fallback = await fetchEnglishThesaurusFromDatamuse(word);
      const mergedSynonyms = dedupe([...result.synonyms, ...fallback.synonyms]);
      const mergedAntonyms = dedupe([...result.antonyms, ...fallback.antonyms]);
      if (mergedSynonyms.length > result.synonyms.length || mergedAntonyms.length > result.antonyms.length) {
        result.synonyms = mergedSynonyms;
        result.antonyms = mergedAntonyms;
        ensureProvider(result, 'datamuse', ATTR_DATAMUSE);
      }
    } catch {
      // no-op fallback error
    }
  }

  if (languageCode === 'en') {
    try {
      const enrichment = await fetchEnglishWordHistoryFromWiktionary(word);
      const mergedNearby = dedupe([...(result.nearbyWords ?? []), ...enrichment.nearbyWords]);
      if (
        enrichment.wordHistory.length > 0 ||
        enrichment.didYouKnow ||
        mergedNearby.length > 0
      ) {
        result.wordHistory = enrichment.wordHistory;
        result.didYouKnow = enrichment.didYouKnow;
        result.nearbyWords = mergedNearby;
        ensureProvider(result, 'wiktionaryApi', ATTR_WIKTIONARY);
      }
    } catch {
      // no-op enrichment error
    }

    try {
      const rhymes = await fetchEnglishRhymesFromDatamuse(word);
      if (rhymes.length > 0) {
        result.rhymes = dedupe([...(result.rhymes ?? []), ...rhymes]).slice(0, 24);
        ensureProvider(result, 'datamuse', ATTR_DATAMUSE);
      }
    } catch {
      // no-op rhymes error
    }
  }

  result.chronology = extractChronologyMarkers(result.entries, result.wordHistory ?? []);
  result.firstKnownUse = inferFirstKnownUse(result.chronology);
  result.wordFamily = inferWordFamily(result.word, result.entries, result.nearbyWords ?? []);

  lookupCache.set(key, { expiresAt: now + LOOKUP_CACHE_MS, value: result });
  evictIfOverLimit(lookupCache, MAX_LOOKUP_CACHE_SIZE);
  return result;
}

export async function browseWordsAlphabetically(
  input: BrowseAlphabeticalWordsInput,
): Promise<MyWordsAlphabeticalBrowseResult> {
  const languageCode = input.languageCode.trim().toLocaleLowerCase();
  if (!languageCode) throw new Error('Language code is required.');

  const letter = normalizeLetter(input.letter);
  const page = clampInt(input.page, 1, 1, 10000);
  const pageSize = clampInt(input.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

  if (languageCode !== 'en') {
    return {
      languageCode,
      letter,
      page,
      pageSize,
      total: 0,
      words: [],
      supported: false,
      message: 'Alphabetical dictionary/thesaurus browse is currently available in English only.',
    };
  }

  const key = `${languageCode}::${letter}`;
  const now = Date.now();
  const cached = alphabeticalCache.get(key);
  let words: string[];
  if (cached && cached.expiresAt > now) {
    words = cached.value;
  } else {
    words = await fetchWordsByPrefixFromDatamuse(letter);
    alphabeticalCache.set(key, { expiresAt: now + ALPHABETICAL_CACHE_MS, value: words });
    evictIfOverLimit(alphabeticalCache, MAX_ALPHABETICAL_CACHE_SIZE);
  }

  const offset = (page - 1) * pageSize;
  return {
    languageCode,
    letter,
    page,
    pageSize,
    total: words.length,
    words: words.slice(offset, offset + pageSize),
    supported: true,
  };
}

export async function suggestWordReplacements(input: WordHelperInput): Promise<MyWordsWordHelperResult> {
  const languageCode = input.languageCode.trim().toLocaleLowerCase();
  const sentence = input.sentence.trim();
  const targetWord = input.targetWord.trim();
  const maxSuggestions = clampInt(
    input.maxSuggestions,
    DEFAULT_WORD_HELPER_SUGGESTIONS,
    1,
    MAX_WORD_HELPER_SUGGESTIONS,
  );

  if (!languageCode) throw new Error('Language code is required.');
  if (!sentence) throw new Error('Sentence is required.');
  if (!targetWord) throw new Error('Selected word is required.');

  const sentenceWords = splitSentenceWords(sentence);
  if (sentenceWords.length === 0) {
    throw new Error('Sentence must include at least one word.');
  }

  const targetLocation = findWordInSentence(sentence, targetWord);
  if (!targetLocation) {
    throw new Error('Selected word must appear in the sentence.');
  }

  const cacheKey = wordHelperCacheKey({ languageCode, sentence, targetWord, maxSuggestions });
  const now = Date.now();
  const cached = wordHelperCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const lookup = await lookupWord({ languageCode, word: targetWord });
  if (!lookup) {
    return {
      languageCode,
      sentence,
      targetWord,
      normalizedTargetWord: targetWord.toLocaleLowerCase(),
      suggestions: [],
      supported: false,
      message: `No thesaurus/dictionary entry found for "${targetWord}" in ${languageCode.toUpperCase()}.`,
      providers: [],
      attributions: [],
    };
  }

  const normalizedTargetWord = targetWord.toLocaleLowerCase();
  const dictionaryCandidates = collectSynonymCandidates(lookup, normalizedTargetWord);
  const knownCandidates = dedupe([
    ...dictionaryCandidates,
    ...(lookup.nearbyWords ?? []),
    ...(lookup.wordFamily ?? []),
  ]).filter((candidate) => candidate.toLocaleLowerCase() !== normalizedTargetWord);

  const before = sentence.slice(0, targetLocation.index);
  const after = sentence.slice(targetLocation.index + targetLocation.matched.length);
  const beforeParts = before.split(/\s+/).filter(Boolean);
  const afterParts = after.split(/\s+/).filter(Boolean);
  const leftContext = normalizeContextToken(beforeParts[beforeParts.length - 1] ?? '');
  const rightContext = normalizeContextToken(afterParts[0] ?? '');

  let contextualCandidates: Array<{ word: string; score: number }> = [];
  if (languageCode === 'en') {
    try {
      contextualCandidates = await fetchEnglishContextualMeaningFromDatamuse({
        word: targetWord,
        leftContext,
        rightContext,
        max: Math.max(48, maxSuggestions * 4),
      });
    } catch {
      contextualCandidates = [];
    }
  }

  const contextRankByWord = new Map<string, { rank: number; score: number }>();
  contextualCandidates.forEach((item, rank) => {
    const key = item.word.toLocaleLowerCase();
    const previous = contextRankByWord.get(key);
    if (!previous || item.score > previous.score) {
      contextRankByWord.set(key, { rank, score: item.score });
    }
  });

  const suggestions: MyWordsWordHelperSuggestion[] = knownCandidates
    .map((candidate) => {
      const key = candidate.toLocaleLowerCase();
      const context = contextRankByWord.get(key);
      const contextMatch = Boolean(context);
      const score = context?.score ?? 0;
      const relevance: MyWordsWordHelperSuggestion['relevance'] = !context
        ? 'related'
        : (context.rank <= 12 || score >= 120000)
          ? 'high'
          : 'medium';
      const replacement = applyMatchCase(targetLocation.matched, candidate);
      return {
        replacement: candidate,
        replacedSentence:
          `${sentence.slice(0, targetLocation.index)}`
          + `${replacement}`
          + `${sentence.slice(targetLocation.index + targetLocation.matched.length)}`,
        score,
        relevance,
        contextMatch,
      };
    })
    .sort((a, b) => {
      if (a.contextMatch !== b.contextMatch) return a.contextMatch ? -1 : 1;
      if (a.score !== b.score) return b.score - a.score;
      return a.replacement.localeCompare(b.replacement, 'en', { sensitivity: 'base' });
    })
    .slice(0, maxSuggestions);

  const providers: MyWordsProvider[] = [...lookup.providers];
  if (contextualCandidates.length > 0 && !providers.includes('datamuse')) {
    providers.push('datamuse');
  }

  const attributions = dedupeAttributions([
    ...lookup.attributions,
    ...(contextualCandidates.length > 0 ? [ATTR_DATAMUSE] : []),
  ]);

  const result: MyWordsWordHelperResult = {
    languageCode,
    sentence,
    targetWord,
    normalizedTargetWord,
    suggestions,
    supported: suggestions.length > 0,
    message:
      suggestions.length === 0
        ? `No replacement options found for "${targetWord}".`
        : languageCode === 'en'
          ? undefined
          : 'Context ranking is currently strongest for English; showing dictionary/thesaurus options.',
    providers,
    attributions,
  };

  wordHelperCache.set(cacheKey, { expiresAt: now + WORD_HELPER_CACHE_MS, value: result });
  evictIfOverLimit(wordHelperCache, MAX_WORD_HELPER_CACHE_SIZE);
  return result;
}

export function __resetMyWordsServiceCacheForTests(): void {
  languageCache = null;
  lookupCache.clear();
  alphabeticalCache.clear();
  wordHelperCache.clear();
}
