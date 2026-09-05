import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import { GARDEN_ACCENT, GARDEN_SURFACES, GARDEN_TYPOGRAPHY, GARDEN_DANGER } from './tokens';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  trend?: number;
}

export function StatCard({ label, value, icon, color, trend }: StatCardProps) {
  const accent = color ?? GARDEN_ACCENT;
  const trendColor = trend == null || trend === 0
    ? colors.textTertiary
    : trend > 0
      ? GARDEN_ACCENT
      : GARDEN_DANGER;
  const trendArrow = trend == null || trend === 0 ? '' : trend > 0 ? '↑' : '↓';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.value, { color: accent }]} numberOfLines={1}>
          {value}
        </Text>
        {icon != null && <Text style={styles.icon}>{icon}</Text>}
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {trend != null && trend !== 0 && (
        <Text style={[styles.trend, { color: trendColor }]}>
          {trendArrow} {Math.abs(trend)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    minWidth: 88,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  value: {
    ...GARDEN_TYPOGRAPHY.displayLg,
    fontSize: 26,
    letterSpacing: -0.02 * 26,
  },
  icon: {
    fontSize: 16,
    lineHeight: 22,
    opacity: 0.6,
  },
  label: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  trend: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    marginTop: 2,
  },
});
