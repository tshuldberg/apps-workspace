import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  getSpots,
  getTides,
} from '@mylife/surf';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.surf;

export default function TidesScreen() {
  const db = useDatabase();
  const spots = useMemo(() => getSpots(db), [db]);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const selectedSpot = spots.find((s) => s.id === selectedSpotId) ?? spots[0] ?? null;

  const now = new Date();
  const startDate = now.toISOString();
  const endDate = new Date(now.getTime() + 7 * 86400000).toISOString();

  // Use spot ID as station ID proxy since tide data is keyed by station
  const tideData = useMemo(
    () => (selectedSpot ? getTides(db, selectedSpot.id, startDate, endDate) : []),
    [db, selectedSpot, startDate, endDate],
  );

  const highs = tideData.filter((t) => t.type === 'high');
  const lows = tideData.filter((t) => t.type === 'low');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Tide Charts</Text>
        <Text variant="caption" color={colors.textSecondary}>
          View tide predictions for your favorite surf spots.
        </Text>
      </Card>

      {/* Spot selector */}
      <View style={styles.chipRow}>
        {spots.slice(0, 10).map((spot) => {
          const selected = spot.id === selectedSpot?.id;
          return (
            <Pressable
              key={spot.id}
              onPress={() => setSelectedSpotId(spot.id)}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                {spot.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tide table */}
      <Card>
        <Text variant="subheading">7-Day Tide Table</Text>
        <View style={styles.list}>
          {tideData.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No tide data available. Tide data is populated when synced from NOAA.
            </Text>
          ) : (
            tideData.map((point, i) => (
              <View key={i} style={styles.tideRow}>
                <View style={[
                  styles.typeBadge,
                  { backgroundColor: point.type === 'high' ? ACCENT : '#3B82F6' },
                ]}>
                  <Text variant="caption" color={colors.background}>
                    {point.type === 'high' ? 'H' : point.type === 'low' ? 'L' : '-'}
                  </Text>
                </View>
                <Text variant="body" style={styles.timeText}>
                  {point.timestamp.slice(0, 16).replace('T', ' ')}
                </Text>
                <Text variant="body" color={ACCENT}>
                  {point.heightFt.toFixed(1)} ft
                </Text>
              </View>
            ))
          )}
        </View>
      </Card>

      {/* Summary stats */}
      {tideData.length > 0 && (
        <Card>
          <Text variant="subheading">Summary</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: ACCENT }]}>{highs.length}</Text>
              <Text variant="caption" color={colors.textSecondary}>High Tides</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#3B82F6' }]}>{lows.length}</Text>
              <Text variant="caption" color={colors.textSecondary}>Low Tides</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Best tide info */}
      {selectedSpot && (
        <Card>
          <Text variant="subheading">Best Tide for {selectedSpot.name}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            This spot works best at {selectedSpot.tide} tide with {selectedSpot.swellDirection} swell.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  tideRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  typeBadge: {
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  timeText: { flex: 1 },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statCard: {
    flex: 1, padding: spacing.sm, borderRadius: 12, alignItems: 'center',
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
});
