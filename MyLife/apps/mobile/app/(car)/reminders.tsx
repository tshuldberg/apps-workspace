import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  getVehicles,
  getActiveSchedules,
  createSchedule,
  updateSchedule,
  deactivateSchedule,
  getDefaultSchedules,
  calculateScheduleStatus,
  serviceTypeLabel,
  type MaintenanceSchedule,
  type ScheduleStatus,
  type ScheduleServiceType,
  type Vehicle,
} from '@mylife/car';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const accentColor = colors.modules.car;

const STATUS_COLORS: Record<ScheduleStatus, string> = {
  overdue: '#FF453A',
  due_soon: '#FFD60A',
  ok: '#30D158',
  unknown: colors.textSecondary,
};

const STATUS_ICONS: Record<ScheduleStatus, string> = {
  overdue: '\u26A0\uFE0F',
  due_soon: '\u23F0',
  ok: '\u2705',
  unknown: '\u2753',
};

const STATUS_LABEL: Record<ScheduleStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due Soon',
  ok: 'OK',
  unknown: 'Unknown',
};

function formatDueInfo(
  schedule: MaintenanceSchedule,
  status: ScheduleStatus,
  currentOdometer: number,
): string {
  const parts: string[] = [];
  if (schedule.nextDueOdometer !== null) {
    const diff = schedule.nextDueOdometer - currentOdometer;
    if (diff > 0) {
      parts.push(`${diff.toLocaleString()} mi remaining`);
    } else {
      parts.push(`${Math.abs(diff).toLocaleString()} mi overdue`);
    }
  }
  if (schedule.nextDueDate) {
    parts.push(`by ${schedule.nextDueDate}`);
  }
  if (parts.length === 0 && status === 'unknown') {
    return 'Set last service date/odometer for accurate reminders';
  }
  return parts.join(' or ');
}

type ViewMode = 'all' | 'by_vehicle';

// Predefined service types for add form
const SERVICE_TYPES: { key: ScheduleServiceType; label: string }[] = [
  { key: 'oil_change', label: 'Oil Change' },
  { key: 'tire_rotation', label: 'Tire Rotation' },
  { key: 'brake_inspection', label: 'Brake Inspection' },
  { key: 'air_filter', label: 'Air Filter' },
  { key: 'transmission_fluid', label: 'Trans Fluid' },
  { key: 'coolant', label: 'Coolant' },
  { key: 'spark_plugs', label: 'Spark Plugs' },
  { key: 'battery', label: 'Battery' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'registration', label: 'Registration' },
  { key: 'custom', label: 'Custom' },
];

