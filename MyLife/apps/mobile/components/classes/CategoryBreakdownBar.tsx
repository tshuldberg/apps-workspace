import { StyleSheet, View } from 'react-native';
import { Text, colors, spacing } from '@mylife/ui';
import type { CategoryRollup } from '@mylife/classes';

export interface CategoryBreakdownBarProps {
  categories: Record<string, CategoryRollup>;
  accent: string;
}

/**
 * Slim per-category bars showing earned/possible % per assignment type.
 * Empty buckets are omitted. Renders nothing if no categories present.
 */
export function CategoryBreakdownBar({ categories, accent }: CategoryBreakdownBarProps) {
  const entries = Object.entries(categories)
    .filter(([, r]) => r.possible > 0 && r.percent !== null)
    .sort((a, b) => (b[1].percent ?? 0) - (a[1].percent ?? 0));

  if (entries.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {entries.map(([key, rollup]) => {
        const pct = Math.max(0, Math.min(100, rollup.percent ?? 0));
        return (
          <View key={key} style={styles.row}>
            <View style={styles.labelRow}>
              <Text variant="caption" color={colors.textSecondary} style={styles.key}>
                {key}
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                {pct.toFixed(0)}%
              </Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${pct}%`, backgroundColor: accent },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { gap: 4 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  key: { textTransform: 'capitalize' },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
});
