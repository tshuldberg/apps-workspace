import { describe, expect, it } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '../../definition';
import { createEvent, getEventById, softDeleteEvent } from '../crud/events';
import { createPin, softDeletePin } from '../crud/pins';
import { createPlan, softDeletePlan } from '../crud/plans';
import { purgeSoftDeleted } from '../crud/maintenance';

function openDb() {
  return createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
}

describe('purgeSoftDeleted', () => {
  it('hard-deletes rows soft-deleted before the retention window and keeps recent ones', () => {
    const { adapter, close } = openDb();

    const oldEvent = createEvent(adapter, { title: 'Old event', saved: true });
    const freshEvent = createEvent(adapter, { title: 'Fresh event', saved: true });
    softDeleteEvent(adapter, oldEvent);
    softDeleteEvent(adapter, freshEvent);
    adapter.execute(
      `UPDATE mh_events SET deleted_at = datetime('now', '-90 days') WHERE id = ?`,
      [oldEvent],
    );

    const oldPin = createPin(adapter, { name: 'Old pin' });
    softDeletePin(adapter, oldPin);
    adapter.execute(
      `UPDATE mh_pins SET deleted_at = datetime('now', '-90 days') WHERE id = ?`,
      [oldPin],
    );

    const oldPlan = createPlan(adapter, { title: 'Old plan', startAt: '2026-01-01T19:00' });
    softDeletePlan(adapter, oldPlan);
    adapter.execute(
      `UPDATE mh_plans SET deleted_at = datetime('now', '-90 days') WHERE id = ?`,
      [oldPlan],
    );

    const result = purgeSoftDeleted(adapter, 30);
    expect(result).toEqual({ events: 1, pins: 1, plans: 1 });

    const remainingDeleted = adapter.query<{ id: string }>(
      `SELECT id FROM mh_events WHERE deleted_at IS NOT NULL`,
    );
    expect(remainingDeleted.map((r) => r.id)).toEqual([freshEvent]);
    expect(getEventById(adapter, oldEvent)).toBeNull();
    close();
  });

  it('never touches live rows', () => {
    const { adapter, close } = openDb();
    const live = createEvent(adapter, { title: 'Live', saved: true });
    expect(purgeSoftDeleted(adapter, 30)).toEqual({ events: 0, pins: 0, plans: 0 });
    expect(getEventById(adapter, live)).not.toBeNull();
    close();
  });

  it('cascades facet cleanup through foreign keys', () => {
    const { adapter, close } = openDb();
    adapter.execute('PRAGMA foreign_keys=ON');
    const ev = createEvent(adapter, { title: 'Purge me', saved: true });
    adapter.execute(
      `INSERT INTO mh_event_facets (id, event_id, axis, value) VALUES ('f1', ?, 'category', 'Music')`,
      [ev],
    );
    softDeleteEvent(adapter, ev);
    adapter.execute(
      `UPDATE mh_events SET deleted_at = datetime('now', '-90 days') WHERE id = ?`,
      [ev],
    );
    purgeSoftDeleted(adapter, 30);
    const facets = adapter.query(`SELECT id FROM mh_event_facets WHERE event_id = ?`, [ev]);
    expect(facets).toHaveLength(0);
    close();
  });
});
