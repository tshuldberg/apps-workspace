import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  GlassCard,
  MaterialSymbol,
  MD_ACCENT_LIGHT,
  MD_CHROME_GOLD,
  MD_DOSE_STATUS,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';

export type MedsFeatureTileConfig = {
  color?: string;
  description?: string;
  href?: string;
  icon: string;
  key: string;
  label: string;
  onPress?: () => void;
};

export type MedsPartOfDay = 'Morning' | 'Midday' | 'Evening' | 'Bedtime';
export type MedsHomeStyle = 'timeline' | 'pillbox' | 'simple';
export type MedsDashboardSectionId = 'schedule' | 'vitals' | 'wellness' | 'mood' | 'refills';

export interface MedsDashboardSectionConfig {
  density: 'compact' | 'expanded';
  description: string;
  enabled: boolean;
  id: MedsDashboardSectionId;
  label: string;
}

export const DEFAULT_MEDS_DASHBOARD_SECTIONS: MedsDashboardSectionConfig[] = [
  {
    density: 'expanded',
    description: 'Today’s reminder timeline and take/skip controls',
    enabled: true,
    id: 'schedule',
    label: 'Schedule',
  },
  {
    density: 'expanded',
    description: 'Latest BP, glucose, and secondary vitals',
    enabled: true,
    id: 'vitals',
    label: 'Vitals',
  },
  {
    density: 'expanded',
    description: 'Composite wellness score preview with trend',
    enabled: true,
    id: 'wellness',
    label: 'Wellness',
  },
  {
    density: 'compact',
    description: 'Daily mood prompt when no check-in exists yet',
    enabled: true,
    id: 'mood',
    label: 'Mood',
  },
  {
    density: 'compact',
    description: 'Low-supply refill alerts and refill request shortcut',
    enabled: true,
    id: 'refills',
    label: 'Refills',
  },
];

export function parseMedsDashboardSections(value?: string | null) {
  if (!value) {
    return DEFAULT_MEDS_DASHBOARD_SECTIONS;
  }

  try {
    const parsed = JSON.parse(value) as Partial<MedsDashboardSectionConfig>[];
    const normalized = DEFAULT_MEDS_DASHBOARD_SECTIONS.map((section) => {
      const match = parsed.find((item) => item.id === section.id);
      return {
        ...section,
        density: match?.density === 'compact' ? 'compact' : section.density,
        enabled: match?.enabled ?? section.enabled,
      };
    });
    const ordered: MedsDashboardSectionConfig[] = [];

    for (const item of parsed) {
      const match = normalized.find((section) => section.id === item.id);
      if (match) {
        ordered.push(match);
      }
    }

    for (const section of normalized) {
      if (!ordered.some((item) => item.id === section.id)) {
        ordered.push(section);
      }
    }

    return ordered;
  } catch {
    return DEFAULT_MEDS_DASHBOARD_SECTIONS;
  }
}

export function daysAgoIso(days: number) {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString();
}

export function toDateKey(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  return parsed.toISOString().slice(0, 10);
}

export function formatMedsTime(value: string | Date) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return typeof value === 'string' ? value : '';
  }

  return parsed.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatMedsDate(value: string | Date, options?: Intl.DateTimeFormatOptions) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return typeof value === 'string' ? value : '';
  }

  return parsed.toLocaleDateString([], options ?? {
    month: 'short',
    day: 'numeric',
  });
}

export function formatRelativeMinutes(targetIso: string, now: Date) {
  const target = new Date(targetIso);
  if (Number.isNaN(target.getTime())) {
    return '';
  }

  const minutes = Math.round((target.getTime() - now.getTime()) / 60000);
  if (Math.abs(minutes) <= 1) {
    return 'now';
  }
  if (minutes > 0) {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return rest > 0 ? `in ${hours}h ${rest}m` : `in ${hours}h`;
    }
    return `in ${minutes} min`;
  }

  const absolute = Math.abs(minutes);
  if (absolute >= 60) {
    const hours = Math.floor(absolute / 60);
    const rest = absolute % 60;
    return rest > 0 ? `${hours}h ${rest}m overdue` : `${hours}h overdue`;
  }
  return `${absolute} min overdue`;
}

export function getPartOfDayLabel(timeIso: string): MedsPartOfDay {
  const value = new Date(timeIso);
  const hour = Number.isNaN(value.getTime())
    ? Number.parseInt(timeIso.slice(11, 13), 10)
    : value.getHours();

  if (Number.isNaN(hour)) {
    return 'Morning';
  }
  if (hour < 11) {
    return 'Morning';
  }
  if (hour < 16) {
    return 'Midday';
  }
  if (hour < 21) {
    return 'Evening';
  }
  return 'Bedtime';
}

