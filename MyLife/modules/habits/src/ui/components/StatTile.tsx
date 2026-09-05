import { StyleSheet, Text, View } from 'react-native';
import { HB_ACCENT, HB_TEXT, HB_TEXT_SECONDARY, HB_TYPOGRAPHY, withAlpha } from '../tokens';
import { GlassCard } from './GlassCard';
import { MaterialSymbol } from './MaterialSymbol';

export interface StatTileProps {
  label: string;
  value: string | number;
  delta?: string;
  icon?: string;
  color?: string;
}

export function StatTile({
  label,
  value,
  delta,
  icon,
  color = HB_ACCENT,
}: StatTileProps) {
  return (
    <GlassCard level={3} style={styles.card} contentStyle={styles.inner}>
      <View style={styles.topRow}>
        <Text style={[styles.label, { color: withAlpha(color, 0.82) }]}>
          {label}
        </Text>
        {icon ? (
          <MaterialSymbol
            name={icon}
            size={16}
            color={color}
            filled
          />
        ) : null}
      </View>
      <Text style={[styles.value, { color }]}>
        {value}
      </Text>
      {delta ? (
        <Text style={styles.delta}>
          {delta}
        </Text>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 120,
  },
  inner: {
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...HB_TYPOGRAPHY.labelUpper,
  },
  value: {
    ...HB_TYPOGRAPHY.headlineMd,
    fontSize: 26,
    lineHeight: 30,
  },
  delta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
});
