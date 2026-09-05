import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  getVehicles,
  getCurrentTireSet,
  getMeasurementsByTireSet,
  getRotationsByTireSet,
  getPositionHealth,
  getTireHealth,
  calculateWearRate,
  createMeasurement,
  createRotation,
  type TireSet,
  type TirePositionHealth,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.car;

function healthColor(health: string): string {
  switch (health) {
    case 'good': return colors.success;
    case 'fair': return '#FF9F0A';
    case 'low': return colors.danger;
    case 'replace': return colors.danger;
    default: return colors.textSecondary;
  }
}

function depthMM(depth32nds: number): string {
  return `${(depth32nds * 0.794).toFixed(1)}mm`;
}

const POSITIONS = ['FL', 'FR', 'RL', 'RR'] as const;

export default function TiresScreen() {
  const db = useDatabase();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fl, setFl] = useState('');
  const [fr, setFr] = useState('');
  const [rl, setRl] = useState('');
  const [rr, setRr] = useState('');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const vehicles = useMemo(() => {
    try { return getVehicles(db); } catch { return []; }
  }, [db, tick]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [selectedVehicleId, vehicles],
  );

  const tireSet: TireSet | null = useMemo(() => {
    if (!selectedVehicle) return null;
    try { return getCurrentTireSet(db, selectedVehicle.id); } catch { return null; }
  }, [db, selectedVehicle, tick]);

  const measurements = useMemo(() => {
    if (!tireSet) return [];
    try { return getMeasurementsByTireSet(db, tireSet.id); } catch { return []; }
  }, [db, tireSet, tick]);

  const rotations = useMemo(() => {
    if (!tireSet) return [];
    try { return getRotationsByTireSet(db, tireSet.id); } catch { return []; }
  }, [db, tireSet, tick]);

  const positionHealth: TirePositionHealth[] = useMemo(
    () => getPositionHealth(measurements),
    [measurements],
  );

  const wearRate = useMemo(() => {
    try { return calculateWearRate(measurements); } catch { return null; }
  }, [measurements]);

  const handleLogMeasurement = () => {
    if (!tireSet) return;
    const depths = { FL: fl, FR: fr, RL: rl, RR: rr };
    try {
      for (const pos of POSITIONS) {
        const val = parseInt(depths[pos], 10);
        if (isNaN(val) || val <= 0) continue;
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        createMeasurement(db, id, {
          tireSetId: tireSet.id,
          position: pos,
          treadDepth32nds: val,
          measuredAt: new Date().toISOString(),
          odometerAt: selectedVehicle?.odometer ?? undefined,
        });
      }
      setFl(''); setFr(''); setRl(''); setRr('');
      setShowForm(false);
      refresh();
    } catch {
      Alert.alert('Error', "Couldn't save measurement.");
    }
  };

  const handleLogRotation = () => {
    if (!tireSet) return;
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      createRotation(db, id, {
        tireSetId: tireSet.id,
        rotatedAt: new Date().toISOString(),
        odometerAt: selectedVehicle?.odometer ?? undefined,
      });
      refresh();
      Alert.alert('Logged', 'Tire rotation recorded.');
    } catch {
      Alert.alert('Error', "Couldn't save rotation.");
    }
  };

  if (vehicles.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>🛞</Text>
        <Text variant="subheading" color={colors.textSecondary}>Tire Management</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add a vehicle in the Garage tab first.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Tires</Text>

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

      {!tireSet ? (
        <Card>
          <View style={styles.emptyState}>
            <Text variant="body" color={colors.textSecondary}>No tire set configured.</Text>
            <Text variant="caption" color={colors.textTertiary}>
              Add a tire set in settings to start tracking tread health.
            </Text>
          </View>
        </Card>
      ) : (
        <>
          <Card>
            <Text variant="label" color={colors.textTertiary}>CURRENT SET</Text>
            <Text variant="body">
              {tireSet.brand ?? 'Unknown'} {tireSet.modelName ?? ''} {tireSet.size ? `(${tireSet.size})` : ''}
            </Text>
          </Card>

          {/* 4-corner diagram */}
          <Card>
            <Text variant="label" color={colors.textTertiary}>TREAD HEALTH</Text>
            <View style={styles.tireGrid}>
              {POSITIONS.map((pos) => {
                const ph = positionHealth.find((p) => p.position === pos);
                const health = ph ? ph.health : 'good';
                const depth = ph ? ph.treadDepth32nds : 0;
                return (
                  <View key={pos} style={styles.tireCell}>
                    <View style={[styles.tireCircle, { borderColor: healthColor(health) }]}>
                      <Text variant="body" style={{ color: healthColor(health) }}>
                        {depth > 0 ? `${depth}/32` : '--'}
                      </Text>
                      <Text variant="iconCaption" color={colors.textTertiary}>
                        {depth > 0 ? depthMM(depth) : ''}
                      </Text>
                    </View>
                    <Text variant="caption" color={colors.textSecondary}>{pos}</Text>
                    {ph && (
                      <Text variant="iconCaption" color={healthColor(health)}>
                        {health}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>

          {wearRate && wearRate.dataPoints > 1 && (
            <Card>
              <Text variant="label" color={colors.textTertiary}>WEAR RATE</Text>
              <Text variant="body">
                {wearRate.rate32ndsPerThousandMiles.toFixed(1)}/32" per 1,000 miles
              </Text>
              <Text variant="caption" color={colors.textSecondary}>
                Based on {wearRate.dataPoints} measurements
              </Text>
            </Card>
          )}

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: ACCENT }]}
              onPress={() => setShowForm(!showForm)}
            >
              <Text variant="label" color={colors.background}>Log Measurement</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: ACCENT }]}
              onPress={handleLogRotation}
            >
              <Text variant="label" color={ACCENT}>Log Rotation</Text>
            </Pressable>
          </View>

          {showForm && (
            <Card>
              <Text variant="label" color={colors.textTertiary}>TREAD DEPTHS (32nds)</Text>
              <View style={styles.depthGrid}>
                {POSITIONS.map((pos) => {
                  const val = pos === 'FL' ? fl : pos === 'FR' ? fr : pos === 'RL' ? rl : rr;
                  const setter = pos === 'FL' ? setFl : pos === 'FR' ? setFr : pos === 'RL' ? setRl : setRr;
                  return (
                    <View key={pos} style={styles.depthField}>
                      <Text variant="caption" color={colors.textSecondary}>{pos}</Text>
                      <TextInput
                        style={styles.depthInput}
                        value={val}
                        onChangeText={setter}
                        placeholder="0"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                      />
                    </View>
                  );
                })}
              </View>
              <Pressable style={[styles.saveButton, { backgroundColor: ACCENT }]} onPress={handleLogMeasurement}>
                <Text variant="label" color={colors.background}>Save</Text>
              </Pressable>
            </Card>
          )}

          {rotations.length > 0 && (
            <Card>
              <Text variant="label" color={colors.textTertiary}>ROTATION HISTORY</Text>
              {rotations.slice(0, 5).map((r) => (
                <View key={r.id} style={styles.historyRow}>
                  <Text variant="body">{new Date(r.rotatedAt).toLocaleDateString()}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {r.odometerAt ? `${r.odometerAt.toLocaleString()} mi` : ''}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </>
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
  emptyState: { paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm },
  tireGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: spacing.md, marginTop: spacing.sm,
  },
  tireCell: { width: '40%', alignItems: 'center', gap: 4 },
  tireCircle: {
    width: 80, height: 80, borderRadius: 40, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  buttonRow: { flexDirection: 'row', gap: spacing.sm },
  actionButton: {
    flex: 1, borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
  depthGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm,
  },
  depthField: { width: '45%', gap: 4 },
  depthInput: {
    backgroundColor: colors.surfaceElevated, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: colors.text, borderWidth: 1, borderColor: colors.border,
    textAlign: 'center', minHeight: 44,
  },
  saveButton: {
    borderRadius: 8, paddingVertical: 12, alignItems: 'center',
    marginTop: spacing.sm, minHeight: 44, justifyContent: 'center',
  },
  historyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
});
