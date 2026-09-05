import { describe, it, expect } from 'vitest';
import { scoreOnThisDayEntry, rankOnThisDayEntries } from '../engine/nostalgia';

describe('scoreOnThisDayEntry', () => {
  it('scores a bare entry at 0', () => {
    const entry = {
      id: '1',
      mood: null,
      imageUris: [],
      wordCount: 50,
      tags: [],
      entryType: 'standard',
      audioPath: null,
      latitude: null,
    };
    expect(scoreOnThisDayEntry(entry, 1)).toBe(2); // only years_ago bonus
  });

  it('scores a rich entry highly', () => {
    const entry = {
      id: '1',
      mood: 'grateful',
      imageUris: ['a.jpg', 'b.jpg'],
      wordCount: 600,
      tags: ['reflection'],
      entryType: 'standard',
      audioPath: '/audio.m4a',
      latitude: 37.7,
    };
    // mood=10 + grateful_bonus=5 + images=10+3 + words>200=10 + words>500=5 + tags=5 + audio=8 + location=5 + years(3)=6
    expect(scoreOnThisDayEntry(entry, 3)).toBe(67);
  });

  it('adds therapy prep bonus', () => {
    const baseEntry = {
      id: '1',
      mood: null,
      imageUris: [],
      wordCount: 50,
      tags: [],
      entryType: 'therapy_prep',
      audioPath: null,
      latitude: null,
    };
    const score = scoreOnThisDayEntry(baseEntry, 1);
    expect(score).toBe(10); // therapy_prep=8 + years_ago=2
  });

  it('caps years ago bonus at 20', () => {
    const entry = {
      id: '1',
      mood: null,
      imageUris: [],
      wordCount: 50,
      tags: [],
      entryType: 'standard',
      audioPath: null,
      latitude: null,
    };
    expect(scoreOnThisDayEntry(entry, 15)).toBe(20); // capped at 20
  });
});

describe('rankOnThisDayEntries', () => {
  it('returns empty for no entries', () => {
    expect(rankOnThisDayEntries([])).toEqual([]);
  });

  it('ranks entries by score descending', () => {
    const entries = [
      {
        id: 'bare', mood: null, imageUris: [], wordCount: 20,
        tags: [], entryType: 'standard', audioPath: null, latitude: null, yearsAgo: 1,
      },
      {
        id: 'rich', mood: 'great', imageUris: ['a.jpg'], wordCount: 300,
        tags: ['tag'], entryType: 'standard', audioPath: null, latitude: null, yearsAgo: 1,
      },
    ];
    const ranked = rankOnThisDayEntries(entries);
    expect(ranked[0].id).toBe('rich');
    expect(ranked[1].id).toBe('bare');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});
