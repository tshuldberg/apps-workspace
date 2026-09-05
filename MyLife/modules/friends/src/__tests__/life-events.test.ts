import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { FRIENDS_MODULE } from '../definition';
import { createPerson, getPerson } from '../db/crud/people';
import {
  createLifeEvent,
  getLifeEvent,
  listEventsForPerson,
  acknowledgeEvent,
  deleteLifeEvent,
  listRecentEvents,
  getPeopleByCities,
} from '../db/crud/life-events';
import {
  getResponseSuggestion,
  getCityGroups,
  formatLifeEventLabel,
  getLifeEventIcon,
} from '../engine/life-chapters';

let db: DatabaseAdapter;
let closeDb: () => void;
let p1Id: string;
let p2Id: string;

beforeEach(() => {
  const testDb = createModuleTestDatabase('friends', FRIENDS_MODULE.migrations!);
  db = testDb.adapter;
  closeDb = testDb.close;

  const person1 = createPerson(db, { display_name: 'Alice', relationship_type: 'friend' });
  const person2 = createPerson(db, { display_name: 'Bob', relationship_type: 'friend', city: 'Portland' });
  p1Id = person1.id;
  p2Id = person2.id;
});

afterEach(() => {
  closeDb();
});

// ── CRUD round-trip ───────────────────────────────────────────────

describe('Life Event CRUD', () => {
  it('creates and reads a life event', () => {
    const event = createLifeEvent(db, {
      person_id: p1Id,
      type: 'job',
      description: 'Started at Acme Corp',
      happened_at: '2026-03-15T00:00:00.000Z',
    });

    expect(event.id).toBeTruthy();
    expect(event.person_id).toBe(p1Id);
    expect(event.type).toBe('job');
    expect(event.description).toBe('Started at Acme Corp');
    expect(event.acknowledged).toBe(false);

    const fetched = getLifeEvent(db, event.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.type).toBe('job');
  });

  it('deletes a life event', () => {
    const event = createLifeEvent(db, {
      person_id: p1Id,
      type: 'graduated',
      description: 'MBA from Stanford',
    });

    deleteLifeEvent(db, event.id);
    expect(getLifeEvent(db, event.id)).toBeNull();
  });
});

// ── Acknowledge ───────────────────────────────────────────────────

describe('Acknowledge event', () => {
  it('marks event as acknowledged', () => {
    const event = createLifeEvent(db, {
      person_id: p1Id,
      type: 'baby',
      description: 'Baby girl!',
    });

    expect(event.acknowledged).toBe(false);
    acknowledgeEvent(db, event.id);

    const fetched = getLifeEvent(db, event.id);
    expect(fetched!.acknowledged).toBe(true);
  });
});

// ── List for person sorted by date ────────────────────────────────

describe('List events for person', () => {
  it('returns events sorted by happened_at DESC', () => {
    createLifeEvent(db, {
      person_id: p1Id,
      type: 'job',
      description: 'First job',
      happened_at: '2024-01-01T00:00:00.000Z',
    });
    createLifeEvent(db, {
      person_id: p1Id,
      type: 'move',
      description: 'Denver',
      happened_at: '2025-06-01T00:00:00.000Z',
    });
    createLifeEvent(db, {
      person_id: p1Id,
      type: 'engaged',
      description: 'Proposal!',
      happened_at: '2026-02-14T00:00:00.000Z',
    });

    const events = listEventsForPerson(db, p1Id);
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('engaged');
    expect(events[1].type).toBe('move');
    expect(events[2].type).toBe('job');
  });

  it('does not return events for other people', () => {
    createLifeEvent(db, { person_id: p1Id, type: 'job', description: 'Job A' });
    createLifeEvent(db, { person_id: p2Id, type: 'job', description: 'Job B' });

    const events = listEventsForPerson(db, p1Id);
    expect(events).toHaveLength(1);
    expect(events[0].description).toBe('Job A');
  });
});

// ── City update on 'move' event ───────────────────────────────────

