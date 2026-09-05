import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  listClothingItems,
  getColorDistribution,
  getColorDistributionByCategory,
  generateColorInsights,
  getColorHarmonyPairs,
  type ColorDistributionEntry,
  type ColorCategory,
} from '@mylife/closet';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#E879A8';

const COLOR_HEX: Record<string, string> = {
  black: '#1A1A1A', white: '#F5F5F5', gray: '#9E9E9E', blue: '#4A90D9',
  red: '#E74C3C', green: '#2ECC71', pink: '#E879A8', yellow: '#F1C40F',
  orange: '#E67E22', purple: '#9B59B6', brown: '#8B6914', multi: '#C0C0C0',
  unknown: '#555555',
};

export default function ColorAnalysisScreen() {
  const db = useDatabase();

  const items = useMemo(() => {
    try { return listClothingItems(db, {}); } catch { return []; }
  }, [db]);

  const distribution: ColorDistributionEntry[] = useMemo(() => {
    try { return getColorDistribution(items); } catch { return []; }
  }, [items]);

  const insights = useMemo(() => {
    try { return generateColorInsights(distribution); } catch { return []; }
  }, [distribution]);

  const harmonyPairs = useMemo(() => {
    try { return getColorHarmonyPairs(distribution); } catch { return []; }
  }, [distribution]);

  if (items.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>🎨</Text>
        <Text variant="subheading" color={colors.textSecondary}>Color Palette Analysis</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add items to your wardrobe to see your color palette.
        </Text>
      </View>
    );
  }

  const maxCount = distribution.length > 0 ? Math.max(...distribution.map((d) => d.count)) : 1;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Color Palette</Text>

      {/* Color grid */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>YOUR PALETTE</Text>
        <View style={styles.paletteGrid}>
          {distribution.slice(0, 12).map((entry) => (
            <View key={entry.color} style={styles.swatchCell}>
              <View style={[styles.swatch, { backgroundColor: COLOR_HEX[entry.color] ?? colors.surfaceElevated }]} />
              <Text variant="iconCaption" color={colors.textSecondary}>
                {entry.color}
              </Text>
              <Text variant="iconCaption" color={colors.textTertiary}>
                {entry.count}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Distribution bars */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>COLOR DISTRIBUTION</Text>
        {distribution.slice(0, 10).map((entry) => {
          const barW = (entry.count / maxCount) * 100;
          return (
            <View key={entry.color} style={styles.barRow}>
              <Text variant="caption" color={colors.textSecondary} style={styles.barLabel}>
                {entry.color}
              </Text>
              <View style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    { width: `${barW}%`, backgroundColor: COLOR_HEX[entry.color] ?? ACCENT },
                  ]}
                />
              </View>
              <Text variant="iconCaption" color={colors.textTertiary} style={styles.barCount}>
                {entry.count}
              </Text>
            </View>
          );
        })}
      </Card>

      {/* Harmony pairs */}
      {harmonyPairs.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>COLOR HARMONY</Text>
          <Text variant="caption" color={colors.textSecondary}>
            Complementary colors found in your wardrobe
          </Text>
          {harmonyPairs.slice(0, 5).map((pair, i) => (
            <View key={i} style={styles.pairRow}>
              <View style={[styles.pairSwatch, { backgroundColor: COLOR_HEX[pair[0]] ?? colors.surfaceElevated }]} />
              <Text variant="caption" color={colors.textSecondary}>+</Text>
              <View style={[styles.pairSwatch, { backgroundColor: COLOR_HEX[pair[1]] ?? colors.surfaceElevated }]} />
              <Text variant="caption" color={colors.textSecondary}>
                {pair[0]} & {pair[1]}
              </Text>
            </View>
          ))}
        </Card>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>INSIGHTS</Text>
          {insights.map((insight, i) => (
            <Text key={i} variant="body" color={colors.textSecondary} style={styles.insightText}>
              {insight}
            </Text>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  emptyScreen: {
    flex: 1, backgroundColor: colors.background, justifyContent: 'center',
    alignItems: 'center', padding: spacing.xl,
  },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  paletteGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm,
  },
  swatchCell: { alignItems: 'center', gap: 2, width: 60 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  barRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4,
  },
  barLabel: { width: 70 },
  barContainer: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: colors.surfaceElevated, overflow: 'hidden',
  },
  bar: { height: 8, borderRadius: 4 },
  barCount: { width: 30, textAlign: 'right' },
  pairRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4,
  },
  pairSwatch: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  },
  insightText: { paddingVertical: 4 },
});
