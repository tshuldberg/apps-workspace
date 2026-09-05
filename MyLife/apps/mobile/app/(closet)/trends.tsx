import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  listClothingItems,
  listDonationCandidates,
  calculateWardrobeValue,
  getClosetDashboard,
  type ClothingItem,
  type ClosetDashboard,
} from '@mylife/closet';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#E879A8';

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function TrendsScreen() {
  const db = useDatabase();

  const items: ClothingItem[] = useMemo(() => {
    try { return listClothingItems(db, {}); } catch { return []; }
  }, [db]);

  const dashboard: ClosetDashboard | null = useMemo(() => {
    try { return getClosetDashboard(db); } catch { return null; }
  }, [db]);

  const donationCandidates: ClothingItem[] = useMemo(() => {
    try { return listDonationCandidates(db); } catch { return []; }
  }, [db]);

  const totalValue = useMemo(() => calculateWardrobeValue(items), [items]);

  // Category distribution
  const categoryCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.status !== 'active') continue;
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]);
  }, [items]);

  // Color distribution
  const colorCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.status !== 'active' || !item.color) continue;
      counts.set(item.color, (counts.get(item.color) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [items]);

  // Usage stats
  const activeItems = items.filter((i) => i.status === 'active');
  const wornItems = activeItems.filter((i) => i.timesWorn > 0);
  const usageRate = activeItems.length > 0
    ? Math.round((wornItems.length / activeItems.length) * 100)
    : 0;

  if (items.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>📈</Text>
        <Text variant="subheading" color={colors.textSecondary}>Trend Analysis</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add items to your wardrobe to see trends and insights.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Trends</Text>

      {/* Key metrics */}
      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Total Items</Text>
          <Text style={styles.metricValue}>{dashboard?.totalItems ?? items.length}</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Wardrobe Value</Text>
          <Text style={styles.metricValue}>{formatCurrency(totalValue)}</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Usage Rate</Text>
          <Text style={styles.metricValue}>{usageRate}%</Text>
        </Card>
      </View>

      {/* Wardrobe health */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>WARDROBE HEALTH</Text>
        <View style={styles.healthBar}>
          <View style={[styles.healthFill, { width: `${usageRate}%`, backgroundColor: usageRate >= 80 ? colors.success : usageRate >= 50 ? '#FF9F0A' : colors.danger }]} />
        </View>
        <Text variant="caption" color={colors.textSecondary}>
          You wear {usageRate}% of your wardrobe ({wornItems.length} of {activeItems.length} items)
        </Text>
        {donationCandidates.length > 0 && (
          <Text variant="caption" color="#FF9F0A" style={{ marginTop: spacing.xs }}>
            Consider donating {donationCandidates.length} unworn item{donationCandidates.length !== 1 ? 's' : ''}
          </Text>
        )}
      </Card>

      {/* Category distribution */}
      {categoryCount.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>CATEGORY DISTRIBUTION</Text>
          {categoryCount.map(([category, count]) => {
            const maxCat = categoryCount[0]?.[1] ?? 1;
            const barW = (count / maxCat) * 100;
            return (
              <View key={category} style={styles.barRow}>
                <Text variant="caption" color={colors.textSecondary} style={styles.barLabel}>
                  {category}
                </Text>
                <View style={styles.barContainer}>
                  <View style={[styles.bar, { width: `${barW}%`, backgroundColor: ACCENT }]} />
                </View>
                <Text variant="iconCaption" color={colors.textTertiary} style={styles.barCount}>
                  {count}
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      {/* Most worn colors */}
      {colorCount.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>MOST WORN COLORS</Text>
          {colorCount.map(([clr, count]) => (
            <View key={clr} style={styles.colorRow}>
              <Text variant="body">{clr}</Text>
              <Text variant="caption" color={colors.textSecondary}>{count} items</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Most worn items */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>MOST WORN ITEMS</Text>
        {activeItems
          .filter((i) => i.timesWorn > 0)
          .sort((a, b) => b.timesWorn - a.timesWorn)
          .slice(0, 5)
          .map((item) => (
            <View key={item.id} style={styles.wornRow}>
              <View style={styles.wornInfo}>
                <Text variant="body">{item.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>{item.category}</Text>
              </View>
              <Text variant="body" style={{ color: ACCENT }}>{item.timesWorn}x</Text>
            </View>
          ))}
        {wornItems.length === 0 && (
          <Text variant="caption" color={colors.textSecondary}>
            No wear data yet. Log outfits to see trends.
          </Text>
        )}
      </Card>
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
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '31.5%', minWidth: 95, gap: spacing.xs },
  metricValue: { color: ACCENT, fontSize: 20, fontWeight: '700' },
  healthBar: {
    height: 10, borderRadius: 5, backgroundColor: colors.surfaceElevated,
    overflow: 'hidden', marginVertical: spacing.sm,
  },
  healthFill: { height: 10, borderRadius: 5 },
  barRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4,
  },
  barLabel: { width: 80 },
  barContainer: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: colors.surfaceElevated, overflow: 'hidden',
  },
  bar: { height: 8, borderRadius: 4 },
  barCount: { width: 30, textAlign: 'right' },
  colorRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4,
  },
  wornRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  wornInfo: { flex: 1, gap: 2 },
});
