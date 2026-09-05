import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BOOKS_SURFACES, BOOKS_TYPOGRAPHY } from './tokens';
import { JAKARTA_FONTS } from './typography';

export interface StatBadgeProps {
  value: string | number;
  label: string;
  icon?: string;
  style?: ViewStyle;
}

export function StatBadge({ value, label, icon, style }: StatBadgeProps) {
  return (
    <View style={[styles.container, style]}>
      {icon != null && <Text style={styles.icon}>{icon}</Text>}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    minWidth: 100,
  },
  icon: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: 4,
  },
  value: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 28,
    color: '#E4E1E9',
    marginBottom: 4,
  },
  label: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 10,
  },
});
