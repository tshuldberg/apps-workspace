import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SLEEP_MODULE } from '../definition';
import { createDream } from '../db/crud';
import { indexDream, searchDreams } from '../engine/dream-search';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('sleep', SLEEP_MODULE.migrations ?? []);
});

afterEach(() => {
  testDb.close();
});

describe('dream search', () => {
  it('indexes dream text, themes, and people for search', () => {
    const dream = createDream(testDb.adapter, {
      date: '2026-03-20',
      content_md: 'A bright river lifted me over the city.',
      type: 'vivid',
      themes: ['flying', 'water'],
      people: ['Old Friend'],
      emotions: ['excited'],
    });

    expect(indexDream(dream)).toEqual({
      content_md: 'A bright river lifted me over the city.',
      themes: 'flying water',
      people: 'Old Friend',
      searchable_text:
        'a bright river lifted me over the city. flying water old friend',
    });
    expect(searchDreams(testDb.adapter, 'river').map((row) => row.id)).toEqual([
      dream.id,
    ]);
    expect(searchDreams(testDb.adapter, 'flying').map((row) => row.id)).toEqual([
      dream.id,
    ]);
    expect(
      searchDreams(testDb.adapter, '"Old Friend"').map((row) => row.id),
    ).toEqual([dream.id]);
  });

  it('applies type and date range filters to search results', () => {
    const nightmare = createDream(testDb.adapter, {
      date: '2026-03-01',
      content_md: 'A storm rolled through the house.',
      type: 'nightmare',
      themes: ['house'],
    });
    createDream(testDb.adapter, {
      date: '2026-03-02',
      content_md: 'A storm lifted the car over the road.',
      type: 'vivid',
      themes: ['car'],
    });

    expect(
      searchDreams(testDb.adapter, 'storm', {
        type: 'nightmare',
      }).map((row) => row.id),
    ).toEqual([nightmare.id]);
    expect(
      searchDreams(testDb.adapter, 'storm', {
        dateRange: {
          startDate: '2026-03-02',
          endDate: '2026-03-02',
        },
      }).map((row) => row.content_md),
    ).toEqual(['A storm lifted the car over the road.']);
  });

  it('searches 1000+ dreams within the performance budget', () => {
    for (let index = 0; index < 1_200; index += 1) {
      const day = String((index % 28) + 1).padStart(2, '0');
      const keyword = index % 40 === 0 ? 'anchor' : 'ordinary';

      createDream(testDb.adapter, {
        date: `2026-03-${day}`,
        content_md: `Dream ${index} about ${keyword} water and long corridors.`,
        type: index % 5 === 0 ? 'nightmare' : 'normal',
        themes: index % 3 === 0 ? ['water'] : ['school'],
        people: [`Person ${index % 12}`],
      });
    }

    searchDreams(testDb.adapter, 'anchor');

    const startedAt = performance.now();
    const results = searchDreams(testDb.adapter, 'anchor', {
      limit: 40,
    });
    const elapsedMs = performance.now() - startedAt;

    expect(results.length).toBe(30);
    expect(elapsedMs).toBeLessThan(100);
  });

  it('returns no results for blank queries', () => {
    expect(searchDreams(testDb.adapter, '   ')).toEqual([]);
  });
});
