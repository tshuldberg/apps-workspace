import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  listClothingItems,
  detectCurrentSeason,
  getItemsToStore,
  getItemsToActivate,
  getPreviousSeason,
  type ClothingItem,
  type Season,
} from '@mylife/closet';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#E879A8';

const SEASON_ICONS: Record<string, string> = {
  spring: '🌸', summer: '☀️', fall: '🍂', winter: '❄️',
};

export default function RotationScreen() {
  const db = useDatabase();

  const items: ClothingItem[] = useMemo(() => {
    try { return listClothingItems(db, {}); } catch { return []; }
  }, [db]);

  const currentSeason: Season = useMemo(
    () => detectCurrentSeason(new Date()),
    [],
  );

  const previousSeason = useMemo(() => getPreviousSeason(currentSeason), [currentSeason]);

  const toStore: ClothingItem[] = useMemo(
    () => getItemsToStore(items, previousSeason, currentSeason),
    [items, previousSeason, currentSeason],
  );

  const toActivate: ClothingItem[] = useMemo(
    () => getItemsToActivate(items, currentSeason),
    [items, currentSeason],
  );

  const activeItems = useMemo(() => items.filter((i) => i.status === 'active'), [items]);
  const storedItems = useMemo(() => items.filter((i) => i.status === 'stored'), [items]);

  const seasons: Season[] = ['spring', 'summer', 'fall', 'winter'];

  if (items.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>🔄</Text>
        <Text variant="subheading" color={colors.textSecondary}>Seasonal Rotation</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add items to your wardrobe to see rotation suggestions.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Seasonal Rotation</Text>

      <Card>
        <Text variant="label" color={colors.textTertiary}>CURRENT SEASON</Text>
        <Text style={styles.seasonLabel}>
          {SEASON_ICONS[currentSeason] ?? ''} {currentSeason.charAt(0).toUpperCase() + currentSeason.slice(1)}
        </Text>
      </Card>

      {/* Season grid */}
      <View style={styles.seasonGrid}>
        {seasons.map((s) => {
          const count = items.filter((i) => {
            return i.seasons.includes(s);
          }).length;
          const isCurrent = s === currentSeason;
          return (
            <Card
              key={s}
              style={[styles.seasonCard, isCurrent && { borderColor: ACCENT, borderWidth: 2 }]}
            >
              <Text style={styles.seasonIcon}>{SEASON_ICONS[s] ?? ''}</Text>
              <Text variant="caption" color={isCurrent ? ACCENT : colors.textSecondary}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
              <Text variant="body" style={{ color: ACCENT }}>{count}</Text>
              <Text variant="iconCaption" color={colors.textTertiary}>items</Text>
            </Card>
          );
        })}
      </View>

      {/* Status summary */}
      <View style={styles.metricsRow}>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Active</Text>
          <Text style={styles.metricValue}>{activeItems.length}</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Stored</Text>
          <Text style={styles.metricValue}>{storedItems.length}</Text>
        </Card>
      </View>

      {/* Items to store */}
      {toStore.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>CONSIDER STORING</Text>
          <Text variant="caption" color={colors.textSecondary}>
            These {previousSeason} items could be rotated out
          </Text>
          {toStore.slice(0, 10).map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text variant="body">{item.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>{item.category}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Items to activate */}
      {toActivate.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>BRING OUT FOR {currentSeason.toUpperCase()}</Text>
          {toActivate.slice(0, 10).map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text variant="body">{item.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>{item.category}</Text>
            </View>
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
  seasonLabel: { fontSize: 24, color: ACCENT, fontWeight: '600', marginTop: spacing.xs },
  seasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  seasonCard: { width: '47%', alignItems: 'center', gap: 4 },
  seasonIcon: { fontSize: 28 },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1, gap: spacing.xs },
  metricValue: { color: ACCENT, fontSize: 24, fontWeight: '700' },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
});
