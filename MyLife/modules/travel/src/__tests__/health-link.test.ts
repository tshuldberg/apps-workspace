import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { TRAVEL_MODULE } from '../definition';
import { getPreTripVaccinationReminders } from '../integrations/health-link';

function createHealthDocs(adapter: DatabaseAdapter): void {
  adapter.execute(`
    CREATE TABLE hl_documents (
      id TEXT PRIMARY KEY,
      title TEXT,
      type TEXT NOT NULL,
      document_date TEXT
    )
  `);
}

function insertDoc(
  adapter: DatabaseAdapter,
  params: { id: string; title: string; type: string; documentDate?: string | null },
): void {
  adapter.execute(
    `INSERT INTO hl_documents (id, title, type, document_date) VALUES (?, ?, ?, ?)`,
    [params.id, params.title, params.type, params.documentDate ?? null],
  );
}

describe('@mylife/travel health-link integration', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('travel', TRAVEL_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('returns the seed list when hl_documents is missing (Health not installed)', () => {
    const reminders = getPreTripVaccinationReminders(adapter, ['FR', 'IT']);
    const ids = reminders.map((r) => r.id);
    expect(ids).toContain('seed_hep_a');
    expect(ids).toContain('seed_typhoid');
    expect(ids).toContain('seed_mmr');
    expect(ids).toContain('seed_tdap');
    for (const r of reminders) {
      expect(r.urgency).toBe('recommended');
    }
  });

  it('returns the seed list even when hl_documents exists but has no vaccination rows', () => {
    createHealthDocs(adapter);
    const reminders = getPreTripVaccinationReminders(adapter, []);
    expect(reminders.length).toBe(4);
    expect(reminders.every((r) => r.urgency === 'recommended')).toBe(true);
  });

  it('adds a `due` reminder for vaccination documents older than 5 years', () => {
    createHealthDocs(adapter);
    const longAgo = '2015-01-01';
    insertDoc(adapter, {
      id: 'doc_yf',
      title: 'Yellow Fever',
      type: 'vaccination',
      documentDate: longAgo,
    });
    const reminders = getPreTripVaccinationReminders(adapter, ['BR']);
    const due = reminders.filter((r) => r.urgency === 'due');
    expect(due.length).toBe(1);
    expect(due[0]!.id).toBe('doc_doc_yf');
    expect(due[0]!.title).toContain('Yellow Fever');
    expect(due[0]!.dueOn).toBe(longAgo);
  });

  it('ignores recent vaccination documents (less than 5 years old)', () => {
    createHealthDocs(adapter);
    const recent = new Date().toISOString().slice(0, 10);
    insertDoc(adapter, {
      id: 'doc_recent',
      title: 'Hepatitis A',
      type: 'vaccination',
      documentDate: recent,
    });
    const reminders = getPreTripVaccinationReminders(adapter, []);
    expect(reminders.filter((r) => r.urgency === 'due').length).toBe(0);
  });
});
