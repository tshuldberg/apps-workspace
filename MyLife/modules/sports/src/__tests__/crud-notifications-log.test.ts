import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  listRecentNotifications,
  pruneNotificationsOlderThan,
  recordNotification,
  type NotificationLogEntry,
} from '../db/crud';

const NOW = Date.parse('2026-04-21T15:00:00.000Z');

function entry(
  overrides: Partial<NotificationLogEntry> = {},
): NotificationLogEntry {
  return {
    id: 'espn:nfl:6:espn:nfl:g1:final',
    team_id: 'espn:nfl:6',
    game_id: 'espn:nfl:g1',
    event_type: 'final',
    fired_at: NOW,
    title: 'Cowboys -- Win',
    body: 'Cowboys 24 Eagles 17 (Final)',
    payload_json: null,
    ...overrides,
  };
}

describe('sports notifications-log CRUD', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('recordNotification inserts a new row and returns inserted=true', () => {
    const res = recordNotification(db.adapter, entry());
    expect(res.inserted).toBe(true);

    const rows = listRecentNotifications(db.adapter);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Cowboys -- Win');
    expect(rows[0].event_type).toBe('final');
  });

  it('recordNotification returns inserted=false on the same (team, game, event_type)', () => {
    recordNotification(db.adapter, entry());
    const second = recordNotification(db.adapter, entry({ id: 'different-pk' }));
    expect(second.inserted).toBe(false);

    const rows = listRecentNotifications(db.adapter);
    expect(rows).toHaveLength(1);
  });

  it('different event_type for the same team + game does NOT dedupe', () => {
    recordNotification(db.adapter, entry({ event_type: 'start', id: 'a' }));
    recordNotification(db.adapter, entry({ event_type: 'final', id: 'b' }));
    recordNotification(db.adapter, entry({ event_type: 'close', id: 'c' }));

    const rows = listRecentNotifications(db.adapter);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.event_type))).toEqual(
      new Set(['start', 'final', 'close']),
    );
  });

  it('listRecentNotifications filters by teamId and honors limit', () => {
    recordNotification(db.adapter, entry({ team_id: 't1', id: '1', event_type: 'start' }));
    recordNotification(db.adapter, entry({ team_id: 't1', id: '2', event_type: 'final' }));
    recordNotification(db.adapter, entry({ team_id: 't2', id: '3', event_type: 'final' }));

    const t1 = listRecentNotifications(db.adapter, { teamId: 't1' });
    expect(t1).toHaveLength(2);
    expect(t1.every((r) => r.team_id === 't1')).toBe(true);

    const limited = listRecentNotifications(db.adapter, { limit: 1 });
    expect(limited).toHaveLength(1);
  });

  it('listRecentNotifications orders by fired_at DESC', () => {
    recordNotification(
      db.adapter,
      entry({ id: 'old', event_type: 'start', fired_at: NOW - 3_600_000 }),
    );
    recordNotification(
      db.adapter,
      entry({ id: 'new', event_type: 'final', fired_at: NOW }),
    );
    const rows = listRecentNotifications(db.adapter);
    expect(rows[0].id).toBe('new');
    expect(rows[1].id).toBe('old');
  });

  it('pruneOlderThan removes entries before cutoff and returns count', () => {
    recordNotification(
      db.adapter,
      entry({ id: 'a', event_type: 'start', fired_at: NOW - 48 * 3_600_000 }),
    );
    recordNotification(
      db.adapter,
      entry({ id: 'b', event_type: 'final', fired_at: NOW - 12 * 3_600_000 }),
    );
    recordNotification(
      db.adapter,
      entry({ id: 'c', event_type: 'close', fired_at: NOW }),
    );
    const removed = pruneNotificationsOlderThan(db.adapter, NOW - 24 * 3_600_000);
    expect(removed).toBe(1);

    const rows = listRecentNotifications(db.adapter);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id).sort()).toEqual(['b', 'c']);
  });

  it('supports null game_id rows (e.g. trade alerts) with dedupe intact', () => {
    const trade = entry({
      id: 't1',
      event_type: 'trade',
      game_id: null,
      title: 'Cowboys made a trade',
      body: null,
    });
    const first = recordNotification(db.adapter, trade);
    expect(first.inserted).toBe(true);
    const dup = recordNotification(db.adapter, { ...trade, id: 't2' });
    expect(dup.inserted).toBe(false);

    const rows = listRecentNotifications(db.adapter);
    expect(rows).toHaveLength(1);
    expect(rows[0].game_id).toBeNull();
    expect(rows[0].event_type).toBe('trade');
  });
});
