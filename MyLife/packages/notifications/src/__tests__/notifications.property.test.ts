/**
 * Property tests for notification infrastructure (Properties 15-16).
 *
 * Property 15: Notification timezone scheduling (R10.2)
 * Property 16: Notification persistence round-trip (R10.5)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { createHubTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { DatabaseAdapter } from '@mylife/db';
import type { NotificationPlatformOps, ScheduledNotification } from '../types';
import { createNotificationService } from '../service';
import {
  insertNotification,
  getNotificationById,
  updateNotification,
} from '../queries';

const NUM_RUNS = 10;

let testDb: InMemoryTestDatabase;
let db: DatabaseAdapter;
let idSeq = 0;
function nextId(prefix: string): string { return `${prefix}_${++idSeq}`; }

function mockPlatform(): NotificationPlatformOps & { scheduled: ScheduledNotification[] } {
  let counter = 0;
  const scheduled: ScheduledNotification[] = [];
  return {
    scheduled,
    async requestPermission() { return true; },
    async checkPermission() { return 'granted' as const; },
    async schedule(n: ScheduledNotification) {
      counter += 1;
      scheduled.push(n);
      return `plat_${counter}`;
    },
    async cancel() {},
    async cancelAll() {},
  };
}

// Arbitraries
const ianaTimezones = fc.constantFrom(
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
  'America/Sao_Paulo',
  'Africa/Cairo',
);

const futureIsoDate = fc.integer({ min: 2027, max: 2030 }).chain((year) =>
  fc.tuple(
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
  ).map(([month, day, hour, minute]) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`,
  ),
);

const moduleIds = fc.constantFrom(
  'meds', 'habits', 'cycle', 'fast', 'budget', 'books', 'health', 'workouts',
);

const repeatIntervals = fc.constantFrom('none' as const, 'daily' as const, 'weekly' as const, 'monthly' as const);

const notificationTitle = fc.string({ minLength: 1, maxLength: 100 });
const notificationBody = fc.string({ minLength: 1, maxLength: 200 });

beforeEach(() => {
  testDb = createHubTestDatabase();
  db = testDb.adapter;
});

afterEach(() => {
  testDb.close();
});

// ---------------------------------------------------------------------------
// Property 15: Notification timezone scheduling (R10.2)
// ---------------------------------------------------------------------------

describe('Property 15: Notification timezone scheduling', () => {
  it('scheduled notification preserves the IANA timezone for any valid timezone', () => {
    fc.assert(
      fc.property(
        ianaTimezones,
        futureIsoDate,
        moduleIds,
        notificationTitle,
        notificationBody,
        (tz, triggerAt, moduleId, title, body) => {
          const n = insertNotification(db, nextId('tz'), moduleId, title, body, triggerAt, tz, 'none', null);
          expect(n.timezone).toBe(tz);
          expect(n.triggerAt).toBe(triggerAt);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('service.schedule stores timezone and trigger correctly for any timezone', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    await fc.assert(
      fc.asyncProperty(
        ianaTimezones,
        futureIsoDate,
        moduleIds,
        notificationTitle,
        notificationBody,
        async (tz, triggerAt, moduleId, title, body) => {
          const n = await svc.schedule({ moduleId, title, body, triggerAt, timezone: tz });
          expect(n.timezone).toBe(tz);
          expect(n.triggerAt).toBe(triggerAt);
          // Platform received the same timezone
          const platNotif = platform.scheduled[platform.scheduled.length - 1];
          expect(platNotif.timezone).toBe(tz);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('update preserves timezone when not changed, updates when provided', () => {
    fc.assert(
      fc.property(
        ianaTimezones,
        ianaTimezones,
        futureIsoDate,
        (tz1, tz2, triggerAt) => {
          const id = nextId('up');
          insertNotification(db, id, 'meds', 'T', 'B', triggerAt, tz1, 'none', null);

          // Update without timezone change
          updateNotification(db, id, { title: 'Updated' });
          expect(getNotificationById(db, id)!.timezone).toBe(tz1);

          // Update with timezone change
          updateNotification(db, id, { timezone: tz2 });
          expect(getNotificationById(db, id)!.timezone).toBe(tz2);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('timezone field is never null or empty for any scheduled notification', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    await fc.assert(
      fc.asyncProperty(
        ianaTimezones,
        futureIsoDate,
        moduleIds,
        async (tz, triggerAt, moduleId) => {
          const n = await svc.schedule({
            moduleId,
            title: 'TZ test',
            body: 'Body',
            triggerAt,
            timezone: tz,
          });
          const fromDb = svc.getById(n.id)!;
          expect(fromDb.timezone).toBeTruthy();
          expect(fromDb.timezone.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('different timezones produce distinct records even for same trigger time', () => {
    fc.assert(
      fc.property(
        ianaTimezones,
        ianaTimezones,
        futureIsoDate,
        (tz1, tz2, triggerAt) => {
          const id1 = nextId('dst_a');
          const id2 = nextId('dst_b');
          insertNotification(db, id1, 'meds', 'A', 'B', triggerAt, tz1, 'none', null);
          insertNotification(db, id2, 'meds', 'A', 'B', triggerAt, tz2, 'none', null);

          const n1 = getNotificationById(db, id1)!;
          const n2 = getNotificationById(db, id2)!;
          expect(n1.id).not.toBe(n2.id);
          expect(n1.timezone).toBe(tz1);
          expect(n2.timezone).toBe(tz2);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 16: Notification persistence round-trip (R10.5)
// ---------------------------------------------------------------------------

describe('Property 16: Notification persistence round-trip', () => {
  it('rescheduleAll restores all active notifications with matching fields', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(moduleIds, notificationTitle, notificationBody, futureIsoDate, ianaTimezones, repeatIntervals),
          { minLength: 1, maxLength: 5 },
        ),
        async (notifications) => {
          // Insert directly (simulating persisted state from prior session)
          const ids: string[] = [];
          for (let i = 0; i < notifications.length; i++) {
            const [moduleId, title, body, triggerAt, tz, repeat] = notifications[i];
            const id = nextId(`rt_${i}`);
            insertNotification(db, id, moduleId, title, body, triggerAt, tz, repeat, null);
            ids.push(id);
          }

          // Clear platform state
          platform.scheduled.length = 0;

          const count = await svc.rescheduleAll();
          expect(count).toBe(notifications.length);

          // Every notification was passed to the platform
          expect(platform.scheduled.length).toBe(notifications.length);

          // Each persisted notification has a platform ID now
          for (const id of ids) {
            const fromDb = getNotificationById(db, id)!;
            expect(fromDb.status).toBe('active');
            expect(fromDb.platformNotificationId).toBeTruthy();
          }

          // Fields match between DB and what the platform received
          for (let i = 0; i < ids.length; i++) {
            const fromDb = getNotificationById(db, ids[i])!;
            const platNotif = platform.scheduled.find((n) => n.id === ids[i])!;
            expect(platNotif).toBeDefined();
            expect(platNotif.title).toBe(fromDb.title);
            expect(platNotif.body).toBe(fromDb.body);
            expect(platNotif.triggerAt).toBe(fromDb.triggerAt);
            expect(platNotif.timezone).toBe(fromDb.timezone);
            expect(platNotif.repeatInterval).toBe(fromDb.repeatInterval);
          }

          // Cleanup for next run
          for (const id of ids) {
            db.execute('DELETE FROM hub_scheduled_notifications WHERE id = ?', [id]);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('rescheduleAll skips cancelled notifications', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(moduleIds, futureIsoDate, ianaTimezones),
          { minLength: 2, maxLength: 5 },
        ),
        fc.integer({ min: 1 }),
        async (notifications, cancelSeed) => {
          const ids: string[] = [];
          for (let i = 0; i < notifications.length; i++) {
            const [moduleId, triggerAt, tz] = notifications[i];
            const id = nextId(`skip_${i}`);
            insertNotification(db, id, moduleId, 'T', 'B', triggerAt, tz, 'none', null);
            ids.push(id);
          }

          // Cancel a subset
          const cancelIdx = cancelSeed % ids.length;
          db.execute(
            "UPDATE hub_scheduled_notifications SET status = 'cancelled' WHERE id = ?",
            [ids[cancelIdx]],
          );

          platform.scheduled.length = 0;
          const count = await svc.rescheduleAll();

          expect(count).toBe(notifications.length - 1);
          expect(platform.scheduled.find((n) => n.id === ids[cancelIdx])).toBeUndefined();

          // Cleanup
          for (const id of ids) {
            db.execute('DELETE FROM hub_scheduled_notifications WHERE id = ?', [id]);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('rescheduleAll skips modules with disabled preferences', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    await fc.assert(
      fc.asyncProperty(
        moduleIds,
        moduleIds,
        futureIsoDate,
        futureIsoDate,
        ianaTimezones,
        async (mod1, mod2, date1, date2, tz) => {
          const id1 = nextId('pref_a');
          const id2 = nextId('pref_b');
          insertNotification(db, id1, mod1, 'A', 'B', date1, tz, 'none', null);
          insertNotification(db, id2, mod2, 'C', 'D', date2, tz, 'none', null);

          svc.setPreference(mod1, false);

          platform.scheduled.length = 0;
          const count = await svc.rescheduleAll();

          // mod1 was skipped
          const mod1Scheduled = platform.scheduled.filter((n) => n.moduleId === mod1);
          expect(mod1Scheduled).toHaveLength(0);

          // mod2 was scheduled (unless mod2 === mod1, then both skipped)
          if (mod1 !== mod2) {
            expect(count).toBeGreaterThanOrEqual(1);
          }

          // Cleanup
          db.execute('DELETE FROM hub_scheduled_notifications WHERE id IN (?, ?)', [id1, id2]);
          db.execute('DELETE FROM hub_notification_preferences WHERE module_id = ?', [mod1]);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('data_json round-trips through persistence for any JSON-serializable object', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
        ), { minKeys: 0, maxKeys: 5 }),
        futureIsoDate,
        ianaTimezones,
        moduleIds,
        async (data, triggerAt, tz, moduleId) => {
          const n = await svc.schedule({
            moduleId,
            title: 'Data test',
            body: 'Body',
            triggerAt,
            timezone: tz,
            data: data as Record<string, unknown>,
          });

          const fromDb = svc.getById(n.id)!;
          expect(fromDb.data).toEqual(data);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('notification IDs remain stable across rescheduleAll', async () => {
    const platform = mockPlatform();
    const svc = createNotificationService(db, platform);

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(moduleIds, futureIsoDate, ianaTimezones),
          { minLength: 1, maxLength: 5 },
        ),
        async (notifications) => {
          const ids: string[] = [];
          for (let i = 0; i < notifications.length; i++) {
            const [moduleId, triggerAt, tz] = notifications[i];
            const id = nextId(`stable_${i}`);
            insertNotification(db, id, moduleId, 'T', 'B', triggerAt, tz, 'none', null);
            ids.push(id);
          }

          await svc.rescheduleAll();

          // All IDs still exist
          for (const id of ids) {
            const fromDb = getNotificationById(db, id);
            expect(fromDb).not.toBeNull();
            expect(fromDb!.id).toBe(id);
          }

          // Cleanup
          for (const id of ids) {
            db.execute('DELETE FROM hub_scheduled_notifications WHERE id = ?', [id]);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
