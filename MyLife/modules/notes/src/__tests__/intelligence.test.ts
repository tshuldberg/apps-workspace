import { describe, it, expect } from 'vitest';
import {
  computeStalenessScores,
  extractSignificantTerms,
  findSimilarUnlinkedNotes,
  findKnowledgeGaps,
  computeKnowledgeDiscovery,
} from '../engine/knowledge-discovery';
import {
  computeDailyCreationTrend,
  computeWordCountDistribution,
  computeWritingVelocity,
  computeWritingStreak,
  computeWritingAnalytics,
} from '../engine/writing-analytics';
import {
  scoreConnections,
  findHubNotes,
  computeLinkDensity,
  findBridgeNotes,
  computeLinkIntelligence,
} from '../engine/link-intelligence';
import {
  computeTagUsage,
  computeTagCoOccurrence,
  findUnusedTags,
  suggestTags,
  computeTagIntelligence,
} from '../engine/tag-intelligence';
import type { Note, NoteGraph } from '../types';

// ── Test Helpers ─────────────────────────────────────────────────────

function makeNote(overrides: Partial<Note> & { id: string }): Note {
  return {
    title: 'Test Note',
    body: '',
    folderId: null,
    isPinned: false,
    isFavorite: false,
    wordCount: 100,
    charCount: 500,
    isDailyNote: false,
    dailyDate: null,
    sourceUrl: null,
    clippedAt: null,
    clipType: null,
    createdAt: '2026-03-01T12:00:00.000Z',
    updatedAt: '2026-03-01T12:00:00.000Z',
    ...overrides,
  };
}

function makeGraph(nodes: Array<{ id: string; title: string; linkCount: number }>, edges: Array<{ source: string; target: string }>): NoteGraph {
  return { nodes, edges };
}

const NOW = '2026-03-24T12:00:00.000Z';

// ── Knowledge Discovery ──────────────────────────────────────────────

