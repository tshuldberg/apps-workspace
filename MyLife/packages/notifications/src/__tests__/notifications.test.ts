import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHubTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { DatabaseAdapter } from '@mylife/db';
import type { NotificationPlatformOps, ScheduledNotification } from '../types';
import { createNotificationService } from '../service';
import {
  insertNotification,
  getNotificationById,
  getActiveNotificationsForModule,
  getAllActiveNotifications,
  updateNotification,
  cancelNotification,
  cancelAllForModule,
  deleteNotificationsForModule,
  getNotificationPreference,
  setNotificationPreference,
  getAllNotificationPreferences,
  deleteNotificationPreference,
} from '../queries';

let testDb: InMemoryTestDatabase;
let db: DatabaseAdapter;

function mockPlatform(): NotificationPlatformOps & { scheduled: string[]; cancelled: string[] } {
  let counter = 0;
  const scheduled: string[] = [];
  const cancelled: string[] = [];
  return {
    scheduled,
    cancelled,
    async requestPermission() { return true; },
    async checkPermission() { return 'granted' as const; },
    async schedule(_n: ScheduledNotification) {
      counter += 1;
      const id = `plat_${counter}`;
      scheduled.push(id);
      return id;
    },
    async cancel(platformId: string) {
      cancelled.push(platformId);
    },
    async cancelAll() {
      cancelled.push('__ALL__');
    },
  };
}

beforeEach(() => {
  testDb = createHubTestDatabase();
  db = testDb.adapter;
});

afterEach(() => {
  testDb.close();
});

// ---------------------------------------------------------------------------
// CRUD queries
// ---------------------------------------------------------------------------

