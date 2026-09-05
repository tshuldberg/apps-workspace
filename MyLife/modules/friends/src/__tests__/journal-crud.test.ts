import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { FRIENDS_MODULE } from '../definition';
import { createPerson } from '../db/crud/people';
import {
  createJournalEntry,
  listJournalForPerson,
  deleteJournalEntry,
  countJournalByType,
} from '../db/crud/journal';

let db: DatabaseAdapter;
let closeDb: () => void;
let p1Id: string;
let p2Id: string;

beforeEach(() => {
  const testDb = createModuleTestDatabase('friends', FRIENDS_MODULE.migrations!);
  db = testDb.adapter;
  closeDb = testDb.close;

  const person1 = createPerson(db, { display_name: 'Alice', relationship_type: 'friend' });
  const person2 = createPerson(db, { display_name: 'Bob', relationship_type: 'friend' });
  p1Id = person1.id;
  p2Id = person2.id;
});

afterEach(() => {
  closeDb();
});

// ── Create journal entries ─────────────────────────────────────────

describe('createJournalEntry', () => {
  it('creates a gratitude entry for a person', () => {
    const entry = createJournalEntry(db, {
      person_id: p1Id,
      type: 'gratitude',
      title: 'Always listens',
      description_md: 'Alice is always there when I need to talk.',
    });

    expect(entry.id).toBeTruthy();
    expect(entry.type).toBe('gratitude');
    expect(entry.title).toBe('Always listens');
    expect(entry.description_md).toBe('Alice is always there when I need to talk.');
    expect(entry.happened_at).toBeTruthy();
    expect(entry.created_at).toBeTruthy();
  });

  it('creates a conflict entry', () => {
    const entry = createJournalEntry(db, {
      person_id: p1Id,
      type: 'conflict',
      title: 'Missed plans',
      description_md: 'Cancelled last minute again.',
    });

    expect(entry.type).toBe('conflict');
    expect(entry.title).toBe('Missed plans');
  });

  it('creates a growth entry', () => {
    const entry = createJournalEntry(db, {
      person_id: p1Id,
      type: 'growth',
      title: 'Better at boundaries',
    });

    expect(entry.type).toBe('growth');
    expect(entry.description_md).toBeNull();
  });

  it('stores person_id in person_ids JSON array', () => {
    const entry = createJournalEntry(db, {
      person_id: p1Id,
      type: 'gratitude',
      title: 'Kind',
    });

    expect(entry.person_ids).toEqual([p1Id]);
  });
});

// ── List by type ──────────────────────────────────────────────────

describe('listJournalForPerson', () => {
  it('returns correct subset when filtered by type', () => {
    createJournalEntry(db, { person_id: p1Id, type: 'gratitude', title: 'G1' });
    createJournalEntry(db, { person_id: p1Id, type: 'gratitude', title: 'G2' });
    createJournalEntry(db, { person_id: p1Id, type: 'conflict', title: 'C1' });
    createJournalEntry(db, { person_id: p1Id, type: 'growth', title: 'Gr1' });

    const gratitude = listJournalForPerson(db, p1Id, 'gratitude');
    expect(gratitude).toHaveLength(2);
    expect(gratitude.every((e) => e.type === 'gratitude')).toBe(true);

    const conflict = listJournalForPerson(db, p1Id, 'conflict');
    expect(conflict).toHaveLength(1);
    expect(conflict[0].title).toBe('C1');

    const growth = listJournalForPerson(db, p1Id, 'growth');
    expect(growth).toHaveLength(1);
  });

  it('returns all journal types when no filter is provided', () => {
    createJournalEntry(db, { person_id: p1Id, type: 'gratitude', title: 'G1' });
    createJournalEntry(db, { person_id: p1Id, type: 'conflict', title: 'C1' });
    createJournalEntry(db, { person_id: p1Id, type: 'growth', title: 'Gr1' });

    const all = listJournalForPerson(db, p1Id);
    expect(all).toHaveLength(3);
  });

  it('excludes entries for other people', () => {
    createJournalEntry(db, { person_id: p1Id, type: 'gratitude', title: 'For Alice' });
    createJournalEntry(db, { person_id: p2Id, type: 'gratitude', title: 'For Bob' });

    const aliceEntries = listJournalForPerson(db, p1Id);
    expect(aliceEntries).toHaveLength(1);
    expect(aliceEntries[0].title).toBe('For Alice');
  });

  it('excludes regular memory type entries', () => {
    // Insert a regular memory directly
    db.execute(
      `INSERT INTO fn_memories (id, person_ids, title, type, created_at)
       VALUES (?, ?, ?, 'memory', datetime('now'))`,
      [crypto.randomUUID(), JSON.stringify([p1Id]), 'A regular memory'],
    );
    createJournalEntry(db, { person_id: p1Id, type: 'gratitude', title: 'Journal entry' });

    const entries = listJournalForPerson(db, p1Id);
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('Journal entry');
  });
});

// ── Delete ────────────────────────────────────────────────────────

describe('deleteJournalEntry', () => {
  it('removes the entry', () => {
    const entry = createJournalEntry(db, {
      person_id: p1Id,
      type: 'gratitude',
      title: 'Deleted one',
    });

    deleteJournalEntry(db, entry.id);

    const remaining = listJournalForPerson(db, p1Id);
    expect(remaining).toHaveLength(0);
  });
});

// ── Count by type ─────────────────────────────────────────────────

describe('countJournalByType', () => {
  it('returns accurate counts per type', () => {
    createJournalEntry(db, { person_id: p1Id, type: 'gratitude', title: 'G1' });
    createJournalEntry(db, { person_id: p1Id, type: 'gratitude', title: 'G2' });
    createJournalEntry(db, { person_id: p1Id, type: 'gratitude', title: 'G3' });
    createJournalEntry(db, { person_id: p1Id, type: 'conflict', title: 'C1' });
    createJournalEntry(db, { person_id: p1Id, type: 'growth', title: 'Gr1' });
    createJournalEntry(db, { person_id: p1Id, type: 'growth', title: 'Gr2' });

    const counts = countJournalByType(db, p1Id);
    expect(counts.gratitude).toBe(3);
    expect(counts.conflict).toBe(1);
    expect(counts.growth).toBe(2);
  });

  it('returns zeros when no entries exist', () => {
    const counts = countJournalByType(db, p1Id);
    expect(counts.gratitude).toBe(0);
    expect(counts.conflict).toBe(0);
    expect(counts.growth).toBe(0);
  });

  it('excludes entries for other people', () => {
    createJournalEntry(db, { person_id: p1Id, type: 'gratitude', title: 'For Alice' });
    createJournalEntry(db, { person_id: p2Id, type: 'gratitude', title: 'For Bob' });

    const counts = countJournalByType(db, p1Id);
    expect(counts.gratitude).toBe(1);
  });
});

// ── Validation ────────────────────────────────────────────────────

describe('validation', () => {
  it('rejects entry with empty title', () => {
    expect(() =>
      createJournalEntry(db, {
        person_id: p1Id,
        type: 'gratitude',
        title: '',
      }),
    ).toThrow();
  });

  it('rejects entry with missing person_id', () => {
    expect(() =>
      createJournalEntry(db, {
        person_id: '',
        type: 'gratitude',
        title: 'Test',
      }),
    ).toThrow();
  });
});
