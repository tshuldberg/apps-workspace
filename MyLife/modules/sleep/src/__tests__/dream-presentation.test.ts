import { describe, expect, it } from 'vitest';
import type { Dream } from '../models/dream-schemas';
import {
  buildDreamTimelineSections,
  filterDreams,
  findRecurringDreamCandidates,
  findRelatedDreams,
  getDreamExcerpt,
  getRecurringDreamGroupId,
  getDreamPeopleSuggestions,
  getDreamTypeMeta,
} from '../engine/dream-presentation';

function makeDream(
  id: string,
  overrides: Partial<Dream> = {},
): Dream {
  return {
    id,
    sleep_entry_id: null,
    date: '2026-04-20',
    content_md: `Dream ${id} about water and school.`,
    type: 'normal',
    themes: ['water'],
    people: [],
    emotions: ['peaceful'],
    is_lucid: false,
    is_recurring: false,
    recurring_group_id: null,
    sketch_photo_id: null,
    created_at: `2026-04-20T07:0${id.slice(-1)}:00.000Z`,
    ...overrides,
  };
}

describe('dream presentation helpers', () => {
  it('groups dreams by month and labels recent sections relative to now', () => {
    const dreams = [
      makeDream('dream-1', { date: '2026-04-20' }),
      makeDream('dream-2', { date: '2026-04-01' }),
      makeDream('dream-3', { date: '2026-03-28' }),
      makeDream('dream-4', { date: '2026-01-18' }),
    ];

    expect(
      buildDreamTimelineSections(dreams, new Date('2026-04-21T07:00:00.000Z')),
    ).toEqual([
      {
        monthKey: '2026-04',
        label: 'This Month',
        dreams: [dreams[0], dreams[1]],
      },
      {
        monthKey: '2026-03',
        label: 'Last Month',
        dreams: [dreams[2]],
      },
      {
        monthKey: '2026-01',
        label: 'January 2026',
        dreams: [dreams[3]],
      },
    ]);
  });

  it('filters dreams by query, theme, emotion, and flags', () => {
    const dreams = [
      makeDream('dream-1', {
        content_md: 'Floating above the city with Jordan.',
        themes: ['flying', 'travel'],
        people: ['Jordan'],
        emotions: ['excited'],
        is_lucid: true,
      }),
      makeDream('dream-2', {
        content_md: 'Lost in a dark house while being chased.',
        type: 'nightmare',
        themes: ['house', 'chase'],
        emotions: ['scared'],
        is_recurring: true,
      }),
      makeDream('dream-3', {
        content_md: 'Back at school with Maya.',
        themes: ['school'],
        people: ['Maya'],
        emotions: ['anxious'],
      }),
    ];

    expect(filterDreams(dreams, { query: 'Jordan city' }).map((dream) => dream.id))
      .toEqual(['dream-1']);
    expect(filterDreams(dreams, { theme: 'school' }).map((dream) => dream.id))
      .toEqual(['dream-3']);
    expect(filterDreams(dreams, { emotion: 'scared' }).map((dream) => dream.id))
      .toEqual(['dream-2']);
    expect(filterDreams(dreams, { lucidOnly: true }).map((dream) => dream.id))
      .toEqual(['dream-1']);
    expect(filterDreams(dreams, { recurringOnly: true }).map((dream) => dream.id))
      .toEqual(['dream-2']);
    expect(
      filterDreams(dreams, {
        type: 'nightmare',
        theme: 'house',
        emotion: 'scared',
      }).map((dream) => dream.id),
    ).toEqual(['dream-2']);
  });

  it('finds related dreams from recurring groups first, then overlapping themes', () => {
    const anchor = makeDream('dream-1', {
      type: 'recurring',
      themes: ['water', 'house'],
      is_recurring: true,
      recurring_group_id: 'group-1',
    });
    const sameGroup = makeDream('dream-2', {
      date: '2026-04-19',
      themes: ['water'],
      is_recurring: true,
      recurring_group_id: 'group-1',
    });
    const themeMatch = makeDream('dream-3', {
      date: '2026-04-18',
      themes: ['house', 'family'],
    });
    const noMatch = makeDream('dream-4', {
      themes: ['technology'],
    });

    expect(findRelatedDreams(anchor, [anchor, themeMatch, sameGroup, noMatch]))
      .toEqual([sameGroup, themeMatch]);
  });

  it('suggests recurring dream groups from matching themes and recent groups', () => {
    const recurringA = makeDream('dream-1', {
      date: '2026-04-18',
      content_md: 'Flying above water near the old house.',
      themes: ['flying', 'water'],
      is_recurring: true,
      recurring_group_id: 'group-a',
    });
    const recurringALater = makeDream('dream-2', {
      date: '2026-04-20',
      content_md: 'Back over the same flooded neighborhood.',
      themes: ['water', 'house'],
      is_recurring: true,
      recurring_group_id: 'group-a',
    });
    const recurringB = makeDream('dream-3', {
      date: '2026-04-19',
      content_md: 'School hallway loop with Maya again.',
      themes: ['school'],
      is_recurring: true,
      recurring_group_id: 'group-b',
    });

    expect(
      findRecurringDreamCandidates(
        {
          content_md: 'Water everywhere around the house.',
          themes: ['water', 'house'],
        },
        [recurringA, recurringALater, recurringB],
      ),
    ).toEqual([recurringALater]);

    expect(
      findRecurringDreamCandidates(
        {
          content_md: '',
          themes: [],
        },
        [recurringA, recurringALater, recurringB],
      ),
    ).toEqual([recurringALater, recurringB]);
  });

  it('builds excerpts and people suggestions from saved dreams', () => {
    expect(
      getDreamExcerpt('# The river\n\n*Bright* water and [Jordan](https://example.com)', 28),
    ).toBe('The river Bright water and…');

    expect(
      getDreamPeopleSuggestions([
        makeDream('dream-1', { people: ['Jordan', 'Maya'] }),
        makeDream('dream-2', { people: ['Jordan'] }),
        makeDream('dream-3', { people: ['Lee'] }),
      ]),
    ).toEqual(['Jordan', 'Lee', 'Maya']);
  });

  it('maps dream types to stable UI metadata', () => {
    expect(getDreamTypeMeta('normal')).toEqual({
      label: 'Normal',
      tone: 'normal',
    });
    expect(getDreamTypeMeta('nightmare')).toEqual({
      label: 'Nightmare',
      tone: 'nightmare',
    });
  });

  it('derives stable recurring group ids from recurring dreams', () => {
    expect(
      getRecurringDreamGroupId(
        makeDream('dream-1', { is_recurring: true, recurring_group_id: null }),
      ),
    ).toBe('dream-1');
    expect(
      getRecurringDreamGroupId(
        makeDream('dream-2', {
          is_recurring: true,
          recurring_group_id: 'group-2',
        }),
      ),
    ).toBe('group-2');
    expect(
      getRecurringDreamGroupId(
        makeDream('dream-3', { is_recurring: false, recurring_group_id: null }),
      ),
    ).toBeNull();
  });
});
