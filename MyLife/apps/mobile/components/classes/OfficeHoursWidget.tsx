import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import type { ClassRow, TeacherRow } from '@mylife/classes';
import {
  formatRelativeDayLabel,
  getUpcomingOfficeHours,
  type UpcomingOfficeHour,
} from './officeHours';

const ACCENT = colors.modules.classes;
const ACCENT_DIM = 'rgba(59,130,246,0.16)';
const ACCENT_BORDER = 'rgba(59,130,246,0.28)';

export interface OfficeHoursWidgetProps {
  teachers: TeacherRow[];
  classes: ClassRow[];
  onPressTeacher: (teacherId: string) => void;
  today?: Date;
  limit?: number;
}

function openMaps(location: string) {
  const q = encodeURIComponent(location);
  void Linking.openURL(`maps:?q=${q}`);
}

function Row({
  item,
  onPressTeacher,
}: {
  item: UpcomingOfficeHour;
  onPressTeacher: (id: string) => void;
}) {
  const codeLabel =
    item.class_codes.length === 0
      ? null
      : item.class_codes.length === 1
        ? item.class_codes[0]
        : `${item.class_codes.length} classes`;

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Pressable
          onPress={() => onPressTeacher(item.teacher_id)}
          accessibilityRole="link"
          accessibilityLabel={`Open ${item.teacher_name}'s profile`}
          style={styles.teacherPress}
          hitSlop={6}
        >
          <Text style={styles.teacherName}>{item.teacher_name}</Text>
        </Pressable>
        {codeLabel ? (
          <View style={styles.codeBadge}>
            <Text style={styles.codeBadgeText}>{codeLabel}</Text>
          </View>
        ) : null}
      </View>
      <Text variant="body" color={colors.textSecondary} style={styles.timeLine}>
        {formatRelativeDayLabel(item.days_from_today, item.day)} · {item.start_time}–{item.end_time}
      </Text>
      {item.office_location ? (
        <View style={styles.locRow}>
          <Text variant="caption" color={colors.textTertiary} style={styles.locText}>
            {item.office_location}
          </Text>
          <Pressable
            onPress={() => openMaps(item.office_location as string)}
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel="Open in Maps"
          >
            <Text style={styles.mapsLink}>Open in Maps →</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function OfficeHoursWidget({
  teachers,
  classes,
  onPressTeacher,
  today,
  limit = 5,
}: OfficeHoursWidgetProps) {
  const items = getUpcomingOfficeHours(
    teachers,
    classes,
    today ?? new Date(),
    limit,
  );

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Office Hours</Text>
        <Text style={styles.title}>This Week</Text>
      </View>
      {items.length === 0 ? (
        <Text variant="body" color={colors.textSecondary} style={styles.empty}>
          No office hours scheduled. Add them in a teacher&apos;s profile.
        </Text>
      ) : (
        <View style={styles.list}>
          {items.map((item, idx) => (
            <View key={`${item.teacher_id}-${item.day}-${item.start_time}-${idx}`}>
              {idx > 0 ? <View style={styles.divider} /> : null}
              <Row item={item} onPressTeacher={onPressTeacher} />
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT_DIM,
  },
  header: {
    gap: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: ACCENT,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  empty: {
    lineHeight: 20,
  },
  list: {
    gap: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  row: {
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  teacherPress: {
    flexShrink: 1,
  },
  teacherName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(19,24,36,0.55)',
  },
  codeBadgeText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  timeLine: {
    fontSize: 13,
    lineHeight: 18,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 2,
  },
  locText: {
    flexShrink: 1,
  },
  mapsLink: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
  },
});
