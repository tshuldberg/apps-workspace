import type { DatabaseAdapter } from '@mylife/db';
import {
  DreamCreateSchema,
  DreamListOptionsSchema,
  DreamStatsSchema,
  DreamUpdateSchema,
  normalizeDreamEmotions,
  normalizeDreamPeople,
  normalizeDreamThemes,
  rowToDream,
  stringifyDreamStringArray,
  type Dream,
  type DreamCreateInput,
  type DreamListOptions,
  type DreamStats,
  type DreamUpdateInput,
  type DreamType,
} from '../../models/dream-schemas';
import {
  DREAM_DICTIONARY_NOTES_SETTING_KEY,
  parseDreamDictionaryNotes,
  serializeDreamDictionaryNotes,
  updateDreamDictionaryNotesMap,
  type DreamDictionaryNotesMap,
} from '../../engine/dream-patterns';

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeDreamTypeFlags(
  type: DreamType,
  isLucid: boolean,
  isRecurring: boolean,
  recurringGroupId: string | null | undefined,
  fallbackGroupId: string,
): {
  is_lucid: boolean;
  is_recurring: boolean;
  recurring_group_id: string | null;
} {
  const nextIsLucid = isLucid || type === 'lucid';
  const nextIsRecurring = isRecurring || type === 'recurring';

  return {
    is_lucid: nextIsLucid,
    is_recurring: nextIsRecurring,
    recurring_group_id: nextIsRecurring
      ? recurringGroupId ?? fallbackGroupId
      : null,
  };
}

function queryDreamCount(
  db: DatabaseAdapter,
  where?: string,
): number {
  const rows = db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM sl_dreams${where ? ` WHERE ${where}` : ''}`,
  );
  return rows[0]?.count ?? 0;
}

function queryTopFacet(
  db: DatabaseAdapter,
  column: 'themes' | 'emotions',
): DreamStats['topThemes'] {
  const rows = db.query<{ value: string; count: number }>(
    `SELECT lower(trim(j.value)) as value, COUNT(*) as count
     FROM sl_dreams d, json_each(d.${column}) j
     WHERE trim(j.value) != ''
     GROUP BY lower(trim(j.value))
     ORDER BY count DESC, value ASC
     LIMIT 10`,
  );

  return rows.map((row) => ({
    value: row.value,
    count: row.count,
  }));
}

export function createDream(
  db: DatabaseAdapter,
  rawInput: DreamCreateInput,
): Dream {
  const input = DreamCreateSchema.parse(rawInput);
  const id = crypto.randomUUID();
  const now = nowIso();
  const themes = normalizeDreamThemes(input.themes);
  const people = normalizeDreamPeople(input.people);
  const emotions = normalizeDreamEmotions(input.emotions);
  const flags = normalizeDreamTypeFlags(
    input.type,
    input.is_lucid,
    input.is_recurring,
    input.recurring_group_id ?? null,
    id,
  );

  db.execute(
    `INSERT INTO sl_dreams
      (id, sleep_entry_id, date, content_md, type, themes, people, emotions,
       is_lucid, is_recurring, recurring_group_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.sleep_entry_id ?? null,
      input.date,
      input.content_md.trim(),
      input.type,
      stringifyDreamStringArray(themes),
      stringifyDreamStringArray(people),
      stringifyDreamStringArray(emotions),
      flags.is_lucid ? 1 : 0,
      flags.is_recurring ? 1 : 0,
      flags.recurring_group_id,
      now,
    ],
  );

  return rowToDream({
    id,
    sleep_entry_id: input.sleep_entry_id ?? null,
    date: input.date,
    content_md: input.content_md.trim(),
    type: input.type,
    themes: stringifyDreamStringArray(themes),
    people: stringifyDreamStringArray(people),
    emotions: stringifyDreamStringArray(emotions),
    is_lucid: flags.is_lucid ? 1 : 0,
    is_recurring: flags.is_recurring ? 1 : 0,
    recurring_group_id: flags.recurring_group_id,
    sketch_photo_id: null,
    created_at: now,
  });
}

export function getDream(db: DatabaseAdapter, id: string): Dream | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM sl_dreams WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToDream(rows[0]) : null;
}

export function updateDream(
  db: DatabaseAdapter,
  id: string,
  rawInput: DreamUpdateInput,
): Dream | null {
  const existing = getDream(db, id);
  if (!existing) {
    return null;
  }

  const updates = DreamUpdateSchema.parse(rawInput);
  if (Object.keys(updates).length === 0) {
    return existing;
  }

  const type = updates.type ?? existing.type;
  const themes =
    updates.themes === undefined
      ? existing.themes
      : normalizeDreamThemes(updates.themes);
  const people =
    updates.people === undefined
      ? existing.people
      : normalizeDreamPeople(updates.people);
  const emotions =
    updates.emotions === undefined
      ? existing.emotions
      : normalizeDreamEmotions(updates.emotions);
  const flags = normalizeDreamTypeFlags(
    type,
    updates.is_lucid ?? existing.is_lucid,
    updates.is_recurring ?? existing.is_recurring,
    updates.recurring_group_id ?? existing.recurring_group_id,
    existing.recurring_group_id ?? id,
  );

  db.execute(
    `UPDATE sl_dreams
     SET sleep_entry_id = ?, date = ?, content_md = ?, type = ?, themes = ?,
         people = ?, emotions = ?, is_lucid = ?, is_recurring = ?,
         recurring_group_id = ?
     WHERE id = ?`,
    [
      updates.sleep_entry_id ?? existing.sleep_entry_id,
      updates.date ?? existing.date,
      updates.content_md?.trim() ?? existing.content_md,
      type,
      stringifyDreamStringArray(themes),
      stringifyDreamStringArray(people),
      stringifyDreamStringArray(emotions),
      flags.is_lucid ? 1 : 0,
      flags.is_recurring ? 1 : 0,
      flags.recurring_group_id,
      id,
    ],
  );

  return getDream(db, id);
}