describe('Knowledge Discovery Engine', () => {
  describe('computeStalenessScores', () => {
    it('scores older notes higher', () => {
      const notes = [
        makeNote({ id: '1', title: 'Old', updatedAt: '2026-01-01T00:00:00.000Z', wordCount: 200 }),
        makeNote({ id: '2', title: 'Recent', updatedAt: '2026-03-23T00:00:00.000Z', wordCount: 200 }),
      ];
      const graph = makeGraph(
        [{ id: '1', title: 'Old', linkCount: 0 }, { id: '2', title: 'Recent', linkCount: 0 }],
        [],
      );
      const scores = computeStalenessScores(notes, graph, NOW);
      const oldScore = scores.find((s) => s.noteId === '1')!;
      const recentScore = scores.find((s) => s.noteId === '2');
      expect(oldScore.score).toBeGreaterThan(0);
      expect(oldScore.daysSinceUpdate).toBeGreaterThan(80);
      // Recent note may not appear or has low score
      if (recentScore) {
        expect(oldScore.score).toBeGreaterThan(recentScore.score);
      }
    });

    it('gives orphan bonus to unlinked notes', () => {
      const notes = [
        makeNote({ id: '1', title: 'Linked', updatedAt: '2026-02-01T00:00:00.000Z', wordCount: 200 }),
        makeNote({ id: '2', title: 'Orphan', updatedAt: '2026-02-01T00:00:00.000Z', wordCount: 200 }),
      ];
      const graph = makeGraph(
        [{ id: '1', title: 'Linked', linkCount: 3 }, { id: '2', title: 'Orphan', linkCount: 0 }],
        [{ source: '1', target: '3' }],
      );
      const scores = computeStalenessScores(notes, graph, NOW);
      const linked = scores.find((s) => s.noteId === '1')!;
      const orphan = scores.find((s) => s.noteId === '2')!;
      expect(orphan.score).toBeGreaterThanOrEqual(linked.score);
    });

    it('returns empty for no notes', () => {
      const scores = computeStalenessScores([], makeGraph([], []), NOW);
      expect(scores).toEqual([]);
    });
  });

  describe('extractSignificantTerms', () => {
    it('extracts meaningful words and strips markdown', () => {
      const terms = extractSignificantTerms('# React Components\nBuild **reusable** components with TypeScript');
      expect(terms).toContain('react');
      expect(terms).toContain('components');
      expect(terms).toContain('typescript');
      expect(terms).not.toContain('with');
      expect(terms).not.toContain('the');
    });

    it('extracts terms from backlinks', () => {
      const terms = extractSignificantTerms('See [[Project Alpha]] for details');
      expect(terms).toContain('project');
      expect(terms).toContain('alpha');
    });

    it('returns empty for empty text', () => {
      expect(extractSignificantTerms('')).toEqual([]);
    });

    it('deduplicates terms', () => {
      const terms = extractSignificantTerms('react react react components components');
      const reactCount = terms.filter((t) => t === 'react').length;
      expect(reactCount).toBe(1);
    });
  });

  describe('findSimilarUnlinkedNotes', () => {
    it('finds notes with shared terms that are not linked', () => {
      const notes = [
        { id: '1', title: 'React Hooks', body: 'React hooks allow functional components to manage state and lifecycle' },
        { id: '2', title: 'React Components', body: 'React components are reusable functional building blocks for state management' },
        { id: '3', title: 'Cooking Tips', body: 'Cooking tips for making delicious pasta with fresh ingredients' },
      ];
      const graph = makeGraph([], []);
      const pairs = findSimilarUnlinkedNotes(notes, graph, 2);
      expect(pairs.length).toBeGreaterThan(0);
      // React notes should be similar
      const reactPair = pairs.find(
        (p) => (p.noteIdA === '1' && p.noteIdB === '2') || (p.noteIdA === '2' && p.noteIdB === '1'),
      );
      expect(reactPair).toBeDefined();
    });

    it('excludes already-linked pairs', () => {
      const notes = [
        { id: '1', title: 'A', body: 'typescript react components state management hooks lifecycle' },
        { id: '2', title: 'B', body: 'typescript react components state management hooks lifecycle' },
      ];
      const graph = makeGraph([], [{ source: '1', target: '2' }]);
      const pairs = findSimilarUnlinkedNotes(notes, graph, 2);
      expect(pairs).toEqual([]);
    });
  });

  describe('findKnowledgeGaps', () => {
    it('finds terms mentioned across many notes without their own note', () => {
      const notes = [
        { id: '1', title: 'Project A', body: 'TypeScript implementation details' },
        { id: '2', title: 'Project B', body: 'TypeScript refactoring notes' },
        { id: '3', title: 'Project C', body: 'TypeScript migration guide' },
      ];
      const gaps = findKnowledgeGaps(notes, 2);
      const tsGap = gaps.find((g) => g.term === 'typescript');
      expect(tsGap).toBeDefined();
      expect(tsGap!.hasOwnNote).toBe(false);
    });

    it('excludes terms that have their own note', () => {
      const notes = [
        { id: '1', title: 'typescript', body: 'TypeScript reference guide' },
        { id: '2', title: 'Project A', body: 'TypeScript implementation' },
        { id: '3', title: 'Project B', body: 'TypeScript migration' },
      ];
      const gaps = findKnowledgeGaps(notes, 2);
      const tsGap = gaps.find((g) => g.term === 'typescript');
      expect(tsGap).toBeUndefined();
    });
  });

  describe('computeKnowledgeDiscovery', () => {
    it('returns aggregate insights', () => {
      const notes = [
        makeNote({ id: '1', title: 'A', body: 'Hello world', updatedAt: '2026-01-01T00:00:00.000Z' }),
        makeNote({ id: '2', title: 'B', body: 'Hello world', updatedAt: '2026-03-23T00:00:00.000Z' }),
      ];
      const graph = makeGraph(
        [{ id: '1', title: 'A', linkCount: 0 }, { id: '2', title: 'B', linkCount: 0 }],
        [],
      );
      const insights = computeKnowledgeDiscovery(notes as Array<Note & { body: string }>, graph, NOW);
      expect(insights.totalNotes).toBe(2);
      expect(insights.orphanCount).toBe(2);
    });
  });
});

