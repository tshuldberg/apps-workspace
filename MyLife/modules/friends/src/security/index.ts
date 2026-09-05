/**
 * Security and privacy utilities for MyFriends.
 *
 * - cascadeDeletePerson: thorough wipe of a person from all tables
 * - exportAllData: full JSON backup of all friends data
 * - exportCSV: single table CSV export
 * - getDataStats: row counts for all tables
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { CascadeDeleteResult, DataStats, FriendsExport } from './types';

export type { CascadeDeleteResult, DataStats, FriendsExport } from './types';

// ── Cascade Delete ──────────────────────────────────────────────────

/**
 * Completely removes a person and all associated data from the database.
 * Handles:
 * - fn_people row
 * - fn_gifts where person_id matches
 * - fn_gift_ideas where person_id matches
 * - fn_memories where person appears in person_ids JSON array
 * - fn_life_events where person_id matches
 * - fn_nudges where person_id matches
 * - fn_photos where person_id matches
 * - fn_circles: removes person from member_ids JSON arrays
 * - fn_hangouts: removes person from people_ids JSON arrays
 */
export function cascadeDeletePerson(
  db: DatabaseAdapter,
  personId: string,
): CascadeDeleteResult {
  const result: CascadeDeleteResult = {
    people: 0,
    gifts: 0,
    giftIdeas: 0,
    memories: 0,
    lifeEvents: 0,
    nudges: 0,
    photos: 0,
    circlesUpdated: 0,
    hangoutsUpdated: 0,
  };

  // Direct foreign key deletes
  const giftsDeleted = db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM fn_gifts WHERE person_id = ?`,
    [personId],
  );
  result.gifts = giftsDeleted[0]?.cnt ?? 0;
  db.execute(`DELETE FROM fn_gifts WHERE person_id = ?`, [personId]);

  const ideasDeleted = db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM fn_gift_ideas WHERE person_id = ?`,
    [personId],
  );
  result.giftIdeas = ideasDeleted[0]?.cnt ?? 0;
  db.execute(`DELETE FROM fn_gift_ideas WHERE person_id = ?`, [personId]);

  const eventsDeleted = db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM fn_life_events WHERE person_id = ?`,
    [personId],
  );
  result.lifeEvents = eventsDeleted[0]?.cnt ?? 0;
  db.execute(`DELETE FROM fn_life_events WHERE person_id = ?`, [personId]);

  const nudgesDeleted = db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM fn_nudges WHERE person_id = ?`,
    [personId],
  );
  result.nudges = nudgesDeleted[0]?.cnt ?? 0;
  db.execute(`DELETE FROM fn_nudges WHERE person_id = ?`, [personId]);

  const photosDeleted = db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM fn_photos WHERE person_id = ?`,
    [personId],
  );
  result.photos = photosDeleted[0]?.cnt ?? 0;
  db.execute(`DELETE FROM fn_photos WHERE person_id = ?`, [personId]);

  // Memories: person_ids is a JSON array. Delete memories where this person appears.
  const memoriesDeleted = db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM fn_memories WHERE person_ids LIKE ?`,
    [`%"${personId}"%`],
  );
  result.memories = memoriesDeleted[0]?.cnt ?? 0;
  db.execute(`DELETE FROM fn_memories WHERE person_ids LIKE ?`, [
    `%"${personId}"%`,
  ]);

  // Circles: remove person from member_ids JSON arrays
  const circlesWithPerson = db.query<{ id: string; member_ids: string }>(
    `SELECT id, member_ids FROM fn_circles WHERE member_ids LIKE ?`,
    [`%"${personId}"%`],
  );
  for (const circle of circlesWithPerson) {
    const members: string[] = JSON.parse(circle.member_ids);
    const filtered = members.filter((id) => id !== personId);
    db.execute(`UPDATE fn_circles SET member_ids = ?, updated_at = ? WHERE id = ?`, [
      JSON.stringify(filtered),
      new Date().toISOString(),
      circle.id,
    ]);
  }
  result.circlesUpdated = circlesWithPerson.length;

  // Hangouts: remove person from people_ids JSON arrays
  const hangoutsWithPerson = db.query<{ id: string; people_ids: string }>(
    `SELECT id, people_ids FROM fn_hangouts WHERE people_ids LIKE ?`,
    [`%"${personId}"%`],
  );
  for (const hangout of hangoutsWithPerson) {
    const people: string[] = JSON.parse(hangout.people_ids);
    const filtered = people.filter((id) => id !== personId);
    db.execute(`UPDATE fn_hangouts SET people_ids = ? WHERE id = ?`, [
      JSON.stringify(filtered),
      hangout.id,
    ]);
  }
  result.hangoutsUpdated = hangoutsWithPerson.length;

  // Finally delete the person record itself
  const personExists = db.query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM fn_people WHERE id = ?`,
    [personId],
  );
  result.people = personExists[0]?.cnt ?? 0;
  db.execute(`DELETE FROM fn_people WHERE id = ?`, [personId]);

  return result;
}

// ── Export All Data ─────────────────────────────────────────────────

/**
 * Exports all MyFriends data as a structured JSON object for backup.
 */
export function exportAllData(db: DatabaseAdapter): FriendsExport {
  const people = db.query<Record<string, unknown>>(`SELECT * FROM fn_people`);
  const circles = db.query<Record<string, unknown>>(`SELECT * FROM fn_circles`);
  const hangouts = db.query<Record<string, unknown>>(`SELECT * FROM fn_hangouts`);
  const gifts = db.query<Record<string, unknown>>(`SELECT * FROM fn_gifts`);
  const giftIdeas = db.query<Record<string, unknown>>(`SELECT * FROM fn_gift_ideas`);
  const memories = db.query<Record<string, unknown>>(`SELECT * FROM fn_memories`);
  const lifeEvents = db.query<Record<string, unknown>>(`SELECT * FROM fn_life_events`);
  const nudges = db.query<Record<string, unknown>>(`SELECT * FROM fn_nudges`);
  const photos = db.query<Record<string, unknown>>(`SELECT * FROM fn_photos`);
  const settingsRows = db.query<{ key: string; value: string }>(`SELECT * FROM fn_settings`);

  const settings: Record<string, string> = {};
  for (const row of settingsRows) {
    settings[row.key] = row.value;
  }

  return {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    data: {
      people,
      circles,
      hangouts,
      gifts,
      giftIdeas,
      memories,
      lifeEvents,
      nudges,
      photos,
      settings,
    },
  };
}

// ── Export CSV ──────────────────────────────────────────────────────

const TABLE_WHITELIST = new Set([
  'fn_people',
  'fn_circles',
  'fn_hangouts',
  'fn_gifts',
  'fn_gift_ideas',
  'fn_memories',
  'fn_life_events',
  'fn_nudges',
  'fn_photos',
  'fn_settings',
]);

/**
 * Exports a single table as a CSV string.
 * Only whitelisted fn_ tables are allowed.
 */
export function exportCSV(db: DatabaseAdapter, table: string): string {
  if (!TABLE_WHITELIST.has(table)) {
    throw new Error(`Table "${table}" is not a valid export target`);
  }

  const rows = db.query<Record<string, unknown>>(`SELECT * FROM ${table}`);
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const lines: string[] = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape CSV values containing commas, quotes, or newlines
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

// ── Data Stats ─────────────────────────────────────────────────────

/**
 * Returns row counts for all friends tables. Used in the settings UI.
 */
export function getDataStats(db: DatabaseAdapter): DataStats {
  const count = (table: string): number => {
    const rows = db.query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${table}`);
    return rows[0]?.cnt ?? 0;
  };

  return {
    people: count('fn_people'),
    circles: count('fn_circles'),
    hangouts: count('fn_hangouts'),
    gifts: count('fn_gifts'),
    giftIdeas: count('fn_gift_ideas'),
    memories: count('fn_memories'),
    lifeEvents: count('fn_life_events'),
    nudges: count('fn_nudges'),
    photos: count('fn_photos'),
  };
}

// ── Delete All Data ─────────────────────────────────────────────────

/**
 * Deletes ALL MyFriends data from all tables. Used for the "nuclear option."
 * Settings are also wiped.
 */
export function deleteAllData(db: DatabaseAdapter): void {
  db.execute(`DELETE FROM fn_photos`);
  db.execute(`DELETE FROM fn_nudges`);
  db.execute(`DELETE FROM fn_life_events`);
  db.execute(`DELETE FROM fn_memories`);
  db.execute(`DELETE FROM fn_gift_ideas`);
  db.execute(`DELETE FROM fn_gifts`);
  db.execute(`DELETE FROM fn_hangouts`);
  db.execute(`DELETE FROM fn_circles`);
  db.execute(`DELETE FROM fn_people`);
  db.execute(`DELETE FROM fn_settings`);
}
