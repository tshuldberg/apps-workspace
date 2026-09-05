import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { JOURNAL_MODULE } from '../definition';
import { getTodayCards } from '../cross-module';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('journal', JOURNAL_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

const today = new Date('2026-04-18T09:00:00.000Z');
const todayDate = '2026-04-18';
const yesterdayDate = '2026-04-17';
const twoDaysAgoDate = '2026-04-16';

function context(now: Date = today) {
  return { now };
}

function insertEntry(opts: {
  id: string;
  entryDate: string;
  createdAt: string;
  body?: string;
  title?: string | null;
}): void {
  testDb.adapter.execute(
    `INSERT INTO jn_entries
       (id, journal_id, entry_date, title, body, mood, image_uris_json, word_count, created_at, updated_at)
     VALUES (?, 'journal-default', ?, ?, ?, NULL, '[]', 0, ?, ?)`,
    [
      opts.id,
      opts.entryDate,
      opts.title ?? null,
      opts.body ?? 'note',
      opts.createdAt,
      opts.createdAt,
    ],
  );
}

describe('getTodayCards (journal)', () => {
  it('returns empty array on empty database', () => {
    const cards = getTodayCards(testDb.adapter, context());
    expect(cards).toEqual([]);
  });

  it('returns the Reflect action when no entry exists for today', () => {
    // Seed a prior entry so the user qualifies as "has journaled before".
    insertEntry({
      id: 'e-prior',
      entryDate: '2026-04-10',
      createdAt: '2026-04-10T08:00:00.000Z',
    });

    const cards = getTodayCards(testDb.adapter, context());
    const reflect = cards.find((c) => c.id === 'journal.todays-entry');
    expect(reflect).toBeDefined();
    expect(reflect!.kind).toBe('action');
    expect(reflect!.priority).toBe(50);
    expect(reflect!.cta).toEqual({ label: 'Reflect', route: '/journal/new' });
  });

  it('does not nudge a brand new user with zero entries', () => {
    const cards = getTodayCards(testDb.adapter, context());
    expect(cards.find((c) => c.id === 'journal.todays-entry')).toBeUndefined();
  });

  it('hides the Reflect action when an entry was already created today', () => {
    insertEntry({
      id: 'e-today',
      entryDate: todayDate,
      createdAt: '2026-04-18T08:00:00.000Z',
    });

    const cards = getTodayCards(testDb.adapter, context());
    expect(cards.find((c) => c.id === 'journal.todays-entry')).toBeUndefined();
  });

  it('returns the on-this-day card for an entry from a prior year on the same MM-DD', () => {
    insertEntry({
      id: 'e-old',
      entryDate: '2025-04-18',
      createdAt: '2025-04-18T07:00:00.000Z',
      title: 'A bright morning',
    });

    const cards = getTodayCards(testDb.adapter, context());
    const onThisDay = cards.find((c) => c.id === 'journal.on-this-day');
    expect(onThisDay).toBeDefined();
    expect(onThisDay!.kind).toBe('insight');
    expect(onThisDay!.title).toBe('1 year ago');
    expect(onThisDay!.subtitle).toBe('A bright morning');
  });

  it('uses plural "years" when the entry is more than 1 year old', () => {
    insertEntry({
      id: 'e-old',
      entryDate: '2023-04-18',
      createdAt: '2023-04-18T07:00:00.000Z',
      title: 'Ancient note',
    });

    const cards = getTodayCards(testDb.adapter, context());
    const onThisDay = cards.find((c) => c.id === 'journal.on-this-day');
    expect(onThisDay?.title).toBe('3 years ago');
  });

  it('returns the streak card when 3+ consecutive days end today or yesterday', () => {
    insertEntry({
      id: 'e1',
      entryDate: twoDaysAgoDate,
      createdAt: `${twoDaysAgoDate}T08:00:00.000Z`,
    });
    insertEntry({
      id: 'e2',
      entryDate: yesterdayDate,
      createdAt: `${yesterdayDate}T08:00:00.000Z`,
    });
    insertEntry({
      id: 'e3',
      entryDate: todayDate,
      createdAt: `${todayDate}T08:00:00.000Z`,
    });

    const cards = getTodayCards(testDb.adapter, context());
    const streak = cards.find((c) => c.id === 'journal.streak');
    expect(streak).toBeDefined();
    expect(streak!.kind).toBe('progress');
    expect(streak!.title).toContain('3 day');
  });

  it('elevates streak priority when the streak is at risk (no entry today yet)', () => {
    insertEntry({
      id: 'e1',
      entryDate: '2026-04-15',
      createdAt: '2026-04-15T08:00:00.000Z',
    });
    insertEntry({
      id: 'e2',
      entryDate: twoDaysAgoDate,
      createdAt: `${twoDaysAgoDate}T08:00:00.000Z`,
    });
    insertEntry({
      id: 'e3',
      entryDate: yesterdayDate,
      createdAt: `${yesterdayDate}T08:00:00.000Z`,
    });

    const cards = getTodayCards(testDb.adapter, context());
    const streak = cards.find((c) => c.id === 'journal.streak');
    expect(streak?.priority).toBe(60);
  });

  it('does not return a streak card for a 2-day streak', () => {
    insertEntry({
      id: 'e1',
      entryDate: yesterdayDate,
      createdAt: `${yesterdayDate}T08:00:00.000Z`,
    });
    insertEntry({
      id: 'e2',
      entryDate: todayDate,
      createdAt: `${todayDate}T08:00:00.000Z`,
    });

    const cards = getTodayCards(testDb.adapter, context());
    expect(cards.find((c) => c.id === 'journal.streak')).toBeUndefined();
  });

  it('caps at 3 cards and never exceeds priority 100', () => {
    insertEntry({
      id: 'e-old',
      entryDate: '2025-04-18',
      createdAt: '2025-04-18T07:00:00.000Z',
      title: 'Past me',
    });
    insertEntry({
      id: 'e1',
      entryDate: twoDaysAgoDate,
      createdAt: `${twoDaysAgoDate}T08:00:00.000Z`,
    });
    insertEntry({
      id: 'e2',
      entryDate: yesterdayDate,
      createdAt: `${yesterdayDate}T08:00:00.000Z`,
    });
    insertEntry({
      id: 'e3',
      entryDate: '2026-04-15',
      createdAt: '2026-04-15T08:00:00.000Z',
    });

    // Today still has no entry, so all three cards should appear together.
    const cards = getTodayCards(testDb.adapter, context());
    expect(cards.length).toBeLessThanOrEqual(3);
    expect(cards.map((c) => c.id)).toEqual(
      expect.arrayContaining([
        'journal.todays-entry',
        'journal.on-this-day',
        'journal.streak',
      ]),
    );
    for (const card of cards) {
      expect(card.priority).toBeLessThanOrEqual(100);
      expect(card.priority).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('crossModule wiring', () => {
  it('is wired into JOURNAL_MODULE.crossModule', () => {
    expect(JOURNAL_MODULE.crossModule).toBeDefined();
    expect(JOURNAL_MODULE.crossModule!.getTodayCards).toBeTypeOf('function');
  });

  it('works through the crossModule interface', () => {
    insertEntry({
      id: 'e-prior',
      entryDate: '2026-04-10',
      createdAt: '2026-04-10T08:00:00.000Z',
    });

    const cards = JOURNAL_MODULE.crossModule!.getTodayCards!(
      testDb.adapter,
      { now: today },
    );
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].moduleId).toBe('journal');
  });
});
