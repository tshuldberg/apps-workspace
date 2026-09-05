import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getVehicles,
  getSnapshotsByVehicle,
  getCodesBySnapshot,
  type DiagnosticSnapshot,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.car;

function severityColor(codeCount: number): string {
  if (codeCount === 0) return colors.success;
  if (codeCount <= 3) return '#FF9F0A';
  return colors.danger;
}

function severityLabel(codeCount: number): string {
  if (codeCount === 0) return 'Clear';
  if (codeCount <= 3) return 'Warning';
  return 'Critical';
}

export default function DiagnosticsScreen() {
  const db = useDatabase();
  const router = useRouter();
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

  const snapshots: DiagnosticSnapshot[] = useMemo(() => {
    if (!selectedVehicle) return [];
    try { return getSnapshotsByVehicle(db, selectedVehicle.id); } catch { return []; }
  }, [db, selectedVehicle, tick]);

  const snapshotCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const snap of snapshots) {
      try {
        counts[snap.id] = getCodesBySnapshot(db, snap.id).length;
      } catch {
        counts[snap.id] = 0;
      }
    }
    return counts;
  }, [db, snapshots]);

  if (vehicles.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>🔧</Text>
        <Text variant="subheading" color={colors.textSecondary}>OBD-II Diagnostics</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add a vehicle in the Garage tab to start scanning.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Diagnostics</Text>

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

      <Pressable style={styles.scanButton} onPress={refresh}>
        <Text variant="label" color={colors.background}>New Scan</Text>
      </Pressable>

      {snapshots.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <Text variant="body" color={colors.textSecondary}>No diagnostic snapshots yet.</Text>
            <Text variant="caption" color={colors.textTertiary}>
              Connect an OBD-II adapter and run a scan.
            </Text>
          </View>
        </Card>
      ) : (
        snapshots.map((snap) => {
          const count = snapshotCounts[snap.id] ?? 0;
          const sColor = severityColor(count);
          return (
            <Pressable
              key={snap.id}
              onPress={() => router.push(`/(car)/diagnostics/${snap.id}`)}
            >
              <Card style={styles.snapshotCard}>
                <View style={styles.snapshotRow}>
                  <View style={styles.snapshotInfo}>
                    <Text variant="body">
                      {new Date(snap.snapshotAt).toLocaleDateString()}
                    </Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {selectedVehicle?.name} {snap.protocol ? `- ${snap.protocol}` : ''}
                    </Text>
                  </View>
                  <View style={styles.snapshotMeta}>
                    <Text variant="caption" color={colors.textSecondary}>
                      {count} code{count !== 1 ? 's' : ''}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: sColor }]}>
                      <Text variant="iconCaption" color={colors.background}>
                        {severityLabel(count)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            </Pressable>
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
  scanButton: {
    backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
  emptyState: { paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm },
  snapshotCard: { backgroundColor: colors.surfaceElevated },
  snapshotRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  snapshotInfo: { flex: 1, gap: 2 },
  snapshotMeta: { alignItems: 'flex-end', gap: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
});
