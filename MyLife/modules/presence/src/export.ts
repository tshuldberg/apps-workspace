import type { DailyUsage, AppUsage, FocusSession } from './types';

function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  // Guard against CSV formula injection
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportDailyUsageCSV(records: DailyUsage[]): string {
  const header = 'date,total_minutes,goal_minutes,goal_met,pickups,first_pickup,last_pickup';
  const rows = records.map((r) =>
    [
      escapeCSV(r.date),
      escapeCSV(r.total_minutes),
      escapeCSV(r.goal_minutes),
      r.goal_met === 1 ? 'yes' : 'no',
      escapeCSV(r.pickups),
      escapeCSV(r.first_pickup),
      escapeCSV(r.last_pickup),
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

export function exportAppUsageCSV(records: AppUsage[]): string {
  const header = 'date,app_name,category,minutes,opens';
  const rows = records.map((r) =>
    [
      escapeCSV(r.date),
      escapeCSV(r.app_name),
      escapeCSV(r.category),
      escapeCSV(r.minutes),
      escapeCSV(r.opens),
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

export function exportSessionsCSV(records: FocusSession[]): string {
  const header = 'start_time,end_time,planned_minutes,actual_minutes,completed,type,rating';
  const rows = records.map((r) =>
    [
      escapeCSV(r.start_time),
      escapeCSV(r.end_time),
      escapeCSV(r.planned_minutes),
      escapeCSV(r.actual_minutes),
      r.completed === 1 ? 'yes' : 'no',
      escapeCSV(r.type),
      escapeCSV(r.rating),
    ].join(','),
  );
  return [header, ...rows].join('\n');
}
