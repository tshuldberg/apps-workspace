/**
 * Wellness timeline aggregation engine.
 * Merges events from multiple health modules into a unified chronological feed.
 * Pure functions, no side effects.
 */

import type { TimelineEvent, TimelineEventType } from '../types';

/**
 * Create a timeline event from raw module data.
 */
export function createTimelineEvent(
  id: string,
  type: TimelineEventType,
  timestamp: string,
  title: string,
  subtitle: string | null,
  icon: string,
  accentColor: string,
  sourceModule: string,
  metadata: Record<string, unknown> = {},
): TimelineEvent {
  return { id, type, timestamp, title, subtitle, icon, accentColor, sourceModule, metadata };
}

/**
 * Merge and sort timeline events from multiple sources.
 * Returns events sorted by timestamp descending (most recent first).
 */
export function mergeTimelineEvents(...eventArrays: TimelineEvent[][]): TimelineEvent[] {
  const all: TimelineEvent[] = [];
  for (const arr of eventArrays) {
    all.push(...arr);
  }
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Filter timeline events by type.
 */
export function filterByType(
  events: TimelineEvent[],
  types: TimelineEventType[],
): TimelineEvent[] {
  const typeSet = new Set(types);
  return events.filter((e) => typeSet.has(e.type));
}

/**
 * Filter timeline events by date range.
 */
export function filterByDateRange(
  events: TimelineEvent[],
  startDate: string,
  endDate: string,
): TimelineEvent[] {
  return events.filter((e) => e.timestamp >= startDate && e.timestamp <= endDate);
}

/**
 * Group timeline events by date (YYYY-MM-DD).
 */
export function groupByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const date = e.timestamp.slice(0, 10);
    const group = groups.get(date) ?? [];
    group.push(e);
    groups.set(date, group);
  }
  return groups;
}

/**
 * Paginate timeline events.
 */
export function paginateEvents(
  events: TimelineEvent[],
  page: number,
  pageSize: number,
): { events: TimelineEvent[]; hasMore: boolean } {
  const start = page * pageSize;
  const sliced = events.slice(start, start + pageSize);
  return { events: sliced, hasMore: start + pageSize < events.length };
}

// ---------------------------------------------------------------------------
// Event factory helpers for each source module
// ---------------------------------------------------------------------------

export function vitalToTimelineEvent(vital: {
  id: string;
  vital_type: string;
  value: number;
  unit: string;
  recorded_at: string;
  source: string;
}): TimelineEvent {
  return createTimelineEvent(
    `vital-${vital.id}`,
    'vital_reading',
    vital.recorded_at,
    `${formatVitalType(vital.vital_type)}: ${vital.value} ${vital.unit}`,
    vital.source !== 'manual' ? `via ${vital.source}` : null,
    '💓',
    '#10B981',
    'health',
    { vitalType: vital.vital_type, value: vital.value },
  );
}

export function sleepToTimelineEvent(session: {
  id: string;
  start_time: string;
  duration_minutes: number;
  quality_score: number | null;
}): TimelineEvent {
  const hours = Math.floor(session.duration_minutes / 60);
  const mins = session.duration_minutes % 60;
  return createTimelineEvent(
    `sleep-${session.id}`,
    'sleep_session',
    session.start_time,
    `Sleep: ${hours}h ${mins}m`,
    session.quality_score !== null ? `Quality: ${session.quality_score}%` : null,
    '😴',
    '#818CF8',
    'health',
    { durationMinutes: session.duration_minutes, qualityScore: session.quality_score },
  );
}

function formatVitalType(type: string): string {
  const map: Record<string, string> = {
    heart_rate: 'Heart Rate',
    resting_heart_rate: 'Resting HR',
    hrv: 'HRV',
    blood_oxygen: 'Blood Oxygen',
    blood_pressure: 'Blood Pressure',
    body_temperature: 'Temperature',
    steps: 'Steps',
    active_energy: 'Active Energy',
    respiratory_rate: 'Respiratory Rate',
    vo2_max: 'VO2 Max',
  };
  return map[type] ?? type;
}
