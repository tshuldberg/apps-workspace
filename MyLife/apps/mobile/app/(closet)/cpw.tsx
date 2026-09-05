import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  listClothingItems,
  logWearEvent,
  getCPWLeaderboard,
  getCPWSummary,
  type ClothingItem,
  type CPWLeaderboardEntry,
  type CPWSummary,
} from '@mylife/closet';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#E879A8';

function cpwColor(cpwCents: number): string {
  const cpw = cpwCents / 100;
  if (cpw < 1) return colors.success;
  if (cpw <= 5) return '#FF9F0A';
  return colors.danger;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CPWScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const items: ClothingItem[] = useMemo(() => {
    try { return listClothingItems(db, {}); } catch { return []; }
  }, [db, tick]);

  const bestItems: CPWLeaderboardEntry[] = useMemo(() => {
    try { return getCPWLeaderboard(items, 'asc', 5); } catch { return []; }
  }, [items]);

  const worstItems: CPWLeaderboardEntry[] = useMemo(() => {
    try { return getCPWLeaderboard(items, 'desc', 5); } catch { return []; }
  }, [items]);

  const summary: CPWSummary | null = useMemo(() => {
    try { return getCPWSummary(items); } catch { return null; }
  }, [items]);

  const handleLogWear = (item: ClothingItem) => {
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      logWearEvent(db, id, { itemIds: [item.id] });
      refresh();
    } catch {
      Alert.alert('Error', "Couldn't log wear.");
    }
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>💰</Text>
        <Text variant="subheading" color={colors.textSecondary}>Cost Per Wear</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add items to your wardrobe to calculate CPW.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Cost Per Wear</Text>

      {/* Summary */}
      {summary && (
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <Text variant="caption" color={colors.textSecondary}>Total Value</Text>
            <Text style={styles.metricValue}>{formatCurrency(summary.totalValueCents)}</Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text variant="caption" color={colors.textSecondary}>Avg CPW</Text>
            <Text style={styles.metricValue}>
              {summary.averageCPWCents != null ? formatCurrency(summary.averageCPWCents) : '--'}
            </Text>
          </Card>
          <Card style={styles.metricCard}>
            <Text variant="caption" color={colors.textSecondary}>Median CPW</Text>
            <Text style={styles.metricValue}>
              {summary.medianCPWCents != null ? formatCurrency(summary.medianCPWCents) : '--'}
            </Text>
          </Card>
        </View>
      )}

      {/* Best value */}
      {bestItems.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>BEST VALUE (LOWEST CPW)</Text>
          {bestItems.map((entry) => {
            const item = items.find((it) => it.id === entry.itemId);
            return (
              <View key={entry.itemId} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text variant="body">{entry.itemName}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {formatCurrency(entry.purchasePriceCents)} - {entry.timesWorn} wear{entry.timesWorn !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.itemMeta}>
                  <View style={[styles.cpwBadge, { backgroundColor: cpwColor(entry.costPerWearCents) }]}>
                    <Text variant="iconCaption" color={colors.background}>
                      {formatCurrency(entry.costPerWearCents)}
                    </Text>
                  </View>
                  {item && (
                    <Pressable
                      style={styles.wearButton}
                      onPress={() => handleLogWear(item)}
                    >
                      <Text variant="iconCaption" color={ACCENT}>+Wear</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </Card>
      )}

      {/* Worst value */}
      {worstItems.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>HIGHEST CPW</Text>
          {worstItems.map((entry) => {
            const item = items.find((it) => it.id === entry.itemId);
            return (
              <View key={entry.itemId} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text variant="body">{entry.itemName}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {formatCurrency(entry.purchasePriceCents)} - {entry.timesWorn} wear{entry.timesWorn !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.itemMeta}>
                  <View style={[styles.cpwBadge, { backgroundColor: cpwColor(entry.costPerWearCents) }]}>
                    <Text variant="iconCaption" color={colors.background}>
                      {formatCurrency(entry.costPerWearCents)}
                    </Text>
                  </View>
                  {item && (
                    <Pressable
                      style={styles.wearButton}
                      onPress={() => handleLogWear(item)}
                    >
                      <Text variant="iconCaption" color={ACCENT}>+Wear</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
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
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '31.5%', minWidth: 95, gap: spacing.xs },
  metricValue: { color: ACCENT, fontSize: 20, fontWeight: '700' },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  itemInfo: { flex: 1, gap: 2 },
  itemMeta: { alignItems: 'flex-end', gap: 4 },
  cpwBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  wearButton: {
    borderWidth: 1, borderColor: ACCENT, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
});
