import { StyleSheet, View } from 'react-native';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import type {
  DegreeType,
  GpaStatus,
  RequirementCategory,
  SatisfactionStatus,
} from '@mylife/classes';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
} from '../_ui';

export const DEGREE_TYPES: DegreeType[] = [
  'BS',
  'BA',
  'MS',
  'MA',
  'PhD',
  'Minor',
  'Certificate',
  'Other',
];

export const REQUIREMENT_CATEGORIES: RequirementCategory[] = [
  'major',
  'minor',
  'general_ed',
  'elective',
  'capstone',
  'other',
];

export const REQUIREMENT_CATEGORY_LABEL: Record<RequirementCategory, string> = {
  major: 'Major',
  minor: 'Minor',
  general_ed: 'Gen Ed',
  elective: 'Elective',
  capstone: 'Capstone',
  other: 'Other',
};

export const SATISFACTION_STATUSES: SatisfactionStatus[] = [
  'planned',
  'in_progress',
  'completed',
];

export const SATISFACTION_STATUS_LABEL: Record<SatisfactionStatus, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  completed: 'Completed',
};

export const MIN_GRADES = [
  'A',
  'A-',
  'B+',
  'B',
  'B-',
  'C+',
  'C',
  'C-',
  'D',
  'none',
] as const;

export function gpaStatusLabel(status: GpaStatus): string {
  switch (status) {
    case 'meets':
      return 'GPA meets target';
    case 'below':
      return 'GPA below target';
    default:
      return 'GPA unknown';
  }
}

export function gpaStatusColor(status: GpaStatus): string {
  switch (status) {
    case 'meets':
      return '#30D158';
    case 'below':
      return '#FFB4AB';
    default:
      return colors.textSecondary;
  }
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

export function PercentRing({
  percent,
  size = 120,
}: {
  percent: number;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  const stroke = 10;
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
        <Text style={{ color: CLASSES_ACCENT, fontSize: 28, fontWeight: '800' }}>
          {pct.toFixed(0)}%
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          Complete
        </Text>
      </View>
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
