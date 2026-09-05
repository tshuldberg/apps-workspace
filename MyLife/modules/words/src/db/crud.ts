import type { DatabaseAdapter } from '@mylife/db';
import type {
  SavedWord,
  WordList,
  CreateSavedWordInput,
  UpdateSavedWordInput,
  CreateWordListInput,
  UpdateWordListInput,
  SavedWordSortBy,
} from '../types';
import {
  CreateSavedWordInputSchema,
  UpdateSavedWordInputSchema,
  CreateWordListInputSchema,
  UpdateWordListInputSchema,
} from '../types';
import type { MyWordsLookupResult } from '../types';

// ── Helpers ────────────────────────────────────────────────────────────

const MAX_LOOKUP_DATA_BYTES = 100_000;

function nowIso(): string {
  return new Date().toISOString();
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

export function truncateLookupData(data: MyWordsLookupResult): string {
  const json = JSON.stringify(data);
  if (json.length <= MAX_LOOKUP_DATA_BYTES) return json;

  const truncated = {
    ...data,
    entries: data.entries.slice(0, 10).map((entry) => ({
      ...entry,
      senses: entry.senses.slice(0, 5).map((sense) => ({
        ...sense,
        subsenses: sense.subsenses.slice(0, 3),
      })),
    })),
    rhymes: data.rhymes?.slice(0, 12),
    nearbyWords: data.nearbyWords?.slice(0, 12),
    wordFamily: data.wordFamily?.slice(0, 12),
    wordHistory: data.wordHistory?.slice(0, 6),
    chronology: data.chronology?.slice(0, 6),
  };
  return JSON.stringify(truncated);
}

function parseLookupData(raw: unknown): MyWordsLookupResult | null {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return JSON.parse(raw) as MyWordsLookupResult;
  } catch {
    return null;
  }
}

