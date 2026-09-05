import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { FRIENDS_MODULE } from '../definition';
import {
  createPerson,
  getPerson,
  updatePerson,
  deletePerson,
  archivePerson,
  unarchivePerson,
  listPeople,
  searchPeople,
} from '../db/crud/people';
import { z } from 'zod';
import type { PersonInput } from '../models/schemas';
import { PersonInputSchema } from '../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;

/** Build a PersonInput with sensible defaults. Overrides use z.input shape (before Zod defaults). */
function makePerson(overrides: Partial<z.input<typeof PersonInputSchema>> = {}): PersonInput {
  return PersonInputSchema.parse({
    display_name: 'Alice Johnson',
    ...overrides,
  });
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('friends', FRIENDS_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

// ── Create ──────────────────────────────────────────────────────────

describe('createPerson', () => {
  it('returns a person with a generated UUID', () => {
    const person = createPerson(adapter, makePerson());
    expect(person.id).toBeTruthy();
    expect(person.display_name).toBe('Alice Johnson');
  });

  it('defaults relationship_type to friend', () => {
    const person = createPerson(adapter, makePerson());
    expect(person.relationship_type).toBe('friend');
  });

  it('sets timestamps', () => {
    const person = createPerson(adapter, makePerson());
    expect(person.created_at).toBeTruthy();
    expect(person.updated_at).toBeTruthy();
  });

  it('defaults nullable fields to null', () => {
    const person = createPerson(adapter, makePerson());
    expect(person.photo_local_uri).toBeNull();
    expect(person.how_met).toBeNull();
    expect(person.birthday).toBeNull();
    expect(person.contact_info).toBeNull();
    expect(person.interests).toBeNull();
    expect(person.energy_tag).toBeNull();
  });

  it('defaults is_archived to false', () => {
    const person = createPerson(adapter, makePerson());
    expect(person.is_archived).toBe(false);
  });

  it('preserves optional fields when provided', () => {
    const person = createPerson(adapter, makePerson({
      relationship_type: 'family',
      birthday: '1990-06-15',
      city: 'Portland',
      energy_tag: 'energizing',
      communication_preference: 'text',
      frequency_goal_days: 14,
      notes_md: 'My sister',
    }));
    expect(person.relationship_type).toBe('family');
    expect(person.birthday).toBe('1990-06-15');
    expect(person.city).toBe('Portland');
    expect(person.energy_tag).toBe('energizing');
    expect(person.communication_preference).toBe('text');
    expect(person.frequency_goal_days).toBe(14);
    expect(person.notes_md).toBe('My sister');
  });
});

// ── Read ────────────────────────────────────────────────────────────

describe('getPerson', () => {
  it('retrieves a person by ID', () => {
    const created = createPerson(adapter, makePerson());
    const found = getPerson(adapter, created.id);
    expect(found).not.toBeNull();
    expect(found!.display_name).toBe('Alice Johnson');
  });

  it('returns null for non-existent ID', () => {
    expect(getPerson(adapter, 'does-not-exist')).toBeNull();
  });
});

// ── Update ──────────────────────────────────────────────────────────

describe('updatePerson', () => {
  it('updates specified fields', () => {
    const person = createPerson(adapter, makePerson());
    updatePerson(adapter, person.id, { display_name: 'Alice Smith' });
    const updated = getPerson(adapter, person.id);
    expect(updated!.display_name).toBe('Alice Smith');
  });

  it('bumps updated_at', () => {
    const person = createPerson(adapter, makePerson());
    // Manually backdate the row so the update produces a newer timestamp
    adapter.execute(
      `UPDATE fn_people SET updated_at = '2000-01-01T00:00:00.000Z' WHERE id = ?`,
      [person.id],
    );
    updatePerson(adapter, person.id, { city: 'Seattle' });
    const updated = getPerson(adapter, person.id);
    expect(updated!.updated_at).not.toBe('2000-01-01T00:00:00.000Z');
  });

  it('does nothing for empty updates', () => {
    const person = createPerson(adapter, makePerson());
    updatePerson(adapter, person.id, {});
    const found = getPerson(adapter, person.id);
    expect(found!.display_name).toBe('Alice Johnson');
  });

  it('updates energy_tag', () => {
    const person = createPerson(adapter, makePerson());
    updatePerson(adapter, person.id, { energy_tag: 'draining' });
    const updated = getPerson(adapter, person.id);
    expect(updated!.energy_tag).toBe('draining');
  });

  it('updates relationship_type', () => {
    const person = createPerson(adapter, makePerson());
    updatePerson(adapter, person.id, { relationship_type: 'close_friend' });
    const updated = getPerson(adapter, person.id);
    expect(updated!.relationship_type).toBe('close_friend');
  });
});

// ── Delete ──────────────────────────────────────────────────────────

describe('deletePerson', () => {
  it('removes the person', () => {
    const person = createPerson(adapter, makePerson());
    deletePerson(adapter, person.id);
    expect(getPerson(adapter, person.id)).toBeNull();
  });

  it('does not throw for non-existent person', () => {
    expect(() => deletePerson(adapter, 'does-not-exist')).not.toThrow();
  });
});

// ── Archive / Unarchive ─────────────────────────────────────────────

describe('archivePerson / unarchivePerson', () => {
  it('archives a person', () => {
    const person = createPerson(adapter, makePerson());
    archivePerson(adapter, person.id);
    const found = getPerson(adapter, person.id);
    expect(found!.is_archived).toBe(true);
  });

  it('unarchives a person', () => {
    const person = createPerson(adapter, makePerson());
    archivePerson(adapter, person.id);
    unarchivePerson(adapter, person.id);
    const found = getPerson(adapter, person.id);
    expect(found!.is_archived).toBe(false);
  });

  it('preserves data after archive/unarchive round trip', () => {
    const person = createPerson(adapter, makePerson({
      display_name: 'Bob',
      city: 'Denver',
      relationship_type: 'colleague',
    }));
    archivePerson(adapter, person.id);
    unarchivePerson(adapter, person.id);
    const found = getPerson(adapter, person.id);
    expect(found!.display_name).toBe('Bob');
    expect(found!.city).toBe('Denver');
    expect(found!.relationship_type).toBe('colleague');
  });
});

// ── List with filters ───────────────────────────────────────────────

describe('listPeople', () => {
  beforeEach(() => {
    createPerson(adapter, makePerson({
      display_name: 'Alice',
      relationship_type: 'friend',
      energy_tag: 'energizing',
      city: 'Portland',
    }));
    createPerson(adapter, makePerson({
      display_name: 'Bob',
      relationship_type: 'family',
      energy_tag: 'neutral',
      city: 'Seattle',
    }));
    createPerson(adapter, makePerson({
      display_name: 'Charlie',
      relationship_type: 'friend',
      energy_tag: 'draining',
      city: 'Portland',
    }));
  });

  it('returns all people by default', () => {
    const people = listPeople(adapter);
    expect(people).toHaveLength(3);
  });

  it('filters by relationship_type', () => {
    const people = listPeople(adapter, { relationship_type: 'family' });
    expect(people).toHaveLength(1);
    expect(people[0].display_name).toBe('Bob');
  });

  it('filters by energy_tag', () => {
    const people = listPeople(adapter, { energy_tag: 'energizing' });
    expect(people).toHaveLength(1);
    expect(people[0].display_name).toBe('Alice');
  });

  it('filters by city', () => {
    const people = listPeople(adapter, { city: 'Portland' });
    expect(people).toHaveLength(2);
  });

  it('filters by is_archived', () => {
    const all = listPeople(adapter);
    archivePerson(adapter, all[0].id);
    const active = listPeople(adapter, { is_archived: false });
    expect(active).toHaveLength(2);
    const archived = listPeople(adapter, { is_archived: true });
    expect(archived).toHaveLength(1);
  });

  it('filters by search (name substring)', () => {
    const people = listPeople(adapter, { search: 'lic' });
    expect(people).toHaveLength(1);
    expect(people[0].display_name).toBe('Alice');
  });

  it('combines multiple filters', () => {
    const people = listPeople(adapter, {
      relationship_type: 'friend',
      city: 'Portland',
    });
    expect(people).toHaveLength(2);
    const names = people.map((p) => p.display_name);
    expect(names).toContain('Alice');
    expect(names).toContain('Charlie');
  });

  it('sorts by name_asc (default)', () => {
    const people = listPeople(adapter);
    expect(people[0].display_name).toBe('Alice');
    expect(people[1].display_name).toBe('Bob');
    expect(people[2].display_name).toBe('Charlie');
  });

  it('sorts by name_desc', () => {
    const people = listPeople(adapter, undefined, 'name_desc');
    expect(people[0].display_name).toBe('Charlie');
    expect(people[2].display_name).toBe('Alice');
  });

  it('sorts by created_at_desc', () => {
    const people = listPeople(adapter, undefined, 'created_at_desc');
    // All created in same millisecond in tests, but should not throw
    expect(people).toHaveLength(3);
  });
});

// ── Search ──────────────────────────────────────────────────────────

describe('searchPeople', () => {
  beforeEach(() => {
    createPerson(adapter, makePerson({ display_name: 'Alice Johnson' }));
    createPerson(adapter, makePerson({ display_name: 'Bob Smith' }));
    createPerson(adapter, makePerson({ display_name: 'alice wonderland' }));
  });

  it('finds by exact substring', () => {
    const results = searchPeople(adapter, 'Johnson');
    expect(results).toHaveLength(1);
    expect(results[0].display_name).toBe('Alice Johnson');
  });

  it('is case-insensitive (SQLite LIKE default)', () => {
    const results = searchPeople(adapter, 'alice');
    expect(results).toHaveLength(2);
  });

  it('returns empty for no matches', () => {
    const results = searchPeople(adapter, 'zzz_no_match');
    expect(results).toHaveLength(0);
  });
});

// ── JSON field round-trip ───────────────────────────────────────────

describe('JSON fields', () => {
  it('round-trips contact_info', () => {
    const person = createPerson(adapter, makePerson({
      contact_info: { phone: '555-1234', email: 'alice@example.com' },
    }));
    const found = getPerson(adapter, person.id);
    expect(found!.contact_info).toEqual({ phone: '555-1234', email: 'alice@example.com' });
  });

  it('round-trips quick_facts', () => {
    const person = createPerson(adapter, makePerson({
      quick_facts: { favorite_color: 'blue', pet: 'dog' },
    }));
    const found = getPerson(adapter, person.id);
    expect(found!.quick_facts).toEqual({ favorite_color: 'blue', pet: 'dog' });
  });

  it('round-trips interests', () => {
    const person = createPerson(adapter, makePerson({
      interests: ['hiking', 'cooking', 'reading'],
    }));
    const found = getPerson(adapter, person.id);
    expect(found!.interests).toEqual(['hiking', 'cooking', 'reading']);
  });

  it('handles empty arrays and objects', () => {
    const person = createPerson(adapter, makePerson({
      contact_info: {},
      quick_facts: {},
      interests: [],
    }));
    const found = getPerson(adapter, person.id);
    expect(found!.contact_info).toEqual({});
    expect(found!.quick_facts).toEqual({});
    expect(found!.interests).toEqual([]);
  });

  it('updates JSON fields correctly', () => {
    const person = createPerson(adapter, makePerson({
      interests: ['hiking'],
    }));
    updatePerson(adapter, person.id, {
      interests: ['hiking', 'swimming', 'chess'],
    });
    const updated = getPerson(adapter, person.id);
    expect(updated!.interests).toEqual(['hiking', 'swimming', 'chess']);
  });

  it('updates contact_info correctly', () => {
    const person = createPerson(adapter, makePerson({
      contact_info: { phone: '555-0000' },
    }));
    updatePerson(adapter, person.id, {
      contact_info: { phone: '555-9999', email: 'new@example.com' },
    });
    const updated = getPerson(adapter, person.id);
    expect(updated!.contact_info).toEqual({ phone: '555-9999', email: 'new@example.com' });
  });
});

// ── Zod validation ──────────────────────────────────────────────────

describe('Zod validation', () => {
  it('rejects empty display_name', () => {
    expect(() =>
      createPerson(adapter, makePerson({ display_name: '' })),
    ).toThrow();
  });

  it('rejects invalid energy_tag', () => {
    expect(() =>
      createPerson(adapter, makePerson({ energy_tag: 'invalid_tag' as never })),
    ).toThrow();
  });

  it('rejects invalid relationship_type', () => {
    expect(() =>
      createPerson(adapter, makePerson({ relationship_type: 'enemy' as never })),
    ).toThrow();
  });

  it('rejects invalid communication_preference', () => {
    expect(() =>
      createPerson(adapter, makePerson({ communication_preference: 'carrier_pigeon' as never })),
    ).toThrow();
  });

  it('rejects non-positive frequency_goal_days', () => {
    expect(() =>
      createPerson(adapter, makePerson({ frequency_goal_days: 0 })),
    ).toThrow();
    expect(() =>
      createPerson(adapter, makePerson({ frequency_goal_days: -5 })),
    ).toThrow();
  });

  it('provides a clear error message for empty display_name', () => {
    const result = PersonInputSchema.safeParse({ display_name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find((i) =>
        i.path.includes('display_name'),
      );
      expect(nameError).toBeDefined();
      expect(nameError!.message).toBe('Display name is required');
    }
  });
});
