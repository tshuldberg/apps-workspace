import type { DatabaseAdapter } from '@mylife/db';
import type { LookupWordInput, MyWordsLookupResult, OfflineLookupResult } from './types';
import { cacheLookupResult, getCachedLookup, evictLruEntries } from './db/crud';
import { getSavedWordByWordAndLang } from './db/crud';
import { lookupWord } from './service';

const DEFAULT_CACHE_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

function generateId(): string {
  return `wd_cache_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function lookupWordWithFallback(
  db: DatabaseAdapter,
  input: LookupWordInput,
  isOnline: boolean,
  cacheMaxBytes: number = DEFAULT_CACHE_MAX_BYTES,
): Promise<OfflineLookupResult | null> {
  const word = input.word.trim();
  const languageCode = input.languageCode.trim().toLowerCase();

  if (isOnline) {
    try {
      const result = await lookupWord(input);
      if (result) {
        cacheLookupResult(db, generateId(), word, languageCode, result);
        evictLruEntries(db, cacheMaxBytes);
        return { result, source: 'api', fetchedAt: null };
      }
    } catch {
      // API failed, fall through to cache
    }
  }

  // Try cache
  const cached = getCachedLookup(db, word, languageCode);
  if (cached) {
    return { result: cached.lookupData, source: 'cache', fetchedAt: cached.fetchedAt };
  }

  // Try saved words
  const saved = getSavedWordByWordAndLang(db, word, languageCode);
  if (saved?.lookupData) {
    return { result: saved.lookupData, source: 'saved', fetchedAt: saved.createdAt };
  }

  return null;
}

export function cacheAfterLookup(
  db: DatabaseAdapter,
  word: string,
  languageCode: string,
  result: MyWordsLookupResult,
  cacheMaxBytes: number = DEFAULT_CACHE_MAX_BYTES,
): void {
  cacheLookupResult(db, generateId(), word, languageCode, result);
  evictLruEntries(db, cacheMaxBytes);
}
