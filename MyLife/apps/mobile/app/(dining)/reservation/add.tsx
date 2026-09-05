import { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  createReservation,
  listRestaurants,
  getRestaurant,
} from '@mylife/dining';
import type { Restaurant, CreateReservationInput } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE_ELEVATED = '#1F1F25';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = '#9F8E81';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

const PLATFORMS = [
  { value: 'resy', label: 'Resy' },
  { value: 'opentable', label: 'OpenTable' },
  { value: 'tock', label: 'Tock' },
  { value: 'yelp', label: 'Yelp' },
  { value: 'phone', label: 'Phone' },
  { value: 'walkin', label: 'Walk-in' },
  { value: 'other', label: 'Other' },
] as const;

const REMINDERS = [
  { value: null, label: 'None' },
  { value: 90, label: '90 min' },
  { value: 1440, label: '1 day' },
  { value: 10080, label: '1 week' },
] as const;

export default function AddReservationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ restaurantId?: string }>();
  const db = useDatabase();

  // Restaurant picker state
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(
    params.restaurantId ?? null,
  );
  const [showPicker, setShowPicker] = useState(!params.restaurantId);

  const selectedRestaurant = useMemo(() => {
    if (!selectedRestaurantId) return null;
    return getRestaurant(db, selectedRestaurantId);
  }, [db, selectedRestaurantId]);

  const filteredRestaurants = useMemo(() => {
    if (!showPicker) return [];
    return listRestaurants(db, {
      search: restaurantSearch || undefined,
      sort_by: 'name',
      sort_dir: 'ASC',
      limit: 20,
    });
  }, [db, restaurantSearch, showPicker]);

  // Form fields
  const [dateStr, setDateStr] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [timeStr, setTimeStr] = useState('19:00');
  const [partySize, setPartySize] = useState('2');
  const [platform, setPlatform] = useState<string | null>(null);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(() => {
    if (!selectedRestaurantId || isSaving) return;

    const size = parseInt(partySize, 10);
    if (!size || size < 1) return;

    setIsSaving(true);
    try {
      const reservedAt = `${dateStr}T${timeStr}:00`;
      const id = uuid();
      const input: CreateReservationInput = {
        restaurant_id: selectedRestaurantId,
        reserved_at: reservedAt,
        party_size: size,
        confirmation_code: confirmationCode.trim() || null,
        platform: platform as CreateReservationInput['platform'],
        reminder_minutes: reminderMinutes,
        notes: notes.trim() || null,
      };

      createReservation(db, id, input);
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedRestaurantId, dateStr, timeStr, partySize, platform,
    confirmationCode, reminderMinutes, notes, isSaving, db, router,
  ]);

  const canSave = selectedRestaurantId && parseInt(partySize, 10) > 0 && !isSaving;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <Text style={styles.headerBack}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Add Reservation</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Restaurant Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RESTAURANT *</Text>
            {selectedRestaurant && !showPicker ? (
              <Pressable
                style={styles.selectedRestaurant}
                onPress={() => setShowPicker(true)}
              >
                <View style={styles.selectedRestaurantInfo}>
                  <Text style={styles.selectedRestaurantName}>
                    {selectedRestaurant.name}
                  </Text>
                  {(selectedRestaurant.neighborhood || selectedRestaurant.city) && (
                    <Text style={styles.selectedRestaurantLocation}>
                      {[selectedRestaurant.neighborhood, selectedRestaurant.city]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  )}
                </View>
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            ) : (
              <>
                <TextInput
                  value={restaurantSearch}
                  onChangeText={(text) => {
                    setRestaurantSearch(text);
                    setShowPicker(true);
                  }}
                  placeholder="Search restaurants..."
                  placeholderTextColor={TEXT_TERTIARY}
                  style={styles.input}
                  autoCorrect={false}
                />
                {showPicker && filteredRestaurants.length > 0 && (
                  <View style={styles.pickerList}>
                    {filteredRestaurants.map((r: Restaurant) => (
                      <Pressable
                        key={r.id}
                        style={styles.pickerItem}
                        onPress={() => {
                          setSelectedRestaurantId(r.id);
                          setShowPicker(false);
                          setRestaurantSearch('');
                        }}
                      >
                        <Text style={styles.pickerItemName}>{r.name}</Text>
                        {(r.neighborhood || r.city) && (
                          <Text style={styles.pickerItemLocation}>
                            {[r.neighborhood, r.city].filter(Boolean).join(', ')}
                          </Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                )}
                {showPicker && restaurantSearch.length > 0 && filteredRestaurants.length === 0 && (
                  <View style={styles.pickerEmpty}>
                    <Text style={styles.pickerEmptyText}>No restaurants found</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Date */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DATE *</Text>
            <TextInput
              value={dateStr}
              onChangeText={setDateStr}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
              autoCorrect={false}
            />
          </View>

          {/* Time */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TIME *</Text>
            <TextInput
              value={timeStr}
              onChangeText={setTimeStr}
              placeholder="HH:mm"
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
              autoCorrect={false}
            />
          </View>

          {/* Party Size */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PARTY SIZE *</Text>
            <View style={styles.stepperRow}>
              <Pressable
                style={styles.stepperButton}
                onPress={() => {
                  const n = Math.max(1, parseInt(partySize, 10) - 1);
                  setPartySize(String(n));
                }}
              >
                <Text style={styles.stepperButtonText}>{'\u2212'}</Text>
              </Pressable>
              <TextInput
                value={partySize}
                onChangeText={setPartySize}
                style={styles.stepperInput}
                keyboardType="number-pad"
                textAlign="center"
              />
              <Pressable
                style={styles.stepperButton}
                onPress={() => {
                  const n = parseInt(partySize, 10) + 1;
                  setPartySize(String(n));
                }}
              >
                <Text style={styles.stepperButtonText}>+</Text>
              </Pressable>
            </View>
          </View>

          {/* Platform */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PLATFORM</Text>
            <View style={styles.chipRow}>
              {PLATFORMS.map((p) => {
                const active = platform === p.value;
                return (
                  <Pressable
                    key={p.value}
                    onPress={() => setPlatform(active ? null : p.value)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Confirmation Code */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CONFIRMATION CODE</Text>
            <TextInput
              value={confirmationCode}
              onChangeText={setConfirmationCode}
              placeholder="e.g. ABC123"
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          {/* Reminder */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>REMINDER</Text>
            <View style={styles.chipRow}>
              {REMINDERS.map((r) => {
                const active = reminderMinutes === r.value;
                return (
                  <Pressable
                    key={r.label}
                    onPress={() => setReminderMinutes(active ? null : r.value)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {r.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any special requests..."
              placeholderTextColor={TEXT_TERTIARY}
              style={[styles.input, styles.multiline]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          >
            <Text style={styles.saveButtonText}>Save Reservation</Text>
          </Pressable>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerBack: {
    fontSize: 16,
    color: ACCENT,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  headerSpacer: {
    width: 50,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: TEXT_TERTIARY,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  multiline: {
    minHeight: 100,
    paddingTop: 12,
  },

  // Restaurant picker
  selectedRestaurant: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 12,
    padding: 14,
  },
  selectedRestaurantInfo: {
    flex: 1,
    gap: 2,
  },
  selectedRestaurantName: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  selectedRestaurantLocation: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
    color: ACCENT,
  },
  pickerList: {
    marginTop: 8,
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 2,
  },
  pickerItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  pickerItemLocation: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  pickerEmpty: {
    marginTop: 8,
    padding: 14,
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 12,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: SURFACE_ELEVATED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: {
    fontSize: 22,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
  stepperInput: {
    width: 60,
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  chipActive: {
    backgroundColor: 'rgba(220,38,38,0.12)',
    borderColor: ACCENT,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  chipTextActive: {
    color: ACCENT,
  },

  // Save
  saveButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
