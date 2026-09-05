import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SLEEP_MODULE } from '../definition';
import {
  createDream,
  createEntry,
  deleteDream,
  getDream,
  getDreamDictionaryNotes,
  getDreamStats,
  getDreamsByEntry,
  getRecurringGroup,
  listAllDreams,
  listDreams,
  setDreamDictionaryNote,
  updateDream,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
});

afterEach(() => {
  testDb.close();
});

describe('dream CRUD', () => {
  it('creates, stores, and retrieves normalized dream arrays', () => {
    const entry = createEntry(testDb.adapter, {
      bedtime: '2026-03-09T23:00:00Z',
      wake_time: '2026-03-10T07:00:00Z',
      quality_rating: 4,
      wake_feeling: 'refreshed',
    });

    const dream = createDream(testDb.adapter, {
      sleep_entry_id: entry.id,
      date: entry.date,
      content_md: '  Flying over the same bright river.  ',
      type: 'recurring',
      themes: [' Flying ', 'water', 'flying'],
      people: ['Old Friend', ' Old Friend '],
      emotions: ['Excited', 'peaceful', ' excited '],
      is_lucid: true,
    });

    expect(dream.content_md).toBe('Flying over the same bright river.');
    expect(dream.themes).toEqual(['flying', 'water']);
    expect(dream.people).toEqual(['Old Friend']);
    expect(dream.emotions).toEqual(['excited', 'peaceful']);
    expect(dream.is_lucid).toBe(true);
    expect(dream.is_recurring).toBe(true);
    expect(dream.recurring_group_id).toBe(dream.id);
    expect(getDream(testDb.adapter, dream.id)).toEqual(dream);

    const stored = testDb.adapter.query<{
      themes: string;
      people: string;
      emotions: string;
    }>(
      `SELECT themes, people, emotions FROM sl_dreams WHERE id = ?`,
      [dream.id],
    )[0];

    expect(stored).toEqual({
      themes: '["flying","water"]',
      people: '["Old Friend"]',
      emotions: '["excited","peaceful"]',
    });
  });

  it('updates dreams, filters lists, and links recurring groups', () => {
    const entry = createEntry(testDb.adapter, {
      bedtime: '2026-03-10T22:30:00Z',
      wake_time: '2026-03-11T06:45:00Z',
      quality_rating: 3,
      wake_feeling: 'groggy',
    });

    const recurring = createDream(testDb.adapter, {
      sleep_entry_id: entry.id,
      date: '2026-03-11',
      content_md: 'Late for school again.',
      type: 'recurring',
      themes: ['school'],
      emotions: ['anxious'],
    });
    const followUp = createDream(testDb.adapter, {
      sleep_entry_id: entry.id,
      date: '2026-03-12',
      content_md: 'Still walking the same endless hallway.',
      type: 'normal',
      themes: ['school', 'lost'],
      emotions: ['confused'],
      is_recurring: true,
      recurring_group_id: recurring.recurring_group_id ?? recurring.id,
    });
    const unrelated = createDream(testDb.adapter, {
      date: '2026-03-13',
      content_md: 'A loud work presentation turned into a storm.',
      type: 'vivid',
      themes: ['work'],
      emotions: ['stressed'],
    });

    const updated = updateDream(testDb.adapter, unrelated.id, {
      type: 'nightmare',
      themes: ['work', 'chase'],
      people: ['Manager'],
      content_md: '  A loud work presentation turned into a chase.  ',
    });

    expect(updated?.type).toBe('nightmare');
    expect(updated?.themes).toEqual(['work', 'chase']);
    expect(updated?.people).toEqual(['Manager']);
    expect(updated?.content_md).toBe(
      'A loud work presentation turned into a chase.',
    );

    expect(getDreamsByEntry(testDb.adapter, entry.id).map((dream) => dream.id))
      .toEqual([followUp.id, recurring.id]);
    expect(
      getRecurringGroup(
        testDb.adapter,
        recurring.recurring_group_id ?? recurring.id,
      ).map((dream) => dream.id),
    ).toEqual([recurring.id, followUp.id]);
    expect(
      listDreams(testDb.adapter, {
        type: 'nightmare',
        theme: 'work',
      }).map((dream) => dream.id),
    ).toEqual([unrelated.id]);
  });

  it('computes dream stats and supports deletion', () => {
    const lucid = createDream(testDb.adapter, {
      date: '2026-03-01',
      content_md: 'I realized I was dreaming above the ocean.',
      type: 'lucid',
      themes: ['water', 'flying'],
      emotions: ['excited'],
    });
    const nightmare = createDream(testDb.adapter, {
      date: '2026-03-02',
      content_md: 'A chase through a dark house.',
      type: 'nightmare',
      themes: ['chase', 'house'],
      emotions: ['scared'],
      is_recurring: true,
      recurring_group_id: 'group-1',
    });
    createDream(testDb.adapter, {
      date: '2026-03-03',
      content_md: 'The same dark house returned.',
      type: 'normal',
      themes: ['house'],
      emotions: ['scared'],
      is_recurring: true,
      recurring_group_id: 'group-1',
    });

    expect(getDreamStats(testDb.adapter)).toEqual({
      totalDreams: 3,
      lucidCount: 1,
      nightmareCount: 1,
      recurringCount: 2,
      topThemes: [
        { value: 'house', count: 2 },
        { value: 'chase', count: 1 },
        { value: 'flying', count: 1 },
        { value: 'water', count: 1 },
      ],
      topEmotions: [
        { value: 'scared', count: 2 },
        { value: 'excited', count: 1 },
      ],
    });

    expect(deleteDream(testDb.adapter, nightmare.id)).toBe(true);
    expect(getDream(testDb.adapter, nightmare.id)).toBeNull();
    expect(deleteDream(testDb.adapter, lucid.id)).toBe(true);
    expect(deleteDream(testDb.adapter, lucid.id)).toBe(false);
  });

  it('rejects empty dream content', () => {
    expect(() =>
      createDream(testDb.adapter, {
        date: '2026-03-14',
        content_md: '   ',
      }),
    ).toThrow(/string must contain at least 1 character/i);
  });

  it('pages the full archive and persists dictionary notes in settings', () => {
    const dreams = [
      createDream(testDb.adapter, {
        date: '2026-03-01',
        content_md: 'Water in a bright hallway.',
        themes: ['water'],
      }),
      createDream(testDb.adapter, {
        date: '2026-03-02',
        content_md: 'Back at school.',
        themes: ['school'],
      }),
      createDream(testDb.adapter, {
        date: '2026-03-03',
        content_md: 'A house near the river.',
        themes: ['house', 'water'],
      }),
      createDream(testDb.adapter, {
        date: '2026-03-04',
        content_md: 'Flying above the city.',
        themes: ['flying'],
      }),
      createDream(testDb.adapter, {
        date: '2026-03-05',
        content_md: 'The hallway returned.',
        themes: ['school'],
      }),
    ];

    expect(listAllDreams(testDb.adapter, 2).map((dream) => dream.id)).toEqual(
      dreams
        .slice()
        .reverse()
        .map((dream) => dream.id),
    );

    expect(getDreamDictionaryNotes(testDb.adapter)).toEqual({});
    expect(
      setDreamDictionaryNote(
        testDb.adapter,
        ' Water ',
        ' Water usually means transition for me. ',
      ),
    ).toEqual({
      water: 'Water usually means transition for me.',
    });
    expect(getDreamDictionaryNotes(testDb.adapter)).toEqual({
      water: 'Water usually means transition for me.',
    });
    expect(setDreamDictionaryNote(testDb.adapter, 'water', '  ')).toEqual({});
    expect(getDreamDictionaryNotes(testDb.adapter)).toEqual({});
  });
});
