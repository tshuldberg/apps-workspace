import type {
  MaintenanceSchedule,
  ScheduleStatus,
  TaskType,
  Season,
  PropertyType,
  OwnershipType,
} from '../types';

// ── Schedule Preset ──

export interface SchedulePreset {
  taskType: TaskType;
  intervalMonths: number;
  seasonPreference: Season | null;
}

// ── Season Windows ──

const SEASON_START_MONTH: Record<Season, number> = {
  spring: 2,  // March (0-indexed)
  summer: 5,  // June
  fall: 8,    // September
  winter: 11, // December
};

const SEASON_END_MONTH: Record<Season, number> = {
  spring: 4,  // May
  summer: 7,  // August
  fall: 10,   // November
  winter: 1,  // February (wraps)
};

// ── Default Presets ──

const HOUSE_PRESETS: SchedulePreset[] = [
  { taskType: 'hvac_filter', intervalMonths: 3, seasonPreference: null },
  { taskType: 'hvac_service', intervalMonths: 12, seasonPreference: 'spring' },
  { taskType: 'gutter_cleaning', intervalMonths: 6, seasonPreference: 'fall' },
  { taskType: 'roof_inspection', intervalMonths: 12, seasonPreference: 'spring' },
  { taskType: 'smoke_detector', intervalMonths: 6, seasonPreference: null },
  { taskType: 'water_heater_flush', intervalMonths: 12, seasonPreference: null },
  { taskType: 'dryer_vent', intervalMonths: 12, seasonPreference: null },
  { taskType: 'pest_control', intervalMonths: 12, seasonPreference: 'spring' },
  { taskType: 'window_cleaning', intervalMonths: 6, seasonPreference: 'spring' },
  { taskType: 'lawn_mower_service', intervalMonths: 12, seasonPreference: 'spring' },
];

const CONDO_PRESETS: SchedulePreset[] = [
  { taskType: 'hvac_filter', intervalMonths: 3, seasonPreference: null },
  { taskType: 'smoke_detector', intervalMonths: 6, seasonPreference: null },
  { taskType: 'dryer_vent', intervalMonths: 12, seasonPreference: null },
  { taskType: 'window_cleaning', intervalMonths: 6, seasonPreference: 'spring' },
  { taskType: 'appliance_service', intervalMonths: 12, seasonPreference: null },
];

const OTHER_PRESETS: SchedulePreset[] = [
  { taskType: 'smoke_detector', intervalMonths: 6, seasonPreference: null },
  { taskType: 'hvac_filter', intervalMonths: 3, seasonPreference: null },
  { taskType: 'appliance_service', intervalMonths: 12, seasonPreference: null },
];

const RENTER_TASK_TYPES: Set<TaskType> = new Set([
  'hvac_filter',
  'smoke_detector',
  'dryer_vent',
  'appliance_service',
]);

const RENTER_FALLBACK = new Map<TaskType, SchedulePreset>([
  ['hvac_filter', { taskType: 'hvac_filter', intervalMonths: 3, seasonPreference: null }],
  ['smoke_detector', { taskType: 'smoke_detector', intervalMonths: 6, seasonPreference: null }],
  ['dryer_vent', { taskType: 'dryer_vent', intervalMonths: 12, seasonPreference: null }],
  ['appliance_service', { taskType: 'appliance_service', intervalMonths: 12, seasonPreference: null }],
]);

/**
 * Return the default maintenance schedule presets for a property type and ownership.
 * Renters get a filtered subset regardless of property type.
 */
export function getDefaultSchedules(
  propertyType: PropertyType,
  ownershipType: OwnershipType,
): SchedulePreset[] {
  let presets: SchedulePreset[];

  switch (propertyType) {
    case 'house':
    case 'townhouse':
      presets = HOUSE_PRESETS;
      break;
    case 'condo':
    case 'apartment':
      presets = CONDO_PRESETS;
      break;
    default:
      presets = OTHER_PRESETS;
  }

  if (ownershipType === 'rent') {
    const filtered = presets.filter((p) => RENTER_TASK_TYPES.has(p.taskType));
    // Ensure all renter essentials are present even if the base set lacks them
    const existing = new Set(filtered.map((p) => p.taskType));
    for (const taskType of RENTER_TASK_TYPES) {
      if (!existing.has(taskType)) {
        const fallback = RENTER_FALLBACK.get(taskType);
        if (fallback) filtered.push(fallback);
      }
    }
    return filtered;
  }

  return presets;
}

// ── Due Date Calculation ──

function isInSeason(month: number, season: Season): boolean {
  const start = SEASON_START_MONTH[season];
  const end = SEASON_END_MONTH[season];

  if (start <= end) {
    return month >= start && month <= end;
  }
  // Winter wraps: Dec(11), Jan(0), Feb(1)
  return month >= start || month <= end;
}

