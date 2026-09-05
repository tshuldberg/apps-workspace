import { describe, it, expect, beforeEach } from 'vitest';
import { createModuleTestDatabase, type DatabaseAdapter } from '@mylife/db';
import { MANHATTAN_MODULE } from '../../definition';
import {
  buildPinNoteContext,
  buildPlanNoteContext,
  entityTagLabel,
  setEntityTags,
  getEntityTags,
  removeEntityTag,
} from '../notes-bridge';
import type { PinRow, PlanRow } from '../../types';

function pin(over: Partial<Pick<PinRow, 'id' | 'name' | 'neighborhood'>> = {}) {
  return { id: 'pin-1', name: 'Joe Coffee', neighborhood: 'West Village', ...over };
}
function plan(over: Partial<Pick<PlanRow, 'id' | 'title' | 'start_at'>> = {}) {
  return { id: 'plan-1', title: 'Dinner', start_at: '2026-06-07T19:30:00Z', ...over };
}

describe('buildPinNoteContext', () => {
  it('builds context with pin + id + slugged neighborhood tags', () => {
    const ctx = buildPinNoteContext(pin());
    expect(ctx).toEqual({
      entityId: 'pin-1',
      entityType: 'pin',
      entityTitle: 'Joe Coffee',
      subtitle: 'West Village',
      tags: ['pin', 'pin-1', 'west-village'],
    });
  });

  it('omits neighborhood tag and sets null subtitle when neighborhood is null', () => {
    const ctx = buildPinNoteContext(pin({ neighborhood: null }));
    expect(ctx.subtitle).toBeNull();
    expect(ctx.tags).toEqual(['pin', 'pin-1']);
  });
});

describe('buildPlanNoteContext', () => {
  it('builds context with plan + id + date-slice tags', () => {
    const ctx = buildPlanNoteContext(plan());
    expect(ctx).toEqual({
      entityId: 'plan-1',
      entityType: 'plan',
      entityTitle: 'Dinner',
      subtitle: '2026-06-07',
      tags: ['plan', 'plan-1', '2026-06-07'],
    });
  });

  it('omits date tag and sets null subtitle when start_at is empty', () => {
    const ctx = buildPlanNoteContext(plan({ start_at: '' }));
    expect(ctx.subtitle).toBeNull();
    expect(ctx.tags).toEqual(['plan', 'plan-1']);
  });
});

describe('entityTagLabel', () => {
  it('produces stable mh-<type>:<id> labels', () => {
    expect(entityTagLabel('pin', 'abc')).toBe('mh-pin:abc');
    expect(entityTagLabel('plan', 'xyz')).toBe('mh-plan:xyz');
  });
});

describe('tag substrate round-trip', () => {
  let db: DatabaseAdapter;
  beforeEach(() => {
    db = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!).adapter;
  });

  it('setEntityTags + getEntityTags round-trips bound labels sorted', () => {
    const bound = setEntityTags(db, 'pin', 'pin-1', ['z-tag', 'a-tag', 'm-tag']);
    expect(bound).toEqual(['z-tag', 'a-tag', 'm-tag']);
    expect(getEntityTags(db, 'pin', 'pin-1')).toEqual(['a-tag', 'm-tag', 'z-tag']);
  });

  it('re-setting the same labels is idempotent (no duplicate bindings)', () => {
    setEntityTags(db, 'plan', 'plan-1', ['dinner', 'date-night']);
    setEntityTags(db, 'plan', 'plan-1', ['dinner', 'date-night']);
    expect(getEntityTags(db, 'plan', 'plan-1')).toEqual(['date-night', 'dinner']);
  });

  it('scopes bindings by entityType and entityId', () => {
    setEntityTags(db, 'pin', 'pin-1', ['shared']);
    setEntityTags(db, 'plan', 'pin-1', ['other']);
    expect(getEntityTags(db, 'pin', 'pin-1')).toEqual(['shared']);
    expect(getEntityTags(db, 'plan', 'pin-1')).toEqual(['other']);
  });

  it('removeEntityTag drops a single binding and is idempotent', () => {
    setEntityTags(db, 'pin', 'pin-1', ['keep', 'drop']);
    removeEntityTag(db, 'pin', 'pin-1', 'drop');
    expect(getEntityTags(db, 'pin', 'pin-1')).toEqual(['keep']);
    // removing again is a no-op
    removeEntityTag(db, 'pin', 'pin-1', 'drop');
    expect(getEntityTags(db, 'pin', 'pin-1')).toEqual(['keep']);
    // removing a never-bound label is a no-op
    removeEntityTag(db, 'pin', 'pin-1', 'never');
    expect(getEntityTags(db, 'pin', 'pin-1')).toEqual(['keep']);
  });

  it('returns empty array for an entity with no tags', () => {
    expect(getEntityTags(db, 'plan', 'nope')).toEqual([]);
  });
});
