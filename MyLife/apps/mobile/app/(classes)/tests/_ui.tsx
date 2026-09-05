import type {
  StandardizedTestCategory,
  StandardizedTestStatus,
} from '@mylife/classes';

export const TEST_CATEGORIES: StandardizedTestCategory[] = [
  'undergrad',
  'grad',
  'ap_ib',
  'language',
  'professional',
  'other',
];

export const TEST_CATEGORY_LABEL: Record<StandardizedTestCategory, string> = {
  undergrad: 'Undergrad',
  grad: 'Grad',
  ap_ib: 'AP / IB',
  language: 'Language',
  professional: 'Professional',
  other: 'Other',
};

export const TEST_STATUSES: StandardizedTestStatus[] = [
  'planned',
  'registered',
  'completed',
  'cancelled',
];

export const TEST_STATUS_LABEL: Record<StandardizedTestStatus, string> = {
  planned: 'Planned',
  registered: 'Registered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function daysUntil(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((t - now.getTime()) / 86_400_000);
}