function rowToSavedWord(row: Record<string, unknown>): SavedWord {
  return {
    id: row.id as string,
    word: row.word as string,
    languageCode: row.language_code as string,
    languageName: row.language_name as string,
    listId: (row.list_id as string) ?? null,
    definitionSummary: (row.definition_summary as string) ?? null,
    partOfSpeech: (row.part_of_speech as string) ?? null,
    pronunciationText: (row.pronunciation_text as string) ?? null,
    lookupData: parseLookupData(row.lookup_data),
    notes: (row.notes as string) ?? null,
    masteryLevel: row.mastery_level as number,
    isFavorite: (row.is_favorite as number) === 1,
    lookedUpCount: row.looked_up_count as number,
    lastLookedUpAt: row.last_looked_up_at as string,
    flashCardId: (row.flash_card_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToWordList(row: Record<string, unknown>): WordList {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    languageCode: (row.language_code as string) ?? null,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Saved Words ───────────────────────────────────────────────────────

export function saveWord(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateSavedWordInput,
): SavedWord {
  const input = CreateSavedWordInputSchema.parse(rawInput);
  const now = nowIso();

  const lookupJson = input.lookupData
    ? truncateLookupData(input.lookupData)
    : null;

  db.execute(
    `INSERT INTO wd_saved_words (id, word, language_code, language_name, list_id, definition_summary, part_of_speech, pronunciation_text, lookup_data, notes, mastery_level, is_favorite, looked_up_count, last_looked_up_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?, ?)`,
    [
      id,
      input.word,
      input.languageCode,
      input.languageName,
      input.listId ?? null,
      input.definitionSummary ?? null,
      input.partOfSpeech ?? null,
      input.pronunciationText ?? null,
      lookupJson,
      input.notes ?? null,
      now,
      now,
      now,
    ],
  );

  return {
    id,
    word: input.word,
    languageCode: input.languageCode,
    languageName: input.languageName,
    listId: input.listId ?? null,
    definitionSummary: input.definitionSummary ?? null,
    partOfSpeech: input.partOfSpeech ?? null,
    pronunciationText: input.pronunciationText ?? null,
    lookupData: input.lookupData ?? null,
    notes: input.notes ?? null,
    masteryLevel: 0,
    isFavorite: false,
    lookedUpCount: 1,
    lastLookedUpAt: now,
    flashCardId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function unsaveWord(db: DatabaseAdapter, id: string): boolean {
  const existing = getSavedWord(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM wd_saved_words WHERE id = ?`, [id]);
  return true;
}

export function getSavedWord(
  db: DatabaseAdapter,
  id: string,
): SavedWord | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM wd_saved_words WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToSavedWord(rows[0]) : null;
}

export function getSavedWordByWordAndLang(
  db: DatabaseAdapter,
  word: string,
  languageCode: string,
): SavedWord | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM wd_saved_words WHERE word = ? AND language_code = ?`,
    [word, languageCode],
  );
  return rows.length > 0 ? rowToSavedWord(rows[0]) : null;
}

export interface GetSavedWordsOptions {
  sortBy?: SavedWordSortBy;
  languageCode?: string;
  listId?: string;
  favoritesOnly?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export function getSavedWords(
  db: DatabaseAdapter,
  options?: GetSavedWordsOptions,
): SavedWord[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.languageCode) {
    conditions.push('language_code = ?');
    params.push(options.languageCode);
  }
  if (options?.listId) {
    conditions.push('list_id = ?');
    params.push(options.listId);
  }
  if (options?.favoritesOnly) {
    conditions.push('is_favorite = 1');
  }
  if (options?.search) {
    conditions.push("word LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(options.search)}%`);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderBy: string;
  switch (options?.sortBy) {
    case 'alphabetical':
      orderBy = 'word ASC';
      break;
    case 'mostLookedUp':
      orderBy = 'looked_up_count DESC';
      break;
    case 'mastery':
      orderBy = 'mastery_level ASC';
      break;
    case 'recent':
    default:
      orderBy = 'last_looked_up_at DESC';
      break;
  }

  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM wd_saved_words ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return rows.map(rowToSavedWord);
}

// ── Lightweight Saved Words (no lookupData) ──────────────────────────

export interface SavedWordLight {
  id: string;
  word: string;
  languageCode: string;
  languageName: string;
  listId: string | null;
  definitionSummary: string | null;
  partOfSpeech: string | null;
  pronunciationText: string | null;
  notes: string | null;
  masteryLevel: number;
  isFavorite: boolean;
  lookedUpCount: number;
  lastLookedUpAt: string;
  flashCardId: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToSavedWordLight(row: Record<string, unknown>): SavedWordLight {
  return {
    id: row.id as string,
    word: row.word as string,
    languageCode: row.language_code as string,
    languageName: row.language_name as string,
    listId: (row.list_id as string) ?? null,
    definitionSummary: (row.definition_summary as string) ?? null,
    partOfSpeech: (row.part_of_speech as string) ?? null,
    pronunciationText: (row.pronunciation_text as string) ?? null,
    notes: (row.notes as string) ?? null,
    masteryLevel: row.mastery_level as number,
    isFavorite: (row.is_favorite as number) === 1,
    lookedUpCount: row.looked_up_count as number,
    lastLookedUpAt: row.last_looked_up_at as string,
    flashCardId: (row.flash_card_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const SAVED_WORD_LIGHT_COLUMNS = `id, word, language_code, language_name, list_id, definition_summary, part_of_speech, pronunciation_text, notes, mastery_level, is_favorite, looked_up_count, last_looked_up_at, flash_card_id, created_at, updated_at`;

export function getSavedWordsLightweight(
  db: DatabaseAdapter,
  options?: GetSavedWordsOptions,
): SavedWordLight[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.languageCode) {
    conditions.push('language_code = ?');
    params.push(options.languageCode);
  }
  if (options?.listId) {
    conditions.push('list_id = ?');
    params.push(options.listId);
  }
  if (options?.favoritesOnly) {
    conditions.push('is_favorite = 1');
  }
  if (options?.search) {
    conditions.push("word LIKE ? ESCAPE '\\'");
    params.push(`%${escapeLike(options.search)}%`);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderBy: string;
  switch (options?.sortBy) {
    case 'alphabetical':
      orderBy = 'word ASC';
      break;
    case 'mostLookedUp':
      orderBy = 'looked_up_count DESC';
      break;
    case 'mastery':
      orderBy = 'mastery_level ASC';
      break;
    case 'recent':
    default:
      orderBy = 'last_looked_up_at DESC';
      break;
  }

  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const rows = db.query<Record<string, unknown>>(
    `SELECT ${SAVED_WORD_LIGHT_COLUMNS} FROM wd_saved_words ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return rows.map(rowToSavedWordLight);
}

export function updateSavedWord(
  db: DatabaseAdapter,
  id: string,
  rawInput: UpdateSavedWordInput,
): SavedWord | null {
  const existing = getSavedWord(db, id);
  if (!existing) return null;

  const input = UpdateSavedWordInputSchema.parse(rawInput);
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.notes !== undefined) {
    updates.push('notes = ?');
    params.push(input.notes);
  }
  if (input.masteryLevel !== undefined) {
    updates.push('mastery_level = ?');
    params.push(input.masteryLevel);
  }
  if (input.isFavorite !== undefined) {
    updates.push('is_favorite = ?');
    params.push(input.isFavorite ? 1 : 0);
  }
  if (input.listId !== undefined) {
    updates.push('list_id = ?');
    params.push(input.listId);
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  params.push(nowIso());
  params.push(id);

  db.execute(
    `UPDATE wd_saved_words SET ${updates.join(', ')} WHERE id = ?`,
    params,
  );
  return getSavedWord(db, id);
}

export function incrementLookupCount(
  db: DatabaseAdapter,
  id: string,
  newLookupData?: MyWordsLookupResult,
): SavedWord | null {
  const existing = getSavedWord(db, id);
  if (!existing) return null;

  const now = nowIso();
  const lookupJson = newLookupData ? truncateLookupData(newLookupData) : null;

  if (lookupJson) {
    db.execute(
      `UPDATE wd_saved_words SET looked_up_count = looked_up_count + 1, last_looked_up_at = ?, lookup_data = ?, updated_at = ? WHERE id = ?`,
      [now, lookupJson, now, id],
    );
  } else {
    db.execute(
      `UPDATE wd_saved_words SET looked_up_count = looked_up_count + 1, last_looked_up_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, id],
    );
  }

  return getSavedWord(db, id);
}

export function getSavedWordCount(db: DatabaseAdapter): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM wd_saved_words`,
  );
  return rows[0].count;
}

export function getSavedWordCountByLanguage(
  db: DatabaseAdapter,
): Array<{ languageCode: string; count: number }> {
  return db.query<{ languageCode: string; count: number }>(
    `SELECT language_code as languageCode, COUNT(*) as count FROM wd_saved_words GROUP BY language_code ORDER BY count DESC`,
  );
}

export function getSavedWordCountByList(
  db: DatabaseAdapter,
): Array<{ listId: string | null; count: number }> {
  return db.query<{ listId: string | null; count: number }>(
    `SELECT list_id as listId, COUNT(*) as count FROM wd_saved_words GROUP BY list_id`,
  );
}

// ── Word Lists ────────────────────────────────────────────────────────

export function createWordList(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateWordListInput,
): WordList {
  const input = CreateWordListInputSchema.parse(rawInput);
  const now = nowIso();

  db.execute(
    `INSERT INTO wd_word_lists (id, name, description, language_code, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.description ?? null,
      input.languageCode ?? null,
      input.sortOrder ?? 0,
      now,
      now,
    ],
  );

  return {
    id,
    name: input.name,
    description: input.description ?? null,
    languageCode: input.languageCode ?? null,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getWordLists(db: DatabaseAdapter, limit: number = 500): WordList[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM wd_word_lists ORDER BY sort_order ASC, created_at ASC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToWordList);
}

export function getWordList(
  db: DatabaseAdapter,
  id: string,
): WordList | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM wd_word_lists WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToWordList(rows[0]) : null;
}

export function updateWordList(
  db: DatabaseAdapter,
  id: string,
  rawInput: UpdateWordListInput,
): WordList | null {
  const existing = getWordList(db, id);
  if (!existing) return null;

  const input = UpdateWordListInputSchema.parse(rawInput);
  const updates: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    params.push(input.name);
  }
  if (input.description !== undefined) {
    updates.push('description = ?');
    params.push(input.description);
  }
  if (input.languageCode !== undefined) {
    updates.push('language_code = ?');
    params.push(input.languageCode);
  }
  if (input.sortOrder !== undefined) {
    updates.push('sort_order = ?');
    params.push(input.sortOrder);
  }

  if (updates.length === 0) return existing;

  updates.push('updated_at = ?');
  params.push(nowIso());
  params.push(id);

  db.execute(
    `UPDATE wd_word_lists SET ${updates.join(', ')} WHERE id = ?`,
    params,
  );
  return getWordList(db, id);
}

export function deleteWordList(db: DatabaseAdapter, id: string): boolean {
  const existing = getWordList(db, id);
  if (!existing) return false;
  db.execute(`DELETE FROM wd_word_lists WHERE id = ?`, [id]);
  return true;
}

// ── Flash Bridge (V2) ────────────────────────────────────────────────

export function setFlashCardId(
  db: DatabaseAdapter,
  savedWordId: string,
  flashCardId: string | null,
): boolean {
  const existing = getSavedWord(db, savedWordId);
  if (!existing) return false;
  db.execute(
    `UPDATE wd_saved_words SET flash_card_id = ?, updated_at = ? WHERE id = ?`,
    [flashCardId, nowIso(), savedWordId],
  );
  return true;
}

// ── Offline Lookup Cache (V3) ────────────────────────────────────────

export interface CachedLookup {
  id: string;
  word: string;
  languageCode: string;
  lookupData: MyWordsLookupResult;
  dataSizeBytes: number;
  fetchedAt: string;
  lastAccessedAt: string;
  accessCount: number;
}

export function cacheLookupResult(
  db: DatabaseAdapter,
  id: string,
  word: string,
  languageCode: string,
  lookupData: MyWordsLookupResult,
): void {
  const json = truncateLookupData(lookupData);
  const sizeBytes = json.length;
  const now = nowIso();

  db.execute(
    `INSERT INTO wd_lookup_cache (id, word, language_code, lookup_data, data_size_bytes, fetched_at, last_accessed_at, access_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(word, language_code) DO UPDATE SET
       lookup_data = excluded.lookup_data,
       data_size_bytes = excluded.data_size_bytes,
       fetched_at = excluded.fetched_at,
       last_accessed_at = excluded.last_accessed_at,
       access_count = access_count + 1,
       updated_at = excluded.updated_at`,
    [id, word, languageCode, json, sizeBytes, now, now, now, now],
  );
}

export function getCachedLookup(
  db: DatabaseAdapter,
  word: string,
  languageCode: string,
): CachedLookup | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM wd_lookup_cache WHERE word = ? AND language_code = ?`,
    [word, languageCode],
  );
  if (rows.length === 0) return null;

  const row = rows[0];
  const now = nowIso();
  db.execute(
    `UPDATE wd_lookup_cache SET last_accessed_at = ?, access_count = access_count + 1 WHERE id = ?`,
    [now, row.id],
  );

  const parsed = parseLookupData(row.lookup_data);
  if (!parsed) return null;

  return {
    id: row.id as string,
    word: row.word as string,
    languageCode: row.language_code as string,
    lookupData: parsed,
    dataSizeBytes: row.data_size_bytes as number,
    fetchedAt: row.fetched_at as string,
    lastAccessedAt: now,
    accessCount: (row.access_count as number) + 1,
  };
}

export function evictLruEntries(db: DatabaseAdapter, maxBytes: number): number {
  const totalRows = db.query<{ total: number }>(
    `SELECT COALESCE(SUM(data_size_bytes), 0) as total FROM wd_lookup_cache`,
  );
  const totalSize = totalRows[0].total;
  if (totalSize <= maxBytes) return 0;

  const excess = totalSize - maxBytes;
  // Find the smallest set of LRU entries whose cumulative size covers the excess
  const candidates = db.query<{ id: string; data_size_bytes: number }>(
    `SELECT id, data_size_bytes FROM wd_lookup_cache ORDER BY last_accessed_at ASC`,
  );

  const idsToDelete: string[] = [];
  let accumulated = 0;
  for (const row of candidates) {
    idsToDelete.push(row.id);
    accumulated += row.data_size_bytes;
    if (accumulated >= excess) break;
  }

  if (idsToDelete.length === 0) return 0;

  const placeholders = idsToDelete.map(() => '?').join(', ');
  db.execute(
    `DELETE FROM wd_lookup_cache WHERE id IN (${placeholders})`,
    idsToDelete,
  );
  return idsToDelete.length;
}

export function evictStaleEntries(db: DatabaseAdapter, maxAgeDays: number): number {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  const stale = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM wd_lookup_cache WHERE last_accessed_at < ?`,
    [cutoff],
  );
  if (stale[0].count === 0) return 0;
  db.execute(`DELETE FROM wd_lookup_cache WHERE last_accessed_at < ?`, [cutoff]);
  return stale[0].count;
}

export function getCachePrefixMatches(
  db: DatabaseAdapter,
  prefix: string,
  languageCode: string | null,
  limit: number = 10,
): string[] {
  const safePrefix = escapeLike(prefix);
  const langCondition = languageCode ? ' AND language_code = ?' : '';
  const langParams = languageCode ? [languageCode] : [];

  const cacheWords = db.query<{ word: string }>(
    `SELECT DISTINCT word FROM wd_lookup_cache WHERE word LIKE ? ESCAPE '\\'${langCondition} ORDER BY access_count DESC LIMIT ?`,
    [`${safePrefix}%`, ...langParams, limit],
  );

  const savedWords = db.query<{ word: string }>(
    `SELECT DISTINCT word FROM wd_saved_words WHERE word LIKE ? ESCAPE '\\'${langCondition} ORDER BY looked_up_count DESC LIMIT ?`,
    [`${safePrefix}%`, ...langParams, limit],
  );

  const seen = new Set<string>();
  const results: string[] = [];
  for (const row of [...cacheWords, ...savedWords]) {
    const key = row.word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(row.word);
    if (results.length >= limit) break;
  }
  return results;
}

export function getCacheStats(db: DatabaseAdapter): { wordCount: number; totalSizeBytes: number } {
  const rows = db.query<{ wordCount: number; totalSizeBytes: number }>(
    `SELECT COUNT(*) as wordCount, COALESCE(SUM(data_size_bytes), 0) as totalSizeBytes FROM wd_lookup_cache`,
  );
  return rows[0];
}

export function clearCache(db: DatabaseAdapter): void {
  db.execute(`DELETE FROM wd_lookup_cache`);
}

// ── Advanced Search (V4) ─────────────────────────────────────────────

export function getDistinctPartsOfSpeech(db: DatabaseAdapter): string[] {
  const rows = db.query<{ part_of_speech: string }>(
    `SELECT DISTINCT part_of_speech FROM wd_saved_words WHERE part_of_speech IS NOT NULL AND part_of_speech != '' ORDER BY part_of_speech ASC`,
  );
  return rows.map((r) => r.part_of_speech);
}

export function searchSavedWordsFts(
  db: DatabaseAdapter,
  query: string,
  limit: number = 100,
  offset: number = 0,
): SavedWord[] {
  const escaped = escapeFtsQuery(query);
  if (!escaped) return [];

  const rows = db.query<Record<string, unknown>>(
    `SELECT s.* FROM wd_saved_words s JOIN wd_saved_words_fts f ON s.rowid = f.rowid WHERE f.wd_saved_words_fts MATCH ? ORDER BY rank LIMIT ? OFFSET ?`,
    [escaped, limit, offset],
  );
  return rows.map(rowToSavedWord);
}

export function escapeFtsQuery(input: string): string {
  if (!input.trim()) return '';

  const cleaned = input.replace(/[()]/g, '');
  const parts: string[] = [];
  const phrasePattern = /"([^"]+)"/g;
  let phraseMatch: RegExpExecArray | null;

  // Extract quoted phrases first
  while ((phraseMatch = phrasePattern.exec(cleaned)) !== null) {
    parts.push(`"${phraseMatch[1]}"`);
  }
  const remaining = cleaned.replace(phrasePattern, '').trim();

  // Process remaining individual tokens
  if (remaining) {
    for (const token of remaining.split(/\s+/).filter(Boolean)) {
      if (token.endsWith('*')) {
        const base = token.slice(0, -1).replace(/['"]/g, '');
        if (base) parts.push(`"${base}"*`);
      } else {
        const clean = token.replace(/['"*]/g, '');
        if (clean) parts.push(`"${clean}"`);
      }
    }
  }

  return parts.join(' ');
}

import type { AdvancedSearchFilters } from '../types';

export function advancedSearchSavedWords(
  db: DatabaseAdapter,
  filters: AdvancedSearchFilters,
): SavedWord[] {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let fromClause = 'wd_saved_words s';

  if (filters.ftsQuery) {
    const escaped = escapeFtsQuery(filters.ftsQuery);
    if (escaped) {
      fromClause = 'wd_saved_words s JOIN wd_saved_words_fts f ON s.rowid = f.rowid';
      conditions.push('f.wd_saved_words_fts MATCH ?');
      params.push(escaped);
    }
  }

  if (filters.languageCodes && filters.languageCodes.length > 0) {
    const placeholders = filters.languageCodes.map(() => '?').join(', ');
    conditions.push(`s.language_code IN (${placeholders})`);
    params.push(...filters.languageCodes);
  }

  if (filters.partsOfSpeech && filters.partsOfSpeech.length > 0) {
    const placeholders = filters.partsOfSpeech.map(() => '?').join(', ');
    conditions.push(`s.part_of_speech IN (${placeholders})`);
    params.push(...filters.partsOfSpeech);
  }

  if (filters.masteryMin !== undefined) {
    conditions.push('s.mastery_level >= ?');
    params.push(filters.masteryMin);
  }
  if (filters.masteryMax !== undefined) {
    conditions.push('s.mastery_level <= ?');
    params.push(filters.masteryMax);
  }

  if (filters.favoritesOnly) {
    conditions.push('s.is_favorite = 1');
  }

  if (filters.listIds && filters.listIds.length > 0) {
    const listConditions: string[] = [];
    const realIds = filters.listIds.filter((id) => id !== '__uncategorized__');
    if (realIds.length > 0) {
      const placeholders = realIds.map(() => '?').join(', ');
      listConditions.push(`s.list_id IN (${placeholders})`);
      params.push(...realIds);
    }
    if (filters.includeUncategorized || filters.listIds.includes('__uncategorized__')) {
      listConditions.push('s.list_id IS NULL');
    }
    if (listConditions.length > 0) {
      conditions.push(`(${listConditions.join(' OR ')})`);
    }
  }

  if (filters.dateRangeDays) {
    const cutoff = new Date(Date.now() - filters.dateRangeDays * 24 * 60 * 60 * 1000).toISOString();
    conditions.push('s.created_at >= ?');
    params.push(cutoff);
  } else if (filters.dateRangeStart) {
    conditions.push('s.created_at >= ?');
    params.push(filters.dateRangeStart);
    if (filters.dateRangeEnd) {
      conditions.push('s.created_at <= ?');
      params.push(filters.dateRangeEnd);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderBy: string;
  if (filters.ftsQuery && escapeFtsQuery(filters.ftsQuery)) {
    orderBy = 'rank';
  } else {
    switch (filters.sortBy) {
      case 'alphabetical':
        orderBy = 's.word ASC';
        break;
      case 'mostLookedUp':
        orderBy = 's.looked_up_count DESC';
        break;
      case 'mastery':
        orderBy = 's.mastery_level ASC';
        break;
      case 'recent':
      default:
        orderBy = 's.last_looked_up_at DESC';
        break;
    }
  }

  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  const rows = db.query<Record<string, unknown>>(
    `SELECT s.* FROM ${fromClause} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return rows.map(rowToSavedWord);
}
