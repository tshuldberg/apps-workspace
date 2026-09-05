// Re-export the canonical pure helper from the @mylife/classes package
// so the mobile component has a stable single import surface and a
// dedicated unit-test target.
export {
  formatRelativeDayLabel,
  getUpcomingOfficeHours,
  OFFICE_HOURS_DAY_LABELS,
  OFFICE_HOURS_DAY_LABELS_SHORT,
  type UpcomingOfficeHour,
} from '@mylife/classes';
