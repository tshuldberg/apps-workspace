import { describe, expect, it } from 'vitest';
import {
  calculateJournalStreak,
  countWords,
  estimateReadingTimeMinutes,
  summarizeMoodDistribution,
} from '../engine/stats';
import type { JournalEntry } from '../types';

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'test-id',
    journalId: 'journal-default',
    entryDate: '2026-03-08',
    title: null,
    body: 'Test body text',
    tags: [],
    mood: null,
    imageUris: [],
    wordCount: 3,
    audioPath: null,
    audioDurationMs: null,
    transcriptionSource: null,
    latitude: null,
    longitude: null,
    placeName: null,
    timezone: null,
    weatherTempC: null,
    weatherDescription: null,
    weatherIcon: null,
    entryType: 'standard',
    therapySessionNumber: null,
    therapyTemplateType: null,
    createdAt: '2026-03-08T12:00:00.000Z',
    updatedAt: '2026-03-08T12:00:00.000Z',
    ...overrides,
  };
}

describe('countWords', () => {
  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(countWords('   \n\t  ')).toBe(0);
  });

  it('counts single word', () => {
    expect(countWords('hello')).toBe(1);
  });

  it('counts multiple words separated by spaces', () => {
    expect(countWords('one two three four five')).toBe(5);
  });

  it('handles multiple whitespace characters between words', () => {
    expect(countWords('word1    word2   word3')).toBe(3);
  });

  it('handles newlines and tabs as separators', () => {
    expect(countWords('first\nsecond\tthird')).toBe(3);
  });

  it('trims leading and trailing whitespace before counting', () => {
    expect(countWords('   hello world   ')).toBe(2);
  });

  it('counts words in a markdown-heavy entry', () => {
    // countWords splits on whitespace; markdown syntax tokens count as words
    expect(countWords('## Heading\n\n**Bold text** and *italic text*')).toBe(7);
  });
});

describe('estimateReadingTimeMinutes', () => {
  it('returns minimum of 1 minute for zero words', () => {
    expect(estimateReadingTimeMinutes(0)).toBe(1);
  });

  it('returns 1 minute for short entries (under 200 words)', () => {
    expect(estimateReadingTimeMinutes(50)).toBe(1);
    expect(estimateReadingTimeMinutes(199)).toBe(1);
  });

  it('returns 1 minute for exactly 200 words', () => {
    expect(estimateReadingTimeMinutes(200)).toBe(1);
  });

  it('returns 2 minutes for 201-400 words', () => {
    expect(estimateReadingTimeMinutes(201)).toBe(2);
    expect(estimateReadingTimeMinutes(400)).toBe(2);
  });

  it('returns 3 minutes for 401-600 words', () => {
    expect(estimateReadingTimeMinutes(401)).toBe(3);
    expect(estimateReadingTimeMinutes(600)).toBe(3);
  });

  it('scales correctly for long entries', () => {
    expect(estimateReadingTimeMinutes(1000)).toBe(5);
    expect(estimateReadingTimeMinutes(2000)).toBe(10);
  });
});