export function deleteDream(db: DatabaseAdapter, id: string): boolean {
  const existing = getDream(db, id);
  if (!existing) {
    return false;
  }

  db.execute(`DELETE FROM sl_dreams WHERE id = ?`, [id]);
  return true;
}

export function listDreams(
  db: DatabaseAdapter,
  rawOptions?: DreamListOptions,
): Dream[] {
  const options = DreamListOptionsSchema.parse(rawOptions ?? {});
  const where: string[] = [];
  const params: unknown[] = [];

  if (options.startDate) {
    where.push('d.date >= ?');
    params.push(options.startDate);
  }
  if (options.endDate) {
    where.push('d.date <= ?');
    params.push(options.endDate);
  }
  if (options.type) {
    where.push('d.type = ?');
    params.push(options.type);
  }
  if (options.theme) {
    where.push(
      `EXISTS (
        SELECT 1
        FROM json_each(d.themes)
        WHERE lower(json_each.value) = lower(?)
      )`,
    );
    params.push(options.theme);
  }

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db.query<Record<string, unknown>>(
    `SELECT d.*
     FROM sl_dreams d
     ${whereClause}
     ORDER BY d.date DESC, d.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return rows.map(rowToDream);
}

export function listAllDreams(
  db: DatabaseAdapter,
  pageSize: number = 500,
): Dream[] {
  const limit = Math.max(1, Math.min(500, Math.trunc(pageSize) || 500));
  const dreams: Dream[] = [];
  let offset = 0;

  while (true) {
    const page = listDreams(db, { limit, offset });
    dreams.push(...page);

    if (page.length < limit) {
      break;
    }

    offset += limit;
  }

  return dreams;
}

export function getDreamsByEntry(
  db: DatabaseAdapter,
  sleepEntryId: string,
): Dream[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT *
     FROM sl_dreams
     WHERE sleep_entry_id = ?
     ORDER BY date DESC, created_at DESC`,
    [sleepEntryId],
  );
  return rows.map(rowToDream);
}

export function getRecurringGroup(
  db: DatabaseAdapter,
  groupId: string,
): Dream[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT *
     FROM sl_dreams
     WHERE recurring_group_id = ?
        OR (id = ? AND is_recurring = 1 AND recurring_group_id IS NULL)
     ORDER BY date ASC, created_at ASC`,
    [groupId, groupId],
  );
  return rows.map(rowToDream);
}

export function getDreamStats(db: DatabaseAdapter): DreamStats {
  return DreamStatsSchema.parse({
    totalDreams: queryDreamCount(db),
    lucidCount: queryDreamCount(db, `is_lucid = 1 OR type = 'lucid'`),
    nightmareCount: queryDreamCount(db, `type = 'nightmare'`),
    recurringCount: queryDreamCount(
      db,
      `is_recurring = 1 OR type = 'recurring'`,
    ),
    topThemes: queryTopFacet(db, 'themes'),
    topEmotions: queryTopFacet(db, 'emotions'),
  });
}

export function getDreamDictionaryNotes(
  db: DatabaseAdapter,
): DreamDictionaryNotesMap {
  const rawValue = db.query<{ value: string | null }>(
    `SELECT value FROM sl_settings WHERE key = ? LIMIT 1`,
    [DREAM_DICTIONARY_NOTES_SETTING_KEY],
  )[0]?.value;

  return parseDreamDictionaryNotes(rawValue);
}

export function setDreamDictionaryNote(
  db: DatabaseAdapter,
  theme: string,
  note: string | null | undefined,
): DreamDictionaryNotesMap {
  const nextNotes = updateDreamDictionaryNotesMap(
    getDreamDictionaryNotes(db),
    theme,
    note,
  );

  if (Object.keys(nextNotes).length === 0) {
    db.execute(`DELETE FROM sl_settings WHERE key = ?`, [
      DREAM_DICTIONARY_NOTES_SETTING_KEY,
    ]);
    return nextNotes;
  }

  db.execute(
    `INSERT OR REPLACE INTO sl_settings (key, value) VALUES (?, ?)`,
    [
      DREAM_DICTIONARY_NOTES_SETTING_KEY,
      serializeDreamDictionaryNotes(nextNotes),
    ],
  );

  return nextNotes;
}
