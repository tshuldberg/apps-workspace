import { StyleSheet, Text, View } from 'react-native';
import { HEALTH_SURFACES, HEALTH_TYPOGRAPHY } from './tokens';
import { colors } from '@mylife/ui';

interface StatBadgeProps {
  value: string | number;
  label: string;
  icon?: string;
}

export function StatBadge({ value, label, icon }: StatBadgeProps) {
  return (
    <View style={styles.container}>
      {icon != null && <Text style={styles.icon}>{icon}</Text>}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: HEALTH_SURFACES.lift,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 4,
    minWidth: 80,
  },
  icon: {
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 2,
  },
  value: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  label: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
});
