import { describe, it, expect } from 'vitest';
import {
  computeWordCountTrend,
  computeTopTags,
  estimateVocabularyRichness,
  computeTagMoodCorrelation,
  computeWritingTimeDistribution,
  computeWritingInsights,
} from '../engine/writing-insights';

describe('computeWordCountTrend', () => {
  it('returns stable for fewer than 4 entries', () => {
    expect(computeWordCountTrend([
      { wordCount: 100, entryDate: '2026-01-01' },
      { wordCount: 200, entryDate: '2026-01-02' },
    ])).toBe('stable');
  });

  it('detects increasing trend', () => {
    const entries = [
      { wordCount: 50, entryDate: '2026-01-01' },
      { wordCount: 60, entryDate: '2026-01-02' },
      { wordCount: 150, entryDate: '2026-01-03' },
      { wordCount: 200, entryDate: '2026-01-04' },
    ];
    expect(computeWordCountTrend(entries)).toBe('increasing');
  });

  it('detects decreasing trend', () => {
    const entries = [
      { wordCount: 200, entryDate: '2026-01-01' },
      { wordCount: 180, entryDate: '2026-01-02' },
      { wordCount: 50, entryDate: '2026-01-03' },
      { wordCount: 40, entryDate: '2026-01-04' },
    ];
    expect(computeWordCountTrend(entries)).toBe('decreasing');
  });

  it('returns stable when change is within threshold', () => {
    const entries = [
      { wordCount: 100, entryDate: '2026-01-01' },
      { wordCount: 105, entryDate: '2026-01-02' },
      { wordCount: 110, entryDate: '2026-01-03' },
      { wordCount: 108, entryDate: '2026-01-04' },
    ];
    expect(computeWordCountTrend(entries)).toBe('stable');
  });

  it('handles unsorted input', () => {
    const entries = [
      { wordCount: 200, entryDate: '2026-01-04' },
      { wordCount: 50, entryDate: '2026-01-01' },
      { wordCount: 150, entryDate: '2026-01-03' },
      { wordCount: 60, entryDate: '2026-01-02' },
    ];
    expect(computeWordCountTrend(entries)).toBe('increasing');
  });
});

describe('computeTopTags', () => {
  it('returns empty array for no tags', () => {
    expect(computeTopTags([], [])).toEqual([]);
  });

  it('ranks tags by frequency', () => {
    const entries = [
      { id: '1', mood: 'good' },
      { id: '2', mood: 'great' },
      { id: '3', mood: null },
    ];
    const entryTags = [
      { entryId: '1', tagName: 'work' },
      { entryId: '2', tagName: 'work' },
      { entryId: '3', tagName: 'work' },
      { entryId: '1', tagName: 'personal' },
    ];
    const result = computeTopTags(entries, entryTags);
    expect(result[0].tag).toBe('work');
    expect(result[0].entryCount).toBe(3);
    expect(result[1].tag).toBe('personal');
    expect(result[1].entryCount).toBe(1);
  });

  it('computes average mood per tag', () => {
    const entries = [
      { id: '1', mood: 'good' },  // 3
      { id: '2', mood: 'great' }, // 4
    ];
    const entryTags = [
      { entryId: '1', tagName: 'work' },
      { entryId: '2', tagName: 'work' },
    ];
    const result = computeTopTags(entries, entryTags);
    expect(result[0].avgMood).toBe(3.5);
  });

  it('returns null avgMood when no mood data', () => {
    const entries = [{ id: '1', mood: null }];
    const entryTags = [{ entryId: '1', tagName: 'misc' }];
    const result = computeTopTags(entries, entryTags);
    expect(result[0].avgMood).toBeNull();
  });

  it('respects limit', () => {
    const entries = [{ id: '1', mood: null }];
    const tags = Array.from({ length: 20 }, (_, i) => ({
      entryId: '1',
      tagName: `tag-${i}`,
    }));
    const result = computeTopTags(entries, tags, 5);
    expect(result).toHaveLength(5);
  });
});

describe('estimateVocabularyRichness', () => {
  it('returns 0 for empty input', () => {
    expect(estimateVocabularyRichness([])).toBe(0);
    expect(estimateVocabularyRichness([''])).toBe(0);
  });

  it('returns 1 for all unique words', () => {
    expect(estimateVocabularyRichness(['the quick brown fox'])).toBe(1);
  });

  it('returns lower score for repeated words', () => {
    const richness = estimateVocabularyRichness(['the the the the']);
    expect(richness).toBe(0.25);
  });

  it('strips markdown formatting', () => {
    const richness = estimateVocabularyRichness(['**bold** *italic* `code`']);
    // Should count: bold, italic, code (3 unique / 3 total = 1)
    expect(richness).toBe(1);
  });
});

describe('computeWritingTimeDistribution', () => {
  it('returns empty for no entries', () => {
    expect(computeWritingTimeDistribution([])).toEqual({});
  });

  it('buckets entries by hour', () => {
    const entries = [
      { createdAt: '2026-01-01 09:30:00' },
      { createdAt: '2026-01-02 09:15:00' },
      { createdAt: '2026-01-03 21:00:00' },
    ];
    const dist = computeWritingTimeDistribution(entries);
    expect(dist[9]).toBe(2);
    expect(dist[21]).toBe(1);
  });
});

describe('computeTagMoodCorrelation', () => {
  it('filters out tags without mood data', () => {
    const entries = [
      { id: '1', mood: 'good' },
      { id: '2', mood: null },
    ];
    const entryTags = [
      { entryId: '1', tagName: 'tagged' },
      { entryId: '2', tagName: 'untagged-mood' },
    ];
    const result = computeTagMoodCorrelation(entries, entryTags);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe('tagged');
  });
});

describe('computeWritingInsights', () => {
  it('returns zero insights for empty entries', () => {
    const result = computeWritingInsights([], []);
    expect(result.totalEntries).toBe(0);
    expect(result.avgWordsPerEntry).toBe(0);
    expect(result.wordCountTrend).toBe('stable');
  });

  it('computes aggregate insights', () => {
    const entries = [
      { id: '1', wordCount: 100, entryDate: '2026-01-01', createdAt: '2026-01-01 09:00:00', mood: 'good', body: 'hello world' },
      { id: '2', wordCount: 200, entryDate: '2026-01-02', createdAt: '2026-01-02 10:00:00', mood: 'great', body: 'today was great and wonderful' },
    ];
    const result = computeWritingInsights(entries, []);
    expect(result.totalEntries).toBe(2);
    expect(result.totalWords).toBe(300);
    expect(result.avgWordsPerEntry).toBe(150);
    expect(result.longestEntryWordCount).toBe(200);
    expect(result.shortestEntryWordCount).toBe(100);
  });
});
