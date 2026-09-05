import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { FRIENDS_MODULE } from '../definition';
import {
  cascadeDeletePerson,
  exportAllData,
  exportCSV,
  getDataStats,
  deleteAllData,
} from '../security';
import { getSetting, setSetting, getSettings, deleteSetting } from '../db/crud/settings';

let adapter: DatabaseAdapter;
let closeDb: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('friends', FRIENDS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

// ── Helpers ────────────────────────────────────────────────────────

function insertPerson(id: string, name: string = 'Test Person'): void {
  adapter.execute(
    `INSERT INTO fn_people (id, display_name, relationship_type, created_at, updated_at)
     VALUES (?, ?, 'friend', datetime('now'), datetime('now'))`,
    [id, name],
  );
}

function insertGift(id: string, personId: string): void {
  adapter.execute(
    `INSERT INTO fn_gifts (id, person_id, direction, description, created_at)
     VALUES (?, ?, 'given', 'Test gift', datetime('now'))`,
    [id, personId],
  );
}

function insertGiftIdea(id: string, personId: string): void {
  adapter.execute(
    `INSERT INTO fn_gift_ideas (id, person_id, description, created_at, updated_at)
     VALUES (?, ?, 'Gift idea', datetime('now'), datetime('now'))`,
    [id, personId],
  );
}

function insertMemory(id: string, personIds: string[]): void {
  adapter.execute(
    `INSERT INTO fn_memories (id, person_ids, title, type, created_at)
     VALUES (?, ?, 'Test memory', 'memory', datetime('now'))`,
    [id, JSON.stringify(personIds)],
  );
}

function insertLifeEvent(id: string, personId: string): void {
  adapter.execute(
    `INSERT INTO fn_life_events (id, person_id, type, created_at)
     VALUES (?, ?, 'job', datetime('now'))`,
    [id, personId],
  );
}

function insertNudge(id: string, personId: string): void {
  adapter.execute(
    `INSERT INTO fn_nudges (id, person_id, type, triggered_at, created_at)
     VALUES (?, ?, 'havent_seen', datetime('now'), datetime('now'))`,
    [id, personId],
  );
}

function insertPhoto(id: string, personId: string): void {
  adapter.execute(
    `INSERT INTO fn_photos (id, person_id, local_uri, created_at)
     VALUES (?, ?, '/path/to/photo.jpg', datetime('now'))`,
    [id, personId],
  );
}

function insertCircle(id: string, memberIds: string[]): void {
  adapter.execute(
    `INSERT INTO fn_circles (id, name, member_ids, created_at, updated_at)
     VALUES (?, 'Test Circle', ?, datetime('now'), datetime('now'))`,
    [id, JSON.stringify(memberIds)],
  );
}

function insertHangout(id: string, peopleIds: string[]): void {
  adapter.execute(
    `INSERT INTO fn_hangouts (id, people_ids, happened_at, created_at)
     VALUES (?, ?, datetime('now'), datetime('now'))`,
    [id, JSON.stringify(peopleIds)],
  );
}

// ── cascadeDeletePerson ────────────────────────────────────────────

describe('cascadeDeletePerson', () => {
  it('deletes the person record', () => {
    insertPerson('p1');
    const result = cascadeDeletePerson(adapter, 'p1');
    expect(result.people).toBe(1);

    const rows = adapter.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM fn_people WHERE id = 'p1'`,
    );
    expect(rows[0].cnt).toBe(0);
  });

  it('deletes associated gifts', () => {
    insertPerson('p1');
    insertGift('g1', 'p1');
    insertGift('g2', 'p1');

    const result = cascadeDeletePerson(adapter, 'p1');
    expect(result.gifts).toBe(2);

    const rows = adapter.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM fn_gifts WHERE person_id = 'p1'`,
    );
    expect(rows[0].cnt).toBe(0);
  });

  it('deletes associated gift ideas', () => {
    insertPerson('p1');
    insertGiftIdea('gi1', 'p1');

    const result = cascadeDeletePerson(adapter, 'p1');
    expect(result.giftIdeas).toBe(1);
  });

  it('deletes memories where person appears in person_ids', () => {
    insertPerson('p1');
    insertPerson('p2');
    insertMemory('m1', ['p1', 'p2']);
    insertMemory('m2', ['p1']);
    insertMemory('m3', ['p2']); // should NOT be deleted

    const result = cascadeDeletePerson(adapter, 'p1');
    expect(result.memories).toBe(2);

    const remaining = adapter.query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM fn_memories`,
    );
    expect(remaining[0].cnt).toBe(1); // m3 survives
  });

  it('deletes associated life events', () => {
    insertPerson('p1');
    insertLifeEvent('le1', 'p1');

    const result = cascadeDeletePerson(adapter, 'p1');
    expect(result.lifeEvents).toBe(1);
  });

  it('deletes associated nudges', () => {
    insertPerson('p1');
    insertNudge('n1', 'p1');
    insertNudge('n2', 'p1');

    const result = cascadeDeletePerson(adapter, 'p1');
    expect(result.nudges).toBe(2);
  });

  it('deletes associated photos', () => {
    insertPerson('p1');
    insertPhoto('ph1', 'p1');

    const result = cascadeDeletePerson(adapter, 'p1');
    expect(result.photos).toBe(1);
  });

  it('removes person from circle member_ids', () => {
    insertPerson('p1');
    insertPerson('p2');
    insertCircle('c1', ['p1', 'p2']);
    insertCircle('c2', ['p1']);

    const result = cascadeDeletePerson(adapter, 'p1');
    expect(result.circlesUpdated).toBe(2);

    const c1 = adapter.query<{ member_ids: string }>(
      `SELECT member_ids FROM fn_circles WHERE id = 'c1'`,
    );
    expect(JSON.parse(c1[0].member_ids)).toEqual(['p2']);

    const c2 = adapter.query<{ member_ids: string }>(
      `SELECT member_ids FROM fn_circles WHERE id = 'c2'`,
    );
    expect(JSON.parse(c2[0].member_ids)).toEqual([]);
  });

  it('removes person from hangout people_ids', () => {
    insertPerson('p1');
    insertPerson('p2');
    insertHangout('h1', ['p1', 'p2']);

    const result = cascadeDeletePerson(adapter, 'p1');
    expect(result.hangoutsUpdated).toBe(1);

    const h1 = adapter.query<{ people_ids: string }>(
      `SELECT people_ids FROM fn_hangouts WHERE id = 'h1'`,
    );
    expect(JSON.parse(h1[0].people_ids)).toEqual(['p2']);
  });

  it('returns zeros when person has no associated data', () => {
    insertPerson('p1');
    const result = cascadeDeletePerson(adapter, 'p1');
    expect(result.people).toBe(1);
    expect(result.gifts).toBe(0);
    expect(result.giftIdeas).toBe(0);
    expect(result.memories).toBe(0);
    expect(result.lifeEvents).toBe(0);
    expect(result.nudges).toBe(0);
    expect(result.photos).toBe(0);
    expect(result.circlesUpdated).toBe(0);
    expect(result.hangoutsUpdated).toBe(0);
  });
});

// ── exportAllData ──────────────────────────────────────────────────

describe('exportAllData', () => {
  it('returns complete data structure', () => {
    insertPerson('p1', 'Alice');
    insertCircle('c1', ['p1']);
    insertHangout('h1', ['p1']);
    insertGift('g1', 'p1');
    insertGiftIdea('gi1', 'p1');
    insertMemory('m1', ['p1']);
    insertLifeEvent('le1', 'p1');
    insertNudge('n1', 'p1');
    insertPhoto('ph1', 'p1');
    setSetting(adapter, 'nudge_enabled', 'true');

    const exported = exportAllData(adapter);

    expect(exported.exportedAt).toBeTruthy();
    expect(exported.version).toBe('1.0.0');
    expect(exported.data.people).toHaveLength(1);
    expect(exported.data.circles).toHaveLength(1);
    expect(exported.data.hangouts).toHaveLength(1);
    expect(exported.data.gifts).toHaveLength(1);
    expect(exported.data.giftIdeas).toHaveLength(1);
    expect(exported.data.memories).toHaveLength(1);
    expect(exported.data.lifeEvents).toHaveLength(1);
    expect(exported.data.nudges).toHaveLength(1);
    expect(exported.data.photos).toHaveLength(1);
    expect(exported.data.settings).toEqual({ nudge_enabled: 'true' });
  });

  it('returns empty arrays when no data exists', () => {
    const exported = exportAllData(adapter);

    expect(exported.data.people).toHaveLength(0);
    expect(exported.data.circles).toHaveLength(0);
    expect(exported.data.hangouts).toHaveLength(0);
    expect(exported.data.settings).toEqual({});
  });
});

// ── exportCSV ─────────────────────────────────────────────────────

describe('exportCSV', () => {
  it('exports a table as CSV with headers', () => {
    setSetting(adapter, 'nudge_enabled', 'true');
    setSetting(adapter, 'biometric_lock_enabled', 'false');

    const csv = exportCSV(adapter, 'fn_settings');
    const lines = csv.split('\n');

    expect(lines[0]).toBe('key,value');
    expect(lines.length).toBe(3); // header + 2 rows
  });

  it('returns empty string for empty table', () => {
    const csv = exportCSV(adapter, 'fn_settings');
    expect(csv).toBe('');
  });

  it('throws for non-whitelisted table', () => {
    expect(() => exportCSV(adapter, 'sqlite_master')).toThrow(
      'not a valid export target',
    );
  });

  it('escapes CSV values with commas', () => {
    insertPerson('p1', 'Smith, John');
    const csv = exportCSV(adapter, 'fn_people');
    expect(csv).toContain('"Smith, John"');
  });
});

// ── getDataStats ───────────────────────────────────────────────────

describe('getDataStats', () => {
  it('returns correct counts', () => {
    insertPerson('p1');
    insertPerson('p2');
    insertCircle('c1', ['p1']);
    insertHangout('h1', ['p1']);
    insertGift('g1', 'p1');
    insertGiftIdea('gi1', 'p1');
    insertMemory('m1', ['p1']);
    insertLifeEvent('le1', 'p1');
    insertNudge('n1', 'p1');
    insertPhoto('ph1', 'p1');

    const stats = getDataStats(adapter);

    expect(stats.people).toBe(2);
    expect(stats.circles).toBe(1);
    expect(stats.hangouts).toBe(1);
    expect(stats.gifts).toBe(1);
    expect(stats.giftIdeas).toBe(1);
    expect(stats.memories).toBe(1);
    expect(stats.lifeEvents).toBe(1);
    expect(stats.nudges).toBe(1);
    expect(stats.photos).toBe(1);
  });

  it('returns zeros for empty database', () => {
    const stats = getDataStats(adapter);
    expect(stats.people).toBe(0);
    expect(stats.circles).toBe(0);
    expect(stats.hangouts).toBe(0);
    expect(stats.gifts).toBe(0);
    expect(stats.giftIdeas).toBe(0);
    expect(stats.memories).toBe(0);
    expect(stats.lifeEvents).toBe(0);
    expect(stats.nudges).toBe(0);
    expect(stats.photos).toBe(0);
  });
});

// ── Settings CRUD ──────────────────────────────────────────────────

describe('Settings CRUD', () => {
  it('getSetting returns null for non-existent key', () => {
    const val = getSetting(adapter, 'biometric_lock_enabled');
    expect(val).toBeNull();
  });

  it('setSetting creates a new setting', () => {
    setSetting(adapter, 'nudge_enabled', 'true');
    const val = getSetting(adapter, 'nudge_enabled');
    expect(val).toBe('true');
  });

  it('setSetting upserts existing setting', () => {
    setSetting(adapter, 'default_nudge_days', '30');
    setSetting(adapter, 'default_nudge_days', '60');
    const val = getSetting(adapter, 'default_nudge_days');
    expect(val).toBe('60');
  });

  it('getSettings returns all settings as record', () => {
    setSetting(adapter, 'nudge_enabled', 'true');
    setSetting(adapter, 'biometric_lock_enabled', 'false');

    const all = getSettings(adapter);
    expect(all).toEqual({
      nudge_enabled: 'true',
      biometric_lock_enabled: 'false',
    });
  });

  it('deleteSetting removes a setting', () => {
    setSetting(adapter, 'nudge_enabled', 'true');
    deleteSetting(adapter, 'nudge_enabled');
    const val = getSetting(adapter, 'nudge_enabled');
    expect(val).toBeNull();
  });
});

// ── deleteAllData ─────────────────────────────────────────────────

describe('deleteAllData', () => {
  it('wipes all tables', () => {
    insertPerson('p1');
    insertCircle('c1', ['p1']);
    insertHangout('h1', ['p1']);
    insertGift('g1', 'p1');
    insertGiftIdea('gi1', 'p1');
    insertMemory('m1', ['p1']);
    insertLifeEvent('le1', 'p1');
    insertNudge('n1', 'p1');
    insertPhoto('ph1', 'p1');
    setSetting(adapter, 'nudge_enabled', 'true');

    deleteAllData(adapter);

    const stats = getDataStats(adapter);
    expect(stats.people).toBe(0);
    expect(stats.circles).toBe(0);
    expect(stats.hangouts).toBe(0);
    expect(stats.gifts).toBe(0);
    expect(stats.giftIdeas).toBe(0);
    expect(stats.memories).toBe(0);
    expect(stats.lifeEvents).toBe(0);
    expect(stats.nudges).toBe(0);
    expect(stats.photos).toBe(0);

    const settings = getSettings(adapter);
    expect(Object.keys(settings)).toHaveLength(0);
  });
});
