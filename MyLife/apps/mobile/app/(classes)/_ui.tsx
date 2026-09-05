import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import type { ClassesFoundationChecklistItem } from '@mylife/classes';

export const CLASSES_ACCENT = colors.modules.classes;
export const CLASSES_ACCENT_DIM = 'rgba(59,130,246,0.16)';
export const CLASSES_ACCENT_BORDER = 'rgba(59,130,246,0.28)';

export function useClassesFocusedSnapshot<T>(load: () => T): T {
  const [value, setValue] = useState<T>(() => load());
  const refresh = useCallback(() => {
    setValue(load());
  }, [load]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return value;
}

export function ClassesScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MyClasses</Text>
        <Text style={styles.title}>{title}</Text>
        <Text variant="body" color={colors.textSecondary} style={styles.subtitle}>
          {subtitle}
        </Text>
      </View>
      {children}
    </ScrollView>
  );
}

export function ClassesHero({
  badge,
  title,
  body,
  actionLabel,
  onAction,
}: {
  badge: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card elevated style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>{badge}</Text>
        </View>
        {actionLabel && onAction ? (
          <Pressable style={styles.heroAction} onPress={onAction}>
            <Text style={styles.heroActionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.heroTitle}>{title}</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.heroBody}>
        {body}
      </Text>
    </Card>
  );
}

export function ClassesMetricRow({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <View style={styles.metricRow}>
      {items.map((item) => (
        <Card key={item.label} style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>
            {item.label}
          </Text>
          <Text style={styles.metricValue}>{item.value}</Text>
        </Card>
      ))}
    </View>
  );
}

export function ClassesSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function ClassesChecklist({
  items,
}: {
  items: ClassesFoundationChecklistItem[];
}) {
  return (
    <Card style={styles.listCard}>
      {items.map((item, index) => (
        <View key={item.id}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.checklistRow}>
            <View
              style={[
                styles.checkDot,
                item.ready ? styles.checkDotReady : styles.checkDotPending,
              ]}
            />
            <View style={styles.checklistCopy}>
              <Text variant="body">{item.label}</Text>
              <Text variant="caption" color={colors.textSecondary} style={styles.checklistBody}>
                {item.description}
              </Text>
            </View>
            <Text
              variant="label"
              color={item.ready ? CLASSES_ACCENT : colors.textTertiary}
            >
              {item.ready ? 'READY' : 'TODO'}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

export function ClassesEmptyCard({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.emptyBody}>
        {body}
      </Text>
      {actionLabel && onAction ? (
        <Pressable style={styles.emptyAction} onPress={onAction}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: CLASSES_ACCENT,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: colors.text,
  },
  subtitle: {
    lineHeight: 21,
  },
  heroCard: {
    backgroundColor: CLASSES_ACCENT_DIM,
    borderColor: CLASSES_ACCENT_BORDER,
    gap: spacing.sm,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(19,24,36,0.55)',
  },
  heroBadgeText: {
    color: CLASSES_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heroAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(19,24,36,0.82)',
  },
  heroActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.text,
  },
  heroBody: {
    lineHeight: 21,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    gap: spacing.xs,
  },
  metricValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: CLASSES_ACCENT,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  listCard: {
    gap: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  checklistRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  checkDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    marginTop: 4,
  },
  checkDotReady: {
    backgroundColor: CLASSES_ACCENT,
  },
  checkDotPending: {
    backgroundColor: colors.textTertiary,
  },
  checklistCopy: {
    flex: 1,
    gap: 4,
  },
  checklistBody: {
    lineHeight: 18,
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: CLASSES_ACCENT_BORDER,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.glass,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.text,
  },
  emptyBody: {
    lineHeight: 21,
  },
  emptyAction: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: CLASSES_ACCENT,
  },
  emptyActionText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
