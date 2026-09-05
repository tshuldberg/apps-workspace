import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HEALTH_TYPOGRAPHY, HEALTH_ACCENT, HEALTH_SURFACES } from './tokens';
import { colors } from '@mylife/ui';

interface VitalCardProps {
  label: string;
  value: string | number;
  unit: string;
  icon: string;
  iconColor?: string;
  sparkline?: number[];
  status?: 'normal' | 'warning' | 'critical';
  onPress?: () => void;
}

const STATUS_COLORS = {
  normal: '#34D399',
  warning: '#FBBF24',
  critical: '#EF4444',
} as const;

const STATUS_LABELS = {
  normal: 'Normal',
  warning: 'Warning',
  critical: 'Critical',
} as const;

export function VitalCard({
  label,
  value,
  unit,
  icon,
  iconColor = HEALTH_ACCENT,
  sparkline,
  status,
  onPress,
}: VitalCardProps) {
  const content = (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={[styles.icon, { color: iconColor }]}>{icon}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>

      {sparkline != null && sparkline.length > 0 && (
        <View style={styles.sparklineContainer}>
          {sparkline.map((val, i) => {
            const max = Math.max(...sparkline);
            const height = max > 0 ? Math.max(4, (val / max) * 24) : 4;
            return (
              <View
                key={i}
                style={[
                  styles.sparkBar,
                  {
                    height,
                    backgroundColor: iconColor,
                    opacity: i === sparkline.length - 1 ? 1 : 0.4,
                  },
                ]}
              />
            );
          })}
        </View>
      )}

      {status != null && (
        <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[status]}20` }]}>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]} />
          <Text style={[styles.statusText, { color: STATUS_COLORS[status] }]}>
            {STATUS_LABELS[status]}
          </Text>
        </View>
      )}
    </View>
  );

  if (onPress != null) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: HEALTH_SURFACES.lift,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 18,
    lineHeight: 24,
  },
  label: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  unit: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },
  sparklineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 24,
    marginTop: 4,
  },
  sparkBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
  },
});
