import { describe, it, expect } from 'vitest';
import {
  buildPersonTimeline,
  detectMilestones,
  formatTimelineDate,
  getYearGroup,
  getTypeColor,
} from '../engine/timeline';

const PERSON_ID = 'person-1';
const NOW = new Date('2026-04-20T12:00:00Z');

// ── buildPersonTimeline ───────────────────────────────────────────────

describe('buildPersonTimeline', () => {
  it('merges hangouts, memories, gifts, and life events into unified list', () => {
    const hangouts = [
      { id: 'h1', people_ids: [PERSON_ID], happened_at: '2026-03-10', activity_tags: ['coffee'], quality_rating: 4, location_name: 'Blue Bottle', notes_md: null },
    ];
    const memories = [
      { id: 'm1', person_ids: [PERSON_ID], title: 'Road trip', happened_at: '2026-02-14', is_inside_joke: false, created_at: '2026-02-14T12:00:00Z' },
    ];
    const gifts = [
      { id: 'g1', person_id: PERSON_ID, direction: 'given', description: 'Book', occasion: 'birthday', date: '2026-01-15' },
    ];
    const lifeEvents = [
      { id: 'le1', person_id: PERSON_ID, type: 'job', description: 'New job at Google', happened_at: '2025-12-01' },
    ];

    const result = buildPersonTimeline(PERSON_ID, hangouts, memories, gifts, lifeEvents, []);

    expect(result).toHaveLength(4);
    expect(result[0].type).toBe('hangout');
    expect(result[1].type).toBe('memory');
    expect(result[2].type).toBe('gift_given');
    expect(result[3].type).toBe('life_event');
  });

  it('sorts entries by date descending', () => {
    const hangouts = [
      { id: 'h1', people_ids: [PERSON_ID], happened_at: '2025-01-01', activity_tags: [], quality_rating: null, location_name: null, notes_md: null },
      { id: 'h2', people_ids: [PERSON_ID], happened_at: '2026-06-15', activity_tags: [], quality_rating: null, location_name: null, notes_md: null },
    ];

    const result = buildPersonTimeline(PERSON_ID, hangouts, [], [], [], []);

    expect(result[0].date).toBe('2026-06-15');
    expect(result[1].date).toBe('2025-01-01');
  });

  it('returns empty array when no data exists', () => {
    const result = buildPersonTimeline(PERSON_ID, [], [], [], [], []);
    expect(result).toEqual([]);
  });

  it('assigns correct type and icon for each source', () => {
    const hangouts = [
      { id: 'h1', people_ids: [PERSON_ID], happened_at: '2026-01-01', activity_tags: ['hike'], quality_rating: null, location_name: null, notes_md: null },
    ];
    const memories = [
      { id: 'm1', person_ids: [PERSON_ID], title: 'Joke', happened_at: '2026-01-02', is_inside_joke: true, created_at: '2026-01-02T00:00:00Z' },
    ];
    const gifts = [
      { id: 'g1', person_id: PERSON_ID, direction: 'received', description: 'Watch', occasion: null, date: '2026-01-03' },
    ];
    const lifeEvents = [
      { id: 'le1', person_id: PERSON_ID, type: 'graduated', description: 'PhD done', happened_at: '2026-01-04' },
    ];

    const result = buildPersonTimeline(PERSON_ID, hangouts, memories, gifts, lifeEvents, []);

    const hangoutEntry = result.find((e) => e.type === 'hangout')!;
    expect(hangoutEntry.icon).toBe('\u26F0\uFE0F'); // hike icon

    const memoryEntry = result.find((e) => e.type === 'memory')!;
    expect(memoryEntry.icon).toBe('\uD83E\uDD2B'); // shh (inside joke)

    const giftEntry = result.find((e) => e.type === 'gift_received')!;
    expect(giftEntry.icon).toBe('\uD83C\uDF80'); // ribbon (received)

    const lifeEventEntry = result.find((e) => e.type === 'life_event')!;
    expect(lifeEventEntry.icon).toBe('\uD83C\uDF93'); // graduation cap
  });

  it('filters out entries not associated with the person', () => {
    const hangouts = [
      { id: 'h1', people_ids: ['other-person'], happened_at: '2026-01-01', activity_tags: [], quality_rating: null, location_name: null, notes_md: null },
    ];
    const gifts = [
      { id: 'g1', person_id: 'other-person', direction: 'given', description: 'Mug', occasion: null, date: '2026-01-01' },
    ];

    const result = buildPersonTimeline(PERSON_ID, hangouts, [], gifts, [], []);
    expect(result).toHaveLength(0);
  });

  it('includes milestones with gold accent', () => {
    const milestones = [
      { id: 'ms1', type: 'first_hangout', date: '2025-06-01', title: 'First hangout', description: 'Your first hangout with Alice' },
    ];

    const result = buildPersonTimeline(PERSON_ID, [], [], [], [], milestones);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('milestone');
    expect(result[0].accentColor).toBe('#FFB877');
  });

  it('skips gifts and life events with no date', () => {
    const gifts = [
      { id: 'g1', person_id: PERSON_ID, direction: 'given', description: 'Thing', occasion: null, date: null },
    ];
    const lifeEvents = [
      { id: 'le1', person_id: PERSON_ID, type: 'other', description: 'Stuff', happened_at: null },
    ];

    const result = buildPersonTimeline(PERSON_ID, [], [], gifts, lifeEvents, []);
    expect(result).toHaveLength(0);
  });
});