export default function RemindersScreen() {
  const db = useDatabase();
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);

  // Add form state
  const [addVehicleId, setAddVehicleId] = useState<string | null>(null);
  const [addServiceType, setAddServiceType] = useState<ScheduleServiceType>('oil_change');
  const [addCustomName, setAddCustomName] = useState('');
  const [addMiles, setAddMiles] = useState('');
  const [addMonths, setAddMonths] = useState('');
  const [addLastOdometer, setAddLastOdometer] = useState('');
  const [addLastDate, setAddLastDate] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const vehicles = useMemo(() => getVehicles(db), [db, tick]);
  const today = new Date().toISOString().slice(0, 10);

  const schedules = useMemo(() => getActiveSchedules(db), [db, tick]);

  const sortedSchedules = useMemo(() => {
    // Use the primary vehicle's odometer or 0 as a fallback for sorting
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
    return schedules.map((s) => {
      const vehicle = vehicleMap.get(s.vehicleId);
      const currentOdometer = vehicle?.odometer ?? 0;
      return {
        ...s,
        status: calculateScheduleStatus(s, currentOdometer, today) as ScheduleStatus,
        vehicleName: vehicle?.name ?? 'Unknown',
        currentOdometer,
      };
    }).sort((a, b) => {
      const priority: Record<ScheduleStatus, number> = { overdue: 3, due_soon: 2, ok: 1, unknown: 0 };
      const pDiff = priority[b.status] - priority[a.status];
      if (pDiff !== 0) return pDiff;
      return a.serviceType.localeCompare(b.serviceType);
    });
  }, [schedules, vehicles, today]);

  const handleSetupDefaults = useCallback((vehicleId: string, vehicle: Vehicle) => {
    Alert.alert(
      'Set up maintenance reminders?',
      `We'll add recommended schedules for ${vehicle.name} (oil changes, tire rotations, and more).`,
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Set Up',
          onPress: () => {
            const presets = getDefaultSchedules();
            presets.forEach((preset) => {
              createSchedule(db, uuid(), {
                vehicleId,
                serviceType: preset.serviceType,
                intervalMiles: preset.intervalMiles ?? undefined,
                intervalMonths: preset.intervalMonths ?? undefined,
                lastServiceOdometer: vehicle.odometer,
                lastServiceDate: today,
              });
            });
            refresh();
          },
        },
      ],
    );
  }, [db, today, refresh]);

  const handleSnooze = useCallback((schedule: MaintenanceSchedule) => {
    const newSnoozeMiles = schedule.snoozeMiles + (schedule.intervalMiles !== null ? 500 : 0);
    const newSnoozeDays = schedule.snoozeDateOffsetDays + (schedule.intervalMonths !== null ? 30 : 0);
    const newCount = schedule.snoozeCount + 1;

    updateSchedule(db, schedule.id, {
      snoozeMiles: newSnoozeMiles,
      snoozeDateOffsetDays: newSnoozeDays,
      snoozeCount: newCount,
    });

    if (newCount >= 3) {
      Alert.alert(
        'Snoozed Multiple Times',
        `This service has been snoozed ${newCount} times. Consider scheduling it soon.`,
      );
    }
    refresh();
  }, [db, refresh]);

  const handleDismiss = useCallback((id: string) => {
    Alert.alert('Dismiss Reminder?', 'This will remove the reminder from your upcoming list. The record is preserved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dismiss',
        style: 'destructive',
        onPress: () => {
          deactivateSchedule(db, id);
          setSelectedDetail(null);
          refresh();
        },
      },
    ]);
  }, [db, refresh]);

  const handleAddSchedule = useCallback(() => {
    if (!addVehicleId) {
      setAddError('Select a vehicle');
      return;
    }
    const miles = addMiles ? parseInt(addMiles, 10) : undefined;
    const months = addMonths ? parseInt(addMonths, 10) : undefined;
    if (!miles && !months) {
      setAddError('Set a mileage or time interval');
      return;
    }
    try {
      createSchedule(db, uuid(), {
        vehicleId: addVehicleId,
        serviceType: addServiceType,
        serviceTypeCustom: addServiceType === 'custom' ? addCustomName : undefined,
        intervalMiles: miles,
        intervalMonths: months,
        lastServiceOdometer: addLastOdometer ? parseInt(addLastOdometer, 10) : undefined,
        lastServiceDate: addLastDate || undefined,
      });
      setShowAddForm(false);
      setAddError(null);
      setAddMiles('');
      setAddMonths('');
      setAddLastOdometer('');
      setAddLastDate('');
      setAddCustomName('');
      refresh();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Invalid input');
    }
  }, [db, addVehicleId, addServiceType, addCustomName, addMiles, addMonths, addLastOdometer, addLastDate, refresh]);

  // No vehicles empty state
  if (vehicles.length === 0) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={{ fontSize: 48 }}>{'\uD83D\uDE97'}</Text>
        <Text variant="subheading" color={colors.textSecondary}>
          Add a vehicle to set up maintenance reminders
        </Text>
        <Text variant="caption" color={colors.textTertiary}>
          Go to the Garage tab to add your first vehicle
        </Text>
      </View>
    );
  }

  // Detail view for a single reminder
  const detailSchedule = selectedDetail
    ? sortedSchedules.find((s) => s.id === selectedDetail)
    : null;

  if (detailSchedule) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable onPress={() => setSelectedDetail(null)}>
          <Text variant="caption" color={accentColor}>{'\u2190'} Back to Reminders</Text>
        </Pressable>

        <Text variant="heading" style={{ color: accentColor }}>
          {serviceTypeLabel(detailSchedule.serviceType, detailSchedule.serviceTypeCustom)}
        </Text>

        <View style={[styles.statusBadgeLarge, { backgroundColor: STATUS_COLORS[detailSchedule.status] + '22' }]}>
          <Text style={{ fontSize: 24 }}>{STATUS_ICONS[detailSchedule.status]}</Text>
          <Text style={{ color: STATUS_COLORS[detailSchedule.status], fontWeight: '700', fontSize: 18 }}>
            {STATUS_LABEL[detailSchedule.status]}
          </Text>
        </View>

        <Text variant="body" color={colors.textSecondary}>
          {formatDueInfo(detailSchedule, detailSchedule.status, detailSchedule.currentOdometer)}
        </Text>

        <Card style={styles.detailCard}>
          <Text variant="subheading">Schedule Details</Text>
          {detailSchedule.intervalMiles && (
            <Text variant="body" color={colors.textSecondary}>
              Every {detailSchedule.intervalMiles.toLocaleString()} miles
            </Text>
          )}
          {detailSchedule.intervalMonths && (
            <Text variant="body" color={colors.textSecondary}>
              Every {detailSchedule.intervalMonths} months
            </Text>
          )}
          <Text variant="body" color={colors.textSecondary}>
            Vehicle: {detailSchedule.vehicleName}
          </Text>
        </Card>

        {(detailSchedule.lastServiceDate || detailSchedule.lastServiceOdometer) && (
          <Card style={styles.detailCard}>
            <Text variant="subheading">Last Service</Text>
            {detailSchedule.lastServiceDate && (
              <Text variant="body" color={colors.textSecondary}>
                Date: {detailSchedule.lastServiceDate}
              </Text>
            )}
            {detailSchedule.lastServiceOdometer !== null && (
              <Text variant="body" color={colors.textSecondary}>
                Odometer: {detailSchedule.lastServiceOdometer.toLocaleString()} mi
              </Text>
            )}
          </Card>
        )}

        {detailSchedule.snoozeCount > 0 && (
          <Card style={styles.detailCard}>
            <Text variant="caption" color={colors.textSecondary}>
              Snoozed {detailSchedule.snoozeCount} time{detailSchedule.snoozeCount !== 1 ? 's' : ''}
            </Text>
          </Card>
        )}

        <View style={styles.actionButtons}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: accentColor }]}
            onPress={() => handleSnooze(detailSchedule)}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              Snooze {detailSchedule.intervalMiles !== null ? '500 mi' : ''}{detailSchedule.intervalMiles !== null && detailSchedule.intervalMonths !== null ? ' / ' : ''}{detailSchedule.intervalMonths !== null ? '1 month' : ''}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, { backgroundColor: colors.danger }]}
            onPress={() => handleDismiss(detailSchedule.id)}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Dismiss Reminder</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // Add form view
  if (showAddForm) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable onPress={() => { setShowAddForm(false); setAddError(null); }}>
          <Text variant="caption" color={accentColor}>{'\u2190'} Back to Reminders</Text>
        </Pressable>

        <Text variant="heading" style={{ color: accentColor }}>Add Reminder</Text>

        <Card style={styles.formCard}>
          <Text variant="subheading">Vehicle</Text>
          <View style={styles.chipRow}>
            {vehicles.map((v) => (
              <Pressable
                key={v.id}
                style={[styles.chip, addVehicleId === v.id && styles.chipSelected]}
                onPress={() => setAddVehicleId(v.id)}
              >
                <Text variant="caption" color={addVehicleId === v.id ? colors.background : colors.text}>
                  {v.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text variant="subheading">Service Type</Text>
          <View style={styles.chipRow}>
            {SERVICE_TYPES.map((st) => (
              <Pressable
                key={st.key}
                style={[styles.chip, addServiceType === st.key && styles.chipSelected]}
                onPress={() => setAddServiceType(st.key)}
              >
                <Text variant="caption" color={addServiceType === st.key ? colors.background : colors.text}>
                  {st.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {addServiceType === 'custom' && (
            <TextInput
              style={styles.input}
              value={addCustomName}
              onChangeText={setAddCustomName}
              placeholder="Custom service name"
              placeholderTextColor={colors.textTertiary}
            />
          )}
        </Card>

        <Card style={styles.formCard}>
          <Text variant="subheading">Interval</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text variant="caption" color={colors.textSecondary}>Miles</Text>
              <TextInput
                style={styles.input}
                value={addMiles}
                onChangeText={setAddMiles}
                placeholder="5000"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text variant="caption" color={colors.textSecondary}>Months</Text>
              <TextInput
                style={styles.input}
                value={addMonths}
                onChangeText={setAddMonths}
                placeholder="6"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text variant="subheading">Last Service (optional)</Text>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text variant="caption" color={colors.textSecondary}>Odometer</Text>
              <TextInput
                style={styles.input}
                value={addLastOdometer}
                onChangeText={setAddLastOdometer}
                placeholder="20000"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text variant="caption" color={colors.textSecondary}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={addLastDate}
                onChangeText={setAddLastDate}
                placeholder="2026-01-01"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          </View>
        </Card>

        {addError && <Text style={styles.errorText}>{addError}</Text>}

        <Pressable style={[styles.saveButton, { backgroundColor: accentColor }]} onPress={handleAddSchedule}>
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Save Reminder</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // Main reminders list
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* View toggle */}
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleButton, viewMode === 'all' && styles.toggleActive]}
          onPress={() => setViewMode('all')}
        >
          <Text variant="caption" color={viewMode === 'all' ? colors.background : colors.textSecondary}>
            All Vehicles
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleButton, viewMode === 'by_vehicle' && styles.toggleActive]}
          onPress={() => setViewMode('by_vehicle')}
        >
          <Text variant="caption" color={viewMode === 'by_vehicle' ? colors.background : colors.textSecondary}>
            By Vehicle
          </Text>
        </Pressable>
      </View>

      {sortedSchedules.length === 0 ? (
        <Card>
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 36 }}>{'\uD83D\uDD14'}</Text>
            <Text variant="body" color={colors.textSecondary}>
              No reminders set up
            </Text>
            <Text variant="caption" color={colors.textTertiary}>
              Add a reminder or set up defaults for a vehicle
            </Text>
            {vehicles.map((v) => {
              const vehicleSchedules = schedules.filter((s) => s.vehicleId === v.id);
              if (vehicleSchedules.length > 0) return null;
              return (
                <Pressable
                  key={v.id}
                  style={[styles.setupButton, { borderColor: accentColor }]}
                  onPress={() => handleSetupDefaults(v.id, v)}
                >
                  <Text variant="caption" color={accentColor}>
                    Set up defaults for {v.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : viewMode === 'all' ? (
        sortedSchedules.map((s) => (
          <Pressable key={s.id} onPress={() => setSelectedDetail(s.id)}>
            <Card style={styles.reminderCard}>
              <View style={styles.reminderRow}>
                <View style={styles.reminderInfo}>
                  <Text variant="body">
                    {serviceTypeLabel(s.serviceType, s.serviceTypeCustom)}
                  </Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {s.vehicleName} {'\u00B7'} {formatDueInfo(s, s.status, s.currentOdometer)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[s.status] + '22' }]}>
                  <Text style={{ fontSize: 12 }}>{STATUS_ICONS[s.status]}</Text>
                  <Text style={[styles.statusText, { color: STATUS_COLORS[s.status] }]}>
                    {STATUS_LABEL[s.status]}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        ))
      ) : (
        vehicles.map((v) => {
          const vehicleSchedules = sortedSchedules.filter((s) => s.vehicleId === v.id);
          if (vehicleSchedules.length === 0) return null;
          return (
            <View key={v.id}>
              <Text variant="subheading" style={{ marginBottom: spacing.sm }}>
                {v.name}
              </Text>
              {vehicleSchedules.map((s) => (
                <Pressable key={s.id} onPress={() => setSelectedDetail(s.id)}>
                  <Card style={styles.reminderCard}>
                    <View style={styles.reminderRow}>
                      <View style={styles.reminderInfo}>
                        <Text variant="body">
                          {serviceTypeLabel(s.serviceType, s.serviceTypeCustom)}
                        </Text>
                        <Text variant="caption" color={colors.textSecondary}>
                          {formatDueInfo(s, s.status, s.currentOdometer)}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[s.status] + '22' }]}>
                        <Text style={{ fontSize: 12 }}>{STATUS_ICONS[s.status]}</Text>
                        <Text style={[styles.statusText, { color: STATUS_COLORS[s.status] }]}>
                          {STATUS_LABEL[s.status]}
                        </Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          );
        })
      )}

      {/* Vehicles with no schedules: offer setup */}
      {vehicles.filter((v) => !schedules.some((s) => s.vehicleId === v.id)).map((v) => (
        <Card key={v.id}>
          <View style={styles.setupRow}>
            <Text variant="body" color={colors.textSecondary}>
              {v.name}: No reminders
            </Text>
            <Pressable
              style={[styles.setupButton, { borderColor: accentColor }]}
              onPress={() => handleSetupDefaults(v.id, v)}
            >
              <Text variant="caption" color={accentColor}>Set up defaults</Text>
            </Pressable>
          </View>
        </Card>
      ))}

      {/* Add custom reminder button */}
      <Pressable
        style={[styles.addButton, { borderColor: accentColor }]}
        onPress={() => {
          setAddVehicleId(vehicles[0]?.id ?? null);
          setShowAddForm(true);
        }}
      >
        <Text style={{ color: accentColor, fontWeight: '600' }}>+ Add Custom Reminder</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  emptyScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyCard: { paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.sm },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
  },
  toggleActive: {
    backgroundColor: accentColor,
  },
  reminderCard: { gap: spacing.xs },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reminderInfo: { flex: 1, gap: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: accentColor },
  formCard: { gap: spacing.sm },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  inputGroup: { flex: 1, gap: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    fontSize: 16,
  },
  errorText: { color: '#FF453A', fontSize: 13 },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  setupButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  setupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailCard: { gap: spacing.xs },
  actionButtons: { gap: spacing.sm },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
});
