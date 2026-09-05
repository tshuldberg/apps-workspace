import { z } from 'zod';

export type MyWordsProvider = 'freeDictionaryApi' | 'datamuse' | 'wiktionaryApi';

export interface MyWordsLanguage {
  code: string;
  name: string;
  words: number;
}

export interface MyWordsSense {
  definition: string;
  tags: string[];
  examples: string[];
  quotes: MyWordsQuote[];
  synonyms: string[];
  antonyms: string[];
  subsenses: MyWordsSense[];
}

export interface MyWordsPronunciation {
  text: string;
  type?: string;
  tags: string[];
}

export interface MyWordsForm {
  word: string;
  tags: string[];
}

export interface MyWordsQuote {
  text: string;
  reference?: string;
}

export interface MyWordsEntry {
  partOfSpeech: string;
  pronunciations: MyWordsPronunciation[];
  forms: MyWordsForm[];
  senses: MyWordsSense[];
  synonyms: string[];
  antonyms: string[];
}

export interface MyWordsAttribution {
  name: string;
  url: string;
  license: string;
}

export interface MyWordsLookupResult {
  word: string;
  requestedLanguageCode: string;
  language: {
    code: string;
    name: string;
  };
  entries: MyWordsEntry[];
  synonyms: string[];
  antonyms: string[];
  wordHistory?: string[];
  chronology?: string[];
  firstKnownUse?: string | null;
  didYouKnow?: string | null;
  wordFamily?: string[];
  rhymes?: string[];
  nearbyWords?: string[];
  providers: MyWordsProvider[];
  attributions: MyWordsAttribution[];
}

export interface LookupWordInput {
  languageCode: string;
  word: string;
}

export interface BrowseAlphabeticalWordsInput {
  languageCode: string;
  letter: string;
  page?: number;
  pageSize?: number;
}

export interface MyWordsAlphabeticalBrowseResult {
  languageCode: string;
  letter: string;
  page: number;
  pageSize: number;
  total: number;
  words: string[];
  supported: boolean;
  message?: string;
}

export interface WordHelperInput {
  languageCode: string;
  sentence: string;
  targetWord: string;
  maxSuggestions?: number;
}

export interface MyWordsWordHelperSuggestion {
  replacement: string;
  replacedSentence: string;
  score: number;
  relevance: 'high' | 'medium' | 'related';
  contextMatch: boolean;
}

export interface MyWordsWordHelperResult {
  languageCode: string;
  sentence: string;
  targetWord: string;
  normalizedTargetWord: string;
  suggestions: MyWordsWordHelperSuggestion[];
  supported: boolean;
  message?: string;
  providers: MyWordsProvider[];
  attributions: MyWordsAttribution[];
}

// ── Saved Words ───────────────────────────────────────────────────────

export type SavedWordSortBy = 'recent' | 'alphabetical' | 'mostLookedUp' | 'mastery';

export interface SavedWord {
  id: string;
  word: string;
  languageCode: string;
  languageName: string;
  listId: string | null;
  definitionSummary: string | null;
  partOfSpeech: string | null;
  pronunciationText: string | null;
  lookupData: MyWordsLookupResult | null;
  notes: string | null;
  masteryLevel: number;
  isFavorite: boolean;
  lookedUpCount: number;
  lastLookedUpAt: string;
  flashCardId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CreateSavedWordInputSchema = z.object({
  word: z.string().min(1),
  languageCode: z.string().min(1),
  languageName: z.string().min(1),
  listId: z.string().nullable().optional(),
  definitionSummary: z.string().nullable().optional(),
  partOfSpeech: z.string().nullable().optional(),
  pronunciationText: z.string().nullable().optional(),
  lookupData: z.any().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type CreateSavedWordInput = z.infer<typeof CreateSavedWordInputSchema>;

export const UpdateSavedWordInputSchema = z.object({
  notes: z.string().nullable().optional(),
  masteryLevel: z.number().int().min(0).max(5).optional(),
  isFavorite: z.boolean().optional(),
  listId: z.string().nullable().optional(),
});
export type UpdateSavedWordInput = z.infer<typeof UpdateSavedWordInputSchema>;

// ── Word Lists ────────────────────────────────────────────────────────

export interface WordList {
  id: string;
  name: string;
  description: string | null;
  languageCode: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const CreateWordListInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  languageCode: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateWordListInput = z.infer<typeof CreateWordListInputSchema>;

export const UpdateWordListInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  languageCode: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateWordListInput = z.infer<typeof UpdateWordListInputSchema>;

// ── Flash Bridge (V2) ────────────────────────────────────────────────

export interface FlashBridgeContent {
  front: string;
  back: string;
  tags: string[];
}

export interface FlashBridgeResult {
  flashCardId: string;
  created: boolean;
}

export interface BulkFlashBridgeResult {
  created: number;
  skipped: number;
  results: Array<{ savedWordId: string; flashCardId: string | null; created: boolean }>;
}

// ── Offline Cache (V3) ───────────────────────────────────────────────

export type OfflineLookupSource = 'api' | 'cache' | 'saved';

export interface OfflineLookupResult {
  result: MyWordsLookupResult;
  source: OfflineLookupSource;
  fetchedAt: string | null;
}

export interface CacheStats {
  wordCount: number;
  totalSizeBytes: number;
}

// ── Advanced Search (V4) ─────────────────────────────────────────────

export interface AdvancedSearchFilters {
  ftsQuery?: string;
  languageCodes?: string[];
  partsOfSpeech?: string[];
  masteryMin?: number;
  masteryMax?: number;
  favoritesOnly?: boolean;
  listIds?: string[];
  includeUncategorized?: boolean;
  dateRangeDays?: number;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  sortBy?: SavedWordSortBy;
  limit?: number;
  offset?: number;
}
