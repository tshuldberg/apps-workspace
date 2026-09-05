import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { createTrip } from '../db/crud/trips';
import {
  createEmergencyContact,
  deleteEmergencyContact,
  getEmergencyContact,
  listEmergencyContacts,
  updateEmergencyContact,
} from '../db/crud/emergency-contacts';
import type { EmergencyContactInput } from '../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;
let tripId: string;

function makeInput(
  overrides: Partial<EmergencyContactInput> = {},
): EmergencyContactInput {
  return {
    name: 'Jane Doe',
    ...overrides,
  };
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
  const trip = createTrip(adapter, { name: 'Test Trip' });
  tripId = trip.id;
});

afterEach(() => {
  closeDb();
});

describe('createEmergencyContact', () => {
  it('returns a contact with ec_ prefixed id and timestamps', () => {
    const c = createEmergencyContact(adapter, makeInput());
    expect(c.id).toMatch(/^ec_/);
    expect(c.name).toBe('Jane Doe');
    expect(c.trip_id).toBeNull();
    expect(c.created_at).toBeTruthy();
    expect(c.updated_at).toBeTruthy();
  });

  it('persists optional fields', () => {
    const c = createEmergencyContact(
      adapter,
      makeInput({
        trip_id: tripId,
        relationship: 'spouse',
        phone: '+1-555-1234',
        email: 'jane@example.com',
        country_code: 'US',
        notes: 'ICE',
      }),
    );
    expect(c.trip_id).toBe(tripId);
    expect(c.relationship).toBe('spouse');
    expect(c.phone).toBe('+1-555-1234');
    expect(c.email).toBe('jane@example.com');
    expect(c.country_code).toBe('US');
    expect(c.notes).toBe('ICE');
  });

  it('allows creation without a trip_id (global contact)', () => {
    const c = createEmergencyContact(adapter, makeInput({ name: 'Global' }));
    expect(c.trip_id).toBeNull();
  });

  it('rejects empty name', () => {
    expect(() =>
      createEmergencyContact(adapter, makeInput({ name: '' })),
    ).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() =>
      createEmergencyContact(adapter, makeInput({ email: 'nope' })),
    ).toThrow();
  });

  it('rejects country_code with wrong length', () => {
    expect(() =>
      createEmergencyContact(adapter, makeInput({ country_code: 'USA' })),
    ).toThrow();
  });
});

describe('getEmergencyContact', () => {
  it('returns null for missing id', () => {
    expect(getEmergencyContact(adapter, 'nope')).toBeNull();
  });

  it('returns the contact row', () => {
    const c = createEmergencyContact(adapter, makeInput({ name: 'Bob' }));
    expect(getEmergencyContact(adapter, c.id)?.name).toBe('Bob');
  });
});

describe('updateEmergencyContact', () => {
  it('updates specified fields and bumps updated_at', async () => {
    const c = createEmergencyContact(adapter, makeInput());
    const before = getEmergencyContact(adapter, c.id)!;
    await new Promise((r) => setTimeout(r, 10));
    updateEmergencyContact(adapter, c.id, {
      name: 'Jane Updated',
      phone: '+1-555-9999',
    });
    const after = getEmergencyContact(adapter, c.id)!;
    expect(after.name).toBe('Jane Updated');
    expect(after.phone).toBe('+1-555-9999');
    expect(after.updated_at).not.toBe(before.updated_at);
  });

  it('ignores unknown columns (injection safety)', () => {
    const c = createEmergencyContact(adapter, makeInput({ name: 'Safe' }));
    updateEmergencyContact(adapter, c.id, {
      // @ts-expect-error testing injection safety
      malicious: "x'; DROP TABLE tv_emergency_contacts; --",
      name: 'Still Safe',
    });
    expect(getEmergencyContact(adapter, c.id)!.name).toBe('Still Safe');
  });

  it('no-ops with empty patch', () => {
    const c = createEmergencyContact(adapter, makeInput());
    const before = getEmergencyContact(adapter, c.id)!;
    updateEmergencyContact(adapter, c.id, {});
    const after = getEmergencyContact(adapter, c.id)!;
    expect(after.updated_at).toBe(before.updated_at);
  });
});

describe('deleteEmergencyContact', () => {
  it('removes a contact', () => {
    const c = createEmergencyContact(adapter, makeInput());
    deleteEmergencyContact(adapter, c.id);
    expect(getEmergencyContact(adapter, c.id)).toBeNull();
  });

  it('cascades from trip delete when trip-scoped', () => {
    const c = createEmergencyContact(
      adapter,
      makeInput({ trip_id: tripId, name: 'Trip Contact' }),
    );
    adapter.execute(`DELETE FROM tv_trips WHERE id = ?`, [tripId]);
    expect(getEmergencyContact(adapter, c.id)).toBeNull();
  });

  it('preserves global contacts when unrelated trips are deleted', () => {
    const global = createEmergencyContact(adapter, makeInput({ name: 'Global' }));
    adapter.execute(`DELETE FROM tv_trips WHERE id = ?`, [tripId]);
    expect(getEmergencyContact(adapter, global.id)).not.toBeNull();
  });
});

describe('listEmergencyContacts', () => {
  it('returns empty array when none exist', () => {
    expect(listEmergencyContacts(adapter)).toEqual([]);
  });

  it('orders by name ASC', () => {
    createEmergencyContact(adapter, makeInput({ name: 'Charlie' }));
    createEmergencyContact(adapter, makeInput({ name: 'Alice' }));
    createEmergencyContact(adapter, makeInput({ name: 'Bob' }));
    const items = listEmergencyContacts(adapter);
    expect(items.map((c) => c.name)).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('filters by tripId', () => {
    createEmergencyContact(
      adapter,
      makeInput({ trip_id: tripId, name: 'Trip' }),
    );
    createEmergencyContact(adapter, makeInput({ name: 'Global' }));
    const items = listEmergencyContacts(adapter, { tripId });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Trip');
  });

  it('filters to globalOnly contacts', () => {
    createEmergencyContact(
      adapter,
      makeInput({ trip_id: tripId, name: 'Trip' }),
    );
    createEmergencyContact(adapter, makeInput({ name: 'Global' }));
    const items = listEmergencyContacts(adapter, { globalOnly: true });
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Global');
  });
});
