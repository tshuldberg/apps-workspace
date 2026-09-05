import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, colors, glass, spacing } from '@mylife/ui';

export const SURF_ACCENT = colors.modules.surf;

export function SurfScreen({
  children,
  contentContainerStyle,
}: PropsWithChildren<{ contentContainerStyle?: StyleProp<ViewStyle> }>) {
  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.backdrop}>
        <LinearGradient
          colors={['rgba(59,130,246,0.28)', 'rgba(59,130,246,0.08)', 'rgba(10,10,15,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGlow}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.01)', 'rgba(10,10,15,0)']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.cornerGlow}
        />
      </View>
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, contentContainerStyle]}>
        {children}
      </ScrollView>
    </View>
  );
}

export function SurfHero({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroHeader}>
        <View style={styles.betaBadge}>
          <Text variant="caption" style={styles.betaText}>
            Beta
          </Text>
        </View>
        {action}
      </View>
      <Text variant="heading" style={styles.heroTitle}>
        {title}
      </Text>
      <Text variant="body" color={colors.textSecondary} style={styles.heroSubtitle}>
        {subtitle}
      </Text>
    </View>
  );
}

export function SurfSection({
  title,
  eyebrow,
  action,
  children,
}: PropsWithChildren<{ title: string; eyebrow?: string; action?: ReactNode }>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          {eyebrow ? (
            <Text variant="caption" color={colors.textTertiary} style={styles.eyebrow}>
              {eyebrow}
            </Text>
          ) : null}
          <Text variant="subheading">{title}</Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

export function SurfGlassCard({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SurfMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <SurfGlassCard style={styles.metricCard}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text variant="heading" style={styles.metricValue}>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" color={colors.textTertiary}>
          {hint}
        </Text>
      ) : null}
    </SurfGlassCard>
  );
}

export function SurfChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text variant="caption" style={{ color: active ? '#03131F' : colors.textSecondary, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SurfPrimaryButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.primaryButton, style]}>
      <Text variant="label" style={styles.primaryButtonText}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SurfEmptyState({
  icon,
  title,
  copy,
  action,
}: {
  icon: string;
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <SurfGlassCard style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text variant="subheading" style={styles.centerText}>
        {title}
      </Text>
      <Text variant="body" color={colors.textSecondary} style={styles.centerText}>
        {copy}
      </Text>
      {action}
    </SurfGlassCard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -60,
    width: 280,
    height: 220,
    borderRadius: 220,
  },
  cornerGlow: {
    position: 'absolute',
    top: 150,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 220,
  },
  hero: {
    borderRadius: 28,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.18)',
    backgroundColor: 'rgba(17,24,39,0.82)',
    overflow: 'hidden',
    gap: spacing.xs,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  betaBadge: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
    backgroundColor: 'rgba(59,130,246,0.14)',
  },
  betaText: {
    color: SURF_ACCENT,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    lineHeight: 40,
  },
  heroSubtitle: {
    lineHeight: 22,
    maxWidth: 280,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  sectionCopy: {
    gap: 2,
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  card: {
    ...glass.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  metricCard: {
    width: '48%',
    minHeight: 112,
    justifyContent: 'space-between',
  },
  metricValue: {
    color: SURF_ACCENT,
    lineHeight: 38,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: 'rgba(59,130,246,0.32)',
    backgroundColor: 'rgba(59,130,246,0.86)',
  },
  primaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: SURF_ACCENT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primaryButtonText: {
    color: '#041019',
    fontWeight: '700',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: spacing.xs,
  },
  centerText: {
    textAlign: 'center',
  },
});
