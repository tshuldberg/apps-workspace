import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { FRIENDS_MODULE } from '../definition';
import { createPerson } from '../db/crud/people';
import {
  detectDrift,
  shouldNudge,
  generateDriftMessage,
  getNudgeUrgency,
} from '../engine/nudges';
import {
  createNudge,
  getNudge,
  dismissNudge,
  snoozeNudge,
  actOnNudge,
  listActiveNudges,
  listNudgesForPerson,
  cleanupOldNudges,
} from '../db/crud/nudges';

// Fixed reference date for deterministic tests
const NOW = new Date('2026-04-20T12:00:00Z');

function daysAgo(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ── detectDrift ────────────────────────────────────────────────────

describe('detectDrift', () => {
  it('returns null with fewer than 3 hangouts', () => {
    expect(detectDrift('Alice', 'p1', [daysAgo(10), daysAgo(20)], NOW)).toBeNull();
  });

  it('returns null with exactly 0 hangouts', () => {
    expect(detectDrift('Alice', 'p1', [], NOW)).toBeNull();
  });

  it('returns DriftInfo when current gap > 2x average', () => {
    // Hangouts at 60, 70, 80 days ago -> avg gap ~10 days, current gap = 60 days
    const dates = [daysAgo(60), daysAgo(70), daysAgo(80)];
    const result = detectDrift('Alice', 'p1', dates, NOW);

    expect(result).not.toBeNull();
    expect(result!.personId).toBe('p1');
    expect(result!.historicalAvgDays).toBe(10);
    expect(result!.currentGapDays).toBe(60);
    expect(result!.driftRatio).toBe(6);
    expect(result!.message).toContain('Alice');
    expect(result!.message).toContain('60 days');
  });

  it('returns null when gap is within normal range', () => {
    // Hangouts at 5, 15, 25 days ago -> avg gap ~10 days, current gap = 5 days
    const dates = [daysAgo(5), daysAgo(15), daysAgo(25)];
    const result = detectDrift('Bob', 'p2', dates, NOW);
    expect(result).toBeNull();
  });

  it('returns null when gap is exactly 2x average (not drift)', () => {
    // Hangouts at 20, 30, 40 days ago -> avg gap = 10 days, current gap = 20 days -> ratio = 2
    const dates = [daysAgo(20), daysAgo(30), daysAgo(40)];
    const result = detectDrift('Charlie', 'p3', dates, NOW);
    expect(result).toBeNull(); // ratio must be > 2, not >= 2
  });

  it('excludes hangouts older than 6 months', () => {
    // 2 recent + 1 old = only 2 within 6 months, should return null
    const dates = [daysAgo(10), daysAgo(20), daysAgo(200)];
    const result = detectDrift('Dana', 'p4', dates, NOW);
    expect(result).toBeNull();
  });

  it('handles unsorted dates', () => {
    // Dates not in desc order -- should still work
    const dates = [daysAgo(70), daysAgo(60), daysAgo(80)];
    const result = detectDrift('Eve', 'p5', dates, NOW);
    expect(result).not.toBeNull();
    expect(result!.currentGapDays).toBe(60);
  });
});

// ── shouldNudge ────────────────────────────────────────────────────

describe('shouldNudge', () => {
  it('returns true when past personal goal', () => {
    expect(shouldNudge(35, 30, 60)).toBe(true);
  });

  it('returns true when exactly at goal', () => {
    expect(shouldNudge(30, 30, 60)).toBe(true);
  });

  it('returns false when within goal', () => {
    expect(shouldNudge(20, 30, 60)).toBe(false);
  });

  it('uses default threshold when no personal goal set', () => {
    expect(shouldNudge(35, null, 30)).toBe(true);
    expect(shouldNudge(25, null, 30)).toBe(false);
  });

  it('returns false when daysSince is null (never seen)', () => {
    expect(shouldNudge(null, 30, 60)).toBe(false);
  });
});

// ── generateDriftMessage ──────────────────────────────────────────

describe('generateDriftMessage', () => {
  it('generates message with days for short intervals', () => {
    const msg = generateDriftMessage('Alice', 5, 30);
    expect(msg).toBe("You used to see Alice every ~5 days. It's been 30 days.");
  });

  it('generates message with weeks for weekly intervals', () => {
    const msg = generateDriftMessage('Bob', 14, 45);
    expect(msg).toBe("You used to see Bob every ~2 weeks. It's been 45 days.");
  });

  it('generates message with month for monthly intervals', () => {
    const msg = generateDriftMessage('Charlie', 30, 90);
    expect(msg).toBe("You used to see Charlie every ~1 month. It's been 90 days.");
  });
});

// ── getNudgeUrgency ───────────────────────────────────────────────

describe('getNudgeUrgency', () => {
  it('returns high when > 2x goal', () => {
    expect(getNudgeUrgency(61, 30)).toBe('high');
    expect(getNudgeUrgency(100, 30)).toBe('high');
  });

  it('returns medium when exactly at goal', () => {
    expect(getNudgeUrgency(30, 30)).toBe('medium');
  });

  it('returns medium between 1x and 2x goal', () => {
    expect(getNudgeUrgency(45, 30)).toBe('medium');
    expect(getNudgeUrgency(60, 30)).toBe('medium');
  });

  it('returns low between 0.7x and 1x goal', () => {
    expect(getNudgeUrgency(25, 30)).toBe('low');
    expect(getNudgeUrgency(21, 30)).toBe('low');
  });

  it('returns low below 0.7x goal', () => {
    expect(getNudgeUrgency(10, 30)).toBe('low');
  });
});

// ── Nudge CRUD ─────────────────────────────────────────────────────

let db: DatabaseAdapter;
let closeDb: () => void;
let p1Id: string;
let p2Id: string;

beforeEach(() => {
  const testDb = createModuleTestDatabase('friends', FRIENDS_MODULE.migrations!);
  db = testDb.adapter;
  closeDb = testDb.close;

  const person1 = createPerson(db, { display_name: 'Alice', relationship_type: 'friend' });
  const person2 = createPerson(db, { display_name: 'Bob', relationship_type: 'friend' });
  p1Id = person1.id;
  p2Id = person2.id;
});

afterEach(() => {
  closeDb();
});

describe('Nudge CRUD round-trip', () => {
  it('creates, reads, dismisses, and acts on a nudge', () => {
    const nudge = createNudge(db, {
      person_id: p1Id,
      type: 'havent_seen',
      triggered_at: '2026-04-20T12:00:00Z',
    });

    expect(nudge.id).toBeTruthy();
    expect(nudge.person_id).toBe(p1Id);
    expect(nudge.type).toBe('havent_seen');
    expect(nudge.triggered_at).toBe('2026-04-20T12:00:00Z');
    expect(nudge.dismissed).toBe(false);
    expect(nudge.snoozed_until).toBeNull();
    expect(nudge.acted_on).toBe(false);
    expect(nudge.created_at).toBeTruthy();

    // Read
    const fetched = getNudge(db, nudge.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.type).toBe('havent_seen');
    expect(fetched!.dismissed).toBe(false);

    // Dismiss
    dismissNudge(db, nudge.id);
    const dismissed = getNudge(db, nudge.id)!;
    expect(dismissed.dismissed).toBe(true);
  });

  it('snoozes a nudge', () => {
    const nudge = createNudge(db, {
      person_id: p1Id,
      type: 'birthday_coming',
      triggered_at: '2026-04-20T12:00:00Z',
    });

    snoozeNudge(db, nudge.id, '2026-04-25T12:00:00Z');
    const snoozed = getNudge(db, nudge.id)!;
    expect(snoozed.snoozed_until).toBe('2026-04-25T12:00:00Z');
  });

  it('acts on a nudge', () => {
    const nudge = createNudge(db, {
      person_id: p1Id,
      type: 'anniversary',
      triggered_at: '2026-04-20T12:00:00Z',
    });

    actOnNudge(db, nudge.id);
    const acted = getNudge(db, nudge.id)!;
    expect(acted.acted_on).toBe(true);
  });
});

// ── listActiveNudges ──────────────────────────────────────────────

describe('listActiveNudges', () => {
  it('excludes dismissed nudges', () => {
    const n1 = createNudge(db, { person_id: p1Id, type: 'havent_seen', triggered_at: '2026-04-20T12:00:00Z' });
    createNudge(db, { person_id: p2Id, type: 'havent_seen', triggered_at: '2026-04-20T12:00:00Z' });

    dismissNudge(db, n1.id);

    const active = listActiveNudges(db, '2026-04-20T13:00:00Z');
    expect(active).toHaveLength(1);
    expect(active[0].person_id).toBe(p2Id);
  });

  it('excludes acted-on nudges', () => {
    const n1 = createNudge(db, { person_id: p1Id, type: 'havent_seen', triggered_at: '2026-04-20T12:00:00Z' });
    createNudge(db, { person_id: p2Id, type: 'havent_seen', triggered_at: '2026-04-20T12:00:00Z' });

    actOnNudge(db, n1.id);

    const active = listActiveNudges(db, '2026-04-20T13:00:00Z');
    expect(active).toHaveLength(1);
    expect(active[0].person_id).toBe(p2Id);
  });

  it('excludes nudges with unexpired snooze', () => {
    const n1 = createNudge(db, { person_id: p1Id, type: 'havent_seen', triggered_at: '2026-04-20T12:00:00Z' });
    createNudge(db, { person_id: p2Id, type: 'havent_seen', triggered_at: '2026-04-20T12:00:00Z' });

    // Snooze n1 until tomorrow
    snoozeNudge(db, n1.id, '2026-04-21T12:00:00Z');

    // Query as of "now" which is before snooze expires
    const active = listActiveNudges(db, '2026-04-20T13:00:00Z');
    expect(active).toHaveLength(1);
    expect(active[0].person_id).toBe(p2Id);
  });

  it('includes nudges with expired snooze', () => {
    const n1 = createNudge(db, { person_id: p1Id, type: 'havent_seen', triggered_at: '2026-04-20T12:00:00Z' });
    createNudge(db, { person_id: p2Id, type: 'havent_seen', triggered_at: '2026-04-20T12:00:00Z' });

    // Snooze n1 until yesterday
    snoozeNudge(db, n1.id, '2026-04-19T12:00:00Z');

    // Query as of today -- snooze is expired
    const active = listActiveNudges(db, '2026-04-20T13:00:00Z');
    expect(active).toHaveLength(2);
  });

  it('includes nudges with no snooze set', () => {
    createNudge(db, { person_id: p1Id, type: 'havent_seen', triggered_at: '2026-04-20T12:00:00Z' });

    const active = listActiveNudges(db, '2026-04-20T13:00:00Z');
    expect(active).toHaveLength(1);
    expect(active[0].snoozed_until).toBeNull();
  });
});

// ── listNudgesForPerson ───────────────────────────────────────────

describe('listNudgesForPerson', () => {
  it('returns all nudges for a person regardless of status', () => {
    const n1 = createNudge(db, { person_id: p1Id, type: 'havent_seen', triggered_at: '2026-04-18T12:00:00Z' });
    createNudge(db, { person_id: p1Id, type: 'birthday_coming', triggered_at: '2026-04-19T12:00:00Z' });
    createNudge(db, { person_id: p2Id, type: 'havent_seen', triggered_at: '2026-04-20T12:00:00Z' });

    dismissNudge(db, n1.id);

    const nudges = listNudgesForPerson(db, p1Id);
    expect(nudges).toHaveLength(2);
  });

  it('does not include nudges for other people', () => {
    createNudge(db, { person_id: p1Id, type: 'havent_seen', triggered_at: '2026-04-20T12:00:00Z' });
    createNudge(db, { person_id: p2Id, type: 'havent_seen', triggered_at: '2026-04-20T12:00:00Z' });

    const nudges = listNudgesForPerson(db, p1Id);
    expect(nudges).toHaveLength(1);
    expect(nudges[0].person_id).toBe(p1Id);
  });
});

// ── cleanupOldNudges ──────────────────────────────────────────────

describe('cleanupOldNudges', () => {
  it('removes old dismissed nudges', () => {
    // Create a nudge and dismiss it
    const n1 = createNudge(db, { person_id: p1Id, type: 'havent_seen', triggered_at: '2026-01-01T12:00:00Z' });
    dismissNudge(db, n1.id);

    // Backdate its created_at to 100 days ago
    db.execute(`UPDATE fn_nudges SET created_at = ? WHERE id = ?`, [
      '2026-01-10T12:00:00Z',
      n1.id,
    ]);

    // Create a recent active nudge
    createNudge(db, { person_id: p2Id, type: 'havent_seen', triggered_at: '2026-04-20T12:00:00Z' });

    cleanupOldNudges(db, 90);

    // Old dismissed nudge should be gone, recent active nudge remains
    expect(getNudge(db, n1.id)).toBeNull();
    const all = listNudgesForPerson(db, p2Id);
    expect(all).toHaveLength(1);
  });

  it('does not remove active (non-dismissed, non-acted-on) nudges even if old', () => {
    const n1 = createNudge(db, { person_id: p1Id, type: 'havent_seen', triggered_at: '2026-01-01T12:00:00Z' });

    // Backdate created_at
    db.execute(`UPDATE fn_nudges SET created_at = ? WHERE id = ?`, [
      '2026-01-10T12:00:00Z',
      n1.id,
    ]);

    cleanupOldNudges(db, 90);

    // Should still exist because it's neither dismissed nor acted on
    expect(getNudge(db, n1.id)).not.toBeNull();
  });

  it('removes old acted-on nudges', () => {
    const n1 = createNudge(db, { person_id: p1Id, type: 'havent_seen', triggered_at: '2026-01-01T12:00:00Z' });
    actOnNudge(db, n1.id);

    // Backdate
    db.execute(`UPDATE fn_nudges SET created_at = ? WHERE id = ?`, [
      '2026-01-10T12:00:00Z',
      n1.id,
    ]);

    cleanupOldNudges(db, 90);
    expect(getNudge(db, n1.id)).toBeNull();
  });
});
