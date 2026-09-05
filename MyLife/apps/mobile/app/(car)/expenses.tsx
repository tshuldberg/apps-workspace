import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  createFuelLog,
  deleteFuelLog,
  getFuelLogsByVehicle,
  getMaintenanceByVehicle,
  getVehicles,
  type FuelLog,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

function formatCurrency(cents: number | null | undefined): string {
  return `$${(((cents ?? 0) as number) / 100).toFixed(2)}`;
}

export default function ExpensesScreen() {
  const db = useDatabase();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [fuelGallons, setFuelGallons] = useState('10');
  const [fuelCost, setFuelCost] = useState('0');
  const [fuelOdometer, setFuelOdometer] = useState('0');
  const [fuelStation, setFuelStation] = useState('');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const vehicles = useMemo(() => getVehicles(db), [db, tick]);
  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0] ?? null,
    [selectedVehicleId, vehicles],
  );
  const fuelLogs = useMemo(
    () => (selectedVehicle ? getFuelLogsByVehicle(db, selectedVehicle.id) : []),
    [db, selectedVehicle, tick],
  );
  const maintenance = useMemo(
    () => (selectedVehicle ? getMaintenanceByVehicle(db, selectedVehicle.id) : []),
    [db, selectedVehicle, tick],
  );

  const totalFuelCostCents = useMemo(
    () => fuelLogs.reduce((sum, log) => sum + log.costCents, 0),
    [fuelLogs],
  );
  const totalMaintenanceCostCents = useMemo(
    () => maintenance.reduce((sum, m) => sum + (m.costCents ?? 0), 0),
    [maintenance],
  );

  const addFuelLog = () => {
    if (!selectedVehicle) {
      Alert.alert('No vehicle', 'Add a vehicle in the Garage tab first.');
      return;
    }
    createFuelLog(db, uuid(), selectedVehicle.id, {
      gallons: Math.max(0, Number(fuelGallons) || 0),
      costCents: Math.max(0, Math.round((Number(fuelCost) || 0) * 100)),
      odometerAt: Math.max(0, Number(fuelOdometer) || 0),
      loggedAt: new Date().toISOString(),
      isFullTank: true,
    });
    setFuelCost('0');
    setFuelStation('');
    refresh();
  };

  const handleDelete = (item: FuelLog) => {
    Alert.alert('Delete fuel log?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteFuelLog(db, item.id);
          refresh();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">Expenses</Text>

      {vehicles.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>{'\uD83D\uDCB0'}</Text>
            <Text variant="subheading" color={colors.textSecondary}>
              Track every dollar
            </Text>
            <Text variant="caption" color={colors.textTertiary}>
              Add a vehicle in the Garage tab to start logging expenses
            </Text>
          </View>
        </Card>
      ) : (
        <>
          <Card>
            <Text variant="subheading">Vehicle</Text>
            <View style={styles.chipRow}>
              {vehicles.map((vehicle) => {
                const selected = (selectedVehicle?.id ?? '') === vehicle.id;
                return (
                  <Pressable
                    key={vehicle.id}
                    style={[styles.chip, selected ? styles.chipSelected : null]}
                    onPress={() => setSelectedVehicleId(vehicle.id)}
                  >
                    <Text variant="label" color={selected ? colors.background : colors.text}>
                      {vehicle.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <View style={styles.metricsGrid}>
            <Card style={styles.metricCard}>
              <Text variant="caption" color={colors.textSecondary}>Fuel Total</Text>
              <Text style={styles.metricValue}>{formatCurrency(totalFuelCostCents)}</Text>
            </Card>
            <Card style={styles.metricCard}>
              <Text variant="caption" color={colors.textSecondary}>Maint. Total</Text>
              <Text style={styles.metricValue}>{formatCurrency(totalMaintenanceCostCents)}</Text>
            </Card>
            <Card style={styles.metricCard}>
              <Text variant="caption" color={colors.textSecondary}>Combined</Text>
              <Text style={styles.metricValue}>
                {formatCurrency(totalFuelCostCents + totalMaintenanceCostCents)}
              </Text>
            </Card>
          </View>

          <Card>
            <Text variant="subheading">Add Fuel Log</Text>
            <View style={styles.formGrid}>
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  value={fuelGallons}
                  onChangeText={setFuelGallons}
                  placeholder="Gallons"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  value={fuelCost}
                  onChangeText={setFuelCost}
                  placeholder="Cost ($)"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.row}>
                <TextInput
                  style={styles.input}
                  value={fuelOdometer}
                  onChangeText={setFuelOdometer}
                  placeholder="Odometer"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  value={fuelStation}
                  onChangeText={setFuelStation}
                  placeholder="Station (optional)"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <Pressable style={styles.primaryButton} onPress={addFuelLog}>
                <Text variant="label" color={colors.background}>Add Fuel Log</Text>
              </Pressable>
            </View>
          </Card>

          <Card>
            <Text variant="subheading">
              Fuel Logs · {selectedVehicle?.name ?? 'None'}
            </Text>
            {fuelLogs.length === 0 ? (
              <View style={styles.emptyState}>
                <Text variant="body" color={colors.textSecondary}>
                  No fuel logs yet
                </Text>
                <Text variant="caption" color={colors.textTertiary}>
                  Log a fill-up to start tracking fuel costs
                </Text>
              </View>
            ) : (
              fuelLogs.map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemCopy}>
                    <Text variant="body">{item.gallons.toFixed(1)} gal</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {new Date(item.loggedAt).toLocaleDateString()} · {formatCurrency(item.costCents)} · {item.odometerAt.toLocaleString()} mi
                    </Text>
                  </View>
                  <Pressable style={styles.dangerButton} onPress={() => handleDelete(item)}>
                    <Text variant="label" color={colors.background}>Delete</Text>
                  </Pressable>
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    width: '31.5%',
    minWidth: 95,
    gap: spacing.xs,
  },
  metricValue: {
    color: colors.modules.car,
    fontSize: 20,
    fontWeight: '700',
  },
  formGrid: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    minWidth: 100,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: colors.modules.car,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  itemCopy: {
    flex: 1,
    gap: 2,
  },
  primaryButton: {
    borderRadius: 8,
    backgroundColor: colors.modules.car,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  dangerButton: {
    borderRadius: 8,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
});