function shiftToSeasonStart(date: Date, season: Season): Date {
  const startMonth = SEASON_START_MONTH[season];
  const result = new Date(date);

  if (isInSeason(date.getUTCMonth(), season)) {
    return result;
  }

  // Shift forward to the next occurrence of the season start
  result.setUTCDate(1);
  if (date.getUTCMonth() < startMonth) {
    // Season is later this year
    result.setUTCMonth(startMonth);
  } else {
    // Season start is next year
    result.setUTCFullYear(result.getUTCFullYear() + 1);
    result.setUTCMonth(startMonth);
  }

  return result;
}

/**
 * Calculate the next due date for a maintenance schedule.
 *
 * Algorithm:
 * 1. Base date = lastCompletedDate or createdAt
 * 2. Add intervalMonths
 * 3. Apply season preference (shift forward only)
 * 4. Add snoozeDays
 */
export function calculateNextDueDate(schedule: {
  intervalMonths: number;
  lastCompletedDate: string | null;
  createdAt: string;
  seasonPreference: Season | null;
  snoozeDays: number;
}): string {
  const baseDate = schedule.lastCompletedDate ?? schedule.createdAt;
  const d = new Date(baseDate);

  // Normalize to date-only (strip time)
  d.setUTCHours(0, 0, 0, 0);

  // Add interval months
  d.setUTCMonth(d.getUTCMonth() + schedule.intervalMonths);

  // Apply season preference (shift forward only)
  let result = d;
  if (schedule.seasonPreference) {
    result = shiftToSeasonStart(d, schedule.seasonPreference);
  }

  // Add snooze days
  if (schedule.snoozeDays > 0) {
    result.setUTCDate(result.getUTCDate() + schedule.snoozeDays);
  }

  return result.toISOString().slice(0, 10);
}

// ── Status Calculation ──

/**
 * Determine the status of a maintenance schedule.
 *
 * - "overdue": current date > next_due_date
 * - "due_soon": current date > next_due_date - 14 days
 * - "ok": otherwise
 * - "unknown": next_due_date is null
 */
export function calculateScheduleStatus(
  nextDueDate: string | null,
  today?: string,
): ScheduleStatus {
  if (!nextDueDate) return 'unknown';

  const now = today
    ? new Date(today + 'T00:00:00Z')
    : new Date();
  now.setUTCHours(0, 0, 0, 0);

  const due = new Date(nextDueDate + 'T00:00:00Z');
  due.setUTCHours(0, 0, 0, 0);

  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 14) return 'due_soon';
  return 'ok';
}

// ── Sort by Urgency ──

const STATUS_PRIORITY: Record<ScheduleStatus, number> = {
  overdue: 0,
  due_soon: 1,
  ok: 2,
  unknown: 3,
};

export interface ScheduleWithStatus extends MaintenanceSchedule {
  status: ScheduleStatus;
}

/**
 * Sort schedules by urgency: overdue first, then due_soon, then ok, then unknown.
 * Within the same status, sort by next_due_date ascending.
 */
export function sortByUrgency(
  schedules: ScheduleWithStatus[],
): ScheduleWithStatus[] {
  return [...schedules].sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (priorityDiff !== 0) return priorityDiff;

    // Within same status, sort by next_due_date ascending
    const aDate = a.nextDueDate ?? '9999-12-31';
    const bDate = b.nextDueDate ?? '9999-12-31';
    return aDate.localeCompare(bDate);
  });
}

// ── Mark Complete ──

export interface MarkCompleteResult {
  lastCompletedDate: string;
  nextDueDate: string;
  snoozeDays: 0;
  snoozeCount: 0;
}

/**
 * Mark a schedule as completed today. Resets snooze, recalculates next due.
 */
export function markComplete(schedule: {
  intervalMonths: number;
  seasonPreference: Season | null;
  createdAt: string;
}, today?: string): MarkCompleteResult {
  const completedDate = today ?? new Date().toISOString().slice(0, 10);

  const nextDueDate = calculateNextDueDate({
    intervalMonths: schedule.intervalMonths,
    lastCompletedDate: completedDate,
    createdAt: schedule.createdAt,
    seasonPreference: schedule.seasonPreference,
    snoozeDays: 0,
  });

  return {
    lastCompletedDate: completedDate,
    nextDueDate,
    snoozeDays: 0,
    snoozeCount: 0,
  };
}

// ── Task Type Display Names ──

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  hvac_filter: 'HVAC Filter Change',
  hvac_service: 'HVAC Professional Service',
  gutter_cleaning: 'Gutter Cleaning',
  roof_inspection: 'Roof Inspection',
  smoke_detector: 'Smoke/CO Detector Battery',
  water_heater_flush: 'Water Heater Flush',
  dryer_vent: 'Dryer Vent Cleaning',
  pest_control: 'Pest Control Inspection',
  exterior_paint: 'Exterior Paint Touch-Up',
  lawn_mower_service: 'Lawn Mower Service',
  window_cleaning: 'Window Cleaning',
  plumbing_inspection: 'Plumbing Inspection',
  appliance_service: 'Appliance Service',
  chimney_sweep: 'Chimney Sweep',
  custom: 'Custom',
};

export function getTaskTypeLabel(taskType: TaskType, customLabel?: string | null): string {
  if (taskType === 'custom' && customLabel) return customLabel;
  return TASK_TYPE_LABELS[taskType];
}
