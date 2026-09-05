import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  getVehicles,
  getFuelLogsByVehicle,
  createFuelLog,
  getAveragePricePerGallon,
  getPriceTrend,
  getStationAnalysis,
  getFuelCostProjection,
  type FuelLog,
  type StationStats,
  type PriceTrendPoint,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.car;

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function FuelPricesScreen() {
  const db = useDatabase();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [gallons, setGallons] = useState('');
  const [price, setPrice] = useState('');
  const [odometer, setOdometer] = useState('');
  const [station, setStation] = useState('');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const vehicles = useMemo(() => {
    try { return getVehicles(db); } catch { return []; }
  }, [db, tick]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [selectedVehicleId, vehicles],
  );

  const fuelLogs: FuelLog[] = useMemo(() => {
    if (!selectedVehicle) return [];
    try { return getFuelLogsByVehicle(db, selectedVehicle.id); } catch { return []; }
  }, [db, selectedVehicle, tick]);

  const avgPrice = useMemo(
    () => getAveragePricePerGallon(fuelLogs),
    [fuelLogs],
  );

  const priceTrend: PriceTrendPoint[] = useMemo(
    () => getPriceTrend(fuelLogs, 6),
    [fuelLogs],
  );

  const stationAnalysis: StationStats[] = useMemo(
    () => getStationAnalysis(fuelLogs),
    [fuelLogs],
  );

  const projection = useMemo(
    () => getFuelCostProjection(fuelLogs, 1000),
    [fuelLogs],
  );

  const handleAddFillUp = () => {
    if (!selectedVehicle) return;
    const gal = parseFloat(gallons);
    const cost = parseFloat(price);
    const odo = parseInt(odometer, 10);
    if (isNaN(gal) || isNaN(cost) || gal <= 0 || cost <= 0) {
      Alert.alert('Required', 'Enter gallons and cost.');
      return;
    }
    try {
      createFuelLog(db, uuid(), selectedVehicle.id, {
        gallons: gal,
        costCents: Math.round(cost * 100),
        odometerAt: isNaN(odo) ? 0 : odo,
        loggedAt: new Date().toISOString(),
        isFullTank: true,
      });
      setGallons(''); setPrice(''); setOdometer(''); setStation('');
      setShowForm(false);
      refresh();
    } catch {
      Alert.alert('Error', "Couldn't save fill-up.");
    }
  };

  if (vehicles.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>⛽</Text>
        <Text variant="subheading" color={colors.textSecondary}>Fuel Price Tracking</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add a vehicle in the Garage tab first.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Fuel Prices</Text>

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

      {/* Key metrics */}
      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Avg $/gal</Text>
          <Text style={styles.metricValue}>
            {avgPrice > 0 ? `$${avgPrice.toFixed(2)}` : '--'}
          </Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Fill-ups</Text>
          <Text style={styles.metricValue}>{fuelLogs.length}</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Next Month Est.</Text>
          <Text style={styles.metricValue}>
            {projection > 0 ? formatPrice(projection) : '--'}
          </Text>
        </Card>
      </View>

      {/* Price trend */}
      {priceTrend.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>PRICE TREND (6 MONTHS)</Text>
          {priceTrend.map((pt) => {
            const maxPrice = Math.max(...priceTrend.map((p) => p.avgPricePerGallon), 1);
            const barW = (pt.avgPricePerGallon / maxPrice) * 100;
            return (
              <View key={pt.month} style={styles.trendRow}>
                <Text variant="caption" color={colors.textSecondary} style={styles.trendLabel}>
                  {pt.month}
                </Text>
                <View style={styles.trendBarContainer}>
                  <View style={[styles.trendBar, { width: `${barW}%`, backgroundColor: ACCENT }]} />
                </View>
                <Text variant="caption" color={colors.textSecondary} style={styles.trendValue}>
                  ${pt.avgPricePerGallon.toFixed(2)}
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      {/* Station analysis */}
      {stationAnalysis.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>STATION RANKINGS</Text>
          {stationAnalysis.map((s, i) => (
            <View key={s.station} style={styles.stationRow}>
              <View style={styles.stationInfo}>
                <Text variant="body">
                  {i === 0 ? '🏆 ' : ''}{s.station}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {s.fillCount} fill-up{s.fillCount !== 1 ? 's' : ''}
                </Text>
              </View>
              <Text variant="body" style={{ color: i === 0 ? colors.success : ACCENT }}>
                ${s.avgPricePerGallon.toFixed(2)}/gal
              </Text>
            </View>
          ))}
        </Card>
      )}

      <Pressable
        style={styles.addButton}
        onPress={() => setShowForm(!showForm)}
      >
        <Text variant="label" color={colors.background}>Log Fill-Up</Text>
      </Pressable>

      {showForm && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>NEW FILL-UP</Text>
          <View style={styles.formGrid}>
            <View style={styles.formRow}>
              <TextInput
                style={styles.input}
                value={gallons}
                onChangeText={setGallons}
                placeholder="Gallons"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="Total $"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.formRow}>
              <TextInput
                style={styles.input}
                value={odometer}
                onChangeText={setOdometer}
                placeholder="Odometer"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
              <TextInput
                style={styles.input}
                value={station}
                onChangeText={setStation}
                placeholder="Station"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <Pressable style={styles.saveButton} onPress={handleAddFillUp}>
              <Text variant="label" color={colors.background}>Save Fill-Up</Text>
            </Pressable>
          </View>
        </Card>
      )}

      {/* Recent logs */}
      {fuelLogs.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>RECENT FILL-UPS</Text>
          {fuelLogs.slice(0, 10).map((log) => (
            <View key={log.id} style={styles.logRow}>
              <View style={styles.logInfo}>
                <Text variant="body">{log.gallons.toFixed(1)} gal</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {new Date(log.loggedAt).toLocaleDateString()} - {log.odometerAt.toLocaleString()} mi
                </Text>
              </View>
              <View style={styles.logCost}>
                <Text variant="body" style={{ color: ACCENT }}>{formatPrice(log.costCents)}</Text>
                <Text variant="iconCaption" color={colors.textTertiary}>
                  ${(log.costCents / 100 / log.gallons).toFixed(2)}/gal
                </Text>
              </View>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceElevated, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '31.5%', minWidth: 95, gap: spacing.xs },
  metricValue: { color: ACCENT, fontSize: 20, fontWeight: '700' },
  trendRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4,
  },
  trendLabel: { width: 60 },
  trendBarContainer: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: colors.surfaceElevated, overflow: 'hidden',
  },
  trendBar: { height: 8, borderRadius: 4 },
  trendValue: { width: 60, textAlign: 'right' },
  stationRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  stationInfo: { flex: 1, gap: 2 },
  addButton: {
    backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 14,
    alignItems: 'center', minHeight: 48, justifyContent: 'center',
  },
  formGrid: { marginTop: spacing.sm, gap: spacing.sm },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1, backgroundColor: colors.surfaceElevated, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 44,
  },
  saveButton: {
    backgroundColor: ACCENT, borderRadius: 8, paddingVertical: 12,
    alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
  logRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  logInfo: { flex: 1, gap: 2 },
  logCost: { alignItems: 'flex-end', gap: 2 },
});
