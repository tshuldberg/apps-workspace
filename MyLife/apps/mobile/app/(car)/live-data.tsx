import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  getVehicles,
  getRecentLiveData,
  getStandardPids,
  type LiveDataLog,
  type OBDPid,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.car;

function gaugeColor(value: number, max: number): string {
  const ratio = value / max;
  if (ratio < 0.5) return colors.success;
  if (ratio < 0.8) return '#FF9F0A';
  return colors.danger;
}

export default function LiveDataScreen() {
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

  const liveData: LiveDataLog[] = useMemo(() => {
    if (!selectedVehicle) return [];
    try { return getRecentLiveData(db, selectedVehicle.id, 50); } catch { return []; }
  }, [db, selectedVehicle, tick]);

  const pids: OBDPid[] = useMemo(() => {
    try { return getStandardPids(); } catch { return []; }
  }, []);

  // Deduplicate: show most recent value per PID
  const latestByPid = useMemo(() => {
    const map = new Map<string, LiveDataLog>();
    for (const ld of liveData) {
      const existing = map.get(ld.pid);
      if (!existing || ld.loggedAt > existing.loggedAt) {
        map.set(ld.pid, ld);
      }
    }
    return Array.from(map.values());
  }, [liveData]);

  // PID gauge configs
  const GAUGE_PIDS = [
    { pid: '010C', label: 'RPM', max: 8000, unit: 'RPM' },
    { pid: '0105', label: 'Coolant', max: 250, unit: 'F' },
    { pid: '010D', label: 'Speed', max: 160, unit: 'mph' },
    { pid: '0110', label: 'MAF', max: 500, unit: 'g/s' },
    { pid: '0111', label: 'Throttle', max: 100, unit: '%' },
    { pid: '0104', label: 'Load', max: 100, unit: '%' },
  ];

  if (vehicles.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>📡</Text>
        <Text variant="subheading" color={colors.textSecondary}>Live OBD-II Data</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add a vehicle in the Garage tab to start reading live data.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Live Data</Text>

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

      <Pressable style={styles.refreshButton} onPress={refresh}>
        <Text variant="label" color={colors.background}>Refresh Data</Text>
      </Pressable>

      {/* Gauge grid */}
      <View style={styles.gaugeGrid}>
        {GAUGE_PIDS.map((gp) => {
          const reading = latestByPid.find((ld) => ld.pid === gp.pid);
          const value = reading?.value ?? 0;
          const barWidth = Math.min(100, (value / gp.max) * 100);
          return (
            <Card key={gp.pid} style={styles.gaugeCard}>
              <Text variant="caption" color={colors.textSecondary}>{gp.label}</Text>
              <Text style={[styles.gaugeValue, { color: ACCENT }]}>
                {reading ? value.toFixed(0) : '--'}
              </Text>
              <Text variant="iconCaption" color={colors.textTertiary}>{gp.unit}</Text>
              <View style={styles.gaugeBar}>
                <View
                  style={[
                    styles.gaugeFill,
                    {
                      width: `${barWidth}%`,
                      backgroundColor: reading ? gaugeColor(value, gp.max) : colors.surfaceElevated,
                    },
                  ]}
                />
              </View>
              {reading && (
                <Text variant="iconCaption" color={colors.textTertiary}>
                  {new Date(reading.loggedAt).toLocaleTimeString()}
                </Text>
              )}
            </Card>
          );
        })}
      </View>

      {/* All readings */}
      {latestByPid.length > 0 && (
        <>
          <Text variant="label" color={colors.textTertiary} style={styles.sectionHeader}>
            ALL READINGS
          </Text>
          {latestByPid.map((ld) => (
            <View key={ld.id} style={styles.readingRow}>
              <View style={styles.readingInfo}>
                <Text variant="body">{ld.pidName ?? ld.pid}</Text>
                <Text variant="iconCaption" color={colors.textTertiary}>
                  {new Date(ld.loggedAt).toLocaleTimeString()}
                </Text>
              </View>
              <Text variant="body" style={{ color: ACCENT }}>
                {ld.value.toFixed(1)}{ld.unit ? ` ${ld.unit}` : ''}
              </Text>
            </View>
          ))}
        </>
      )}

      {liveData.length === 0 && (
        <Card>
          <View style={styles.emptyState}>
            <Text variant="body" color={colors.textSecondary}>No live data recorded yet.</Text>
            <Text variant="caption" color={colors.textTertiary}>
              Connect an OBD-II adapter to read live sensor data.
            </Text>
          </View>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceElevated, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  refreshButton: {
    backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
  gaugeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  gaugeCard: {
    width: '48%', minWidth: 140, alignItems: 'center', gap: 4,
  },
  gaugeValue: { fontSize: 28, fontWeight: '700' },
  gaugeBar: {
    width: '100%', height: 6, borderRadius: 3,
    backgroundColor: colors.surfaceElevated, overflow: 'hidden',
  },
  gaugeFill: { height: 6, borderRadius: 3 },
  sectionHeader: { marginTop: spacing.lg, marginBottom: spacing.xs },
  readingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceElevated, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  readingInfo: { flex: 1, gap: 2 },
  emptyState: { paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm },
});
