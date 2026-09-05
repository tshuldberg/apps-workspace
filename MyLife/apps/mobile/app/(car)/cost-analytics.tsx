import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  getVehicles,
  getFuelLogsByVehicle,
  getMaintenanceByVehicle,
  getTripsByVehicle,
  calculateCostPerMile,
  getCostBreakdown,
  getMonthlyCostTrend,
  getTripSummaryByPurpose,
  estimateIrsDeduction,
  type CostBreakdown,
  type MonthlyCostTrend,
  type TripPurpose,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.car;

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CostAnalyticsScreen() {
  const db = useDatabase();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const vehicles = useMemo(() => {
    try { return getVehicles(db); } catch { return []; }
  }, [db]);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [selectedVehicleId, vehicles],
  );

  const fuelLogs = useMemo(() => {
    if (!selectedVehicle) return [];
    try { return getFuelLogsByVehicle(db, selectedVehicle.id); } catch { return []; }
  }, [db, selectedVehicle]);

  const maintenance = useMemo(() => {
    if (!selectedVehicle) return [];
    try { return getMaintenanceByVehicle(db, selectedVehicle.id); } catch { return []; }
  }, [db, selectedVehicle]);

  const trips = useMemo(() => {
    if (!selectedVehicle) return [];
    try { return getTripsByVehicle(db, selectedVehicle.id); } catch { return []; }
  }, [db, selectedVehicle]);

  const costPerMile = useMemo(
    () => calculateCostPerMile(fuelLogs, maintenance),
    [fuelLogs, maintenance],
  );

  const breakdown: CostBreakdown = useMemo(
    () => getCostBreakdown(fuelLogs, maintenance),
    [fuelLogs, maintenance],
  );

  const monthlyTrend: MonthlyCostTrend[] = useMemo(
    () => getMonthlyCostTrend(fuelLogs, maintenance),
    [fuelLogs, maintenance],
  );

  const purposeSummary = useMemo(
    () => getTripSummaryByPurpose(trips),
    [trips],
  );

  const purposeEntries = useMemo(
    () => Object.entries(purposeSummary) as [TripPurpose, { count: number; totalMiles: number }][],
    [purposeSummary],
  );

  const businessMiles = useMemo(() => {
    const biz = purposeSummary['business' as TripPurpose];
    return biz ? biz.totalMiles : 0;
  }, [purposeSummary]);

  const irsDeduction = useMemo(
    () => estimateIrsDeduction(businessMiles),
    [businessMiles],
  );

  if (vehicles.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text variant="subheading" color={colors.textSecondary}>Cost Analytics</Text>
        <Text variant="caption" color={colors.textTertiary}>
          Add a vehicle and log expenses to see analytics.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading" style={{ color: ACCENT }}>Cost Analytics</Text>

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
          <Text variant="caption" color={colors.textSecondary}>Cost/Mile</Text>
          <Text style={styles.metricValue}>
            {costPerMile > 0 ? `${(costPerMile / 100).toFixed(2)}c` : '--'}
          </Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Total Cost</Text>
          <Text style={styles.metricValue}>{formatCurrency(breakdown.totalCents)}</Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>IRS Deduction</Text>
          <Text style={styles.metricValue}>{formatCurrency(irsDeduction)}</Text>
        </Card>
      </View>

      {/* Expense Breakdown */}
      <Card>
        <Text variant="label" color={colors.textTertiary}>EXPENSE BREAKDOWN</Text>
        <View style={styles.breakdownRow}>
          <Text variant="body">Fuel</Text>
          <Text variant="body" style={{ color: ACCENT }}>{formatCurrency(breakdown.fuelCents)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text variant="body">Maintenance</Text>
          <Text variant="body" style={{ color: ACCENT }}>{formatCurrency(breakdown.maintenanceCents)}</Text>
        </View>
        {breakdown.totalCents > 0 && (
          <View style={styles.barContainer}>
            <View
              style={[
                styles.barSegment,
                {
                  width: `${(breakdown.fuelCents / breakdown.totalCents) * 100}%`,
                  backgroundColor: ACCENT,
                },
              ]}
            />
            <View
              style={[
                styles.barSegment,
                {
                  width: `${(breakdown.maintenanceCents / breakdown.totalCents) * 100}%`,
                  backgroundColor: '#FF9F0A',
                },
              ]}
            />
          </View>
        )}
      </Card>

      {/* Monthly Trend */}
      {monthlyTrend.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>MONTHLY TREND</Text>
          {monthlyTrend.slice(-6).map((m) => {
            const maxCost = Math.max(...monthlyTrend.map((t) => t.totalCents), 1);
            const barW = (m.totalCents / maxCost) * 100;
            return (
              <View key={m.month} style={styles.trendRow}>
                <Text variant="caption" color={colors.textSecondary} style={styles.trendLabel}>
                  {m.month}
                </Text>
                <View style={styles.trendBarContainer}>
                  <View style={[styles.trendBar, { width: `${barW}%`, backgroundColor: ACCENT }]} />
                </View>
                <Text variant="caption" color={colors.textSecondary} style={styles.trendValue}>
                  {formatCurrency(m.totalCents)}
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      {/* Trip Purpose */}
      {purposeEntries.length > 0 && (
        <Card>
          <Text variant="label" color={colors.textTertiary}>TRIP PURPOSE</Text>
          {purposeEntries.map(([purpose, ps]) => (
            <View key={purpose} style={styles.breakdownRow}>
              <Text variant="body">{purpose}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {ps.count} trip{ps.count !== 1 ? 's' : ''} - {ps.totalMiles.toFixed(0)} mi
              </Text>
            </View>
          ))}
        </Card>
      )}

      {fuelLogs.length === 0 && maintenance.length === 0 && (
        <Card>
          <View style={styles.emptyState}>
            <Text variant="body" color={colors.textSecondary}>No expense data yet.</Text>
            <Text variant="caption" color={colors.textTertiary}>
              Log fuel fill-ups and maintenance in the Expenses tab.
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
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCard: { width: '31.5%', minWidth: 95, gap: spacing.xs },
  metricValue: { color: ACCENT, fontSize: 20, fontWeight: '700' },
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.glass,
  },
  barContainer: {
    flexDirection: 'row', height: 8, borderRadius: 4,
    overflow: 'hidden', marginTop: spacing.sm,
    backgroundColor: colors.surfaceElevated,
  },
  barSegment: { height: 8 },
  trendRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: 4,
  },
  trendLabel: { width: 60 },
  trendBarContainer: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: colors.surfaceElevated, overflow: 'hidden',
  },
  trendBar: { height: 8, borderRadius: 4 },
  trendValue: { width: 70, textAlign: 'right' },
  emptyState: { paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm },
});