// ── Writing Analytics ────────────────────────────────────────────────

describe('Writing Analytics Engine', () => {
  describe('computeDailyCreationTrend', () => {
    it('groups notes by creation day', () => {
      const notes = [
        makeNote({ id: '1', createdAt: '2026-03-23T10:00:00.000Z', wordCount: 50 }),
        makeNote({ id: '2', createdAt: '2026-03-23T14:00:00.000Z', wordCount: 100 }),
        makeNote({ id: '3', createdAt: '2026-03-22T10:00:00.000Z', wordCount: 75 }),
      ];
      const trend = computeDailyCreationTrend(notes, 30, NOW);
      const mar23 = trend.find((t) => t.period === '2026-03-23');
      expect(mar23).toBeDefined();
      expect(mar23!.count).toBe(2);
      expect(mar23!.totalWords).toBe(150);
    });

    it('returns empty counts for days with no notes', () => {
      const trend = computeDailyCreationTrend([], 7, NOW);
      expect(trend.length).toBe(7);
      expect(trend.every((t) => t.count === 0)).toBe(true);
    });
  });

  describe('computeWordCountDistribution', () => {
    it('distributes notes into buckets', () => {
      const notes = [
        makeNote({ id: '1', wordCount: 10 }),
        makeNote({ id: '2', wordCount: 100 }),
        makeNote({ id: '3', wordCount: 300 }),
        makeNote({ id: '4', wordCount: 800 }),
        makeNote({ id: '5', wordCount: 2000 }),
      ];
      const dist = computeWordCountDistribution(notes);
      expect(dist.find((b) => b.label.startsWith('Quick'))!.count).toBe(1);
      expect(dist.find((b) => b.label.startsWith('Short'))!.count).toBe(1);
      expect(dist.find((b) => b.label.startsWith('Medium'))!.count).toBe(1);
      expect(dist.find((b) => b.label.startsWith('Long'))!.count).toBe(1);
      expect(dist.find((b) => b.label.startsWith('Deep'))!.count).toBe(1);
    });
  });

  describe('computeWritingVelocity', () => {
    it('computes velocity metrics', () => {
      const notes = [
        makeNote({ id: '1', createdAt: '2026-03-20T10:00:00.000Z', wordCount: 500, title: 'Big Note' }),
        makeNote({ id: '2', createdAt: '2026-03-22T10:00:00.000Z', wordCount: 200, title: 'Small Note' }),
      ];
      const velocity = computeWritingVelocity(notes, 4, NOW);
      expect(velocity.notesPerWeek).toBeGreaterThan(0);
      expect(velocity.wordsPerWeek).toBeGreaterThan(0);
      expect(velocity.longestNote!.title).toBe('Big Note');
      expect(velocity.mostProductiveDay).toBeDefined();
    });

    it('returns zeros for no notes', () => {
      const velocity = computeWritingVelocity([], 4, NOW);
      expect(velocity.notesPerWeek).toBe(0);
      expect(velocity.longestNote).toBeNull();
    });
  });

  describe('computeWritingStreak', () => {
    it('counts consecutive days', () => {
      const notes = [
        makeNote({ id: '1', createdAt: '2026-03-22T10:00:00.000Z' }),
        makeNote({ id: '2', createdAt: '2026-03-23T10:00:00.000Z' }),
        makeNote({ id: '3', createdAt: '2026-03-24T10:00:00.000Z' }),
      ];
      const streak = computeWritingStreak(notes, NOW);
      expect(streak.currentStreak).toBe(3);
      expect(streak.longestStreak).toBe(3);
      expect(streak.totalActiveDays).toBe(3);
    });

    it('breaks streak on gap days', () => {
      const notes = [
        makeNote({ id: '1', createdAt: '2026-03-20T10:00:00.000Z' }),
        makeNote({ id: '2', createdAt: '2026-03-24T10:00:00.000Z' }),
      ];
      const streak = computeWritingStreak(notes, NOW);
      expect(streak.currentStreak).toBe(1);
      expect(streak.longestStreak).toBe(1);
    });

    it('returns zeros for empty notes', () => {
      const streak = computeWritingStreak([], NOW);
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);
    });
  });

  describe('computeWritingAnalytics', () => {
    it('returns aggregate analytics', () => {
      const notes = [makeNote({ id: '1', createdAt: '2026-03-24T10:00:00.000Z' })];
      const analytics = computeWritingAnalytics(notes, NOW);
      expect(analytics.velocity).toBeDefined();
      expect(analytics.streak).toBeDefined();
      expect(analytics.wordCountDistribution.length).toBe(5);
    });
  });
});

