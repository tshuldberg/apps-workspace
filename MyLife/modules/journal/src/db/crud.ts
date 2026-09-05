import type { DatabaseAdapter } from '@mylife/db';
import {
  CreateJournalEntryInputSchema,
  CreateJournalNotebookInputSchema,
  JournalEntryFilterSchema,
  UpdateJournalEntryInputSchema,
  type CreateJournalEntryInput,
  type CreateJournalNotebookInput,
  type JournalDashboard,
  type JournalEntry,
  type JournalEntryFilter,
  type JournalExportBundle,
  type JournalNotebook,
  type JournalOnThisDayItem,
  type JournalSearchResult,
  type JournalSetting,
  type JournalTag,
  type UpdateJournalEntryInput,
} from '../types';
import { calculateJournalStreak, countWords } from '../engine/stats';
import { DEFAULT_JOURNAL_ID } from './schema';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTagName(value: string): string {
  return value.trim().toLowerCase();
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (ch) => `\\${ch}`);
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

function parseImageUris(raw: unknown): string[] {
  if (typeof raw !== 'string') {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function rowToJournal(row: Record<string, unknown>): JournalNotebook {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    color: (row.color as string) ?? null,
    isDefault: Number(row.is_default ?? 0) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToEntry(row: Record<string, unknown>, tags: string[] = []): JournalEntry {
  return {
    id: row.id as string,
    journalId: (row.journal_id as string) ?? DEFAULT_JOURNAL_ID,
    entryDate: row.entry_date as string,
    title: (row.title as string) ?? null,
    body: row.body as string,
    tags,
    mood: (row.mood as JournalEntry['mood']) ?? null,
    imageUris: parseImageUris(row.image_uris_json),
    wordCount: row.word_count as number,
    // Voice-to-text (V3)
    audioPath: (row.audio_path as string) ?? null,
    audioDurationMs: (row.audio_duration_ms as number) ?? null,
    transcriptionSource: (row.transcription_source as JournalEntry['transcriptionSource']) ?? null,
    // Metadata (V3)
    latitude: (row.latitude as number) ?? null,
    longitude: (row.longitude as number) ?? null,
    placeName: (row.place_name as string) ?? null,
    timezone: (row.timezone as string) ?? null,
    weatherTempC: (row.weather_temp_c as number) ?? null,
    weatherDescription: (row.weather_description as string) ?? null,
    weatherIcon: (row.weather_icon as string) ?? null,
    // Therapy (V3)
    entryType: (row.entry_type as JournalEntry['entryType']) ?? 'standard',
    therapySessionNumber: (row.therapy_session_number as number) ?? null,
    therapyTemplateType: (row.therapy_template_type as JournalEntry['therapyTemplateType']) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToTag(row: Record<string, unknown>): JournalTag {
  return {
    id: row.id as string,
    name: row.name as string,
    color: (row.color as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function ensureDefaultJournal(db: DatabaseAdapter): JournalNotebook {
  const existing = db.query<Record<string, unknown>>(
    `SELECT * FROM jn_journals WHERE is_default = 1 ORDER BY created_at ASC LIMIT 1`,
  )[0];
  if (existing) {
    return rowToJournal(existing);
  }

  const fallback = db.query<Record<string, unknown>>(
    `SELECT * FROM jn_journals ORDER BY created_at ASC LIMIT 1`,
  )[0];
  if (fallback) {
    db.execute(`UPDATE jn_journals SET is_default = 1, updated_at = ? WHERE id = ?`, [nowIso(), fallback.id]);
    return rowToJournal({ ...fallback, is_default: 1 });
  }

  const createdAt = nowIso();
  db.execute(
    `INSERT INTO jn_journals (id, name, description, color, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [DEFAULT_JOURNAL_ID, 'Daily Journal', 'Default notebook for daily writing', '#A78BFA', createdAt, createdAt],
  );

  return {
    id: DEFAULT_JOURNAL_ID,
    name: 'Daily Journal',
    description: 'Default notebook for daily writing',
    color: '#A78BFA',
    isDefault: true,
    createdAt,
    updatedAt: createdAt,
  };
}

function getTagsForEntry(db: DatabaseAdapter, entryId: string): string[] {
  return db.query<{ name: string }>(
    `SELECT t.name
     FROM jn_tags t
     INNER JOIN jn_entry_tags et ON et.tag_id = t.id
     WHERE et.entry_id = ?
     ORDER BY t.name ASC`,
    [entryId],
  ).map((row) => row.name);
}

function batchGetTagsForEntries(
  db: DatabaseAdapter,
  entryIds: string[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (entryIds.length === 0) return result;

  // SQLite has a variable limit (~999). Batch in chunks of 500.
  const CHUNK_SIZE = 500;
  for (let i = 0; i < entryIds.length; i += CHUNK_SIZE) {
    const chunk = entryIds.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => '?').join(', ');
    const rows = db.query<{ entry_id: string; name: string }>(
      `SELECT et.entry_id, t.name
       FROM jn_tags t
       INNER JOIN jn_entry_tags et ON et.tag_id = t.id
       WHERE et.entry_id IN (${placeholders})
       ORDER BY t.name ASC`,
      chunk,
    );

    for (const row of rows) {
      const tags = result.get(row.entry_id) ?? [];
      tags.push(row.name);
      result.set(row.entry_id, tags);
    }
  }

  return result;
}

function syncEntryTags(db: DatabaseAdapter, entryId: string, tags: string[], createdAt: string): void {
  db.execute(`DELETE FROM jn_entry_tags WHERE entry_id = ?`, [entryId]);

  for (const tagName of [...new Set(tags.map(normalizeTagName).filter(Boolean))]) {
    const newTagId = createId('jn_tag');
    db.execute(
      `INSERT INTO jn_tags (id, name, color, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO NOTHING`,
      [newTagId, tagName, null, createdAt],
    );
    const tagId = db.query<{ id: string }>(`SELECT id FROM jn_tags WHERE name = ?`, [tagName])[0]?.id ?? newTagId;

    db.execute(
      `INSERT OR IGNORE INTO jn_entry_tags (id, entry_id, tag_id, created_at) VALUES (?, ?, ?, ?)`,
      [createId('jn_entry_tag'), entryId, tagId, createdAt],
    );
  }
}

export function createJournalNotebook(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateJournalNotebookInput,
): JournalNotebook {
  const input = CreateJournalNotebookInputSchema.parse(rawInput);
  const createdAt = nowIso();

  db.transaction(() => {
    if (input.isDefault) {
      db.execute(`UPDATE jn_journals SET is_default = 0, updated_at = ?`, [createdAt]);
    }

    db.execute(
      `INSERT INTO jn_journals (id, name, description, color, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.name, input.description, input.color, input.isDefault ? 1 : 0, createdAt, createdAt],
    );
  });

  return getJournalNotebookById(db, id)!;
}

export function getJournalNotebookById(db: DatabaseAdapter, id: string): JournalNotebook | null {
  ensureDefaultJournal(db);
  const row = db.query<Record<string, unknown>>(`SELECT * FROM jn_journals WHERE id = ?`, [id])[0];
  return row ? rowToJournal(row) : null;
}

export function listJournalNotebooks(db: DatabaseAdapter): JournalNotebook[] {
  ensureDefaultJournal(db);
  return db
    .query<Record<string, unknown>>(`SELECT * FROM jn_journals ORDER BY is_default DESC, name ASC`)
    .map(rowToJournal);
}

export function createJournalEntry(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateJournalEntryInput,
): JournalEntry {
  const input = CreateJournalEntryInputSchema.parse(rawInput);
  const now = nowIso();
  const entryDate = input.entryDate ?? dateOnly(now);
  const wordCount = countWords(input.body);
  const journalId = input.journalId ?? ensureDefaultJournal(db).id;

  db.transaction(() => {
    db.execute(
      `INSERT INTO jn_entries (
        id, journal_id, entry_date, title, body, mood, image_uris_json, word_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        journalId,
        entryDate,
        input.title,
        input.body,
        input.mood,
        JSON.stringify(input.imageUris),
        wordCount,
        now,
        now,
      ],
    );

    syncEntryTags(db, id, input.tags, now);
  });

  return getJournalEntryById(db, id)!;
}

export function getJournalEntryById(db: DatabaseAdapter, id: string): JournalEntry | null {
  ensureDefaultJournal(db);
  const rows = db.query<Record<string, unknown>>(`SELECT * FROM jn_entries WHERE id = ?`, [id]);
  if (!rows[0]) {
    return null;
  }
  return rowToEntry(rows[0], getTagsForEntry(db, id));
}

export function listJournalEntries(db: DatabaseAdapter, rawFilter?: JournalEntryFilter): JournalEntry[] {
  ensureDefaultJournal(db);
  const filter = JournalEntryFilterSchema.parse(rawFilter ?? {});
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.journalId) {
    conditions.push('e.journal_id = ?');
    params.push(filter.journalId);
  }
  if (filter.startDate) {
    conditions.push('e.entry_date >= ?');
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    conditions.push('e.entry_date <= ?');
    params.push(filter.endDate);
  }
  if (filter.mood) {
    conditions.push('e.mood = ?');
    params.push(filter.mood);
  }
  if (filter.tag) {
    conditions.push(
      `e.id IN (
        SELECT et.entry_id
        FROM jn_entry_tags et
        INNER JOIN jn_tags t ON t.id = et.tag_id
        WHERE t.name = ?
      )`,
    );
    params.push(normalizeTagName(filter.tag));
  }
  if (filter.search) {
    conditions.push(`(LOWER(COALESCE(e.title, '')) LIKE ? ESCAPE '\\' OR LOWER(e.body) LIKE ? ESCAPE '\\')`);
    const like = `%${escapeLike(filter.search.toLowerCase())}%`;
    params.push(like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.query<Record<string, unknown>>(
    `SELECT e.* FROM jn_entries e ${where}
     ORDER BY e.entry_date DESC, e.updated_at DESC
     LIMIT ? OFFSET ?`,
    [...params, filter.limit, filter.offset],
  );

  const entryIds = rows.map((row) => row.id as string);
  const tagMap = batchGetTagsForEntries(db, entryIds);
  return rows.map((row) => rowToEntry(row, tagMap.get(row.id as string) ?? []));
}

export function searchJournalEntries(
  db: DatabaseAdapter,
  query: string,
  limit = 20,
  journalId?: string,
): JournalSearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return listJournalEntries(db, { search: normalized, limit, journalId }).map((entry) => ({
    ...entry,
    matchedTagNames: entry.tags.filter((tag) => tag.includes(normalized)),
  }));
}

export function updateJournalEntry(
  db: DatabaseAdapter,
  id: string,
  rawInput: UpdateJournalEntryInput,
): JournalEntry | null {
  const existing = getJournalEntryById(db, id);
  if (!existing) {
    return null;
  }

  const updates = UpdateJournalEntryInputSchema.parse(rawInput);
  const nextEntry = {
    journalId: updates.journalId ?? existing.journalId,
    entryDate: updates.entryDate ?? existing.entryDate,
    title: updates.title === undefined ? existing.title : updates.title,
    body: updates.body ?? existing.body,
    mood: updates.mood === undefined ? existing.mood : updates.mood,
    imageUris: updates.imageUris ?? existing.imageUris,
    tags: updates.tags ?? existing.tags,
  };
  const nextWordCount = countWords(nextEntry.body);
  const now = nowIso();

  db.transaction(() => {
    db.execute(
      `UPDATE jn_entries
       SET journal_id = ?, entry_date = ?, title = ?, body = ?, mood = ?, image_uris_json = ?, word_count = ?, updated_at = ?
       WHERE id = ?`,
      [
        nextEntry.journalId,
        nextEntry.entryDate,
        nextEntry.title,
        nextEntry.body,
        nextEntry.mood,
        JSON.stringify(nextEntry.imageUris),
        nextWordCount,
        now,
        id,
      ],
    );
    syncEntryTags(db, id, nextEntry.tags, now);
  });

  return getJournalEntryById(db, id);
}

export function deleteJournalEntry(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM jn_entries WHERE id = ?`, [id]);
}

export function getEntriesForDate(db: DatabaseAdapter, entryDate: string, journalId?: string): JournalEntry[] {
  return listJournalEntries(db, { journalId, startDate: entryDate, endDate: entryDate, limit: 50 });
}

export function listJournalTags(db: DatabaseAdapter, journalId?: string): JournalTag[] {
  ensureDefaultJournal(db);
  const rows = journalId
    ? db.query<Record<string, unknown>>(
      `SELECT DISTINCT t.*
       FROM jn_tags t
       INNER JOIN jn_entry_tags et ON et.tag_id = t.id
       INNER JOIN jn_entries e ON e.id = et.entry_id
       WHERE e.journal_id = ?
       ORDER BY t.name ASC`,
      [journalId],
    )
    : db.query<Record<string, unknown>>(`SELECT * FROM jn_tags ORDER BY name ASC`);

  return rows.map(rowToTag);
}

export function getJournalSetting(db: DatabaseAdapter, key: string): string | null {
  const row = db.query<{ value: string }>(`SELECT value FROM jn_settings WHERE key = ?`, [key])[0];
  return row?.value ?? null;
}

export function setJournalSetting(db: DatabaseAdapter, key: string, value: string): JournalSetting {
  db.execute(
    `INSERT INTO jn_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );

  return { key, value };
}

export function getJournalDashboard(
  db: DatabaseAdapter,
  referenceDate = new Date().toISOString().slice(0, 10),
  journalId?: string,
): JournalDashboard {
  ensureDefaultJournal(db);
  const where = journalId ? `WHERE journal_id = ?` : '';
  const params = journalId ? [journalId] : [];
  const entryCount = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM jn_entries ${where}`,
    params,
  )[0]?.count ?? 0;
  const totalWords = db.query<{ total: number | null }>(
    `SELECT SUM(word_count) as total FROM jn_entries ${where}`,
    params,
  )[0]?.total ?? 0;
  const monthlyWords = db.query<{ total: number | null }>(
    `SELECT SUM(word_count) as total
     FROM jn_entries
     ${journalId ? 'WHERE journal_id = ? AND ' : 'WHERE '} substr(entry_date, 1, 7) = substr(?, 1, 7)`,
    journalId ? [journalId, referenceDate] : [referenceDate],
  )[0]?.total ?? 0;
  const latestMood = db.query<{ mood: JournalDashboard['latestMood'] }>(
    `SELECT mood
     FROM jn_entries
     ${journalId ? 'WHERE journal_id = ? AND mood IS NOT NULL' : 'WHERE mood IS NOT NULL'}
     ORDER BY entry_date DESC, updated_at DESC LIMIT 1`,
    journalId ? [journalId] : [],
  )[0]?.mood ?? null;
  const distinctDates = db.query<{ entry_date: string }>(
    `SELECT DISTINCT entry_date
     FROM jn_entries
     ${where}
     ORDER BY entry_date DESC
     LIMIT 1000`,
    params,
  ).map((row) => row.entry_date);
  const streak = calculateJournalStreak(distinctDates, referenceDate);

  const journalCount = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM jn_journals`,
  )[0]?.count ?? 0;

  return {
    entryCount,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    totalWords,
    monthlyWords,
    latestMood,
    journalCount,
  };
}

export function listOnThisDayEntries(
  db: DatabaseAdapter,
  referenceDate = new Date().toISOString().slice(0, 10),
  journalId?: string,
  limit = 20,
): JournalOnThisDayItem[] {
  ensureDefaultJournal(db);
  const rows = db.query<Record<string, unknown>>(
    `SELECT *
     FROM jn_entries
     WHERE strftime('%m-%d', entry_date) = strftime('%m-%d', ?)
       AND entry_date < ?
       ${journalId ? 'AND journal_id = ?' : ''}
     ORDER BY entry_date DESC
     LIMIT ?`,
    journalId ? [referenceDate, referenceDate, journalId, limit] : [referenceDate, referenceDate, limit],
  );

  const entryIds = rows.map((row) => row.id as string);
  const tagMap = batchGetTagsForEntries(db, entryIds);
  return rows.map((row) => {
    const entry = rowToEntry(row, tagMap.get(row.id as string) ?? []);
    return {
      ...entry,
      yearsAgo: Number(referenceDate.slice(0, 4)) - Number(entry.entryDate.slice(0, 4)),
    };
  });
}

export function exportJournalData(db: DatabaseAdapter, journalId?: string): JournalExportBundle {
  const journals = journalId
    ? (() => {
      const journal = getJournalNotebookById(db, journalId);
      return journal ? [journal] : [];
    })()
    : listJournalNotebooks(db);

  // Export must include ALL entries, not a truncated page.
  // JournalEntryFilterSchema.limit maxes at 200 per page, so we
  // paginate internally to collect everything.
  const entries: JournalEntry[] = [];
  let offset = 0;
  const PAGE = 200;
  for (;;) {
    const page = listJournalEntries(db, { journalId, limit: PAGE, offset });
    entries.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  const tags = listJournalTags(db, journalId);
  const settings = db
    .query<Record<string, unknown>>(`SELECT * FROM jn_settings ORDER BY key ASC`)
    .map((row) => ({ key: row.key as string, value: row.value as string }));

  return {
    journals,
    entries,
    tags,
    settings,
    onThisDay: listOnThisDayEntries(db, new Date().toISOString().slice(0, 10), journalId, 20),
  };
}