export function sortByTime<T>(items: T[], getTime: (item: T) => string) {
  return [...items].sort((left, right) => {
    const a = new Date(getTime(left)).getTime();
    const b = new Date(getTime(right)).getTime();
    return a - b;
  });
}

export function createDoseTone(status: string, scheduledTime: string, now: Date) {
  const normalized = status.toLowerCase();
  if (normalized === 'taken') {
    return 'taken' as const;
  }
  if (normalized === 'late') {
    return 'taken' as const;
  }
  if (normalized === 'skipped') {
    return normalized as keyof typeof MD_DOSE_STATUS;
  }

  const scheduled = new Date(scheduledTime);
  if (Number.isNaN(scheduled.getTime())) {
    return 'upcoming' as const;
  }

  const deltaMinutes = Math.round((scheduled.getTime() - now.getTime()) / 60000);
  if (deltaMinutes <= 0) {
    return 'due' as const;
  }
  if (deltaMinutes <= 60) {
    return 'due' as const;
  }
  return 'upcoming' as const;
}

export function HeaderIconButton({
  icon,
  label,
  onPress,
  tone = MD_TEXT_SECONDARY,
}: {
  icon: string;
  label?: string;
  onPress?: () => void;
  tone?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerIconButton,
        pressed ? styles.headerIconButtonPressed : null,
      ]}
    >
      <MaterialSymbol color={tone} name={icon} size={18} />
    </Pressable>
  );
}

export function FilterChip({
  label,
  selected = false,
  onPress,
  icon,
  color = MD_ACCENT_LIGHT,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? withAlpha(color, 0.18) : MD_SURFACES.low,
        },
        style,
      ]}
    >
      {icon ? (
        <MaterialSymbol color={selected ? color : MD_TEXT_TERTIARY} name={icon} size={14} />
      ) : null}
      <Text style={[styles.filterChipText, { color: selected ? MD_TEXT : MD_TEXT_SECONDARY }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SearchField({
  placeholder,
  value,
  onChangeText,
}: {
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <GlassCard padding={0} style={styles.searchShell}>
      <View style={styles.searchField}>
        <MaterialSymbol color={MD_TEXT_TERTIARY} name="search" size={18} />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={MD_TEXT_TERTIARY}
          style={styles.searchInput}
          value={value}
        />
      </View>
    </GlassCard>
  );
}

export function ScreenTitleBlock({
  title,
  subtitle,
  accent = MD_ACCENT_LIGHT,
  action,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.screenTitleRow}>
      <View style={styles.screenTitleCopy}>
        <Text style={[styles.screenTitleEyebrow, { color: accent }]}>Clinical Dashboard</Text>
        <Text style={styles.screenTitle}>{title}</Text>
        {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

export function MetricBadge({
  label,
  value,
  tone = MD_ACCENT_LIGHT,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <GlassCard padding={14} style={styles.metricBadge}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: tone }]}>{value}</Text>
    </GlassCard>
  );
}

export function ProgressBar({
  value,
  tone = MD_ACCENT_LIGHT,
  trackTone = withAlpha(MD_TEXT_SECONDARY, 0.12),
  height = 8,
}: {
  value: number;
  tone?: string;
  trackTone?: string;
  height?: number;
}) {
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <View style={[styles.progressTrack, { backgroundColor: trackTone, height }]}>
      <View
        style={[
          styles.progressFill,
          {
            backgroundColor: tone,
            width: `${safeValue}%`,
          },
        ]}
      />
    </View>
  );
}

export function TonePill({
  label,
  tone = MD_ACCENT_LIGHT,
}: {
  label: string;
  tone?: string;
}) {
  return (
    <View style={[styles.tonePill, { backgroundColor: withAlpha(tone, 0.16) }]}>
      <Text style={[styles.tonePillText, { color: tone }]}>{label}</Text>
    </View>
  );
}

