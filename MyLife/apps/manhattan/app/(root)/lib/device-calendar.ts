// Device calendar bridge (Phase 3).
//
// Thin app-side wrapper around expo-calendar. All payload shaping, ICS,
// dedup, and reconciliation live in the pure @mylife/manhattan engine
// (engines/calendar-payload). This file only performs the native I/O:
// permissions, a dedicated "Manhattan Events" calendar, and two-way sync.
//
// Timezone note: events are written with timeZone America/New_York (the
// app is NYC-scoped for v1). startAt is a floating-local ISO string; it is
// interpreted as a Date in the device locale, which is correct for NYC
// users. Cross-timezone correctness is future work.
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import type { DatabaseAdapter } from '@mylife/db';
import { allDayDate, zonedWallTimeToInstant } from './timezone';
import {
  MANHATTAN_TIMEZONE,
  FacetAxis,
  getPlans,
  getEvents,
  getEventById,
  updatePlanCalendarEventId,
  getPlanByCalendarEventId,
  planToCalendarPayload,
  buildManhattanEventNotes,
  reconcileInboundDeviceEvents,
  upsertExternalEvent,
  classify,
  addFacet,
  getSetting,
  setSetting,
  type DeviceCalendarEvent,
  type PlanRow,
} from '@mylife/manhattan';

const MANHATTAN_CALENDAR_TITLE = 'Manhattan Events';
const MANHATTAN_CALENDAR_NAME = 'manhattan-internal';
const SETTING_CALENDAR_ID = 'deviceCalendarId';
const SETTING_IMPORT_ENABLED = 'deviceCalendarImportEnabled';
const ACCENT = '#E4572E';

export interface CalendarSyncResult {
  imported: number;
  exported: number;
  failed: number;
  importSkipped: boolean;
}

export function isDeviceCalendarImportEnabled(db: DatabaseAdapter): boolean {
  return getSetting(db, SETTING_IMPORT_ENABLED) === 'true';
}

export function setDeviceCalendarImportEnabled(db: DatabaseAdapter, enabled: boolean): void {
  setSetting(db, SETTING_IMPORT_ENABLED, enabled ? 'true' : 'false');
}

export async function ensureCalendarPermission(): Promise<boolean> {
  const result = await Calendar.requestCalendarPermissionsAsync();
  return result.status === 'granted';
}

export async function ensureManhattanCalendar(db: DatabaseAdapter): Promise<string> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

  const savedId = getSetting(db, SETTING_CALENDAR_ID);
  if (savedId && calendars.some((c) => c.id === savedId)) {
    return savedId;
  }

  const existing = calendars.find((c) => c.title === MANHATTAN_CALENDAR_TITLE);
  if (existing) {
    setSetting(db, SETTING_CALENDAR_ID, existing.id);
    return existing.id;
  }

  let source: Calendar.Source | { isLocalAccount: boolean; name: string };
  let sourceId: string | undefined;
  if (Platform.OS === 'ios') {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    source = defaultCalendar.source;
    sourceId = defaultCalendar.source.id;
  } else {
    source = { isLocalAccount: true, name: 'Manhattan' };
  }

  const id = await Calendar.createCalendarAsync({
    title: MANHATTAN_CALENDAR_TITLE,
    color: ACCENT,
    entityType: Calendar.EntityTypes.EVENT,
    name: MANHATTAN_CALENDAR_NAME,
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
    source: source as Calendar.Source,
    sourceId,
  });
  setSetting(db, SETTING_CALENDAR_ID, id);
  return id;
}

// Pure timezone math lives in ./timezone (node-testable, no expo imports).

function toIso(value: string | Date): string {
  return typeof value === 'string' ? value : new Date(value).toISOString();
}

export async function exportPlanToDevice(
  db: DatabaseAdapter,
  calendarId: string,
  plan: PlanRow,
): Promise<void> {
  const event = plan.event_id ? getEventById(db, plan.event_id) : null;
  const payload = planToCalendarPayload(plan, event);
  const endSource = payload.endAt ?? payload.startAt;
  const details = {
    title: payload.title,
    startDate: payload.allDay
      ? allDayDate(payload.startAt)
      : zonedWallTimeToInstant(payload.startAt, MANHATTAN_TIMEZONE),
    endDate: payload.allDay
      ? allDayDate(endSource)
      : zonedWallTimeToInstant(endSource, MANHATTAN_TIMEZONE),
    timeZone: MANHATTAN_TIMEZONE,
    location: payload.location ?? undefined,
    notes: buildManhattanEventNotes(payload.manhattanId, payload.description),
    allDay: payload.allDay,
  };

  if (plan.calendar_event_id) {
    try {
      await Calendar.updateEventAsync(plan.calendar_event_id, details);
      return;
    } catch {
      // The linked event was removed on the device; fall through and recreate.
    }
  }

  const id = await Calendar.createEventAsync(calendarId, details);
  updatePlanCalendarEventId(db, plan.id, id);
}

export async function deleteDeviceCalendarEvent(calendarEventId: string): Promise<boolean> {
  try {
    await Calendar.deleteEventAsync(calendarEventId);
    return true;
  } catch {
    return false;
  }
}

export async function importDeviceEvents(
  db: DatabaseAdapter,
  windowDays = 60,
): Promise<number> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const calendarIds = calendars.map((c) => c.id);
  if (calendarIds.length === 0) return 0;

  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + windowDays);

  const nativeEvents = await Calendar.getEventsAsync(calendarIds, start, end);
  const deviceEvents: DeviceCalendarEvent[] = nativeEvents
    // Skip events Manhattan itself exported from a plan (linked via
    // calendar_event_id) so a plan never bounces back as a duplicate event.
    .filter((e) => !getPlanByCalendarEventId(db, e.id))
    .map((e) => ({
      id: e.id,
      title: e.title ?? 'Untitled event',
      startDate: toIso(e.startDate),
      endDate: e.endDate ? toIso(e.endDate) : null,
      location: e.location ?? null,
      notes: e.notes ?? null,
      allDay: e.allDay ?? false,
    }));

  const knownExternalIds = getEvents(db)
    .filter((e) => e.source_id === 'device_calendar' && e.external_id)
    .map((e) => e.external_id as string);

  const candidates = reconcileInboundDeviceEvents(deviceEvents, knownExternalIds);
  for (const candidate of candidates) {
    const eventId = upsertExternalEvent(db, candidate);
    for (const facet of classify(candidate)) {
      const parsedAxis = FacetAxis.safeParse(facet.axis);
      if (parsedAxis.success) {
        addFacet(db, { eventId, axis: parsedAxis.data, value: facet.value });
      }
    }
  }
  return candidates.length;
}

export async function syncDeviceCalendar(db: DatabaseAdapter): Promise<CalendarSyncResult> {
  const granted = await ensureCalendarPermission();
  if (!granted) {
    throw new Error('Calendar permission was not granted.');
  }
  const calendarId = await ensureManhattanCalendar(db);

  let exported = 0;
  let failed = 0;
  for (const plan of getPlans(db)) {
    try {
      await exportPlanToDevice(db, calendarId, plan);
      exported += 1;
    } catch {
      // One plan failing (e.g. a transient calendar write error) must not abort
      // the whole sync; skip it and continue.
      failed += 1;
    }
  }

  const importEnabled = isDeviceCalendarImportEnabled(db);
  const imported = importEnabled ? await importDeviceEvents(db) : 0;
  return { imported, exported, failed, importSkipped: !importEnabled };
}
