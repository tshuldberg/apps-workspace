import type { CSSProperties, ReactElement } from 'react';
import type {
  ApplicationStatus,
  ApplicationTaskKind,
  ApplicationTaskStatus,
  ApplicationType,
  DeadlineUrgency,
  StandardizedTestCategory,
  StandardizedTestStatus,
} from '@mylife/classes';
import { CLASSES_ACCENT, CLASSES_ACCENT_BORDER, TEXT, TEXT_SECONDARY } from '../ui';

export const APPLICATION_TYPES: ApplicationType[] = [
  'undergrad',
  'grad',
  'scholarship',
  'fellowship',
  'internship',
  'job',
  'other',
];
export const APPLICATION_TYPE_LABEL: Record<ApplicationType, string> = {
  undergrad: 'Undergrad',
  grad: 'Grad',
  scholarship: 'Scholarship',
  fellowship: 'Fellowship',
  internship: 'Internship',
  job: 'Job',
  other: 'Other',
};

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'considering',
  'in_progress',
  'submitted',
  'accepted',
  'rejected',
  'waitlisted',
  'deferred',
  'withdrawn',
];
export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  considering: 'Considering',
  in_progress: 'In progress',
  submitted: 'Submitted',
  accepted: 'Accepted',
  rejected: 'Rejected',
  waitlisted: 'Waitlisted',
  deferred: 'Deferred',
  withdrawn: 'Withdrawn',
};

export const APPLICATION_TASK_KINDS: ApplicationTaskKind[] = [
  'essay',
  'recommendation',
  'transcript',
  'portal_step',
  'fee',
  'supplemental',
  'other',
];
export const APPLICATION_TASK_KIND_LABEL: Record<ApplicationTaskKind, string> = {
  essay: 'Essay',
  recommendation: 'Recommendation',
  transcript: 'Transcript',
  portal_step: 'Portal step',
  fee: 'Fee',
  supplemental: 'Supplemental',
  other: 'Other',
};

export const APPLICATION_TASK_STATUSES: ApplicationTaskStatus[] = [
  'not_started',
  'in_progress',
  'done',
  'skipped',
];
export const APPLICATION_TASK_STATUS_LABEL: Record<ApplicationTaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
  skipped: 'Skipped',
};

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

export function urgencyColor(urgency: DeadlineUrgency): string {
  switch (urgency) {
    case 'overdue':
    case 'critical':
      return '#FFB4AB';
    case 'soon':
      return '#FFD166';
    case 'comfortable':
      return CLASSES_ACCENT;
    case 'distant':
      return '#30D158';
    default:
      return TEXT_SECONDARY;
  }
}

export function urgencyLabel(urgency: DeadlineUrgency): string {
  switch (urgency) {
    case 'overdue':
      return 'Overdue';
    case 'critical':
      return 'Critical';
    case 'soon':
      return 'Soon';
    case 'comfortable':
      return 'Comfortable';
    case 'distant':
      return 'Distant';
    default:
      return 'No deadline';
  }
}

export function deadlineCountdown(deadline: string | null, now: Date = new Date()): string {
  if (!deadline) return 'No deadline';
  const t = Date.parse(deadline);
  if (Number.isNaN(t)) return 'Unknown';
  const days = Math.floor((t - now.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days <= 60) return `${days}d left`;
  return `${Math.round(days / 30)}mo left`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function pillStyle(color: string = CLASSES_ACCENT, borderColor: string = CLASSES_ACCENT_BORDER): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    border: `1px solid ${borderColor}`,
    color,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.4,
  };
}

export function progressBar(percent: number): ReactElement {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div
      style={{
        height: 8,
        borderRadius: 4,
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: CLASSES_ACCENT,
          borderRadius: 4,
        }}
      />
    </div>
  );
}

export const cardStyle: CSSProperties = {
  borderRadius: 16,
  border: `1px solid ${CLASSES_ACCENT_BORDER}`,
  background: 'var(--accent-classes-dim)',
  padding: 16,
  display: 'grid',
  gap: 8,
  textDecoration: 'none',
  color: TEXT,
};