export function FeatureTile({
  icon,
  label,
  description,
  color = MD_ACCENT_LIGHT,
  onPress,
}: MedsFeatureTileConfig) {
  return (
    <Pressable onPress={onPress} style={styles.featureTileWrap}>
      <GlassCard padding={16} style={styles.featureTile}>
        <View style={[styles.featureIcon, { backgroundColor: withAlpha(color, 0.16) }]}>
          <MaterialSymbol color={color} filled name={icon} size={20} />
        </View>
        <Text numberOfLines={2} style={styles.featureLabel}>{label}</Text>
        {description ? (
          <Text numberOfLines={2} style={styles.featureDescription}>
            {description}
          </Text>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

export function ExpandablePanel({
  open,
  onToggle,
  title,
  caption,
  accent = MD_ACCENT_LIGHT,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  title: string;
  caption?: string;
  accent?: string;
  children: ReactNode;
}) {
  return (
    <GlassCard padding={16} style={styles.expandablePanel}>
      <Pressable onPress={onToggle} style={styles.expandableHeader}>
        <View style={styles.expandableCopy}>
          <Text style={styles.expandableTitle}>{title}</Text>
          {caption ? <Text style={styles.expandableCaption}>{caption}</Text> : null}
        </View>
        <TonePill label={open ? 'Hide' : 'Show'} tone={accent} />
      </Pressable>
      {open ? <View style={styles.expandableBody}>{children}</View> : null}
    </GlassCard>
  );
}

export function LabeledValueRow({
  label,
  value,
  detail,
  tone = MD_TEXT,
  onPress,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: string;
  onPress?: () => void;
}) {
  const row = (
    <View style={styles.labeledValueRow}>
      <View style={styles.labeledValueCopy}>
        <Text style={styles.labeledValueLabel}>{label}</Text>
        {detail ? <Text style={styles.labeledValueDetail}>{detail}</Text> : null}
      </View>
      <Text style={[styles.labeledValueValue, { color: tone }]}>{value}</Text>
    </View>
  );

  if (!onPress) {
    return row;
  }

  return <Pressable onPress={onPress}>{row}</Pressable>;
}

export function EmptyGlassState({
  title,
  message,
  actionLabel,
  onPress,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <GlassCard padding={18} style={styles.emptyState}>
      <MaterialSymbol color={MD_ACCENT_LIGHT} name="local_hospital" size={20} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyMessage}>{message}</Text>
      {actionLabel && onPress ? (
        <FilterChip label={actionLabel} onPress={onPress} selected />
      ) : null}
    </GlassCard>
  );
}

export function SectionStack({ children }: { children: ReactNode }) {
  return <View style={styles.sectionStack}>{children}</View>;
}

export function valueChangeLabel(delta: number) {
  if (delta > 0) {
    return `+${delta}`;
  }
  if (delta < 0) {
    return `${delta}`;
  }
  return '0';
}

const styles = StyleSheet.create({
  screenTitleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  screenTitleCopy: {
    flex: 1,
    gap: 4,
  },
  screenTitleEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  screenTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 34,
  },
  screenSubtitle: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  headerIconButton: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.05),
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerIconButtonPressed: {
    opacity: 0.82,
  },
  filterChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipText: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  searchShell: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.88),
  },
  searchField: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchInput: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT,
    flex: 1,
    fontFamily: MD_FONTS.medium,
    padding: 0,
  },
  metricBadge: {
    flex: 1,
    minWidth: 96,
  },
  metricLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_TEXT_SECONDARY,
    marginBottom: 6,
  },
  metricValue: {
    ...MD_TYPOGRAPHY.vitalDisplay,
    color: MD_ACCENT_LIGHT,
    fontSize: 28,
    lineHeight: 32,
  },
  progressTrack: {
    borderRadius: 999,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    borderRadius: 999,
    height: '100%',
  },
  tonePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tonePillText: {
    ...MD_TYPOGRAPHY.labelUpper,
  },
  featureTileWrap: {
    flexBasis: '31%',
    flexGrow: 1,
    minWidth: 100,
  },
  featureTile: {
    gap: 10,
    minHeight: 126,
  },
  featureIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  featureLabel: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
  },
  featureDescription: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
    lineHeight: 18,
  },
  expandablePanel: {
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
  },
  expandableHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  expandableCopy: {
    flex: 1,
    gap: 4,
  },
  expandableTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
  },
  expandableCaption: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
  },
  expandableBody: {
    gap: 12,
    marginTop: 16,
  },
  labeledValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  labeledValueCopy: {
    flex: 1,
    gap: 3,
  },
  labeledValueLabel: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
  },
  labeledValueDetail: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
    lineHeight: 18,
  },
  labeledValueValue: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_CHROME_GOLD,
    fontFamily: MD_FONTS.bold,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_SURFACES.low, 0.9),
    gap: 10,
    justifyContent: 'center',
    minHeight: 160,
  },
  emptyTitle: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    textAlign: 'center',
  },
  emptyMessage: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    textAlign: 'center',
  },
  sectionStack: {
    gap: 14,
  },
});

export const medsPhase1Styles = styles;
