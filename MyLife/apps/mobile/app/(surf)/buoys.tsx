import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  getStationsForZone,
  SEED_ZONES,
  getLatestBuoyReading,
  getRecentBuoyReadings,
} from '@mylife/surf';
import type { SeedZone } from '@mylife/surf';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.surf;

export default function BuoysScreen() {
  const db = useDatabase();
  const [selectedZone, setSelectedZone] = useState<SeedZone>(SEED_ZONES[0]);

  const stations = useMemo(
    () => getStationsForZone(selectedZone.id),
    [selectedZone],
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text variant="subheading">Buoy Explorer</Text>
        <Text variant="caption" color={colors.textSecondary}>
          NOAA buoy readings for wave, wind, and water temperature data.
        </Text>
      </Card>

      {/* Zone selector */}
      <View style={styles.chipRow}>
        {SEED_ZONES.map((zone) => {
          const selected = zone.id === selectedZone.id;
          return (
            <Pressable
              key={zone.id}
              onPress={() => setSelectedZone(zone)}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                {zone.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Buoy stations */}
      <Card>
        <Text variant="subheading">{selectedZone.name} Buoys</Text>
        <View style={styles.list}>
          {!stations || stations.buoys.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No buoy stations mapped for this zone.
            </Text>
          ) : (
            stations.buoys.map((buoy) => {
              const reading = getLatestBuoyReading(db, buoy.id);
              return (
                <View key={buoy.id} style={styles.buoyRow}>
                  <View style={styles.mainCopy}>
                    <Text variant="body">{buoy.name}</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      Station: {buoy.id}
                    </Text>
                  </View>
                  {reading ? (
                    <View style={styles.readingData}>
                      {reading.waveHeightFt != null && (
                        <Text variant="body" color={ACCENT}>{reading.waveHeightFt.toFixed(1)}ft</Text>
                      )}
                      {reading.dominantPeriodSeconds != null && (
                        <Text variant="caption" color={colors.textSecondary}>{reading.dominantPeriodSeconds}s</Text>
                      )}
                      {reading.waterTempF != null && (
                        <Text variant="caption" color={colors.textSecondary}>{reading.waterTempF}F</Text>
                      )}
                    </View>
                  ) : (
                    <Text variant="caption" color={colors.textTertiary}>No data</Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      </Card>

      {/* Tide stations */}
      <Card>
        <Text variant="subheading">{selectedZone.name} Tide Stations</Text>
        <View style={styles.list}>
          {stations?.tideStations.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No tide stations mapped for this zone.
            </Text>
          ) : (
            stations?.tideStations.map((station) => (
              <View key={station.id} style={styles.buoyRow}>
                <Text variant="body">{station.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>Station: {station.id}</Text>
              </View>
            ))
          )}
        </View>
      </Card>
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
  buoyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  mainCopy: { flex: 1, gap: 2 },
  readingData: { alignItems: 'flex-end', gap: 2 },
});
