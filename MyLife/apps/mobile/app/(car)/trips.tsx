import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  createTrip,
  deleteTrip,
  getTripsByVehicle,
  getVehicles,
  getTripSummaryByPurpose,
  estimateIrsDeduction,
  type TripPurpose,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const accentColor = colors.modules.car;

const PURPOSE_LABELS: Record<TripPurpose, string> = {
  personal: 'Personal',
  business: 'Business',
  medical: 'Medical',
  charity: 'Charity',
  moving: 'Moving',
  commute: 'Commute',
};

const PURPOSE_ICONS: Record<TripPurpose, string> = {
  personal: '\ud83c\udfe0',
  business: '\ud83d\udcbc',
  medical: '\ud83c\udfe5',
  charity: '\u2764\ufe0f',
  moving: '\ud83d\udce6',
  commute: '\ud83d\ude8c',
};

function formatDistance(miles: number): string {
  return `${miles.toLocaleString()} mi`;
}

export default function TripsScreen() {
  const db = useDatabase();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<TripPurpose>('personal');
  const [routeName, setRouteName] = useState('');
  const [startOdo, setStartOdo] = useState('');
  const [endOdo, setEndOdo] = useState('');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const vehicles = useMemo(() => getVehicles(db), [db, tick]);
  const vehicleId = selectedVehicleId ?? vehicles[0]?.id ?? null;
  const trips = useMemo(
    () => (vehicleId ? getTripsByVehicle(db, vehicleId) : []),
    [db, vehicleId, tick],
  );

  const summary = useMemo(() => getTripSummaryByPurpose(trips), [trips]);
  const businessMiles = summary.business?.totalMiles ?? 0;
  const irsDeduction = estimateIrsDeduction(businessMiles);

  const handleAdd = useCallback(() => {
    if (!vehicleId) return;
    const s = parseInt(startOdo, 10);
    const e = parseInt(endOdo, 10);
    if (isNaN(s) || isNaN(e) || e <= s) {
      Alert.alert('Invalid', 'End odometer must be greater than start');
      return;
    }
    createTrip(db, uuid(), {
      vehicleId,
      purpose,
      routeName: routeName.trim() || undefined,
      startOdometer: s,
      endOdometer: e,
      startedAt: new Date().toISOString(),
    });
    setStartOdo('');
    setEndOdo('');
    setRouteName('');
    refresh();
  }, [db, vehicleId, purpose, routeName, startOdo, endOdo, refresh]);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert('Delete Trip', 'Remove this trip record?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { deleteTrip(db, id); refresh(); } },
      ]);
    },
    [db, refresh],
  );

  if (vehicles.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>{'\ud83d\udccd'}</Text>
          <Text variant="subheading" color={colors.textSecondary}>
            Ready to hit the road
          </Text>
          <Text variant="caption" color={colors.textTertiary} style={{ textAlign: 'center' }}>
            Add a vehicle in the Garage tab to start logging trips
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {vehicles.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehiclePicker}>
          {vehicles.map((v) => (
            <Pressable
              key={v.id}
              onPress={() => setSelectedVehicleId(v.id)}
              style={[styles.vehicleChip, vehicleId === v.id && styles.vehicleChipActive]}
            >
              <Text style={[styles.vehicleChipText, vehicleId === v.id && styles.vehicleChipTextActive]}>
                {v.name || `${v.year} ${v.make}`}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {businessMiles > 0 && (
        <Card style={styles.card}>
          <Text variant="subheading">IRS Deduction Estimate</Text>
          <Text style={styles.deductionAmount}>${(irsDeduction / 100).toFixed(2)}</Text>
          <Text variant="caption" color={colors.textSecondary}>{formatDistance(businessMiles)} business miles</Text>
        </Card>
      )}

      <Card style={styles.card}>
        <Text variant="subheading">Log Trip</Text>
        <View style={styles.purposeRow}>
          {(Object.keys(PURPOSE_LABELS) as TripPurpose[]).map((p) => (
            <Pressable key={p} onPress={() => setPurpose(p)} style={[styles.purposeChip, purpose === p && styles.purposeChipActive]}>
              <Text style={styles.purposeIcon}>{PURPOSE_ICONS[p]}</Text>
              <Text style={[styles.purposeText, purpose === p && styles.purposeTextActive]}>{PURPOSE_LABELS[p]}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput style={styles.input} placeholder="Route name (optional)" placeholderTextColor={colors.textTertiary} value={routeName} onChangeText={setRouteName} />
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.halfInput]} placeholder="Start odometer" placeholderTextColor={colors.textTertiary} value={startOdo} onChangeText={setStartOdo} keyboardType="numeric" />
          <TextInput style={[styles.input, styles.halfInput]} placeholder="End odometer" placeholderTextColor={colors.textTertiary} value={endOdo} onChangeText={setEndOdo} keyboardType="numeric" />
        </View>
        <Pressable onPress={handleAdd} style={styles.addButton}>
          <Text style={styles.addButtonText}>Log Trip</Text>
        </Pressable>
      </Card>

      {Object.entries(summary).filter(([, s]) => s.count > 0).map(([p, s]) => (
        <Card key={p} style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={{ fontSize: 20 }}>{PURPOSE_ICONS[p as TripPurpose]}</Text>
            <Text variant="body" style={{ flex: 1, fontWeight: '600' }}>{PURPOSE_LABELS[p as TripPurpose]}</Text>
            <Text variant="caption" color={colors.textSecondary}>{s.count} trips · {formatDistance(s.totalMiles)}</Text>
          </View>
        </Card>
      ))}

      {trips.map((t) => (
        <Card key={t.id} style={styles.card}>
          <View style={styles.tripRow}>
            <Text style={{ fontSize: 24 }}>{PURPOSE_ICONS[t.purpose]}</Text>
            <View style={styles.tripInfo}>
              <Text variant="body">{t.routeName || PURPOSE_LABELS[t.purpose]}</Text>
              <Text variant="caption" color={colors.textSecondary}>{formatDistance(t.distance)} · {t.startedAt.slice(0, 10)}</Text>
            </View>
            <Pressable style={styles.deleteButton} onPress={() => handleDelete(t.id)}>
              <Text variant="label" color={colors.danger}>Delete</Text>
            </Pressable>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  vehiclePicker: { marginBottom: spacing.sm },
  vehicleChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginRight: spacing.xs, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  vehicleChipActive: { backgroundColor: accentColor, borderColor: accentColor },
  vehicleChipText: { fontSize: 13, color: colors.textSecondary },
  vehicleChipTextActive: { color: '#fff', fontWeight: '600' },
  card: { marginBottom: 0 },
  purposeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  purposeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  purposeChipActive: { borderColor: accentColor, backgroundColor: `${accentColor}20` },
  purposeIcon: { fontSize: 14 },
  purposeText: { fontSize: 12, color: colors.textSecondary },
  purposeTextActive: { color: accentColor, fontWeight: '600' },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, color: colors.text, fontSize: 14, marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.xs },
  halfInput: { flex: 1 },
  addButton: { backgroundColor: accentColor, borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: spacing.xs, minHeight: 44, justifyContent: 'center' },
  addButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tripInfo: { flex: 1, gap: 2 },
  deleteButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  deductionAmount: { fontSize: 28, fontWeight: '700', color: '#30D158', marginBottom: 2 },
});
