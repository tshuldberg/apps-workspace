import { StyleSheet, Text, View } from 'react-native';
import { MOOD_SURFACES, MOOD_TYPOGRAPHY } from './tokens';
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
    backgroundColor: MOOD_SURFACES.lift,
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
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  label: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: colors.textSecondary,
  },
});
