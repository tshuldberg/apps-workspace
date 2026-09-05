import { StyleSheet, View } from 'react-native';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import type { CertificationRow, OnlineCourseRow } from '@mylife/classes';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
} from '../_ui';

export const COURSE_STATUS_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  abandoned: 'Abandoned',
};

export const GOAL_STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  completed: 'Completed',
  paused: 'Paused',
  abandoned: 'Abandoned',
};

export type CertExpiryBucket = 'expired' | 'soon' | 'soonish' | 'ok' | 'none';

export function bucketCertExpiry(
  expiresAt: string | null,
  now: Date = new Date(),
): CertExpiryBucket {
  if (!expiresAt) return 'none';
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return 'none';
  const days = Math.floor((target - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return 'expired';
  if (days <= 30) return 'soon';
  if (days <= 90) return 'soonish';
  return 'ok';
}

export function expiryColor(bucket: CertExpiryBucket): string {
  switch (bucket) {
    case 'expired':
    case 'soon':
      return '#FFB4AB';
    case 'soonish':
      return '#FFD166';
    case 'ok':
      return '#30D158';
    default:
      return colors.textSecondary;
  }
}

export function expiryLabel(
  expiresAt: string | null,
  now: Date = new Date(),
): string {
  if (!expiresAt) return 'No expiry';
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return 'Unknown expiry';
  const days = Math.floor((target - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  if (days <= 90) return `Expires in ${days}d`;
  const months = Math.round(days / 30);
  return `Expires in ${months}mo`;
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

export function CourseListCard({ course }: { course: OnlineCourseRow }) {
  const meta = [
    course.provider,
    course.instructor,
    course.actual_hours
      ? `${course.actual_hours.toFixed(1)}h logged`
      : course.estimated_hours
        ? `${course.estimated_hours.toFixed(1)}h est.`
        : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.listCard}>
      <View style={styles.listCardTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.listCardTitle}>{course.title}</Text>
          {meta ? (
            <Text variant="caption" color={colors.textSecondary}>
              {meta}
            </Text>
          ) : null}
        </View>
        <Pill label={COURSE_STATUS_LABEL[course.status] ?? course.status} />
      </View>
      <ProgressBar percent={course.progress_percent} />
      <Text variant="caption" color={colors.textSecondary}>
        {course.progress_percent.toFixed(0)}% complete
      </Text>
    </View>
  );
}

export function CertListCard({ cert }: { cert: CertificationRow }) {
  const bucket = bucketCertExpiry(cert.expires_at);
  const color = expiryColor(bucket);

  return (
    <View style={styles.listCard}>
      <Text style={styles.listCardTitle}>{cert.name}</Text>
      {cert.issuer ? (
        <Text variant="caption" color={colors.textSecondary}>
          {cert.issuer}
        </Text>
      ) : null}
      <View style={styles.badgeRow}>
        <Pill label={expiryLabel(cert.expires_at)} color={color} borderColor={color} />
        {cert.issued_at ? (
          <Text variant="caption" color={colors.textSecondary}>
            Issued {formatDate(cert.issued_at)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  listCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: CLASSES_ACCENT_DIM,
    padding: spacing.md,
    gap: spacing.xs,
  },
  listCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  listCardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
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
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});
