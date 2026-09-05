import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { FRIENDS_MODULE } from '../definition';
import { createPerson } from '../db/crud/people';
import {
  createMemory,
  getMemory,
  updateMemory,
  deleteMemory,
  listMemories,
  listMemoriesForPerson,
  getInsideJokes,
  getMemoryAnniversaries,
} from '../db/crud/memories';
import { createJournalEntry } from '../db/crud/journal';

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

// ── CRUD round-trip ──────────────────────────────────────────────────

describe('createMemory', () => {
  it('creates a memory with all fields', () => {
    const memory = createMemory(db, {
      title: 'Road trip to Big Sur',
      description_md: 'Best weekend ever.',
      person_ids: [p1Id, p2Id],
      happened_at: '2025-06-15T10:00:00.000Z',
      tags: ['travel', 'road-trip'],
      is_inside_joke: false,
    });

    expect(memory.id).toBeTruthy();
    expect(memory.title).toBe('Road trip to Big Sur');
    expect(memory.description_md).toBe('Best weekend ever.');
    expect(memory.person_ids).toEqual([p1Id, p2Id]);
    expect(memory.happened_at).toBe('2025-06-15T10:00:00.000Z');
    expect(memory.tags).toEqual(['travel', 'road-trip']);
    expect(memory.is_inside_joke).toBe(false);
    expect(memory.type).toBe('memory');
    expect(memory.created_at).toBeTruthy();
  });

  it('defaults happened_at to now when not provided', () => {
    const memory = createMemory(db, { title: 'Quick note' });
    expect(memory.happened_at).toBeTruthy();
  });
});

