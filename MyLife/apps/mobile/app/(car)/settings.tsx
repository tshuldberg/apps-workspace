import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  countVehicles,
  getFuelLogsByVehicle,
  getMaintenanceByVehicle,
  getSetting,
  getVehicles,
  setSetting,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type OdometerUnit = 'miles' | 'km';
type FuelUnit = 'gallons' | 'liters';

export default function SettingsScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const odometerUnit = useMemo(
    () => (getSetting(db, 'odometer_unit') as OdometerUnit) ?? 'miles',
    [db, tick],
  );
  const fuelUnit = useMemo(
    () => (getSetting(db, 'fuel_unit') as FuelUnit) ?? 'gallons',
    [db, tick],
  );
  const currency = useMemo(
    () => getSetting(db, 'currency') ?? 'USD',
    [db, tick],
  );

  const vehicles = useMemo(() => getVehicles(db), [db, tick]);
  const vehicleCount = useMemo(() => countVehicles(db), [db, tick]);
  const totalMaintenance = useMemo(
    () => vehicles.reduce((sum, v) => sum + getMaintenanceByVehicle(db, v.id).length, 0),
    [db, vehicles, tick],
  );
  const totalFuelLogs = useMemo(
    () => vehicles.reduce((sum, v) => sum + getFuelLogsByVehicle(db, v.id).length, 0),
    [db, vehicles, tick],
  );

  const setOdometerUnit = (value: OdometerUnit) => {
    setSetting(db, 'odometer_unit', value);
    refresh();
  };

  const setFuelUnit = (value: FuelUnit) => {
    setSetting(db, 'fuel_unit', value);
    refresh();
  };

  const setCurrency = (value: string) => {
    setSetting(db, 'currency', value.toUpperCase());
    refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">Settings</Text>
      <Text variant="caption" color={colors.textSecondary}>
        Units, preferences, and data overview.
      </Text>

      <Card>
        <Text variant="subheading">Preferences</Text>

        <Text variant="caption" color={colors.textSecondary}>Odometer unit</Text>
        <View style={styles.chipRow}>
          {(['miles', 'km'] as const).map((value) => {
            const selected = odometerUnit === value;
            return (
              <Pressable
                key={value}
                style={[styles.chip, selected ? styles.chipSelected : null]}
                onPress={() => setOdometerUnit(value)}
              >
                <Text variant="label" color={selected ? colors.background : colors.text}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="caption" color={colors.textSecondary}>Fuel unit</Text>
        <View style={styles.chipRow}>
          {(['gallons', 'liters'] as const).map((value) => {
            const selected = fuelUnit === value;
            return (
              <Pressable
                key={value}
                style={[styles.chip, selected ? styles.chipSelected : null]}
                onPress={() => setFuelUnit(value)}
              >
                <Text variant="label" color={selected ? colors.background : colors.text}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="caption" color={colors.textSecondary}>Currency</Text>
        <TextInput
          style={styles.input}
          value={currency}
          onChangeText={setCurrency}
          placeholder="USD"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="characters"
        />
      </Card>

      <Card>
        <Text variant="subheading">Data Overview</Text>
        <Text variant="body" color={colors.textSecondary}>
          Vehicles: {vehicleCount}
        </Text>
        <Text variant="body" color={colors.textSecondary}>
          Maintenance records: {totalMaintenance}
        </Text>
        <Text variant="body" color={colors.textSecondary}>
          Fuel logs: {totalFuelLogs}
        </Text>
      </Card>
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    marginTop: spacing.xs,
  },
});
