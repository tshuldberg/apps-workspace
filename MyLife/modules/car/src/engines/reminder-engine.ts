import type { ScheduleServiceType, ScheduleStatus, MaintenanceSchedule } from '../types';

export interface SchedulePreset {
  serviceType: ScheduleServiceType;
  intervalMiles: number | null;
  intervalMonths: number | null;
}

export interface NextDueResult {
  nextDueOdometer: number | null;
  nextDueDate: string | null;
}

/**
 * Calculate the next due odometer and date for a schedule based on
 * last service values, intervals, and any active snooze offsets.
 */
export function calculateNextDue(schedule: {
  intervalMiles: number | null;
  intervalMonths: number | null;
  lastServiceOdometer: number | null;
  lastServiceDate: string | null;
  snoozeMiles: number;
  snoozeDateOffsetDays: number;
}): NextDueResult {
  let nextDueOdometer: number | null = null;
  let nextDueDate: string | null = null;

  if (schedule.intervalMiles !== null && schedule.lastServiceOdometer !== null) {
    nextDueOdometer = schedule.lastServiceOdometer + schedule.intervalMiles + schedule.snoozeMiles;
  }

  if (schedule.intervalMonths !== null && schedule.lastServiceDate !== null) {
    const d = new Date(schedule.lastServiceDate + 'T00:00:00Z');
    d.setUTCMonth(d.getUTCMonth() + schedule.intervalMonths);
    d.setUTCDate(d.getUTCDate() + schedule.snoozeDateOffsetDays);
    nextDueDate = d.toISOString().slice(0, 10);
  }

  return { nextDueOdometer, nextDueDate };
}

/**
 * Determine the status of a maintenance schedule given the vehicle's
 * current odometer and today's date.
 *
 * - "overdue": past due by mileage OR date
 * - "due_soon": within 500 miles OR 30 days of the due point
 * - "ok": not yet approaching due
 * - "unknown": insufficient data (no last service info populated)
 */
export function calculateScheduleStatus(
  schedule: {
    intervalMiles: number | null;
    intervalMonths: number | null;
    lastServiceOdometer: number | null;
    lastServiceDate: string | null;
    nextDueOdometer: number | null;
    nextDueDate: string | null;
    snoozeMiles: number;
    snoozeDateOffsetDays: number;
  },
  currentOdometer: number,
  currentDate: string,
): ScheduleStatus {
  const hasMileageData = schedule.intervalMiles !== null && schedule.lastServiceOdometer !== null;
  const hasDateData = schedule.intervalMonths !== null && schedule.lastServiceDate !== null;

  if (!hasMileageData && !hasDateData) {
    return 'unknown';
  }

  const nextDue = calculateNextDue(schedule);

  let mileageStatus: ScheduleStatus = 'ok';
  if (nextDue.nextDueOdometer !== null) {
    if (currentOdometer >= nextDue.nextDueOdometer) {
      mileageStatus = 'overdue';
    } else if (currentOdometer >= nextDue.nextDueOdometer - 500) {
      mileageStatus = 'due_soon';
    }
  }

  let dateStatus: ScheduleStatus = 'ok';
  if (nextDue.nextDueDate !== null) {
    const dueMs = new Date(nextDue.nextDueDate + 'T00:00:00Z').getTime();
    const currentMs = new Date(currentDate + 'T00:00:00Z').getTime();
    const dayMs = 86400000;
    if (currentMs >= dueMs) {
      dateStatus = 'overdue';
    } else if (currentMs >= dueMs - 30 * dayMs) {
      dateStatus = 'due_soon';
    }
  }

  // Most urgent status wins
  const priority: Record<ScheduleStatus, number> = { overdue: 3, due_soon: 2, ok: 1, unknown: 0 };
  return priority[mileageStatus] >= priority[dateStatus] ? mileageStatus : dateStatus;
}

/**
 * Return the 8 default maintenance schedule presets.
 */
export function getDefaultSchedules(): SchedulePreset[] {
  return [
    { serviceType: 'oil_change', intervalMiles: 5000, intervalMonths: 6 },
    { serviceType: 'tire_rotation', intervalMiles: 7500, intervalMonths: null },
    { serviceType: 'brake_inspection', intervalMiles: 20000, intervalMonths: null },
    { serviceType: 'air_filter', intervalMiles: 15000, intervalMonths: 12 },
    { serviceType: 'transmission_fluid', intervalMiles: 30000, intervalMonths: null },
    { serviceType: 'coolant', intervalMiles: 30000, intervalMonths: 24 },
    { serviceType: 'spark_plugs', intervalMiles: 60000, intervalMonths: null },
    { serviceType: 'battery', intervalMiles: null, intervalMonths: 48 },
  ];
}

/**
 * Sort schedules by urgency: overdue first, then due_soon, then ok, then unknown.
 * Within the same status, sort alphabetically by service type.
 */
export function sortByUrgency(
  schedules: MaintenanceSchedule[],
  currentOdometer: number,
  currentDate: string,
): Array<MaintenanceSchedule & { status: ScheduleStatus }> {
  const priority: Record<ScheduleStatus, number> = { overdue: 3, due_soon: 2, ok: 1, unknown: 0 };

  return schedules
    .map((s) => ({
      ...s,
      status: calculateScheduleStatus(s, currentOdometer, currentDate),
    }))
    .sort((a, b) => {
      const pDiff = priority[b.status] - priority[a.status];
      if (pDiff !== 0) return pDiff;
      return a.serviceType.localeCompare(b.serviceType);
    });
}

/**
 * Human-readable label for a schedule service type.
 */
export function serviceTypeLabel(serviceType: ScheduleServiceType, customName?: string | null): string {
  const labels: Record<ScheduleServiceType, string> = {
    oil_change: 'Oil Change',
    tire_rotation: 'Tire Rotation',
    brake_inspection: 'Brake Inspection',
    air_filter: 'Air Filter',
    transmission_fluid: 'Transmission Fluid',
    coolant: 'Coolant',
    spark_plugs: 'Spark Plugs',
    battery: 'Battery',
    inspection: 'Inspection',
    registration: 'Registration',
    custom: customName?.trim() || 'Custom',
  };
  return labels[serviceType];
}
