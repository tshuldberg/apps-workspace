import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import type { Dream } from '../../models/dream-schemas';
import {
  buildDreamTimelineSections,
  filterDreams,
  findRecurringDreamCandidates,
  getRecurringDreamGroupId,
  type DreamFilterState,
} from '../dream-presentation';

const DREAM_TYPES = [
  'normal',
  'vivid',
  'nightmare',
  'lucid',
  'recurring',
] as const;

const DREAM_THEMES = [
  'flying',
  'water',
  'school',
  'work',
  'house',
  'travel',
  'animals',
] as const;

const DREAM_EMOTIONS = [
  'happy',
  'anxious',
  'scared',
  'confused',
  'peaceful',
  'excited',
] as const;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function makeDream(index: number): Dream {
  const day = 1 + (index % 28);
  return {
    id: `dream-${index}`,
    sleep_entry_id: null,
    date: `2026-04-${pad(day)}`,
    content_md: `Dream ${index} about ${DREAM_THEMES[index % DREAM_THEMES.length]} and person ${index % 9}`,
    type: DREAM_TYPES[index % DREAM_TYPES.length],
    themes: [
      DREAM_THEMES[index % DREAM_THEMES.length],
      DREAM_THEMES[(index + 2) % DREAM_THEMES.length],
    ],
    people: [`Person ${index % 9}`],
    emotions: [DREAM_EMOTIONS[index % DREAM_EMOTIONS.length]],
    is_lucid: index % 4 === 0,
    is_recurring: index % 5 === 0,
    recurring_group_id: index % 5 === 0 ? `group-${index % 6}` : null,
    sketch_photo_id: null,
    created_at: `2026-04-${pad(day)}T07:${pad(index % 60)}:00.000Z`,
  };
}

function makeFilterCase(
  rng: () => number,
  index: number,
): {
  dreams: Dream[];
  filters: DreamFilterState;
} {
  const size = randomInt(rng, 0, 160);
  const selectedType =
    rng() >= 0.55
      ? DREAM_TYPES[randomInt(rng, 0, DREAM_TYPES.length - 1)]
      : null;
  const selectedTheme =
    rng() >= 0.6
      ? DREAM_THEMES[randomInt(rng, 0, DREAM_THEMES.length - 1)]
      : null;
  const selectedEmotion =
    rng() >= 0.7
      ? DREAM_EMOTIONS[randomInt(rng, 0, DREAM_EMOTIONS.length - 1)]
      : null;

  return {
    dreams: Array.from({ length: size }, (_, offset) => makeDream(index + offset)),
    filters: {
      query: rng() >= 0.65 ? `person ${index % 9}` : '',
      type: selectedType,
      theme: selectedTheme,
      emotion: selectedEmotion,
      lucidOnly: rng() >= 0.8,
      recurringOnly: rng() >= 0.82,
    },
  };
}

function makeRecurringCase(
  rng: () => number,
  index: number,
): {
  draft: Pick<Dream, 'content_md' | 'themes'>;
  dreams: Dream[];
} {
  const size = randomInt(rng, 12, 160);
  const dreams = Array.from({ length: size }, (_, offset) => makeDream(index + offset)).map(
    (dream, offset) => {
      if (offset % 3 === 0) {
        return {
          ...dream,
          is_recurring: true,
          recurring_group_id: `group-${offset % 8}`,
          type: offset % 2 === 0 ? 'recurring' : dream.type,
        };
      }
      return dream;
    },
  );
  const chosenTheme = DREAM_THEMES[index % DREAM_THEMES.length];
  const query = rng() >= 0.5 ? `person ${index % 9}` : '';

  return {
    draft: {
      content_md: query,
      themes: rng() >= 0.4 ? [chosenTheme] : [],
    },
    dreams,
  };
}