describe('getMemory', () => {
  it('retrieves a memory by id', () => {
    const created = createMemory(db, {
      title: 'Test memory',
      person_ids: [p1Id],
      tags: ['fun'],
    });

    const retrieved = getMemory(db, created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe('Test memory');
    expect(retrieved!.person_ids).toEqual([p1Id]);
    expect(retrieved!.tags).toEqual(['fun']);
  });

  it('returns null for nonexistent id', () => {
    expect(getMemory(db, 'nonexistent')).toBeNull();
  });
});

describe('updateMemory', () => {
  it('partially updates a memory', () => {
    const memory = createMemory(db, {
      title: 'Original',
      tags: ['old'],
      is_inside_joke: false,
    });

    updateMemory(db, memory.id, {
      title: 'Updated',
      is_inside_joke: true,
      tags: ['new', 'updated'],
    });

    const updated = getMemory(db, memory.id);
    expect(updated!.title).toBe('Updated');
    expect(updated!.is_inside_joke).toBe(true);
    expect(updated!.tags).toEqual(['new', 'updated']);
  });
});

describe('deleteMemory', () => {
  it('removes a memory', () => {
    const memory = createMemory(db, { title: 'To delete' });
    deleteMemory(db, memory.id);
    expect(getMemory(db, memory.id)).toBeNull();
  });
});

// ── Inside joke filtering ────────────────────────────────────────────

describe('getInsideJokes', () => {
  it('returns only inside jokes', () => {
    createMemory(db, { title: 'Normal', is_inside_joke: false });
    createMemory(db, { title: 'Joke 1', is_inside_joke: true, person_ids: [p1Id] });
    createMemory(db, { title: 'Joke 2', is_inside_joke: true, person_ids: [p2Id] });

    const jokes = getInsideJokes(db);
    expect(jokes).toHaveLength(2);
    expect(jokes.every((j) => j.is_inside_joke)).toBe(true);
  });

  it('filters inside jokes by person', () => {
    createMemory(db, { title: 'Joke A', is_inside_joke: true, person_ids: [p1Id] });
    createMemory(db, { title: 'Joke B', is_inside_joke: true, person_ids: [p2Id] });

    const jokesForAlice = getInsideJokes(db, p1Id);
    expect(jokesForAlice).toHaveLength(1);
    expect(jokesForAlice[0].title).toBe('Joke A');
  });
});

// ── Multi-person memory retrieval ────────────────────────────────────

describe('multi-person memories', () => {
  it('retrieves memory with 2 person_ids', () => {
    const memory = createMemory(db, {
      title: 'Group hangout',
      person_ids: [p1Id, p2Id],
    });

    const forAlice = listMemoriesForPerson(db, p1Id);
    const forBob = listMemoriesForPerson(db, p2Id);

    expect(forAlice).toHaveLength(1);
    expect(forAlice[0].id).toBe(memory.id);
    expect(forBob).toHaveLength(1);
    expect(forBob[0].id).toBe(memory.id);
  });
});

// ── List by person filters correctly ─────────────────────────────────

describe('listMemories filters', () => {
  it('filters by person_id', () => {
    createMemory(db, { title: 'With Alice', person_ids: [p1Id] });
    createMemory(db, { title: 'With Bob', person_ids: [p2Id] });

    const result = listMemories(db, { person_id: p1Id });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('With Alice');
  });

  it('filters by is_inside_joke', () => {
    createMemory(db, { title: 'Normal', is_inside_joke: false });
    createMemory(db, { title: 'Joke', is_inside_joke: true });

    const jokes = listMemories(db, { is_inside_joke: true });
    expect(jokes).toHaveLength(1);
    expect(jokes[0].title).toBe('Joke');
  });

  it('filters by date range', () => {
    createMemory(db, { title: 'Old', happened_at: '2024-01-01T00:00:00.000Z' });
    createMemory(db, { title: 'Recent', happened_at: '2025-06-01T00:00:00.000Z' });

    const result = listMemories(db, { date_from: '2025-01-01T00:00:00.000Z' });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Recent');
  });
});

// ── Tags serialize/deserialize ───────────────────────────────────────

describe('tags', () => {
  it('serializes and deserializes tags correctly', () => {
    const memory = createMemory(db, {
      title: 'Tagged',
      tags: ['funny', 'party', 'late-night'],
    });

    const retrieved = getMemory(db, memory.id);
    expect(retrieved!.tags).toEqual(['funny', 'party', 'late-night']);
  });

  it('filters by tag', () => {
    createMemory(db, { title: 'Party memory', tags: ['party', 'fun'] });
    createMemory(db, { title: 'Work memory', tags: ['work'] });

    const partyMemories = listMemories(db, { tag: 'party' });
    expect(partyMemories).toHaveLength(1);
    expect(partyMemories[0].title).toBe('Party memory');
  });
});

// ── Anniversary detection ────────────────────────────────────────────

describe('getMemoryAnniversaries', () => {
  it('detects memory from 1 year ago today', () => {
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    createMemory(db, {
      title: 'Anniversary memory',
      happened_at: oneYearAgo.toISOString(),
    });

    const anniversaries = getMemoryAnniversaries(db, now);
    expect(anniversaries).toHaveLength(1);
    expect(anniversaries[0].title).toBe('Anniversary memory');
  });

  it('excludes memories from current year', () => {
    const now = new Date();
    const thisYear = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    createMemory(db, {
      title: 'Recent memory',
      happened_at: thisYear.toISOString(),
    });

    const anniversaries = getMemoryAnniversaries(db, now);
    expect(anniversaries).toHaveLength(0);
  });

  it('excludes memories outside 7-day window', () => {
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate() + 15);

    createMemory(db, {
      title: 'Far away',
      happened_at: twoYearsAgo.toISOString(),
    });

    const anniversaries = getMemoryAnniversaries(db, now);
    expect(anniversaries).toHaveLength(0);
  });
});

// ── Does not include journal entries ─────────────────────────────────

describe('isolation from journal entries', () => {
  it('listMemories excludes journal entries', () => {
    createMemory(db, { title: 'A real memory', person_ids: [p1Id] });
    createJournalEntry(db, {
      person_id: p1Id,
      type: 'gratitude',
      title: 'Grateful for Alice',
    });

    const memories = listMemories(db);
    expect(memories).toHaveLength(1);
    expect(memories[0].title).toBe('A real memory');
  });

  it('getInsideJokes excludes journal entries', () => {
    createMemory(db, { title: 'Inside joke', is_inside_joke: true });
    createJournalEntry(db, {
      person_id: p1Id,
      type: 'conflict',
      title: 'Conflict entry',
    });

    const jokes = getInsideJokes(db);
    expect(jokes).toHaveLength(1);
    expect(jokes[0].title).toBe('Inside joke');
  });
});

// ── Validation ───────────────────────────────────────────────────────

describe('validation', () => {
  it('rejects memory with empty title', () => {
    expect(() => createMemory(db, { title: '' })).toThrow();
  });
});
