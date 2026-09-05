import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  countVehicles,
  createVehicle,
  deleteVehicle,
  getVehicles,
  updateVehicle,
  type Vehicle,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

interface VehicleFormState {
  nickname: string;
  make: string;
  model: string;
  year: string;
  odometer: string;
}

const emptyForm: VehicleFormState = {
  nickname: '',
  make: '',
  model: '',
  year: String(new Date().getFullYear()),
  odometer: '0',
};

export default function GarageScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [form, setForm] = useState<VehicleFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<VehicleFormState>(emptyForm);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const vehicles = useMemo(() => getVehicles(db), [db, tick]);
  const vehicleCount = useMemo(() => countVehicles(db), [db, tick]);

  const handleCreate = () => {
    if (!form.make.trim() || !form.model.trim()) {
      Alert.alert('Missing fields', 'Make and model are required.');
      return;
    }
    createVehicle(db, uuid(), {
      name: form.nickname.trim() || `${form.make.trim()} ${form.model.trim()}`.trim(),
      make: form.make.trim(),
      model: form.model.trim(),
      year: Math.max(1900, Number(form.year) || new Date().getFullYear()),
      odometer: Math.max(0, Number(form.odometer) || 0),
      fuelType: 'gas',
    });
    setForm(emptyForm);
    refresh();
  };

  const startEditing = (vehicle: Vehicle) => {
    setEditingId(vehicle.id);
    setEditForm({
      nickname: vehicle.name,
      make: vehicle.make,
      model: vehicle.model,
      year: String(vehicle.year),
      odometer: String(vehicle.odometer),
    });
  };

  const handleUpdate = () => {
    if (!editingId) return;
    updateVehicle(db, editingId, {
      name: editForm.nickname.trim() || `${editForm.make.trim()} ${editForm.model.trim()}`.trim(),
      make: editForm.make.trim(),
      model: editForm.model.trim(),
      year: Math.max(1900, Number(editForm.year) || new Date().getFullYear()),
      odometer: Math.max(0, Number(editForm.odometer) || 0),
    });
    setEditingId(null);
    refresh();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete vehicle?', 'This removes the vehicle and related logs.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteVehicle(db, id);
          refresh();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">Garage</Text>
      <Text variant="caption" color={colors.textSecondary}>
        Vehicles: {vehicleCount}
      </Text>

      <Card>
        <Text variant="subheading">Add Vehicle</Text>
        <View style={styles.formGrid}>
          <TextInput
            style={styles.input}
            value={form.nickname}
            onChangeText={(v) => setForm((prev) => ({ ...prev, nickname: v }))}
            placeholder="Nickname (optional)"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              value={form.year}
              onChangeText={(v) => setForm((prev) => ({ ...prev, year: v }))}
              placeholder="Year"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              value={form.odometer}
              onChangeText={(v) => setForm((prev) => ({ ...prev, odometer: v }))}
              placeholder="Odometer"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
          <TextInput
            style={styles.input}
            value={form.make}
            onChangeText={(v) => setForm((prev) => ({ ...prev, make: v }))}
            placeholder="Make *"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={styles.input}
            value={form.model}
            onChangeText={(v) => setForm((prev) => ({ ...prev, model: v }))}
            placeholder="Model *"
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable style={styles.primaryButton} onPress={handleCreate}>
            <Text variant="label" color={colors.background}>Save Vehicle</Text>
          </Pressable>
        </View>
      </Card>

      {vehicles.length === 0 ? (
        <Card>
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>{'\uD83D\uDE97'}</Text>
            <Text variant="subheading" color={colors.textSecondary}>
              Your garage awaits
            </Text>
            <Text variant="caption" color={colors.textTertiary}>
              Add your first vehicle to start tracking maintenance and fuel
            </Text>
          </View>
        </Card>
      ) : (
        vehicles.map((vehicle) => (
          <Card key={vehicle.id}>
            <Pressable onPress={() => router.push(`/(car)/vehicle/${vehicle.id}`)}>
              <Text variant="body">{vehicle.name}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.odometer.toLocaleString()} mi
              </Text>
            </Pressable>

            <View style={styles.actionsRow}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => router.push(`/(car)/vehicle/${vehicle.id}`)}
              >
                <Text variant="label" color={colors.text}>Details</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => startEditing(vehicle)}>
                <Text variant="label" color={colors.text}>Edit</Text>
              </Pressable>
              <Pressable style={styles.dangerButton} onPress={() => handleDelete(vehicle.id)}>
                <Text variant="label" color={colors.background}>Delete</Text>
              </Pressable>
            </View>

            {editingId === vehicle.id ? (
              <Card style={styles.editCard}>
                <Text variant="subheading">Edit Vehicle</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.nickname}
                  onChangeText={(v) => setEditForm((prev) => ({ ...prev, nickname: v }))}
                  placeholder="Nickname"
                  placeholderTextColor={colors.textTertiary}
                />
                <View style={styles.row}>
                  <TextInput
                    style={styles.input}
                    value={editForm.year}
                    onChangeText={(v) => setEditForm((prev) => ({ ...prev, year: v }))}
                    placeholder="Year"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.input}
                    value={editForm.odometer}
                    onChangeText={(v) => setEditForm((prev) => ({ ...prev, odometer: v }))}
                    placeholder="Odometer"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                </View>
                <TextInput
                  style={styles.input}
                  value={editForm.make}
                  onChangeText={(v) => setEditForm((prev) => ({ ...prev, make: v }))}
                  placeholder="Make"
                  placeholderTextColor={colors.textTertiary}
                />
                <TextInput
                  style={styles.input}
                  value={editForm.model}
                  onChangeText={(v) => setEditForm((prev) => ({ ...prev, model: v }))}
                  placeholder="Model"
                  placeholderTextColor={colors.textTertiary}
                />
                <View style={styles.actionsRow}>
                  <Pressable style={styles.primaryButton} onPress={handleUpdate}>
                    <Text variant="label" color={colors.background}>Save</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => setEditingId(null)}>
                    <Text variant="label" color={colors.text}>Cancel</Text>
                  </Pressable>
                </View>
              </Card>
            ) : null}
          </Card>
        ))
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
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  editCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    alignItems: 'center',
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
