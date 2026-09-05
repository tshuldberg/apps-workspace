import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  getVehicles,
  getGpsTripsByVehicle,
  metersToMiles,
  type GpsTrip,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.car;

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatDistance(meters: number): string {
  return `${metersToMiles(meters).toFixed(1)} mi`;
}

export default function GpsDashboardScreen() {
  const db = useDatabase();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const vehicles = useMemo(() => {
    try { return getVehicles(db); } catch { return []; }
  }, [db]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [selectedVehicleId, vehicles],
  );

  const trips: GpsTrip[] = useMemo(() => {
    if (!selectedVehicle) return [];
    try { return getGpsTripsByVehicle(db, selectedVehicle.id); } catch { return []; }
  }, [db, selectedVehicle]);

  const totalDistance = useMemo(
    () => trips.reduce((sum, t) => sum + t.distanceMeters, 0),
    [trips],
  );

  const totalDuration = useMemo(
    () => trips.reduce((sum, t) => sum + t.durationSeconds, 0),
    [trips],
  );

  if (vehicles.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>📍</Text>
        <Text variant="subheading" color={colors.textSecondary}>GPS Trip Dashboard</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add a vehicle in the Garage tab to start tracking trips.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>GPS Trips</Text>

      <Card>
        <Text variant="label" color={colors.textTertiary}>VEHICLE</Text>
        <View style={styles.chipRow}>
          {vehicles.map((v) => {
            const selected = selectedVehicle?.id === v.id;
            return (
              <Pressable
                key={v.id}
                style={[styles.chip, selected && { backgroundColor: ACCENT }]}
                onPress={() => setSelectedVehicleId(v.id)}
              >
                <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                  {v.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Total Distance</Text>
          <Text style={styles.metricValue}>{formatDistance(totalDistance)}</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Total Time</Text>
          <Text style={styles.metricValue}>{formatDuration(totalDuration)}</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Trips</Text>
          <Text style={styles.metricValue}>{trips.length}</Text>
        </Card>
      </View>

      {trips.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <Text variant="body" color={colors.textSecondary}>No GPS trips recorded yet.</Text>
            <Text variant="caption" color={colors.textTertiary}>
              Use the Start Trip button to begin recording.
            </Text>
          </View>
        </Card>
      ) : (
        trips.map((trip) => {
          const avgSpeed = trip.durationSeconds > 0
            ? (metersToMiles(trip.distanceMeters) / (trip.durationSeconds / 3600)).toFixed(1)
            : '0';
          return (
            <Card key={trip.id} style={styles.tripCard}>
              <View style={styles.tripRow}>
                <View style={styles.tripInfo}>
                  <Text variant="body">{trip.routeName ?? 'Trip'}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {new Date(trip.startedAt).toLocaleDateString()} - {trip.purpose}
                  </Text>
                </View>
                <View style={styles.tripStats}>
                  <Text variant="body" style={{ color: ACCENT }}>
                    {formatDistance(trip.distanceMeters)}
                  </Text>
                  <Text variant="iconCaption" color={colors.textTertiary}>
                    {formatDuration(trip.durationSeconds)} - {avgSpeed} mph avg
                  </Text>
                </View>
              </View>
            </Card>
          );
        })
      )}

      <Pressable style={styles.startButton}>
        <Text variant="label" color={colors.background}>Start Trip</Text>
      </Pressable>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceElevated, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '31.5%', minWidth: 95, gap: spacing.xs },
  metricValue: { color: ACCENT, fontSize: 20, fontWeight: '700' },
  emptyState: { paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm },
  tripCard: { backgroundColor: colors.surfaceElevated },
  tripRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripInfo: { flex: 1, gap: 2 },
  tripStats: { alignItems: 'flex-end', gap: 2 },
  startButton: {
    backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', minHeight: 48, justifyContent: 'center',
  },
});
