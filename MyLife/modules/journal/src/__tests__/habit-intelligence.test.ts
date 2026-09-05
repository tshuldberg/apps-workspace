import { describe, it, expect } from 'vitest';
import {
  computeConsistencyScore,
  computeEntryRichness,
  computeEntryRichnessTrend,
  findBestWritingDay,
  findBestWritingTime,
  computePromptAdherence,
  computeHabitIntelligence,
} from '../engine/habit-intelligence';

describe('computeConsistencyScore', () => {
  it('returns 0 for no entries', () => {
    expect(computeConsistencyScore([], 7, '2026-01-07')).toBe(0);
  });

  it('returns 100 for daily entries over the window', () => {
    const dates = [
      '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04',
      '2026-01-05', '2026-01-06', '2026-01-07',
    ];
    expect(computeConsistencyScore(dates, 7, '2026-01-07')).toBe(100);
  });

  it('returns proportional score for partial coverage', () => {
    const dates = ['2026-01-05', '2026-01-06', '2026-01-07'];
    // 3 out of 7 days = 43%
    expect(computeConsistencyScore(dates, 7, '2026-01-07')).toBe(43);
  });

  it('ignores dates outside the window', () => {
    const dates = ['2025-12-01', '2026-01-07'];
    expect(computeConsistencyScore(dates, 7, '2026-01-07')).toBe(14);
  });

  it('returns 0 for invalid window', () => {
    expect(computeConsistencyScore(['2026-01-01'], 0, '2026-01-01')).toBe(0);
  });
});

describe('computeEntryRichness', () => {
  it('returns 20 for bare minimum entry', () => {
    const entry = {
      mood: null,
      tags: [],
      imageUris: [],
      audioPath: null,
      latitude: null,
      wordCount: 10,
    };
    expect(computeEntryRichness(entry)).toBe(20);
  });

  it('returns 100 for fully rich entry', () => {
    const entry = {
      mood: 'good',
      tags: ['tag1'],
      imageUris: ['photo.jpg'],
      audioPath: '/audio.m4a',
      latitude: 37.7749,
      wordCount: 150,
    };
    expect(computeEntryRichness(entry)).toBe(100);
  });

  it('scores mood + tags + long entry', () => {
    const entry = {
      mood: 'great',
      tags: ['work', 'reflection'],
      imageUris: [],
      audioPath: null,
      latitude: null,
      wordCount: 200,
    };
    // 20 (body) + 15 (mood) + 15 (tags) + 15 (words>100) = 65
    expect(computeEntryRichness(entry)).toBe(65);
  });
});

describe('computeEntryRichnessTrend', () => {
  it('returns stable for fewer than 4 entries', () => {
    expect(computeEntryRichnessTrend([
      { date: '2026-01-01', richness: 20 },
    ])).toBe('stable');
  });

  it('detects increasing trend', () => {
    const entries = [
      { date: '2026-01-01', richness: 20 },
      { date: '2026-01-02', richness: 25 },
      { date: '2026-01-03', richness: 60 },
      { date: '2026-01-04', richness: 80 },
    ];
    expect(computeEntryRichnessTrend(entries)).toBe('increasing');
  });

  it('detects decreasing trend', () => {
    const entries = [
      { date: '2026-01-01', richness: 80 },
      { date: '2026-01-02', richness: 70 },
      { date: '2026-01-03', richness: 30 },
      { date: '2026-01-04', richness: 20 },
    ];
    expect(computeEntryRichnessTrend(entries)).toBe('decreasing');
  });
});

describe('findBestWritingDay', () => {
  it('returns null for no entries', () => {
    expect(findBestWritingDay([])).toBeNull();
  });

  it('returns the day with most entries', () => {
    // 2026-01-05 is Monday, 2026-01-06 is Tuesday, 2026-01-12 is Monday
    const dates = ['2026-01-05', '2026-01-06', '2026-01-12'];
    expect(findBestWritingDay(dates)).toBe('Monday');
  });
});

describe('findBestWritingTime', () => {
  it('returns null for no entries', () => {
    expect(findBestWritingTime([])).toBeNull();
  });

  it('returns morning for morning entries', () => {
    const times = [
      '2026-01-01 08:00:00',
      '2026-01-02 09:30:00',
      '2026-01-03 11:00:00',
    ];
    expect(findBestWritingTime(times)).toBe('6am-12pm');
  });

  it('returns evening for evening entries', () => {
    const times = [
      '2026-01-01 18:00:00',
      '2026-01-02 19:30:00',
      '2026-01-03 20:00:00',
    ];
    expect(findBestWritingTime(times)).toBe('5pm-9pm');
  });
});

describe('computePromptAdherence', () => {
  it('returns empty for no prompts', () => {
    expect(computePromptAdherence([], [])).toEqual({});
  });

  it('computes adherence per category', () => {
    const prompts = [
      { category: 'gratitude', date: '2026-01-01' },
      { category: 'gratitude', date: '2026-01-02' },
      { category: 'stoic', date: '2026-01-01' },
    ];
    const entryDates = ['2026-01-01'];
    const result = computePromptAdherence(prompts, entryDates);
    expect(result.gratitude).toBe(0.5); // 1 of 2 days
    expect(result.stoic).toBe(1); // 1 of 1 day
  });
});

describe('computeHabitIntelligence', () => {
  it('returns zero intelligence for no entries', () => {
    const result = computeHabitIntelligence([], '2026-01-07');
    expect(result.consistencyScore7d).toBe(0);
    expect(result.consistencyScore30d).toBe(0);
    expect(result.entryRichnessAvg).toBe(0);
    expect(result.bestDayOfWeek).toBeNull();
    expect(result.bestTimeOfDay).toBeNull();
  });
});
