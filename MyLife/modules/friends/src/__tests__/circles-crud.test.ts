import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { FRIENDS_MODULE } from '../definition';
import {
  createCircle,
  getCircle,
  updateCircle,
  deleteCircle,
  listCircles,
  addMember,
  removeMember,
  getCirclesForPerson,
  removePersonFromAllCircles,
} from '../db/crud/circles';

let db: DatabaseAdapter;
let closeDb: () => void;

beforeEach(() => {
  const testDb = createModuleTestDatabase('friends', FRIENDS_MODULE.migrations!);
  db = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

// ── Create ────────────────────────────────────────────────────────────

describe('createCircle', () => {
  it('creates a circle with initial members', () => {
    const circle = createCircle(db, {
      name: 'College Friends',
      description: 'People from university',
      icon: '🎓',
      color: '#3B82F6',
      member_ids: ['person-1', 'person-2'],
    });

    expect(circle.id).toBeTruthy();
    expect(circle.name).toBe('College Friends');
    expect(circle.description).toBe('People from university');
    expect(circle.icon).toBe('🎓');
    expect(circle.color).toBe('#3B82F6');
    expect(circle.member_ids).toEqual(['person-1', 'person-2']);
    expect(circle.created_at).toBeTruthy();
    expect(circle.updated_at).toBeTruthy();
  });

  it('creates a circle with no members (valid)', () => {
    const circle = createCircle(db, { name: 'Empty Group' });

    expect(circle.name).toBe('Empty Group');
    expect(circle.member_ids).toEqual([]);
    expect(circle.description).toBeNull();
    expect(circle.icon).toBeNull();
    expect(circle.color).toBeNull();
  });

  it('rejects empty name', () => {
    expect(() => createCircle(db, { name: '' })).toThrow();
  });
});

// ── Read ──────────────────────────────────────────────────────────────

describe('getCircle', () => {
  it('returns circle with deserialized member_ids', () => {
    const created = createCircle(db, {
      name: 'Work',
      member_ids: ['p1', 'p2', 'p3'],
    });

    const fetched = getCircle(db, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe('Work');
    expect(fetched!.member_ids).toEqual(['p1', 'p2', 'p3']);
  });

  it('returns null for non-existent circle', () => {
    expect(getCircle(db, 'does-not-exist')).toBeNull();
  });
});

// ── Update ────────────────────────────────────────────────────────────

describe('updateCircle', () => {
  it('partially updates circle fields', () => {
    const circle = createCircle(db, {
      name: 'Old Name',
      color: '#000000',
    });

    // Force a later timestamp by manually setting created_at in the past.
    db.execute(
      `UPDATE fn_circles SET created_at = ?, updated_at = ? WHERE id = ?`,
      ['2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z', circle.id],
    );

    updateCircle(db, circle.id, { name: 'New Name' });
    const updated = getCircle(db, circle.id)!;

    expect(updated.name).toBe('New Name');
    expect(updated.color).toBe('#000000'); // unchanged
    expect(updated.updated_at).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('updates member_ids via update', () => {
    const circle = createCircle(db, { name: 'Test' });
    updateCircle(db, circle.id, { member_ids: ['a', 'b'] });

    const updated = getCircle(db, circle.id)!;
    expect(updated.member_ids).toEqual(['a', 'b']);
  });

  it('no-ops when update has no fields', () => {
    const circle = createCircle(db, { name: 'Test' });
    updateCircle(db, circle.id, {});

    const fetched = getCircle(db, circle.id)!;
    expect(fetched.updated_at).toBe(circle.updated_at);
  });
});

// ── Delete ────────────────────────────────────────────────────────────

describe('deleteCircle', () => {
  it('removes circle without affecting people', () => {
    const circle = createCircle(db, {
      name: 'Temp',
      member_ids: ['person-1'],
    });

    deleteCircle(db, circle.id);
    expect(getCircle(db, circle.id)).toBeNull();

    // People table should still have the person (we only check circle is gone;
    // people CRUD is in a separate module, so we verify by absence of cascade).
  });

  it('is safe to delete non-existent circle', () => {
    expect(() => deleteCircle(db, 'does-not-exist')).not.toThrow();
  });
});

// ── List ──────────────────────────────────────────────────────────────

describe('listCircles', () => {
  it('returns circles sorted by name', () => {
    createCircle(db, { name: 'Zebra' });
    createCircle(db, { name: 'Alpha' });
    createCircle(db, { name: 'Middle' });

    const list = listCircles(db);
    expect(list.map((c) => c.name)).toEqual(['Alpha', 'Middle', 'Zebra']);
  });

  it('returns empty array when no circles exist', () => {
    expect(listCircles(db)).toEqual([]);
  });
});

// ── addMember ─────────────────────────────────────────────────────────

describe('addMember', () => {
  it('appends person to member_ids JSON', () => {
    const circle = createCircle(db, {
      name: 'Group',
      member_ids: ['p1'],
    });

    addMember(db, circle.id, 'p2');
    const updated = getCircle(db, circle.id)!;
    expect(updated.member_ids).toEqual(['p1', 'p2']);
  });

  it('is idempotent (adding same person twice produces no duplicate)', () => {
    const circle = createCircle(db, {
      name: 'Group',
      member_ids: ['p1'],
    });

    addMember(db, circle.id, 'p1');
    addMember(db, circle.id, 'p1');
    const updated = getCircle(db, circle.id)!;
    expect(updated.member_ids).toEqual(['p1']);
  });

  it('is safe for non-existent circle', () => {
    expect(() => addMember(db, 'ghost', 'p1')).not.toThrow();
  });
});

// ── removeMember ──────────────────────────────────────────────────────

describe('removeMember', () => {
  it('removes person from member_ids JSON', () => {
    const circle = createCircle(db, {
      name: 'Group',
      member_ids: ['p1', 'p2', 'p3'],
    });

    removeMember(db, circle.id, 'p2');
    const updated = getCircle(db, circle.id)!;
    expect(updated.member_ids).toEqual(['p1', 'p3']);
  });

  it('is safe to remove non-existent member (no-op)', () => {
    const circle = createCircle(db, {
      name: 'Group',
      member_ids: ['p1'],
    });

    removeMember(db, circle.id, 'does-not-exist');
    const updated = getCircle(db, circle.id)!;
    expect(updated.member_ids).toEqual(['p1']);
  });

  it('is safe for non-existent circle', () => {
    expect(() => removeMember(db, 'ghost', 'p1')).not.toThrow();
  });
});

// ── getCirclesForPerson ───────────────────────────────────────────────

describe('getCirclesForPerson', () => {
  it('returns all circles containing the person', () => {
    createCircle(db, { name: 'A', member_ids: ['p1', 'p2'] });
    createCircle(db, { name: 'B', member_ids: ['p2', 'p3'] });
    createCircle(db, { name: 'C', member_ids: ['p3'] });

    const circles = getCirclesForPerson(db, 'p2');
    expect(circles).toHaveLength(2);
    expect(circles.map((c) => c.name).sort()).toEqual(['A', 'B']);
  });

  it('returns empty array when person is in no circles', () => {
    createCircle(db, { name: 'A', member_ids: ['p1'] });
    expect(getCirclesForPerson(db, 'p999')).toEqual([]);
  });
});

// ── removePersonFromAllCircles ────────────────────────────────────────

describe('removePersonFromAllCircles', () => {
  it('removes person from every circle they belong to', () => {
    createCircle(db, { name: 'A', member_ids: ['p1', 'target'] });
    createCircle(db, { name: 'B', member_ids: ['target', 'p2'] });
    createCircle(db, { name: 'C', member_ids: ['p3'] });

    removePersonFromAllCircles(db, 'target');

    const circles = listCircles(db);
    for (const c of circles) {
      expect(c.member_ids).not.toContain('target');
    }

    // Other members unaffected
    const a = circles.find((c) => c.name === 'A')!;
    expect(a.member_ids).toEqual(['p1']);
    const b = circles.find((c) => c.name === 'B')!;
    expect(b.member_ids).toEqual(['p2']);
    const cCircle = circles.find((c) => c.name === 'C')!;
    expect(cCircle.member_ids).toEqual(['p3']);
  });

  it('is safe when person is in no circles', () => {
    createCircle(db, { name: 'A', member_ids: ['p1'] });
    expect(() => removePersonFromAllCircles(db, 'nobody')).not.toThrow();
  });
});