// ── Link Intelligence ────────────────────────────────────────────────

describe('Link Intelligence Engine', () => {
  describe('scoreConnections', () => {
    it('scores directly linked notes higher', () => {
      const graph = makeGraph(
        [
          { id: '1', title: 'A', linkCount: 2 },
          { id: '2', title: 'B', linkCount: 1 },
          { id: '3', title: 'C', linkCount: 1 },
        ],
        [{ source: '1', target: '2' }, { source: '1', target: '3' }],
      );
      const connections = scoreConnections(graph, '1');
      expect(connections.length).toBe(2);
      expect(connections[0].directLinks).toBe(1);
    });

    it('detects shared neighbors', () => {
      const graph = makeGraph(
        [
          { id: '1', title: 'A', linkCount: 1 },
          { id: '2', title: 'B', linkCount: 2 },
          { id: '3', title: 'C', linkCount: 1 },
        ],
        [{ source: '1', target: '2' }, { source: '3', target: '2' }],
      );
      const connections = scoreConnections(graph, '1');
      const c3 = connections.find((c) => c.noteId === '3');
      expect(c3).toBeDefined();
      expect(c3!.sharedNeighbors).toBe(1);
    });
  });

  describe('findHubNotes', () => {
    it('identifies highly-connected notes', () => {
      const graph = makeGraph(
        [
          { id: '1', title: 'Hub', linkCount: 5 },
          { id: '2', title: 'Leaf', linkCount: 1 },
          { id: '3', title: 'Leaf2', linkCount: 1 },
        ],
        [
          { source: '1', target: '2' },
          { source: '1', target: '3' },
        ],
      );
      const hubs = findHubNotes(graph);
      expect(hubs[0].noteId).toBe('1');
      expect(hubs[0].hubScore).toBe(100);
    });

    it('returns empty for empty graph', () => {
      expect(findHubNotes(makeGraph([], []))).toEqual([]);
    });
  });

  describe('computeLinkDensity', () => {
    it('computes density stats', () => {
      const graph = makeGraph(
        [
          { id: '1', title: 'A', linkCount: 1 },
          { id: '2', title: 'B', linkCount: 1 },
          { id: '3', title: 'C', linkCount: 0 },
        ],
        [{ source: '1', target: '2' }],
      );
      const density = computeLinkDensity(graph);
      expect(density.totalNotes).toBe(3);
      expect(density.totalLinks).toBe(1);
      expect(density.linkedNotes).toBe(2);
      expect(density.orphanNotes).toBe(1);
      expect(density.density).toBeGreaterThan(0);
    });

    it('handles empty graph', () => {
      const density = computeLinkDensity(makeGraph([], []));
      expect(density.totalNotes).toBe(0);
      expect(density.density).toBe(0);
    });
  });

  describe('findBridgeNotes', () => {
    it('finds notes that connect separate clusters', () => {
      const graph = makeGraph(
        [
          { id: '1', title: 'A', linkCount: 1 },
          { id: '2', title: 'Bridge', linkCount: 2 },
          { id: '3', title: 'C', linkCount: 1 },
        ],
        [{ source: '1', target: '2' }, { source: '2', target: '3' }],
      );
      const bridges = findBridgeNotes(graph);
      expect(bridges.length).toBe(1);
      expect(bridges[0].noteId).toBe('2');
    });

    it('returns empty when no bridges exist', () => {
      const graph = makeGraph(
        [
          { id: '1', title: 'A', linkCount: 2 },
          { id: '2', title: 'B', linkCount: 2 },
          { id: '3', title: 'C', linkCount: 2 },
        ],
        [
          { source: '1', target: '2' },
          { source: '2', target: '3' },
          { source: '1', target: '3' },
        ],
      );
      const bridges = findBridgeNotes(graph);
      expect(bridges.length).toBe(0);
    });
  });

  describe('computeLinkIntelligence', () => {
    it('returns aggregate link insights', () => {
      const graph = makeGraph(
        [{ id: '1', title: 'A', linkCount: 1 }, { id: '2', title: 'B', linkCount: 1 }],
        [{ source: '1', target: '2' }],
      );
      const insights = computeLinkIntelligence(graph);
      expect(insights.density.totalNotes).toBe(2);
      expect(insights.hubNotes.length).toBeGreaterThan(0);
    });
  });
});

