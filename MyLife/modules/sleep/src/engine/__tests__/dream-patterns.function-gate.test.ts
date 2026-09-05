import { describe, expect, it } from 'vitest';
import type { Dream, DreamType } from '../../models/dream-schemas';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import {
  getDreamDictionary,
  parseDreamDictionaryNotes,
  searchDreamDictionary,
  sortDreamDictionary,
  type DreamDictionaryNotesMap,
} from '../dream-patterns';

const DREAM_TYPES: DreamType[] = [
  'normal',
  'vivid',
  'nightmare',
  'lucid',
  'recurring',
];

const DREAM_THEMES = [
  'water',
  'house',
  'school',
  'flying',
  'family',
  'chase',
  'travel',
  'animals',
] as const;

const DREAM_EMOTIONS = [
  'peaceful',
  'excited',
  'scared',
  'confused',
  'anxious',
  'happy',
] as const;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function makeDream(index: number): Dream {
  const day = 1 + (index % 28);
  const month = 1 + Math.floor(index / 28) % 4;
  const type = DREAM_TYPES[index % DREAM_TYPES.length];
  const themeA = DREAM_THEMES[index % DREAM_THEMES.length];
  const themeB = DREAM_THEMES[(index + 2) % DREAM_THEMES.length];

  return {
    id: `dream-${index}`,
    sleep_entry_id: null,
    date: `2026-${pad(month)}-${pad(day)}`,
    content_md: `Dream ${index} about ${themeA}, ${themeB}, and looping hallways.`,
    type,
    themes: [themeA, themeB],
    people: [`Person ${index % 9}`],
    emotions: [
      DREAM_EMOTIONS[index % DREAM_EMOTIONS.length],
      DREAM_EMOTIONS[(index + 1) % DREAM_EMOTIONS.length],
    ],
    is_lucid: type === 'lucid' || index % 7 === 0,
    is_recurring: type === 'recurring' || index % 6 === 0,
    recurring_group_id:
      type === 'recurring' || index % 6 === 0 ? `group-${index % 10}` : null,
    sketch_photo_id: null,
    created_at: `2026-${pad(month)}-${pad(day)}T07:${pad(index % 60)}:00.000Z`,
  };
}

function makeNotesMap(
  rng: () => number,
): DreamDictionaryNotesMap {
  const notes: DreamDictionaryNotesMap = {};

  for (const theme of DREAM_THEMES) {
    if (rng() >= 0.55) {
      notes[theme] = `${theme} note ${Math.floor(rng() * 20)}`;
    }
  }

  return notes;
}

function makeDictionaryCase(
  rng: () => number,
  index: number,
): {
  dreams: Dream[];
  notes: DreamDictionaryNotesMap;
  query: string;
} {
  const size = randomInt(rng, 0, 220);
  const dreams = Array.from({ length: size }, (_, offset) => makeDream(index + offset));
  const notes = makeNotesMap(rng);
  const queryTheme = DREAM_THEMES[index % DREAM_THEMES.length];
  const query = rng() >= 0.5 ? `${queryTheme}` : `note ${index % 10}`;

  return {
    dreams,
    notes,
    query,
  };
}

describe('getDreamDictionary function quality gate', () => {
  it('matches contract behavior for known cases', () => {
    const dreams = [
      {
        ...makeDream(1),
        themes: ['water', 'flying'],
      },
      {
        ...makeDream(2),
        themes: ['water', 'house'],
      },
      {
        ...makeDream(3),
        themes: ['school', 'animals'],
        date: '2026-04-18',
      },
    ];
    const result = getDreamDictionary(dreams, {
      water: 'Water means transition.',
    });
    const waterEntry = result.find((entry) => entry.theme === 'water');

    expect(waterEntry).toMatchObject({
      theme: 'water',
      count: 2,
      note: 'Water means transition.',
    });
    expect(waterEntry?.exampleExcerpts.length).toBeGreaterThan(0);
    expect(sortDreamDictionary(result, 'alphabetical')[0]?.theme).toBe('animals');
  });

  it('passes deterministic fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'getDreamDictionary fuzz',
      iterations: 120,
      seed: 42,
      makeCase: (rng, index) => makeDictionaryCase(rng, index),
      assertCase: async ({ dreams, notes, query }) => {
        const normalizedNotes = parseDreamDictionaryNotes(notes);
        const dictionary = getDreamDictionary(dreams, notes);

        for (const entry of dictionary) {
          const matchingDreams = dreams.filter((dream) =>
            dream.themes.includes(entry.theme),
          );

          expect(entry.count).toBe(matchingDreams.length);
          expect(entry.firstOccurrence <= entry.lastOccurrence).toBe(true);
          expect(entry.exampleExcerpts.length).toBeGreaterThan(0);
          expect(entry.note ?? null).toBe(normalizedNotes[entry.theme] ?? null);
        }

        const searched = searchDreamDictionary(dictionary, query);
        for (const entry of searched) {
          const haystack = [
            entry.theme,
            entry.note ?? '',
            entry.associatedEmotions.join(' '),
            entry.exampleExcerpts.join(' '),
          ]
            .join(' ')
            .toLocaleLowerCase();

          for (const token of query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)) {
            expect(haystack.includes(token)).toBe(true);
          }
        }
      },
    });
  });

  it('stays within nlogn complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'getDreamDictionary',
      sizes: [250, 500, 1000],
      expected: 'nlogn',
      maxRatios: [7.0, 7.0],
      sampleRuns: 5,
      setup: (size) => ({
        dreams: Array.from({ length: size }, (_, index) => makeDream(index)),
        notes: {
          water: 'Water means transition.',
          house: 'House means safety.',
          school: 'School means unfinished work.',
        },
      }),
      run: async ({ dreams, notes }) => {
        getDreamDictionary(dreams, notes);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'getDreamDictionary',
      repeats: 16,
      maxHeapDeltaBytes: 10 * 1024 * 1024,
      setup: () => ({
        dreams: Array.from({ length: 900 }, (_, index) => makeDream(index)),
        notes: {
          water: 'Water means transition.',
          house: 'House means safety.',
          school: 'School means unfinished work.',
        },
      }),
      run: async ({ dreams, notes }) => {
        getDreamDictionary(dreams, notes);
      },
    });
  });
});
