import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import {
  createDocument,
  deleteDocument,
  getDocument,
  getExpiring,
  getPassports,
  getVisas,
  listDocuments,
  listDocumentsByType,
  updateDocument,
} from '../db/crud/documents';
import type { DocumentInput, DocumentType } from '../models/schemas';

let adapter: DatabaseAdapter;
let closeDb: () => void;

const ALL_TYPES: DocumentType[] = [
  'passport',
  'visa',
  'insurance',
  'vaccination',
  'membership',
  'other',
];

function makeInput(overrides: Partial<DocumentInput> = {}): DocumentInput {
  return {
    type: 'passport',
    name: 'US Passport',
    ...overrides,
  };
}

function daysFromNowIso(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

beforeEach(() => {
  const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
  adapter = testDb.adapter;
  closeDb = testDb.close;
});

afterEach(() => {
  closeDb();
});

describe('createDocument', () => {
  it('returns a document with a generated id and defaults', () => {
    const d = createDocument(adapter, makeInput());
    expect(d.id).toBeTruthy();
    expect(d.type).toBe('passport');
    expect(d.name).toBe('US Passport');
    expect(d.renewal_reminder_days).toBe(90);
  });

  it('persists optional fields', () => {
    const d = createDocument(
      adapter,
      makeInput({
        number: 'A12345678',
        country: 'USA',
        issue_date: '2020-01-15',
        expiry_date: '2030-01-14',
        renewal_reminder_days: 180,
        notes_md: 'Renew early',
        photo_id: 'photo-1',
      }),
    );
    expect(d.number).toBe('A12345678');
    expect(d.country).toBe('USA');
    expect(d.issue_date).toBe('2020-01-15');
    expect(d.expiry_date).toBe('2030-01-14');
    expect(d.renewal_reminder_days).toBe(180);
    expect(d.notes_md).toBe('Renew early');
    expect(d.photo_id).toBe('photo-1');
  });

  it('creates all six document types', () => {
    for (const type of ALL_TYPES) {
      const d = createDocument(adapter, makeInput({ type, name: `${type} doc` }));
      expect(d.type).toBe(type);
      const reread = getDocument(adapter, d.id);
      expect(reread?.type).toBe(type);
    }
  });

  it('rejects empty name', () => {
    expect(() => createDocument(adapter, makeInput({ name: '' }))).toThrow();
  });
});

describe('getDocument', () => {
  it('returns null for missing id', () => {
    expect(getDocument(adapter, 'nope')).toBeNull();
  });

  it('returns the document row', () => {
    const d = createDocument(adapter, makeInput({ name: 'Schengen Visa', type: 'visa' }));
    const got = getDocument(adapter, d.id);
    expect(got?.name).toBe('Schengen Visa');
    expect(got?.type).toBe('visa');
  });
});

describe('updateDocument', () => {
  it('updates specified fields and leaves others', () => {
    const d = createDocument(adapter, makeInput({ name: 'Old Name' }));
    updateDocument(adapter, d.id, { name: 'New Name', number: 'X999' });
    const got = getDocument(adapter, d.id);
    expect(got?.name).toBe('New Name');
    expect(got?.number).toBe('X999');
    expect(got?.type).toBe('passport');
  });

  it('no-ops with empty patch', () => {
    const d = createDocument(adapter, makeInput());
    const before = getDocument(adapter, d.id)!;
    updateDocument(adapter, d.id, {});
    const after = getDocument(adapter, d.id)!;
    expect(after.updated_at).toBe(before.updated_at);
  });
});

describe('deleteDocument', () => {
  it('removes a document', () => {
    const d = createDocument(adapter, makeInput());
    deleteDocument(adapter, d.id);
    expect(getDocument(adapter, d.id)).toBeNull();
  });
});

describe('listDocuments', () => {
  it('returns documents ordered by name', () => {
    createDocument(adapter, makeInput({ name: 'Zeta', type: 'other' }));
    createDocument(adapter, makeInput({ name: 'Alpha', type: 'other' }));
    const items = listDocuments(adapter);
    expect(items.map((x) => x.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('filters by type', () => {
    createDocument(adapter, makeInput({ type: 'passport', name: 'P' }));
    createDocument(adapter, makeInput({ type: 'visa', name: 'V' }));
    const visas = listDocuments(adapter, { type: 'visa' });
    expect(visas).toHaveLength(1);
    expect(visas[0].name).toBe('V');
  });
});

describe('listDocumentsByType / getPassports / getVisas', () => {
  beforeEach(() => {
    createDocument(adapter, makeInput({ type: 'passport', name: 'US Passport' }));
    createDocument(adapter, makeInput({ type: 'visa', name: 'Schengen' }));
    createDocument(adapter, makeInput({ type: 'insurance', name: 'IMG' }));
  });

  it('listDocumentsByType filters correctly', () => {
    expect(listDocumentsByType(adapter, 'passport')).toHaveLength(1);
    expect(listDocumentsByType(adapter, 'insurance')).toHaveLength(1);
    expect(listDocumentsByType(adapter, 'vaccination')).toHaveLength(0);
  });

  it('getPassports returns passports only', () => {
    expect(getPassports(adapter)).toHaveLength(1);
    expect(getPassports(adapter)[0].name).toBe('US Passport');
  });

  it('getVisas returns visas only', () => {
    expect(getVisas(adapter)).toHaveLength(1);
    expect(getVisas(adapter)[0].name).toBe('Schengen');
  });
});

describe('getExpiring', () => {
  it('returns documents expiring within the window ordered by expiry_date ASC', () => {
    createDocument(adapter, makeInput({ name: 'past', expiry_date: daysFromNowIso(-10) }));
    createDocument(adapter, makeInput({ name: 'far-future', expiry_date: daysFromNowIso(500) }));
    createDocument(adapter, makeInput({ name: 'soon', expiry_date: daysFromNowIso(20) }));
    createDocument(adapter, makeInput({ name: 'sooner', expiry_date: daysFromNowIso(5) }));
    createDocument(adapter, makeInput({ name: 'edge', expiry_date: daysFromNowIso(30) }));

    const items = getExpiring(adapter, 30);
    expect(items.map((x) => x.name)).toEqual(['sooner', 'soon', 'edge']);
  });

  it('excludes documents without an expiry_date', () => {
    createDocument(adapter, makeInput({ name: 'noexpiry' }));
    expect(getExpiring(adapter, 365)).toHaveLength(0);
  });

  it('respects window boundary (exclusive beyond)', () => {
    createDocument(adapter, makeInput({ name: 'in', expiry_date: daysFromNowIso(10) }));
    createDocument(adapter, makeInput({ name: 'out', expiry_date: daysFromNowIso(100) }));
    const items = getExpiring(adapter, 30);
    expect(items.map((x) => x.name)).toEqual(['in']);
  });

  it('treats today (0 days) as expiring', () => {
    createDocument(adapter, makeInput({ name: 'today', expiry_date: daysFromNowIso(0) }));
    const items = getExpiring(adapter, 7);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('today');
  });
});