describe('notification CRUD queries', () => {
  it('inserts and retrieves a notification', () => {
    const n = insertNotification(
      db, 'n1', 'meds', 'Take Medication', 'Time for your dose',
      '2026-04-10T08:00:00Z', 'America/New_York', 'none', null,
    );
    expect(n.id).toBe('n1');
    expect(n.moduleId).toBe('meds');
    expect(n.title).toBe('Take Medication');
    expect(n.status).toBe('active');
    expect(n.repeatInterval).toBe('none');
    expect(n.platformNotificationId).toBeNull();
  });

  it('getNotificationById returns null for missing', () => {
    expect(getNotificationById(db, 'missing')).toBeNull();
  });

  it('getActiveNotificationsForModule filters by module and status', () => {
    insertNotification(db, 'n1', 'meds', 'A', 'B', '2026-04-10T08:00:00Z', 'UTC', 'none', null);
    insertNotification(db, 'n2', 'meds', 'C', 'D', '2026-04-11T08:00:00Z', 'UTC', 'daily', null);
    insertNotification(db, 'n3', 'habits', 'E', 'F', '2026-04-10T09:00:00Z', 'UTC', 'none', null);
    cancelNotification(db, 'n1');

    const meds = getActiveNotificationsForModule(db, 'meds');
    expect(meds).toHaveLength(1);
    expect(meds[0].id).toBe('n2');

    const habits = getActiveNotificationsForModule(db, 'habits');
    expect(habits).toHaveLength(1);
  });

  it('getAllActiveNotifications returns all active', () => {
    insertNotification(db, 'n1', 'meds', 'A', 'B', '2026-04-10T08:00:00Z', 'UTC', 'none', null);
    insertNotification(db, 'n2', 'habits', 'C', 'D', '2026-04-11T08:00:00Z', 'UTC', 'none', null);
    cancelNotification(db, 'n1');

    const all = getAllActiveNotifications(db);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('n2');
  });

  it('updateNotification modifies fields', () => {
    insertNotification(db, 'n1', 'meds', 'Old', 'Body', '2026-04-10T08:00:00Z', 'UTC', 'none', null);
    const updated = updateNotification(db, 'n1', { title: 'New Title', repeatInterval: 'daily' });
    expect(updated!.title).toBe('New Title');
    expect(updated!.repeatInterval).toBe('daily');
  });

  it('cancelAllForModule cancels only that module', () => {
    insertNotification(db, 'n1', 'meds', 'A', 'B', '2026-04-10T08:00:00Z', 'UTC', 'none', null);
    insertNotification(db, 'n2', 'meds', 'C', 'D', '2026-04-11T08:00:00Z', 'UTC', 'none', null);
    insertNotification(db, 'n3', 'habits', 'E', 'F', '2026-04-10T09:00:00Z', 'UTC', 'none', null);

    cancelAllForModule(db, 'meds');

    expect(getActiveNotificationsForModule(db, 'meds')).toHaveLength(0);
    expect(getActiveNotificationsForModule(db, 'habits')).toHaveLength(1);
  });

  it('deleteNotificationsForModule removes rows entirely', () => {
    insertNotification(db, 'n1', 'meds', 'A', 'B', '2026-04-10T08:00:00Z', 'UTC', 'none', null);
    deleteNotificationsForModule(db, 'meds');
    expect(getNotificationById(db, 'n1')).toBeNull();
  });

  it('stores and retrieves JSON data', () => {
    const data = { deepLink: '/meds/123', extra: true };
    insertNotification(db, 'n1', 'meds', 'A', 'B', '2026-04-10T08:00:00Z', 'UTC', 'none', JSON.stringify(data));
    const n = getNotificationById(db, 'n1')!;
    expect(n.data).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// Preference CRUD
// ---------------------------------------------------------------------------

describe('notification preference queries', () => {
  it('returns null for missing preference', () => {
    expect(getNotificationPreference(db, 'meds')).toBeNull();
  });

  it('sets and gets a preference', () => {
    setNotificationPreference(db, 'meds', false);
    const pref = getNotificationPreference(db, 'meds')!;
    expect(pref.moduleId).toBe('meds');
    expect(pref.enabled).toBe(false);
  });

  it('upserts on conflict', () => {
    setNotificationPreference(db, 'meds', true);
    setNotificationPreference(db, 'meds', false);
    expect(getNotificationPreference(db, 'meds')!.enabled).toBe(false);
  });

  it('getAllNotificationPreferences returns all', () => {
    setNotificationPreference(db, 'meds', true);
    setNotificationPreference(db, 'habits', false);
    const all = getAllNotificationPreferences(db);
    expect(all).toHaveLength(2);
    expect(all.map((p) => p.moduleId).sort()).toEqual(['habits', 'meds']);
  });

  it('deleteNotificationPreference removes the row', () => {
    setNotificationPreference(db, 'meds', true);
    deleteNotificationPreference(db, 'meds');
    expect(getNotificationPreference(db, 'meds')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// NotificationService
// ---------------------------------------------------------------------------

describe('NotificationService', () => {
  it('schedule persists and calls platform', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    const n = await svc.schedule({
      moduleId: 'meds',
      title: 'Take Med',
      body: 'Time for dose',
      triggerAt: '2026-04-10T08:00:00Z',
      timezone: 'America/New_York',
    });

    expect(n.moduleId).toBe('meds');
    expect(n.status).toBe('active');
    expect(n.platformNotificationId).toBe('plat_1');
    expect(platform.scheduled).toHaveLength(1);

    // Also persisted
    const fromDb = svc.getById(n.id)!;
    expect(fromDb.platformNotificationId).toBe('plat_1');
  });

  it('schedule skips platform when module notifications disabled', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);
    svc.setPreference('meds', false);

    const n = await svc.schedule({
      moduleId: 'meds',
      title: 'Take Med',
      body: 'Time for dose',
      triggerAt: '2026-04-10T08:00:00Z',
      timezone: 'UTC',
    });

    expect(n.platformNotificationId).toBeNull();
    expect(platform.scheduled).toHaveLength(0);
  });

  it('update cancels old platform notification and reschedules', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    const n = await svc.schedule({
      moduleId: 'meds',
      title: 'Old Title',
      body: 'Body',
      triggerAt: '2026-04-10T08:00:00Z',
      timezone: 'UTC',
    });

    const updated = await svc.update(n.id, { title: 'New Title' });

    expect(updated.title).toBe('New Title');
    expect(platform.cancelled).toContain('plat_1');
    expect(platform.scheduled).toHaveLength(2); // original + rescheduled
    expect(updated.platformNotificationId).toBe('plat_2');
  });

  it('cancel marks as cancelled and cancels platform', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    const n = await svc.schedule({
      moduleId: 'meds',
      title: 'Test',
      body: 'Body',
      triggerAt: '2026-04-10T08:00:00Z',
      timezone: 'UTC',
    });

    await svc.cancel(n.id);

    const fromDb = svc.getById(n.id)!;
    expect(fromDb.status).toBe('cancelled');
    expect(platform.cancelled).toContain('plat_1');
  });

  it('cancelAllForModule cancels all active for that module', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    await svc.schedule({ moduleId: 'meds', title: 'A', body: 'B', triggerAt: '2026-04-10T08:00:00Z', timezone: 'UTC' });
    await svc.schedule({ moduleId: 'meds', title: 'C', body: 'D', triggerAt: '2026-04-11T08:00:00Z', timezone: 'UTC' });
    await svc.schedule({ moduleId: 'habits', title: 'E', body: 'F', triggerAt: '2026-04-10T09:00:00Z', timezone: 'UTC' });

    await svc.cancelAllForModule('meds');

    expect(svc.getForModule('meds')).toHaveLength(0);
    expect(svc.getForModule('habits')).toHaveLength(1);
  });

  it('getForModule returns only active', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    const n1 = await svc.schedule({ moduleId: 'meds', title: 'A', body: 'B', triggerAt: '2026-04-10T08:00:00Z', timezone: 'UTC' });
    await svc.schedule({ moduleId: 'meds', title: 'C', body: 'D', triggerAt: '2026-04-11T08:00:00Z', timezone: 'UTC' });
    await svc.cancel(n1.id);

    expect(svc.getForModule('meds')).toHaveLength(1);
  });

  it('preference CRUD through service', () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    expect(svc.getPreference('meds')).toBeNull();

    svc.setPreference('meds', false);
    expect(svc.getPreference('meds')!.enabled).toBe(false);

    svc.setPreference('meds', true);
    expect(svc.getPreference('meds')!.enabled).toBe(true);

    expect(svc.getAllPreferences()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// rescheduleAll (R10.5)
// ---------------------------------------------------------------------------

describe('rescheduleAll', () => {
  it('reschedules all active notifications from persisted state', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    // Insert directly to simulate persisted state from prior session
    insertNotification(db, 'n1', 'meds', 'A', 'B', '2099-01-01T08:00:00Z', 'UTC', 'none', null);
    insertNotification(db, 'n2', 'habits', 'C', 'D', '2099-01-01T09:00:00Z', 'UTC', 'daily', null);
    insertNotification(db, 'n3', 'meds', 'E', 'F', '2099-01-01T10:00:00Z', 'UTC', 'none', null);
    cancelNotification(db, 'n3');

    const count = await svc.rescheduleAll();

    expect(count).toBe(2);
    expect(platform.cancelled).toContain('__ALL__');
    expect(platform.scheduled).toHaveLength(2);

    // Platform IDs should be updated
    expect(getNotificationById(db, 'n1')!.platformNotificationId).toBe('plat_1');
    expect(getNotificationById(db, 'n2')!.platformNotificationId).toBe('plat_2');
  });

  it('skips disabled modules', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    insertNotification(db, 'n1', 'meds', 'A', 'B', '2099-01-01T08:00:00Z', 'UTC', 'none', null);
    svc.setPreference('meds', false);

    const count = await svc.rescheduleAll();
    expect(count).toBe(0);
    expect(platform.scheduled).toHaveLength(0);
  });

  it('marks past non-repeating notifications as fired', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    insertNotification(db, 'n1', 'meds', 'A', 'B', '2020-01-01T08:00:00Z', 'UTC', 'none', null);

    const count = await svc.rescheduleAll();
    expect(count).toBe(0);
    expect(getNotificationById(db, 'n1')!.status).toBe('fired');
  });

  it('reschedules past repeating notifications', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    insertNotification(db, 'n1', 'meds', 'A', 'B', '2020-01-01T08:00:00Z', 'UTC', 'daily', null);

    const count = await svc.rescheduleAll();
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Timezone field persistence (R10.2)
// ---------------------------------------------------------------------------

describe('timezone handling', () => {
  it('persists and returns the IANA timezone', () => {
    insertNotification(
      db, 'n1', 'meds', 'A', 'B',
      '2026-04-10T12:00:00Z', 'America/Los_Angeles', 'none', null,
    );
    const n = getNotificationById(db, 'n1')!;
    expect(n.timezone).toBe('America/Los_Angeles');
    expect(n.triggerAt).toBe('2026-04-10T12:00:00Z');
  });

  it('update preserves timezone when not changed', () => {
    insertNotification(db, 'n1', 'meds', 'A', 'B', '2026-04-10T12:00:00Z', 'Europe/Berlin', 'none', null);
    updateNotification(db, 'n1', { title: 'Updated' });
    expect(getNotificationById(db, 'n1')!.timezone).toBe('Europe/Berlin');
  });
});