describe('City auto-update on move', () => {
  it('updates person city when a move event is created', () => {
    createLifeEvent(db, {
      person_id: p1Id,
      type: 'move',
      description: 'San Francisco',
    });

    const person = getPerson(db, p1Id);
    expect(person!.city).toBe('San Francisco');
  });

  it('does not update city for non-move events', () => {
    createLifeEvent(db, {
      person_id: p2Id,
      type: 'job',
      description: 'New York',
    });

    const person = getPerson(db, p2Id);
    expect(person!.city).toBe('Portland'); // unchanged
  });

  it('does not update city if description is empty', () => {
    createLifeEvent(db, {
      person_id: p2Id,
      type: 'move',
    });

    const person = getPerson(db, p2Id);
    expect(person!.city).toBe('Portland'); // unchanged
  });
});

// ── People by city grouping ──────────────────────────────────────

describe('People by city', () => {
  it('groups non-archived people by city', () => {
    // Set Alice's city
    createLifeEvent(db, { person_id: p1Id, type: 'move', description: 'Portland' });

    const groups = getPeopleByCities(db);
    expect(groups['Portland']).toBeDefined();
    expect(groups['Portland'].length).toBe(2); // Alice + Bob
  });

  it('excludes people with no city', () => {
    // p1 has no city initially
    const groups = getPeopleByCities(db);
    const allPeople = Object.values(groups).flat();
    const aliceInGroups = allPeople.find((p) => p.id === p1Id);
    expect(aliceInGroups).toBeUndefined();
  });
});

// ── Recent events filter ─────────────────────────────────────────

describe('Recent events', () => {
  it('returns only events within the lookback window', () => {
    createLifeEvent(db, {
      person_id: p1Id,
      type: 'job',
      description: 'Old job',
      happened_at: '2020-01-01T00:00:00.000Z',
    });
    createLifeEvent(db, {
      person_id: p1Id,
      type: 'move',
      description: 'Seattle',
      happened_at: new Date().toISOString(),
    });

    const recent = listRecentEvents(db, 30);
    expect(recent).toHaveLength(1);
    expect(recent[0].description).toBe('Seattle');
  });
});

// ── Engine: response suggestions ─────────────────────────────────

describe('Response suggestions', () => {
  it('returns a suggestion for each known type', () => {
    const types = ['move', 'job', 'baby', 'engaged', 'married', 'graduated', 'other'];
    for (const type of types) {
      const suggestion = getResponseSuggestion(type);
      expect(suggestion).toBeTruthy();
      expect(suggestion.length).toBeGreaterThan(10);
    }
  });

  it('returns fallback for unknown type', () => {
    const suggestion = getResponseSuggestion('unknown_type');
    expect(suggestion).toBeTruthy();
  });
});

// ── Engine: city groups ──────────────────────────────────────────

describe('getCityGroups', () => {
  it('groups people by city, ignoring null cities', () => {
    const people = [
      { id: '1', display_name: 'Alice', city: 'Portland' },
      { id: '2', display_name: 'Bob', city: 'Portland' },
      { id: '3', display_name: 'Carol', city: 'NYC' },
      { id: '4', display_name: 'Dave', city: null },
    ];

    const groups = getCityGroups(people);
    expect(groups.get('Portland')).toHaveLength(2);
    expect(groups.get('NYC')).toHaveLength(1);
    expect(groups.has('null')).toBe(false);
    expect(groups.size).toBe(2);
  });
});

// ── Engine: format labels ────────────────────────────────────────

describe('formatLifeEventLabel', () => {
  it('returns human-readable labels', () => {
    expect(formatLifeEventLabel('move')).toBe('Moved cities');
    expect(formatLifeEventLabel('job')).toBe('New job');
    expect(formatLifeEventLabel('baby')).toBe('Had a baby');
    expect(formatLifeEventLabel('engaged')).toBe('Got engaged');
    expect(formatLifeEventLabel('married')).toBe('Got married');
    expect(formatLifeEventLabel('graduated')).toBe('Graduated');
    expect(formatLifeEventLabel('other')).toBe('Life update');
  });

  it('returns fallback for unknown type', () => {
    expect(formatLifeEventLabel('xyz')).toBe('Life update');
  });
});

// ── Engine: icons ────────────────────────────────────────────────

describe('getLifeEventIcon', () => {
  it('returns an icon for each type', () => {
    const types = ['move', 'job', 'baby', 'engaged', 'married', 'graduated', 'other'];
    for (const type of types) {
      const icon = getLifeEventIcon(type);
      expect(icon).toBeTruthy();
    }
  });
});