describe('calculateJournalStreak', () => {
  it('returns zeros for empty dates array', () => {
    expect(calculateJournalStreak([], '2026-03-08')).toEqual({
      currentStreak: 0,
      longestStreak: 0,
    });
  });

  it('returns streak of 1 when only the reference date has an entry', () => {
    expect(calculateJournalStreak(['2026-03-08'], '2026-03-08')).toEqual({
      currentStreak: 1,
      longestStreak: 1,
    });
  });

  it('counts consecutive days as a streak', () => {
    const dates = ['2026-03-08', '2026-03-07', '2026-03-06', '2026-03-05'];
    expect(calculateJournalStreak(dates, '2026-03-08')).toEqual({
      currentStreak: 4,
      longestStreak: 4,
    });
  });

  it('supports 1-day grace period (yesterday counts as active streak)', () => {
    const dates = ['2026-03-07', '2026-03-06', '2026-03-05'];
    expect(calculateJournalStreak(dates, '2026-03-08')).toEqual({
      currentStreak: 3,
      longestStreak: 3,
    });
  });

  it('breaks current streak when most recent entry is older than yesterday', () => {
    const dates = ['2026-03-05', '2026-03-04', '2026-03-03'];
    expect(calculateJournalStreak(dates, '2026-03-08')).toEqual({
      currentStreak: 0,
      longestStreak: 3,
    });
  });

  it('tracks longest streak separately from current streak', () => {
    // Gap between 2026-03-04 and 2026-03-02 breaks the earlier streak
    const dates = ['2026-03-08', '2026-03-07', '2026-03-04', '2026-03-03', '2026-03-02', '2026-03-01'];
    expect(calculateJournalStreak(dates, '2026-03-08')).toEqual({
      currentStreak: 2,
      longestStreak: 4,
    });
  });

  it('handles single entry not on reference date or yesterday', () => {
    expect(calculateJournalStreak(['2026-03-01'], '2026-03-08')).toEqual({
      currentStreak: 0,
      longestStreak: 1,
    });
  });

  it('handles dates in unsorted order (longestStreak computed correctly)', () => {
    // The function sorts internally for longestStreak but expects DESC order
    // for currentStreak (uses distinctDatesDesc[0] as most recent)
    const dates = ['2026-03-06', '2026-03-08', '2026-03-07'];
    expect(calculateJournalStreak(dates, '2026-03-08')).toEqual({
      currentStreak: 0,  // [0] is '2026-03-06', not in reference set
      longestStreak: 3,
    });
  });

  it('handles month boundaries correctly', () => {
    const dates = ['2026-03-02', '2026-03-01', '2026-02-28'];
    expect(calculateJournalStreak(dates, '2026-03-02')).toEqual({
      currentStreak: 3,
      longestStreak: 3,
    });
  });

  it('handles year boundaries correctly', () => {
    const dates = ['2026-01-02', '2026-01-01', '2025-12-31', '2025-12-30'];
    expect(calculateJournalStreak(dates, '2026-01-02')).toEqual({
      currentStreak: 4,
      longestStreak: 4,
    });
  });
});

describe('summarizeMoodDistribution', () => {
  it('returns empty object for empty entries array', () => {
    expect(summarizeMoodDistribution([])).toEqual({});
  });

  it('returns empty object when all entries have null mood', () => {
    const entries = [
      makeEntry({ mood: null }),
      makeEntry({ mood: null }),
    ];
    expect(summarizeMoodDistribution(entries)).toEqual({});
  });

  it('counts a single mood correctly', () => {
    const entries = [makeEntry({ mood: 'good' })];
    expect(summarizeMoodDistribution(entries)).toEqual({ good: 1 });
  });

  it('counts multiple occurrences of the same mood', () => {
    const entries = [
      makeEntry({ mood: 'good' }),
      makeEntry({ mood: 'good' }),
      makeEntry({ mood: 'good' }),
    ];
    expect(summarizeMoodDistribution(entries)).toEqual({ good: 3 });
  });

  it('counts all mood types separately', () => {
    const entries = [
      makeEntry({ mood: 'low' }),
      makeEntry({ mood: 'okay' }),
      makeEntry({ mood: 'good' }),
      makeEntry({ mood: 'great' }),
      makeEntry({ mood: 'grateful' }),
    ];
    expect(summarizeMoodDistribution(entries)).toEqual({
      low: 1,
      okay: 1,
      good: 1,
      great: 1,
      grateful: 1,
    });
  });

  it('skips null moods while counting non-null ones', () => {
    const entries = [
      makeEntry({ mood: 'good' }),
      makeEntry({ mood: null }),
      makeEntry({ mood: 'great' }),
      makeEntry({ mood: null }),
    ];
    expect(summarizeMoodDistribution(entries)).toEqual({ good: 1, great: 1 });
  });
});
