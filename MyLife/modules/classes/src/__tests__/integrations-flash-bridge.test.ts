import { describe, expect, it } from 'vitest';
import {
  aggregateStudyTopics,
  buildClassDeckSeed,
} from '../integrations/flash-bridge';

const cls = { id: 'c1', name: 'Algorithms', code: 'CS 401' };

describe('aggregateStudyTopics', () => {
  it('returns empty array on empty input', () => {
    expect(aggregateStudyTopics([])).toEqual([]);
  });

  it('parses + dedupes topics across sessions', () => {
    const out = aggregateStudyTopics([
      { topics_covered: JSON.stringify(['BFS', 'DFS']) },
      { topics_covered: JSON.stringify(['DFS', 'Dijkstra']) },
      { topics_covered: null },
    ]);
    expect(out).toEqual(['BFS', 'DFS', 'Dijkstra']);
  });

  it('skips invalid JSON gracefully', () => {
    expect(
      aggregateStudyTopics([
        { topics_covered: 'not json' },
        { topics_covered: JSON.stringify(['x']) },
      ]),
    ).toEqual(['x']);
  });

  it('trims and filters empty strings', () => {
    expect(
      aggregateStudyTopics([
        { topics_covered: JSON.stringify(['  trees  ', '', '   ']) },
      ]),
    ).toEqual(['trees']);
  });
});

describe('buildClassDeckSeed', () => {
  it('builds a class-only deck', () => {
    const seed = buildClassDeckSeed(cls, null, []);
    expect(seed.name).toBe('CS 401');
    expect(seed.classId).toBe('c1');
    expect(seed.assignmentId).toBeNull();
    expect(seed.suggestedTopics).toEqual([]);
  });

  it('includes assignment title when provided', () => {
    const seed = buildClassDeckSeed(
      cls,
      { id: 'a1', title: 'Midterm' },
      [{ topics_covered: JSON.stringify(['BFS']) }],
    );
    expect(seed.name).toBe('CS 401: Midterm');
    expect(seed.assignmentId).toBe('a1');
    expect(seed.suggestedTopics).toEqual(['BFS']);
  });

  it('falls back to class name when code is missing', () => {
    const seed = buildClassDeckSeed(
      { id: 'c2', name: 'Music Theory', code: null },
      null,
      [],
    );
    expect(seed.name).toBe('Music Theory');
  });
});
