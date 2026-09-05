import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  createFuelLog,
  createMaintenance,
  deleteFuelLog,
  deleteMaintenance,
  getFuelLogsByVehicle,
  getMaintenanceByVehicle,
  getVehicleById,
  type FuelLog,
  type Maintenance,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

function formatCurrency(cents: number | null | undefined): string {
  return `$${(((cents ?? 0) as number) / 100).toFixed(2)}`;
}

export default function VehicleDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const vehicleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [serviceType, setServiceType] = useState('oil_change');
  const [serviceCost, setServiceCost] = useState('');
  const [serviceOdometer, setServiceOdometer] = useState('');

  const [fuelGallons, setFuelGallons] = useState('10');
  const [fuelCost, setFuelCost] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const vehicle = useMemo(
    () => (vehicleId ? getVehicleById(db, vehicleId) : null),
    [db, vehicleId, tick],
  );
  const maintenance = useMemo(
    () => (vehicleId ? getMaintenanceByVehicle(db, vehicleId) : []),
    [db, vehicleId, tick],
  );
  const fuelLogs = useMemo(
    () => (vehicleId ? getFuelLogsByVehicle(db, vehicleId) : []),
    [db, vehicleId, tick],
  );

  const addService = () => {
    if (!vehicleId) return;
    createMaintenance(db, uuid(), vehicleId, {
      type: serviceType.trim() || 'oil_change',
      performedAt: new Date().toISOString(),
      costCents: Math.max(0, Math.round((Number(serviceCost) || 0) * 100)),
      odometerAt: Math.max(0, Number(serviceOdometer) || 0),
    });
    setServiceCost('');
    setServiceOdometer('');
    refresh();
  };

  const addFuel = () => {
    if (!vehicleId) return;
    createFuelLog(db, uuid(), vehicleId, {
      gallons: Math.max(0, Number(fuelGallons) || 0),
      costCents: Math.max(0, Math.round((Number(fuelCost) || 0) * 100)),
      odometerAt: Math.max(0, Number(fuelOdometer) || 0),
      loggedAt: new Date().toISOString(),
      isFullTank: true,
    });
    setFuelCost('');
    setFuelOdometer('');
    refresh();
  };

  const handleDeleteService = (item: Maintenance) => {
    Alert.alert('Delete service log?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMaintenance(db, item.id);
          refresh();
        },
      },
    ]);
  };

  const handleDeleteFuel = (item: FuelLog) => {
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

  if (!vehicle) {
    return (
      <>
        <Stack.Screen options={{ title: 'Vehicle Detail' }} />
        <View style={styles.screen}>
          <View style={styles.emptyState}>
            <Text variant="body" color={colors.textSecondary}>Vehicle not found.</Text>
            <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
              <Text variant="label" color={colors.text}>Go Back</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: vehicle.name }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text variant="label" color={colors.text}>Back</Text>
        </Pressable>

        <Card>
          <Text variant="heading">{vehicle.name}</Text>
          <Text variant="body" color={colors.textSecondary}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            Odometer: {vehicle.odometer.toLocaleString()} mi
          </Text>
        </Card>

        <Card>
          <Text variant="subheading">Add Service Log</Text>
          <View style={styles.formGrid}>
            <TextInput
              style={styles.input}
              value={serviceType}
              onChangeText={setServiceType}
              placeholder="Service type"
              placeholderTextColor={colors.textTertiary}
            />
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                value={serviceCost}
                onChangeText={setServiceCost}
                placeholder="Cost ($)"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.input}
                value={serviceOdometer}
                onChangeText={setServiceOdometer}
                placeholder="Odometer"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />
            </View>
            <Pressable style={styles.primaryButton} onPress={addService}>
              <Text variant="label" color={colors.background}>Add Service</Text>
            </Pressable>
          </View>

          {maintenance.length === 0 ? (
            <View style={styles.inlineEmpty}>
              <Text variant="body" color={colors.textSecondary}>No service logs yet</Text>
              <Text variant="caption" color={colors.textTertiary}>Add your first service record above</Text>
            </View>
          ) : (
            maintenance.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <View style={styles.itemCopy}>
                  <Text variant="body">{item.type}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {new Date(item.performedAt).toLocaleDateString()} · {formatCurrency(item.costCents)}
                    {item.odometerAt ? ` · ${item.odometerAt.toLocaleString()} mi` : ''}
                  </Text>
                </View>
                <Pressable style={styles.dangerButton} onPress={() => handleDeleteService(item)}>
                  <Text variant="label" color={colors.background}>Delete</Text>
                </Pressable>
              </View>
            ))
          )}
        </Card>

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
              <TextInput
                style={styles.input}
                value={fuelOdometer}
                onChangeText={setFuelOdometer}
                placeholder="Odometer"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
              />
            </View>
            <Pressable style={styles.primaryButton} onPress={addFuel}>
              <Text variant="label" color={colors.background}>Add Fuel Log</Text>
            </Pressable>
          </View>

          {fuelLogs.length === 0 ? (
            <View style={styles.inlineEmpty}>
              <Text variant="body" color={colors.textSecondary}>No fuel logs yet</Text>
              <Text variant="caption" color={colors.textTertiary}>Log a fill-up to track fuel costs</Text>
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
                <Pressable style={styles.dangerButton} onPress={() => handleDeleteFuel(item)}>
                  <Text variant="label" color={colors.background}>Delete</Text>
                </Pressable>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </>
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
  formGrid: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    minWidth: 80,
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
  secondaryButton: {
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
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
  inlineEmpty: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
});
