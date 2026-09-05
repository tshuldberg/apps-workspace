import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import {
  createLocationReminder,
  deleteLocationReminder,
  getHabits,
  getSetting,
  isLocationSupported,
  setSetting,
  updateLocationReminder,
  validateCoordinates,
  validateRadius,
  type LocationReminder,
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_FONTS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  MaterialSymbol,
  SectionHeader,
  withAlpha,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type PermissionMode = 'unknown' | 'while_using' | 'always';
type ReminderStep = 0 | 1 | 2 | 3;
type TriggerType = 'arrival' | 'departure' | 'both';

type ReminderDraft = {
  locationName: string;
  latitude: string;
  longitude: string;
  radiusMeters: number;
  triggerType: TriggerType;
  habitId: string | null;
};

const LOCATION_PERMISSION_KEY = 'habits_location_permission_mode';

const PRESET_LOCATIONS: Array<{ name: string; latitude: number; longitude: number }> = [
  { name: 'Home', latitude: 34.0522, longitude: -118.2437 },
  { name: 'Work', latitude: 34.0489, longitude: -118.2568 },
  { name: 'Gym', latitude: 34.0627, longitude: -118.3083 },
  { name: 'Park', latitude: 34.0721, longitude: -118.2606 },
];

const RADIUS_OPTIONS = [50, 100, 150, 250, 500];
const TRIGGER_OPTIONS: TriggerType[] = ['arrival', 'departure', 'both'];

function defaultDraft(): ReminderDraft {
  return {
    locationName: '',
    latitude: '',
    longitude: '',
    radiusMeters: 100,
    triggerType: 'arrival',
    habitId: null,
  };
}

function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

function formatTrigger(triggerType: string) {
  switch (triggerType) {
    case 'arrival':
      return 'Enter';
    case 'departure':
      return 'Leave';
    case 'both':
      return 'Both';
    default:
      return triggerType;
  }
}

function normalizePosition(value: number, min: number, max: number) {
  if (min === max) return 50;
  return ((value - min) / (max - min)) * 70 + 15;
}

function mapReminderRows(rows: Array<Record<string, unknown>>): LocationReminder[] {
  return rows.map((row) => ({
    id: row.id as string,
    habitId: row.habit_id as string,
    locationName: row.location_name as string,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMeters: Number(row.radius_meters),
    triggerType: row.trigger_type as TriggerType,
    isActive: Number(row.is_active) === 1,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

export default function LocationRemindersScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorStep, setEditorStep] = useState<ReminderStep>(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReminderDraft>(defaultDraft());

  const refresh = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  const reminders = useMemo(() => {
    const rows = db.query<Record<string, unknown>>(
      'SELECT * FROM hb_location_reminders ORDER BY updated_at DESC, created_at DESC',
    );
    return mapReminderRows(rows);
  }, [db, tick]);

  const habits = useMemo(
    () => getHabits(db, { isArchived: false }),
    [db, tick],
  );

  const habitsById = useMemo(
    () => new Map(habits.map((habit) => [habit.id, habit])),
    [habits],
  );

  const selectedReminder = useMemo(
    () => reminders.find((reminder) => reminder.id === selectedReminderId) ?? reminders[0] ?? null,
    [reminders, selectedReminderId],
  );

  const permissionMode = useMemo(
    () => (getSetting(db, LOCATION_PERMISSION_KEY) as PermissionMode | null) ?? 'unknown',
    [db, tick],
  );

  const mapBounds = useMemo(() => {
    if (reminders.length === 0) {
      return {
        minLat: 33.9,
        maxLat: 34.2,
        minLng: -118.4,
        maxLng: -118.0,
      };
    }

    return reminders.reduce(
      (bounds, reminder) => ({
        minLat: Math.min(bounds.minLat, reminder.latitude),
        maxLat: Math.max(bounds.maxLat, reminder.latitude),
        minLng: Math.min(bounds.minLng, reminder.longitude),
        maxLng: Math.max(bounds.maxLng, reminder.longitude),
      }),
      {
        minLat: reminders[0].latitude,
        maxLat: reminders[0].latitude,
        minLng: reminders[0].longitude,
        maxLng: reminders[0].longitude,
      },
    );
  }, [reminders]);

  const openNewReminder = useCallback(() => {
    setEditingId(null);
    setEditorStep(0);
    setDraft({
      ...defaultDraft(),
      habitId: habits[0]?.id ?? null,
    });
    setEditorVisible(true);
  }, [habits]);

  const openEditReminder = useCallback((reminder: LocationReminder) => {
    setEditingId(reminder.id);
    setEditorStep(0);
    setDraft({
      locationName: reminder.locationName,
      latitude: String(reminder.latitude),
      longitude: String(reminder.longitude),
      radiusMeters: reminder.radiusMeters,
      triggerType: reminder.triggerType,
      habitId: reminder.habitId,
    });
    setEditorVisible(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorVisible(false);
    setEditingId(null);
    setEditorStep(0);
    setDraft(defaultDraft());
  }, []);

  const setReminderActive = useCallback(
    (id: string, isActive: boolean) => {
      db.execute(
        'UPDATE hb_location_reminders SET is_active = ?, updated_at = ? WHERE id = ?',
        [isActive ? 1 : 0, new Date().toISOString(), id],
      );
      refresh();
    },
    [db, refresh],
  );

  const handleDeleteReminder = useCallback(
    (reminder: LocationReminder) => {
      Alert.alert('Delete Reminder', 'Remove this location reminder?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteLocationReminder(db, reminder.id);
            refresh();
          },
        },
      ]);
    },
    [db, refresh],
  );

  const handleSaveReminder = useCallback(() => {
    const latitude = Number.parseFloat(draft.latitude);
    const longitude = Number.parseFloat(draft.longitude);

    if (!draft.locationName.trim() || !draft.habitId) {
      Alert.alert('Missing Info', 'Give the reminder a name and link it to a habit.');
      return;
    }

    if (!validateCoordinates(latitude, longitude)) {
      Alert.alert('Invalid Coordinates', 'Enter a latitude and longitude inside normal map ranges.');
      return;
    }

    if (!validateRadius(draft.radiusMeters)) {
      Alert.alert('Invalid Radius', 'Radius must be between 50 and 500 meters.');
      return;
    }

    if (editingId) {
      updateLocationReminder(db, editingId, {
        habitId: draft.habitId,
        locationName: draft.locationName.trim(),
        latitude,
        longitude,
        radiusMeters: draft.radiusMeters,
        triggerType: draft.triggerType,
      });
      setReminderActive(editingId, true);
    } else {
      createLocationReminder(db, uuid(), {
        habitId: draft.habitId,
        locationName: draft.locationName.trim(),
        latitude,
        longitude,
        radiusMeters: draft.radiusMeters,
        triggerType: draft.triggerType,
      });
    }

    closeEditor();
    refresh();
  }, [closeEditor, db, draft, editingId, refresh, setReminderActive]);

  const savePermissionMode = useCallback(
    (mode: PermissionMode) => {
      setSetting(db, LOCATION_PERMISSION_KEY, mode);
      refresh();
    },
    [db, refresh],
  );

  const canAdvanceStep = useCallback(() => {
    switch (editorStep) {
      case 0:
        return Boolean(draft.locationName.trim() && draft.latitude && draft.longitude);
      case 1:
        return validateRadius(draft.radiusMeters);
      case 2:
        return Boolean(draft.habitId);
      case 3:
        return true;
      default:
        return false;
    }
  }, [draft, editorStep]);

  const supported = isLocationSupported(Platform.OS);

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>Contextual nudges</Text>
            <Text style={styles.title}>Location Reminders</Text>
            <Text style={styles.subtitle}>
              Set arrival and departure cues so habits show up when your day naturally reaches the right place.
            </Text>
          </View>
          <Pressable style={styles.addButton} onPress={openNewReminder}>
            <MaterialSymbol name="add" size={18} color={HB_TEXT} filled />
          </Pressable>
        </View>

        <GlassCard level={4} style={styles.mapCard} contentStyle={styles.mapCardContent}>
          <View style={styles.mapHeaderRow}>
            <View>
              <Text style={styles.mapTitle}>Reminder Map</Text>
              <Text style={styles.mapSubtitle}>
                {reminders.length === 0
                  ? 'Pins will appear here once you save your first place.'
                  : 'Tap a pin or reminder row to inspect the active geofence.'}
              </Text>
            </View>
            <View style={styles.mapLegend}>
              <View style={[styles.legendDot, styles.legendDotUser]} />
              <Text style={styles.legendLabel}>You</Text>
            </View>
          </View>

          <View style={styles.mapCanvas}>
            <View style={styles.mapGridHorizontalTop} />
            <View style={styles.mapGridHorizontalBottom} />
            <View style={styles.mapGridVerticalLeft} />
            <View style={styles.mapGridVerticalRight} />

            <View style={styles.userMarker}>
              <View style={styles.userMarkerCore} />
            </View>

            {reminders.map((reminder) => {
              const left = `${normalizePosition(
                reminder.longitude,
                mapBounds.minLng,
                mapBounds.maxLng,
              )}%`;
              const top = `${normalizePosition(
                reminder.latitude,
                mapBounds.minLat,
                mapBounds.maxLat,
              )}%`;
              const selected = selectedReminder?.id === reminder.id;
              const pinPositionStyle = {
                left,
                top,
              } as unknown as ViewStyle;

              return (
                <Pressable
                  key={reminder.id}
                  onPress={() => setSelectedReminderId(reminder.id)}
                  style={[
                    styles.pinButton,
                    pinPositionStyle,
                  ]}
                >
                  <View
                    style={[
                      styles.pin,
                      selected ? styles.pinSelected : null,
                      !reminder.isActive ? styles.pinInactive : null,
                    ]}
                  >
                    <MaterialSymbol
                      name="location_on"
                      size={16}
                      color={HB_TEXT}
                      filled
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>

          {selectedReminder ? (
            <View style={styles.mapDetailCard}>
              <View style={styles.mapDetailTopRow}>
                <View style={styles.mapDetailCopy}>
                  <Text style={styles.mapDetailTitle}>{selectedReminder.locationName}</Text>
                  <Text style={styles.mapDetailSubtitle}>
                    {habitsById.get(selectedReminder.habitId)?.name ?? 'Unlinked habit'} • {formatTrigger(selectedReminder.triggerType)} • {selectedReminder.radiusMeters}m
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    selectedReminder.isActive ? styles.statusPillActive : styles.statusPillInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      selectedReminder.isActive ? styles.statusPillTextActive : styles.statusPillTextInactive,
                    ]}
                  >
                    {selectedReminder.isActive ? 'Active' : 'Paused'}
                  </Text>
                </View>
              </View>
              <Text style={styles.mapDetailCoordinates}>
                {formatCoordinates(selectedReminder.latitude, selectedReminder.longitude)}
              </Text>
            </View>
          ) : null}
        </GlassCard>

        <GlassCard level={2} contentStyle={styles.sectionCard}>
          <SectionHeader
            title="Permissions"
            action={{
              label: 'Open Settings',
              onPress: () => {
                void Linking.openSettings();
              },
            }}
          />
          <Text style={styles.permissionBody}>
            {supported
              ? 'Location-triggered reminders need background access in a production build. Mark your current permission mode below so the app can keep the setup state visible.'
              : 'Geofence reminders are not available on this platform.'}
          </Text>
          <View style={styles.permissionModeRow}>
            {(['unknown', 'while_using', 'always'] as PermissionMode[]).map((mode) => {
              const selected = permissionMode === mode;
              return (
                <Pressable
                  key={mode}
                  style={[
                    styles.permissionChip,
                    selected ? styles.permissionChipSelected : null,
                  ]}
                  onPress={() => savePermissionMode(mode)}
                >
                  <Text
                    style={[
                      styles.permissionChipText,
                      selected ? styles.permissionChipTextSelected : null,
                    ]}
                  >
                    {mode === 'unknown'
                      ? 'Not set'
                      : mode === 'while_using'
                        ? 'While Using'
                        : 'Always'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        <GlassCard level={2} contentStyle={styles.sectionCard}>
          <SectionHeader title="Reminder List" />
          {reminders.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialSymbol
                name="location_on"
                size={24}
                color={HB_ACCENT_LIGHT}
                filled
              />
              <Text style={styles.emptyTitle}>No locations saved yet</Text>
              <Text style={styles.emptyBody}>
                Add a few places like Home, Work, or Gym, then link each one to the habit you want to surface there.
              </Text>
              <Pressable style={styles.primaryButton} onPress={openNewReminder}>
                <Text style={styles.primaryButtonText}>Add First Reminder</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.reminderList}>
              {reminders.map((reminder) => {
                const habit = habitsById.get(reminder.habitId);
                const selected = selectedReminder?.id === reminder.id;

                return (
                  <Pressable
                    key={reminder.id}
                    onPress={() => setSelectedReminderId(reminder.id)}
                  >
                    <GlassCard
                      level={1}
                      style={[
                        styles.reminderCard,
                        selected ? styles.reminderCardSelected : null,
                      ]}
                      contentStyle={styles.reminderCardContent}
                    >
                      <View style={styles.reminderHeaderRow}>
                        <View style={styles.reminderHeaderCopy}>
                          <Text style={styles.reminderTitle}>{reminder.locationName}</Text>
                          <Text style={styles.reminderSubtitle}>
                            {habit?.icon ? `${habit.icon} ` : ''}
                            {habit?.name ?? 'Unknown habit'}
                          </Text>
                        </View>
                        <Switch
                          trackColor={{
                            false: withAlpha(HB_TEXT_TERTIARY, 0.28),
                            true: withAlpha(HB_ACCENT, 0.6),
                          }}
                          thumbColor={reminder.isActive ? HB_ACCENT_LIGHT : HB_TEXT}
                          value={reminder.isActive}
                          onValueChange={(enabled) => setReminderActive(reminder.id, enabled)}
                        />
                      </View>

                      <View style={styles.reminderMetaRow}>
                        <View style={styles.metaPill}>
                          <Text style={styles.metaPillText}>{formatTrigger(reminder.triggerType)}</Text>
                        </View>
                        <View style={styles.metaPill}>
                          <Text style={styles.metaPillText}>{reminder.radiusMeters}m</Text>
                        </View>
                        <Text style={styles.coordinatesText}>
                          {formatCoordinates(reminder.latitude, reminder.longitude)}
                        </Text>
                      </View>

                      <View style={styles.reminderActions}>
                        <Pressable
                          style={styles.secondaryButton}
                          onPress={() => openEditReminder(reminder)}
                        >
                          <Text style={styles.secondaryButtonText}>Edit</Text>
                        </Pressable>
                        <Pressable
                          style={styles.tertiaryButton}
                          onPress={() => handleDeleteReminder(reminder)}
                        >
                          <Text style={styles.tertiaryButtonText}>Delete</Text>
                        </Pressable>
                      </View>
                    </GlassCard>
                  </Pressable>
                );
              })}
            </View>
          )}
        </GlassCard>
      </ScrollView>

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={editorVisible}
        onRequestClose={closeEditor}
      >
        <View style={styles.editorScreen}>
          <View style={styles.editorHeader}>
            <Pressable onPress={closeEditor}>
              <Text style={styles.editorDismiss}>Cancel</Text>
            </Pressable>
            <Text style={styles.editorTitle}>
              {editingId ? 'Edit Location' : 'Add Location'}
            </Text>
            <Pressable
              onPress={() => {
                if (editorStep === 3) {
                  handleSaveReminder();
                  return;
                }
                if (!canAdvanceStep()) {
                  Alert.alert('Incomplete Step', 'Finish the current step before moving on.');
                  return;
                }
                setEditorStep((current) => Math.min(3, current + 1) as ReminderStep);
              }}
            >
              <Text style={styles.editorSave}>
                {editorStep === 3 ? 'Save' : 'Next'}
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.editorContent}>
            <View style={styles.stepDots}>
              {[0, 1, 2, 3].map((value) => (
                <View
                  key={value}
                  style={[
                    styles.stepDot,
                    editorStep === value ? styles.stepDotActive : null,
                  ]}
                />
              ))}
            </View>

            {editorStep === 0 ? (
              <GlassCard level={2} contentStyle={styles.sectionCard}>
                <SectionHeader title="Step 1: Pick a location" />
                <TextInput
                  placeholder="Location name"
                  placeholderTextColor={HB_TEXT_TERTIARY}
                  style={styles.input}
                  value={draft.locationName}
                  onChangeText={(locationName) => setDraft((current) => ({ ...current, locationName }))}
                />
                <View style={styles.coordinateRow}>
                  <TextInput
                    keyboardType="decimal-pad"
                    placeholder="Latitude"
                    placeholderTextColor={HB_TEXT_TERTIARY}
                    style={[styles.input, styles.coordinateInput]}
                    value={draft.latitude}
                    onChangeText={(latitude) => setDraft((current) => ({ ...current, latitude }))}
                  />
                  <TextInput
                    keyboardType="decimal-pad"
                    placeholder="Longitude"
                    placeholderTextColor={HB_TEXT_TERTIARY}
                    style={[styles.input, styles.coordinateInput]}
                    value={draft.longitude}
                    onChangeText={(longitude) => setDraft((current) => ({ ...current, longitude }))}
                  />
                </View>
                <Text style={styles.fieldHint}>Use any real coordinates or tap a preset below.</Text>
                <View style={styles.presetList}>
                  {PRESET_LOCATIONS.map((preset) => (
                    <Pressable
                      key={preset.name}
                      style={styles.presetChip}
                      onPress={() => {
                        setDraft((current) => ({
                          ...current,
                          locationName: preset.name,
                          latitude: String(preset.latitude),
                          longitude: String(preset.longitude),
                        }));
                      }}
                    >
                      <Text style={styles.presetChipText}>{preset.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </GlassCard>
            ) : null}

            {editorStep === 1 ? (
              <GlassCard level={2} contentStyle={styles.sectionCard}>
                <SectionHeader title="Step 2: Set the radius" />
                <Text style={styles.fieldHint}>
                  Smaller radii feel more precise. Larger radii catch you earlier.
                </Text>
                <View style={styles.presetList}>
                  {RADIUS_OPTIONS.map((radius) => {
                    const selected = draft.radiusMeters === radius;
                    return (
                      <Pressable
                        key={radius}
                        style={[
                          styles.radiusChip,
                          selected ? styles.radiusChipSelected : null,
                        ]}
                        onPress={() => setDraft((current) => ({ ...current, radiusMeters: radius }))}
                      >
                        <Text
                          style={[
                            styles.radiusChipText,
                            selected ? styles.radiusChipTextSelected : null,
                          ]}
                        >
                          {radius}m
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </GlassCard>
            ) : null}

            {editorStep === 2 ? (
              <GlassCard level={2} contentStyle={styles.sectionCard}>
                <SectionHeader title="Step 3: Link a habit" />
                <View style={styles.editorOptionList}>
                  {habits.map((habit) => {
                    const selected = draft.habitId === habit.id;
                    return (
                      <Pressable
                        key={habit.id}
                        style={[
                          styles.editorOption,
                          selected ? styles.editorOptionSelected : null,
                        ]}
                        onPress={() => setDraft((current) => ({ ...current, habitId: habit.id }))}
                      >
                        <Text style={styles.editorOptionLabel}>
                          {habit.icon ? `${habit.icon} ` : ''}
                          {habit.name}
                        </Text>
                        <Text style={styles.editorOptionHint}>
                          {habit.frequency} • {habit.timeOfDay}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </GlassCard>
            ) : null}

            {editorStep === 3 ? (
              <GlassCard level={2} contentStyle={styles.sectionCard}>
                <SectionHeader title="Step 4: Choose the trigger" />
                <View style={styles.presetList}>
                  {TRIGGER_OPTIONS.map((option) => {
                    const selected = draft.triggerType === option;
                    return (
                      <Pressable
                        key={option}
                        style={[
                          styles.radiusChip,
                          selected ? styles.radiusChipSelected : null,
                        ]}
                        onPress={() => setDraft((current) => ({ ...current, triggerType: option }))}
                      >
                        <Text
                          style={[
                            styles.radiusChipText,
                            selected ? styles.radiusChipTextSelected : null,
                          ]}
                        >
                          {formatTrigger(option)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Summary</Text>
                  <Text style={styles.summaryLine}>
                    {draft.locationName || 'Location'} • {draft.radiusMeters}m • {formatTrigger(draft.triggerType)}
                  </Text>
                  <Text style={styles.summaryLine}>
                    {habitsById.get(draft.habitId ?? '')?.name ?? 'Choose a habit'}
                  </Text>
                </View>
              </GlassCard>
            ) : null}

            {editorStep > 0 ? (
              <Pressable
                style={styles.backButton}
                onPress={() => setEditorStep((current) => Math.max(0, current - 1) as ReminderStep)}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 44,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  title: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
  },
  subtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  addButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: withAlpha(HB_ACCENT, 0.24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapCard: {
    backgroundColor: withAlpha(HB_ACCENT, 0.08),
  },
  mapCardContent: {
    gap: 16,
  },
  mapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  mapTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 22,
    lineHeight: 26,
    color: HB_TEXT,
  },
  mapSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    marginTop: 4,
    maxWidth: 240,
  },
  mapLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendDotUser: {
    backgroundColor: '#30D158',
  },
  legendLabel: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
  },
  mapCanvas: {
    height: 256,
    borderRadius: 24,
    backgroundColor: withAlpha('#8BCFF0', 0.08),
    overflow: 'hidden',
  },
  mapGridHorizontalTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '33%',
    height: 1,
    backgroundColor: withAlpha(HB_TEXT_TERTIARY, 0.14),
  },
  mapGridHorizontalBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '66%',
    height: 1,
    backgroundColor: withAlpha(HB_TEXT_TERTIARY, 0.14),
  },
  mapGridVerticalLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33%',
    width: 1,
    backgroundColor: withAlpha(HB_TEXT_TERTIARY, 0.14),
  },
  mapGridVerticalRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '66%',
    width: 1,
    backgroundColor: withAlpha(HB_TEXT_TERTIARY, 0.14),
  },
  userMarker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 14,
    backgroundColor: withAlpha('#30D158', 0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMarkerCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#30D158',
  },
  pinButton: {
    position: 'absolute',
    marginLeft: -18,
    marginTop: -18,
  },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: withAlpha(HB_ACCENT, 0.74),
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSelected: {
    backgroundColor: HB_ACCENT,
    transform: [{ scale: 1.08 }],
  },
  pinInactive: {
    backgroundColor: withAlpha(HB_TEXT_TERTIARY, 0.34),
  },
  mapDetailCard: {
    borderRadius: 20,
    backgroundColor: withAlpha(HB_SURFACES.highest, 0.88),
    padding: 16,
    gap: 8,
  },
  mapDetailTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  mapDetailCopy: {
    flex: 1,
    gap: 4,
  },
  mapDetailTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  mapDetailSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  mapDetailCoordinates: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillActive: {
    backgroundColor: withAlpha('#30D158', 0.18),
  },
  statusPillInactive: {
    backgroundColor: withAlpha(HB_TEXT_TERTIARY, 0.14),
  },
  statusPillText: {
    ...HB_TYPOGRAPHY.labelUpper,
  },
  statusPillTextActive: {
    color: '#30D158',
  },
  statusPillTextInactive: {
    color: HB_TEXT_TERTIARY,
  },
  sectionCard: {
    gap: 16,
  },
  permissionBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  permissionModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  permissionChip: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  permissionChipSelected: {
    backgroundColor: withAlpha(HB_ACCENT, 0.26),
  },
  permissionChipText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
  },
  permissionChipTextSelected: {
    color: HB_TEXT,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  emptyTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  emptyBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: HB_ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 8,
  },
  primaryButtonText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  reminderList: {
    gap: 12,
  },
  reminderCard: {
    backgroundColor: withAlpha(HB_ACCENT, 0.04),
  },
  reminderCardSelected: {
    backgroundColor: withAlpha(HB_ACCENT, 0.1),
  },
  reminderCardContent: {
    gap: 12,
  },
  reminderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  reminderHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  reminderTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: HB_TEXT,
  },
  reminderSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  reminderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaPillText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  coordinatesText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
  },
  reminderActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT,
  },
  tertiaryButton: {
    borderRadius: 999,
    backgroundColor: withAlpha('#FF453A', 0.18),
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tertiaryButtonText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: '#FFB4AB',
  },
  editorScreen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  editorDismiss: {
    fontFamily: HB_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  editorTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  editorSave: {
    fontFamily: HB_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: HB_ACCENT_LIGHT,
  },
  editorContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: withAlpha(HB_TEXT_TERTIARY, 0.24),
  },
  stepDotActive: {
    width: 28,
    backgroundColor: HB_ACCENT,
  },
  input: {
    borderRadius: 16,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: HB_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  coordinateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  coordinateInput: {
    flex: 1,
  },
  fieldHint: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  presetList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetChip: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  presetChipText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT,
  },
  radiusChip: {
    borderRadius: 18,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  radiusChipSelected: {
    backgroundColor: withAlpha(HB_ACCENT, 0.26),
  },
  radiusChipText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  radiusChipTextSelected: {
    color: HB_TEXT,
  },
  editorOptionList: {
    gap: 10,
  },
  editorOption: {
    borderRadius: 16,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  editorOptionSelected: {
    backgroundColor: withAlpha(HB_ACCENT, 0.26),
  },
  editorOptionLabel: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  editorOptionHint: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  summaryCard: {
    borderRadius: 18,
    backgroundColor: withAlpha(HB_ACCENT, 0.08),
    padding: 16,
    gap: 6,
  },
  summaryLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  summaryLine: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
  },
  backButton: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
  },
});
