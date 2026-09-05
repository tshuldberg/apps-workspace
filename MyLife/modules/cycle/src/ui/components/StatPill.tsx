import { StyleSheet, Text, View } from 'react-native';
import { CYCLE_FONTS } from '../typography';
import { CYCLE_SURFACES } from '../tokens';

interface StatPillProps {
  label: string;
  value: string;
  accent?: string;
}

/**
 * Compact stat pill with uppercase label and bold value.
 * Used in analytics, history headers, and predictions.
 */
export function StatPill({ label, value, accent }: StatPillProps) {
  return (
    <View style={styles.pill}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, accent ? { color: accent } : null]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: CYCLE_SURFACES.low,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
    gap: 2,
  },
  label: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(214, 195, 181, 0.7)',
  },
  value: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 16,
    color: '#E4E1E9',
    letterSpacing: -0.2,
  },
});
