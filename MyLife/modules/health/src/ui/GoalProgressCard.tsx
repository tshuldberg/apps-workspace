import { StyleSheet, Text, View } from 'react-native';
import { HEALTH_TYPOGRAPHY, HEALTH_ACCENT, HEALTH_SURFACES } from './tokens';
import { colors } from '@mylife/ui';

interface GoalProgressCardProps {
  title: string;
  current: number;
  target: number;
  unit: string;
  color?: string;
}

export function GoalProgressCard({
  title,
  current,
  target,
  unit,
  color = HEALTH_ACCENT,
}: GoalProgressCardProps) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.pct, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.current}>{current.toLocaleString()}</Text>
        <Text style={styles.separator}>/</Text>
        <Text style={styles.target}>{target.toLocaleString()}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: HEALTH_SURFACES.lift,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.text,
  },
  pct: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 16,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  current: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  separator: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  target: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  unit: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: HEALTH_SURFACES.focus,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
});