describe('filterDreams function quality gate', () => {
  it('matches the contract for combined filters', () => {
    const dreams = [
      makeDream(1),
      makeDream(2),
      makeDream(3),
      makeDream(4),
    ];
    const result = filterDreams(dreams, {
      theme: dreams[0].themes[0],
      query: dreams[0].people[0],
    });

    expect(result.every((dream) => dream.themes.includes(dreams[0].themes[0])))
      .toBe(true);
    expect(result.every((dream) => dream.people.includes(dreams[0].people[0])))
      .toBe(true);
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'filterDreams fuzz',
      iterations: 120,
      seed: 42,
      makeCase: (rng, index) => makeFilterCase(rng, index),
      assertCase: async ({ dreams, filters }) => {
        const result = filterDreams(dreams, filters);

        for (const dream of result) {
          if (filters.type) {
            expect(dream.type).toBe(filters.type);
          }
          if (filters.theme) {
            expect(dream.themes).toContain(filters.theme);
          }
          if (filters.emotion) {
            expect(dream.emotions).toContain(filters.emotion);
          }
          if (filters.lucidOnly) {
            expect(dream.is_lucid).toBe(true);
          }
          if (filters.recurringOnly) {
            expect(dream.is_recurring).toBe(true);
          }
        }
      },
    });
  });

  it('stays within linear complexity slope budget for section building', async () => {
    await assertComplexitySlope({
      label: 'buildDreamTimelineSections',
      sizes: [500, 1000, 2000],
      expected: 'linear',
      warmupRuns: 2,
      sampleRuns: 7,
      maxRatios: [4.0, 4.0],
      setup: (size) => Array.from({ length: size }, (_, index) => makeDream(index)),
      run: async (dreams) => {
        for (let index = 0; index < 20; index += 1) {
          buildDreamTimelineSections(dreams);
        }
      },
    });
  }, 15_000);

  it('stays within memory budget under repeated dream filtering', async () => {
    await assertMemoryBudget({
      label: 'filterDreams repeated calls',
      repeats: 14,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeFilterCase(() => 0.7, 12),
      run: async ({ dreams, filters }) => {
        filterDreams(dreams, filters);
      },
    });
  });
});

describe('findRecurringDreamCandidates function quality gate', () => {
  it('returns only recurring-group representatives that match the draft', () => {
    const dreams = [
      {
        ...makeDream(1),
        is_recurring: true,
        recurring_group_id: 'group-a',
        themes: ['water', 'house'],
      },
      {
        ...makeDream(2),
        is_recurring: true,
        recurring_group_id: 'group-a',
        themes: ['water'],
        date: '2026-04-22',
      },
      {
        ...makeDream(3),
        is_recurring: true,
        recurring_group_id: 'group-b',
        themes: ['school'],
      },
    ];

    const result = findRecurringDreamCandidates(
      {
        content_md: 'water around the house',
        themes: ['water', 'house'],
      },
      dreams,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('dream-2');
    expect(getRecurringDreamGroupId(result[0]!)).toBe('group-a');
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'findRecurringDreamCandidates fuzz',
      iterations: 120,
      seed: 42,
      makeCase: (rng, index) => makeRecurringCase(rng, index),
      assertCase: async ({ draft, dreams }) => {
        const result = findRecurringDreamCandidates(draft, dreams, 4);
        const groupIds = result
          .map((dream) => getRecurringDreamGroupId(dream))
          .filter((value): value is string => Boolean(value));
        const normalizedThemes = new Set(
          draft.themes.map((theme) => theme.toLocaleLowerCase()),
        );
        const queryTokens = draft.content_md
          .toLocaleLowerCase()
          .trim()
          .split(/\s+/)
          .filter(Boolean);

        expect(result).toHaveLength(groupIds.length);
        expect(new Set(groupIds).size).toBe(groupIds.length);

        for (const dream of result) {
          expect(getRecurringDreamGroupId(dream)).toBeTruthy();

          if (normalizedThemes.size > 0 || queryTokens.length > 0) {
            const themeOverlap = dream.themes.some((theme) =>
              normalizedThemes.has(theme.toLocaleLowerCase()),
            );
            const haystack = [
              dream.content_md,
              dream.themes.join(' '),
              dream.people.join(' '),
            ]
              .join(' ')
              .toLocaleLowerCase();
            const tokenMatch = queryTokens.some((token) => haystack.includes(token));
            expect(themeOverlap || tokenMatch).toBe(true);
          }
        }
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'findRecurringDreamCandidates',
      sizes: [250, 500, 1000],
      expected: 'linear',
      sampleRuns: 3,
      setup: (size) => makeRecurringCase(() => 0.74, size),
      run: async ({ draft, dreams }) => {
        findRecurringDreamCandidates(draft, dreams, 4);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'findRecurringDreamCandidates repeated calls',
      repeats: 14,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => makeRecurringCase(() => 0.71, 18),
      run: async ({ draft, dreams }) => {
        findRecurringDreamCandidates(draft, dreams, 4);
      },
    });
  });
});
