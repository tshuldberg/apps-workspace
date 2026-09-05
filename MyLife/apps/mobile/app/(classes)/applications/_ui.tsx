import { StyleSheet, View } from 'react-native';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import type {
  ApplicationStatus,
  ApplicationType,
  ApplicationTaskKind,
  ApplicationTaskStatus,
  DeadlineUrgency,
} from '@mylife/classes';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
} from '../_ui';

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

export const APPLICATION_TASK_STATUS_LABEL: Record<ApplicationTaskStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
  skipped: 'Skipped',
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
      return colors.textSecondary;
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

export function deadlineCountdown(
  deadline: string | null,
  now: Date = new Date(),
): string {
  if (!deadline) return 'No deadline';
  const t = Date.parse(deadline);
  if (Number.isNaN(t)) return 'Unknown';
  const days = Math.floor((t - now.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days <= 60) return `${days}d left`;
  const months = Math.round(days / 30);
  return `${months}mo left`;
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

export function Pill({
  label,
  color = CLASSES_ACCENT,
  borderColor = CLASSES_ACCENT_BORDER,
}: {
  label: string;
  color?: string;
  borderColor?: string;
}) {
  return (
    <View style={[styles.pill, { borderColor }]}>
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({
  percent,
  height = 8,
  accent = CLASSES_ACCENT,
}: {
  percent: number;
  height?: number;
  accent?: string;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: accent,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

export function PercentRing({
  percent,
  size = 96,
}: {
  percent: number;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  const stroke = 8;
  const inner = size - stroke * 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: CLASSES_ACCENT_BORDER,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <View
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: size / 2,
          backgroundColor: CLASSES_ACCENT_DIM,
          opacity: pct / 200 + 0.1,
        }}
      />
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: CLASSES_ACCENT, fontSize: 22, fontWeight: '800' }}>
          {pct.toFixed(0)}%
        </Text>
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: CLASSES_ACCENT_DIM,
    padding: spacing.md,
    gap: spacing.xs,
  },
});