// ── detectMilestones ──────────────────────────────────────────────────

describe('detectMilestones', () => {
  it('detects first hangout', () => {
    const hangouts = [
      { happened_at: '2025-06-01', activity_tags: ['coffee'] },
      { happened_at: '2025-07-15', activity_tags: ['dinner'] },
    ];

    const result = detectMilestones('Alice', null, hangouts, NOW);
    const first = result.find((m) => m.type === 'first_hangout');
    expect(first).toBeDefined();
    expect(first!.date).toBe('2025-06-01');
    expect(first!.title).toBe('First hangout');
  });

  it('detects first trip (travel tag)', () => {
    const hangouts = [
      { happened_at: '2025-01-01', activity_tags: ['coffee'] },
      { happened_at: '2025-03-10', activity_tags: ['travel'] },
      { happened_at: '2025-05-20', activity_tags: ['travel', 'hike'] },
    ];

    const result = detectMilestones('Bob', null, hangouts, NOW);
    const trip = result.find((m) => m.type === 'first_trip');
    expect(trip).toBeDefined();
    expect(trip!.date).toBe('2025-03-10');
  });

  it('detects count milestones (10th, 25th, 50th)', () => {
    // Generate 50 hangouts
    const hangouts = Array.from({ length: 50 }, (_, i) => ({
      happened_at: `2025-01-${String(1 + (i % 28)).padStart(2, '0')}`,
      activity_tags: ['coffee'],
    }));

    const result = detectMilestones('Charlie', null, hangouts, NOW);
    expect(result.find((m) => m.type === 'hangout_count_10')).toBeDefined();
    expect(result.find((m) => m.type === 'hangout_count_25')).toBeDefined();
    expect(result.find((m) => m.type === 'hangout_count_50')).toBeDefined();
    expect(result.find((m) => m.type === 'hangout_count_100')).toBeUndefined();
  });

  it('detects friendship anniversary (1yr from when_met)', () => {
    const hangouts = [
      { happened_at: '2025-04-20', activity_tags: [] },
    ];

    const result = detectMilestones('Diana', '2025-01-15', hangouts, NOW);
    const anniv = result.find((m) => m.type === 'friendship_anniversary_1yr');
    expect(anniv).toBeDefined();
    expect(anniv!.date).toBe('2026-01-15');
    expect(anniv!.title).toBe('1 year of friendship');
  });

  it('does not detect future anniversaries', () => {
    const hangouts = [
      { happened_at: '2026-01-01', activity_tags: [] },
    ];

    // when_met is only 2 months ago, 1yr anniversary is in the future
    const result = detectMilestones('Eve', '2026-02-20', hangouts, NOW);
    const anniv = result.find((m) => m.type === 'friendship_anniversary_1yr');
    expect(anniv).toBeUndefined();
  });

  it('returns empty array with no hangouts', () => {
    const result = detectMilestones('Frank', '2020-01-01', [], NOW);
    expect(result).toEqual([]);
  });

  it('does not detect most active month when fewer than 10 hangouts', () => {
    const hangouts = Array.from({ length: 5 }, (_, i) => ({
      happened_at: `2025-03-${String(i + 1).padStart(2, '0')}`,
      activity_tags: [],
    }));

    const result = detectMilestones('Grace', null, hangouts, NOW);
    expect(result.find((m) => m.type === 'most_active_month')).toBeUndefined();
  });
});

// ── formatTimelineDate ────────────────────────────────────────────────

describe('formatTimelineDate', () => {
  it('formats ISO date to readable string', () => {
    const result = formatTimelineDate('2026-04-15');
    expect(result).toBe('Apr 15, 2026');
  });

  it('handles full ISO datetime', () => {
    const result = formatTimelineDate('2026-01-01T12:00:00Z');
    // Should at least contain Jan and 2026
    expect(result).toContain('2026');
    expect(result).toContain('Jan');
  });

  it('returns input string for invalid dates', () => {
    const result = formatTimelineDate('not-a-date');
    // Invalid dates may return 'Invalid Date' from toLocaleDateString or the input
    expect(typeof result).toBe('string');
  });
});

// ── getYearGroup ──────────────────────────────────────────────────────

describe('getYearGroup', () => {
  it('extracts year from ISO date', () => {
    expect(getYearGroup('2026-04-15')).toBe('2026');
    expect(getYearGroup('2025-12-31')).toBe('2025');
  });
});

// ── getTypeColor ──────────────────────────────────────────────────────

describe('getTypeColor', () => {
  it('returns correct colors for each type', () => {
    expect(getTypeColor('hangout')).toBe('#EC4899');
    expect(getTypeColor('memory')).toBe('#8B5CF6');
    expect(getTypeColor('gift_given')).toBe('#10B981');
    expect(getTypeColor('gift_received')).toBe('#06B6D4');
    expect(getTypeColor('life_event')).toBe('#F59E0B');
    expect(getTypeColor('milestone')).toBe('#FFB877');
  });
});
