import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import {
  RECIPES_ACCENT,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from './tokens';

interface StatBadgeProps {
  value: string | number;
  label: string;
  icon?: string;
  iconColor?: string;
}

export function StatBadge({ value, label, icon, iconColor }: StatBadgeProps) {
  return (
    <View style={styles.container}>
      {icon != null && (
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: `${iconColor ?? RECIPES_ACCENT}22` },
          ]}
        >
          <Text style={styles.icon}>{icon}</Text>
        </View>
      )}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
    minWidth: 88,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  icon: {
    fontSize: 18,
    lineHeight: 24,
  },
  value: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  label: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
});
