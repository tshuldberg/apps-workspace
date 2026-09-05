import { describe, expect, it } from 'vitest';
import type { Dream } from '../models/dream-schemas';
import {
  getDreamDictionary,
  getDreamPatternDashboard,
  getEmotionDistribution,
  getLucidDreamRate,
  getNightmareRate,
  getRecurringDreamSummary,
  getThemeFrequency,
  parseDreamDictionaryNotes,
  searchDreamDictionary,
  sortDreamDictionary,
  updateDreamDictionaryNotesMap,
} from '../engine/dream-patterns';

function makeDream(
  id: string,
  overrides: Partial<Dream> = {},
): Dream {
  return {
    id,
    sleep_entry_id: null,
    date: '2026-04-01',
    content_md: `Dream ${id} about water and a bright hallway.`,
    type: 'normal',
    themes: ['water'],
    people: [],
    emotions: ['peaceful'],
    is_lucid: false,
    is_recurring: false,
    recurring_group_id: null,
    sketch_photo_id: null,
    created_at: `2026-04-01T07:0${id.slice(-1)}:00.000Z`,
    ...overrides,
  };
}

describe('dream pattern helpers', () => {
  const dreams = [
    makeDream('dream-1', {
      date: '2026-04-01',
      content_md: 'I knew I was dreaming while flying over water.',
      type: 'lucid',
      themes: ['water', 'flying'],
      emotions: ['excited', 'peaceful'],
      is_lucid: true,
    }),
    makeDream('dream-2', {
      date: '2026-04-03',
      content_md: 'A chase through a dark house.',
      type: 'nightmare',
      themes: ['house', 'chase'],
      emotions: ['scared'],
    }),
    makeDream('dream-3', {
      date: '2026-04-05',
      content_md: 'The house by the river returned.',
      themes: ['water', 'house'],
      emotions: ['scared'],
      is_recurring: true,
      recurring_group_id: 'group-river',
    }),
    makeDream('dream-4', {
      date: '2026-04-12',
      content_md: 'I found the same flooded house again.',
      type: 'recurring',
      themes: ['water', 'house'],
      emotions: ['confused', 'scared'],
      is_recurring: true,
      recurring_group_id: 'group-river',
    }),
    makeDream('dream-5', {
      date: '2026-04-19',
      content_md: 'Back at school with family.',
      type: 'vivid',
      themes: ['school', 'family'],
      emotions: ['peaceful'],
    }),
  ];

  it('counts themes and emotions within a date range', () => {
    expect(getThemeFrequency(dreams).slice(0, 4)).toEqual([
      { theme: 'house', count: 3 },
      { theme: 'water', count: 3 },
      { theme: 'chase', count: 1 },
      { theme: 'family', count: 1 },
    ]);

    expect(
      getEmotionDistribution(dreams, {
        startDate: '2026-04-01',
        endDate: '2026-04-12',
      }),
    ).toEqual([
      { emotion: 'scared', count: 3, percentage: 50 },
      { emotion: 'confused', count: 1, percentage: 16.7 },
      { emotion: 'excited', count: 1, percentage: 16.7 },
      { emotion: 'peaceful', count: 1, percentage: 16.7 },
    ]);

    expect(getLucidDreamRate(dreams)).toEqual({
      count: 1,
      total: 5,
      percentage: 20,
    });
    expect(getNightmareRate(dreams)).toEqual({
      count: 1,
      total: 5,
      percentage: 20,
    });
  });

  it('builds recurring summaries and dictionary entries with notes', () => {
    const recurring = getRecurringDreamSummary(dreams);

    expect(recurring).toEqual([
      {
        groupId: 'group-river',
        frequency: 2,
        firstOccurrence: '2026-04-05',
        lastOccurrence: '2026-04-12',
        themes: ['house', 'water'],
        emotions: ['scared', 'confused'],
        exampleExcerpts: [
          'I found the same flooded house again.',
          'The house by the river returned.',
        ],
        latestDreamId: 'dream-4',
      },
    ]);

    const dictionary = getDreamDictionary(dreams, {
      water: 'Water usually signals transition.',
    });
    const water = dictionary.find((entry) => entry.theme === 'water');
    const house = dictionary.find((entry) => entry.theme === 'house');

    expect(water).toMatchObject({
      theme: 'water',
      count: 3,
      firstOccurrence: '2026-04-01',
      lastOccurrence: '2026-04-12',
      associatedEmotions: ['scared', 'confused', 'excited'],
      note: 'Water usually signals transition.',
    });
    expect(water?.exampleExcerpts).toEqual([
      'I found the same flooded house again.',
      'The house by the river returned.',
    ]);
    expect(house?.count).toBe(3);
  });

  it('supports dashboard summaries plus dictionary search and sorting', () => {
    const dashboard = getDreamPatternDashboard(dreams);

    expect(dashboard.totalDreams).toBe(5);
    expect(dashboard.dreamsPerWeekAverage).toBe(1.7);
    expect(dashboard.topThemes).toEqual([
      { theme: 'house', count: 3 },
      { theme: 'water', count: 3 },
      { theme: 'chase', count: 1 },
      { theme: 'family', count: 1 },
      { theme: 'flying', count: 1 },
    ]);
    expect(dashboard.typeDistribution).toEqual([
      { type: 'normal', count: 1, percentage: 20 },
      { type: 'vivid', count: 1, percentage: 20 },
      { type: 'nightmare', count: 1, percentage: 20 },
      { type: 'lucid', count: 1, percentage: 20 },
      { type: 'recurring', count: 1, percentage: 20 },
    ]);
    expect(dashboard.lucidTrend.map((point) => point.weekStart)).toEqual([
      '2026-03-30',
      '2026-04-06',
      '2026-04-13',
    ]);

    const dictionary = getDreamDictionary(dreams, {
      water: 'Water usually signals transition.',
      school: 'School dreams show unfinished work.',
    });

    expect(
      searchDreamDictionary(dictionary, 'unfinished work').map((entry) => entry.theme),
    ).toEqual(['school']);
    expect(
      sortDreamDictionary(dictionary, 'alphabetical')
        .slice(0, 3)
        .map((entry) => entry.theme),
    ).toEqual(['chase', 'family', 'flying']);
    expect(
      sortDreamDictionary(dictionary, 'recency')
        .slice(0, 2)
        .map((entry) => entry.theme),
    ).toEqual(['family', 'school']);
  });

  it('normalizes dictionary notes maps consistently', () => {
    expect(
      parseDreamDictionaryNotes(
        '{" Water ":"  means change  ","school":"   ","house":"safety"}',
      ),
    ).toEqual({
      water: 'means change',
      house: 'safety',
    });

    expect(
      updateDreamDictionaryNotesMap(
        { water: 'means change' },
        ' House ',
        ' safety ',
      ),
    ).toEqual({
      water: 'means change',
      house: 'safety',
    });

    expect(
      updateDreamDictionaryNotesMap(
        { water: 'means change', house: 'safety' },
        'water',
        '   ',
      ),
    ).toEqual({
      house: 'safety',
    });
  });
});
