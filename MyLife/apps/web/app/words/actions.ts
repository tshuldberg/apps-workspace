'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  browseWordsAlphabetically,
  getMyWordsLanguages,
  lookupWord,
  suggestWordReplacements,
  saveWord,
  unsaveWord,
  getSavedWord,
  getSavedWordByWordAndLang,
  getSavedWords,
  getSavedWordsLightweight,
  updateSavedWord,
  getSavedWordCount,
  getSavedWordCountByLanguage,
  getSavedWordCountByList,
  createWordList,
  getWordList,
  getWordLists,
  updateWordList,
  deleteWordList,
  cacheLookupResult,
  getCachedLookup,
  getCachePrefixMatches,
  getCacheStats,
  clearCache,
  advancedSearchSavedWords,
  getDistinctPartsOfSpeech,
  searchSavedWordsFts,
  type GetSavedWordsOptions,
  type CreateSavedWordInput,
  type UpdateSavedWordInput,
  type CreateWordListInput,
  type UpdateWordListInput,
  type AdvancedSearchFilters,
} from '@mylife/words';
import type {
  BrowseAlphabeticalWordsInput,
  LookupWordInput,
  WordHelperInput,
  MyWordsAlphabeticalBrowseResult,
  MyWordsLanguage,
  MyWordsLookupResult,
  MyWordsWordHelperResult,
} from '@mylife/words';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('words');
  return adapter;
}

function generateId(): string {
  return `wd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Service (API) actions ──────────────────────────────────────────

export async function fetchMyWordsLanguagesAction(): Promise<MyWordsLanguage[]> {
  return getMyWordsLanguages();
}

export async function lookupWordAction(input: LookupWordInput): Promise<MyWordsLookupResult | null> {
  return lookupWord(input);
}

export async function browseAlphabeticalWordsAction(
  input: BrowseAlphabeticalWordsInput,
): Promise<MyWordsAlphabeticalBrowseResult> {
  return browseWordsAlphabetically(input);
}

export async function suggestWordReplacementsAction(
  input: WordHelperInput,
): Promise<MyWordsWordHelperResult> {
  return suggestWordReplacements(input);
}

// ── Saved Words CRUD ───────────────────────────────────────────────

export async function saveWordAction(input: CreateSavedWordInput) {
  const id = generateId();
  return saveWord(db(), id, input);
}

export async function unsaveWordAction(id: string) {
  return unsaveWord(db(), id);
}

export async function fetchSavedWordAction(id: string) {
  return getSavedWord(db(), id);
}

export async function fetchSavedWordByWordAndLangAction(word: string, languageCode: string) {
  return getSavedWordByWordAndLang(db(), word, languageCode);
}

export async function fetchSavedWordsAction(options?: GetSavedWordsOptions) {
  return getSavedWords(db(), options);
}

export async function fetchSavedWordsLightweightAction(options?: GetSavedWordsOptions) {
  return getSavedWordsLightweight(db(), options);
}

export async function updateSavedWordAction(id: string, input: UpdateSavedWordInput) {
  return updateSavedWord(db(), id, input);
}

export async function fetchSavedWordCountAction() {
  return getSavedWordCount(db());
}

export async function fetchSavedWordCountByLanguageAction() {
  return getSavedWordCountByLanguage(db());
}

export async function fetchSavedWordCountByListAction() {
  return getSavedWordCountByList(db());
}

// ── Word Lists CRUD ────────────────────────────────────────────────

export async function createWordListAction(input: CreateWordListInput) {
  const id = generateId();
  return createWordList(db(), id, input);
}

export async function fetchWordListAction(id: string) {
  return getWordList(db(), id);
}

export async function fetchWordListsAction() {
  return getWordLists(db());
}

export async function updateWordListAction(id: string, input: UpdateWordListInput) {
  return updateWordList(db(), id, input);
}

export async function deleteWordListAction(id: string) {
  return deleteWordList(db(), id);
}

// ── Offline Cache ──────────────────────────────────────────────────

export async function cacheLookupAction(
  word: string,
  languageCode: string,
  data: MyWordsLookupResult,
) {
  const id = generateId();
  cacheLookupResult(db(), id, word, languageCode, data);
}

export async function fetchCachedLookupAction(word: string, languageCode: string) {
  return getCachedLookup(db(), word, languageCode);
}

export async function fetchCachePrefixMatchesAction(
  prefix: string,
  languageCode: string | null,
  limit?: number,
) {
  return getCachePrefixMatches(db(), prefix, languageCode, limit);
}

export async function fetchCacheStatsAction() {
  return getCacheStats(db());
}

export async function clearCacheAction() {
  clearCache(db());
}

// ── Advanced Search (V4) ───────────────────────────────────────────

export async function advancedSearchAction(filters: AdvancedSearchFilters) {
  return advancedSearchSavedWords(db(), filters);
}

export async function fetchDistinctPartsOfSpeechAction() {
  return getDistinctPartsOfSpeech(db());
}

export async function searchFtsAction(query: string, limit?: number, offset?: number) {
  return searchSavedWordsFts(db(), query, limit, offset);
}