// ── Tag Intelligence ─────────────────────────────────────────────────

describe('Tag Intelligence Engine', () => {
  const TAGS = [
    { id: 't1', name: 'react' },
    { id: 't2', name: 'typescript' },
    { id: 't3', name: 'unused-tag' },
  ];

  const NOTE_TAG_PAIRS = [
    { noteId: 'n1', tagId: 't1' },
    { noteId: 'n1', tagId: 't2' },
    { noteId: 'n2', tagId: 't1' },
    { noteId: 'n2', tagId: 't2' },
    { noteId: 'n3', tagId: 't1' },
  ];

  describe('computeTagUsage', () => {
    it('counts tag usage correctly', () => {
      const usage = computeTagUsage(TAGS, NOTE_TAG_PAIRS, 3);
      const react = usage.find((u) => u.tagName === 'react')!;
      expect(react.noteCount).toBe(3);
      expect(react.percentage).toBe(100);

      const ts = usage.find((u) => u.tagName === 'typescript')!;
      expect(ts.noteCount).toBe(2);
      expect(ts.percentage).toBe(67);
    });

    it('sorts by usage count descending', () => {
      const usage = computeTagUsage(TAGS, NOTE_TAG_PAIRS, 3);
      expect(usage[0].tagName).toBe('react');
    });
  });

  describe('computeTagCoOccurrence', () => {
    it('finds co-occurring tags', () => {
      const coOccurrence = computeTagCoOccurrence(TAGS, NOTE_TAG_PAIRS);
      expect(coOccurrence.length).toBeGreaterThan(0);
      const reactTs = coOccurrence.find(
        (c) => (c.tagNameA === 'react' && c.tagNameB === 'typescript') ||
               (c.tagNameA === 'typescript' && c.tagNameB === 'react'),
      );
      expect(reactTs).toBeDefined();
      expect(reactTs!.sharedNotes).toBe(2);
    });
  });

  describe('findUnusedTags', () => {
    it('identifies tags with no notes', () => {
      const unused = findUnusedTags(TAGS, NOTE_TAG_PAIRS);
      expect(unused.length).toBe(1);
      expect(unused[0].name).toBe('unused-tag');
    });
  });

  describe('suggestTags', () => {
    it('suggests tags based on co-occurrence', () => {
      const suggestions = suggestTags(['t1'], TAGS, NOTE_TAG_PAIRS);
      const tsSuggestion = suggestions.find((s) => s.tagName === 'typescript');
      expect(tsSuggestion).toBeDefined();
      expect(tsSuggestion!.confidence).toBeGreaterThan(0);
    });

    it('returns empty for no existing tags', () => {
      expect(suggestTags([], TAGS, NOTE_TAG_PAIRS)).toEqual([]);
    });
  });

  describe('computeTagIntelligence', () => {
    it('returns aggregate tag insights', () => {
      const insights = computeTagIntelligence(TAGS, NOTE_TAG_PAIRS, 3);
      expect(insights.usage.length).toBe(3);
      expect(insights.unusedTagCount).toBe(1);
      expect(insights.topTagCount).toBe(3);
    });
  });
});
