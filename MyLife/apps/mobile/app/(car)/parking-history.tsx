import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  getVehicles,
  getParkingHistory,
  getActiveParking,
  getMeterStatus,
  isStaleParking,
  calculateWalkingTime,
  type ParkingLocation,
  type MeterStatus,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.car;

function meterColor(status: MeterStatus): string {
  switch (status) {
    case 'active': return colors.success;
    case 'expiring_soon': return '#FF9F0A';
    case 'expired': return colors.danger;
    case 'no_meter': return colors.textSecondary;
    default: return colors.textSecondary;
  }
}

function meterLabel(status: MeterStatus): string {
  switch (status) {
    case 'active': return 'Meter Active';
    case 'expiring_soon': return 'Expiring Soon';
    case 'expired': return 'Meter Expired';
    case 'no_meter': return 'No Meter';
    default: return 'Unknown';
  }
}

export default function ParkingHistoryScreen() {
  const db = useDatabase();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const vehicles = useMemo(() => {
    try { return getVehicles(db); } catch { return []; }
  }, [db, tick]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [selectedVehicleId, vehicles],
  );

  const activeParking: ParkingLocation | null = useMemo(() => {
    if (!selectedVehicle) return null;
    try { return getActiveParking(db, selectedVehicle.id); } catch { return null; }
  }, [db, selectedVehicle, tick]);

  const history: ParkingLocation[] = useMemo(() => {
    if (!selectedVehicle) return [];
    try { return getParkingHistory(db, selectedVehicle.id); } catch { return []; }
  }, [db, selectedVehicle, tick]);

  const now = new Date().toISOString();

  if (vehicles.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>🅿️</Text>
        <Text variant="subheading" color={colors.textSecondary}>Parking History</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add a vehicle in the Garage tab first.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Parking</Text>

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

      {/* Active parking */}
      {activeParking && (
        <Card style={styles.activeCard}>
          <Text variant="label" color={colors.textTertiary}>CURRENTLY PARKED</Text>
          <View style={styles.parkingInfo}>
            <Text variant="subheading">
              {activeParking.spot ?? `${activeParking.latitude.toFixed(4)}, ${activeParking.longitude.toFixed(4)}`}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              Parked: {new Date(activeParking.savedAt).toLocaleString()}
            </Text>
            {(() => {
              const status = getMeterStatus(activeParking.meterExpiresAt, now);
              return (
                <View style={styles.meterRow}>
                  <View style={[styles.meterDot, { backgroundColor: meterColor(status) }]} />
                  <Text variant="caption" color={meterColor(status)}>
                    {meterLabel(status)}
                  </Text>
                </View>
              );
            })()}
            {activeParking.notes && (
              <Text variant="caption" color={colors.textTertiary}>{activeParking.notes}</Text>
            )}
          </View>
        </Card>
      )}

      <Pressable style={styles.parkButton} onPress={refresh}>
        <Text variant="label" color={colors.background}>Park Here</Text>
      </Pressable>

      {/* History */}
      <Text variant="label" color={colors.textTertiary} style={styles.sectionHeader}>
        PARKING HISTORY
      </Text>
      {history.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <Text variant="body" color={colors.textSecondary}>No parking history yet.</Text>
          </View>
        </Card>
      ) : (
        history.map((loc) => {
          const stale = isStaleParking(loc.savedAt, now);
          const mStatus = getMeterStatus(loc.meterExpiresAt, now);
          const walkMin = calculateWalkingTime(500); // estimate 500 meters
          return (
            <Card
              key={loc.id}
              style={[styles.historyCard, stale && styles.staleCard]}
            >
              <View style={styles.historyRow}>
                <View style={styles.historyInfo}>
                  <Text variant="body" color={stale ? colors.textTertiary : colors.text}>
                    {loc.spot ?? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {new Date(loc.savedAt).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.historyMeta}>
                  <View style={[styles.meterBadge, { backgroundColor: meterColor(mStatus) }]}>
                    <Text variant="iconCaption" color={colors.background}>
                      {meterLabel(mStatus)}
                    </Text>
                  </View>
                  <Text variant="iconCaption" color={colors.textTertiary}>
                    ~{walkMin}min walk
                  </Text>
                </View>
              </View>
            </Card>
          );
        })
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceElevated, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  activeCard: { borderWidth: 1, borderColor: ACCENT },
  parkingInfo: { marginTop: spacing.sm, gap: 4 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meterDot: { width: 8, height: 8, borderRadius: 4 },
  parkButton: {
    backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', minHeight: 48, justifyContent: 'center',
  },
  sectionHeader: { marginTop: spacing.lg, marginBottom: spacing.xs },
  emptyState: { paddingVertical: spacing.md, alignItems: 'center' },
  historyCard: { backgroundColor: colors.surfaceElevated },
  staleCard: { opacity: 0.5 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyInfo: { flex: 1, gap: 2 },
  historyMeta: { alignItems: 'flex-end', gap: 4 },
  meterBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
});
