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
  createVisit,
  createCompanion,
  listRestaurants,
  getRestaurant,
} from '@mylife/dining';
import type { Restaurant, CreateVisitInput } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE_ELEVATED = '#1F1F25';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = '#9F8E81';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.03)';

const OCCASIONS = ['Birthday', 'Anniversary', 'Date Night', 'Business', 'Casual', 'Special'] as const;

function StarPicker({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
}) {
  return (
    <View style={starStyles.row}>
      <Text style={starStyles.label}>{label}</Text>
      <View style={starStyles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(value === n ? null : n)}
            hitSlop={4}
          >
            <Text
              style={[
                starStyles.star,
                n <= (value ?? 0) ? starStyles.starFilled : null,
              ]}
            >
              {n <= (value ?? 0) ? '\u2605' : '\u2606'}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  stars: {
    flexDirection: 'row',
    gap: 6,
  },
  star: {
    fontSize: 28,
    color: TEXT_TERTIARY,
  },
  starFilled: {
    color: '#FFB877',
  },
});

export default function AddVisitScreen() {
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
    const items = listRestaurants(db, {
      search: restaurantSearch || undefined,
      sort_by: 'name',
      sort_dir: 'ASC',
      limit: 20,
    });
    return items;
  }, [db, restaurantSearch, showPicker]);

  // Form fields
  const [visitedAt] = useState(() => new Date().toISOString());
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [vibeRating, setVibeRating] = useState<number | null>(null);
  const [foodRating, setFoodRating] = useState<number | null>(null);
  const [serviceRating, setServiceRating] = useState<number | null>(null);
  const [partySize, setPartySize] = useState('');
  const [occasion, setOccasion] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Companions
  const [companionName, setCompanionName] = useState('');
  const [companions, setCompanions] = useState<string[]>([]);

  // Total cost
  const [totalCost, setTotalCost] = useState('');

  // Budget integration
  const [linkToBudget, setLinkToBudget] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const addCompanion = useCallback(() => {
    const trimmed = companionName.trim();
    if (!trimmed) return;
    if (companions.includes(trimmed)) return;
    setCompanions((prev) => [...prev, trimmed]);
    setCompanionName('');
  }, [companionName, companions]);

  const removeCompanion = useCallback((name: string) => {
    setCompanions((prev) => prev.filter((c) => c !== name));
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedRestaurantId || !overallRating || isSaving) return;

    setIsSaving(true);
    try {
      const visitId = uuid();
      const totalCostCents = totalCost ? Math.round(parseFloat(totalCost) * 100) || null : null;

      const input: CreateVisitInput = {
        restaurant_id: selectedRestaurantId,
        visited_at: visitedAt,
        overall_rating: overallRating,
        vibe_rating: vibeRating,
        food_rating: foodRating,
        service_rating: serviceRating,
        party_size: partySize ? parseInt(partySize, 10) || null : null,
        occasion: (occasion as CreateVisitInput['occasion']) ?? null,
        notes_md: notes.trim() || null,
        total_cost_cents: totalCostCents,
      };

      createVisit(db, visitId, input);

      for (const name of companions) {
        const companionId = uuid();
        createCompanion(db, companionId, {
          visit_id: visitId,
          display_name: name,
        });
      }

      if (linkToBudget && selectedRestaurant) {
        const restaurantName = selectedRestaurant.name;
        const desc = encodeURIComponent(restaurantName);
        router.push(`/(budget)/add?category=Dining+Out&amount=${totalCostCents ?? ''}&desc=${desc}&date=${visitedAt}&source=dining` as any);
      } else {
        router.back();
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedRestaurantId, selectedRestaurant, overallRating, visitedAt, vibeRating,
    foodRating, serviceRating, partySize, occasion, notes, totalCost,
    companions, linkToBudget, isSaving, db, router,
  ]);

  const canSave = selectedRestaurantId && overallRating && !isSaving;

  const visitDate = new Date(visitedAt);
  const dateLabel = visitDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeLabel = visitDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <Text style={styles.headerBack}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Log Visit</Text>
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

          {/* Date/Time */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DATE & TIME</Text>
            <View style={styles.dateDisplay}>
              <Text style={styles.dateText}>{dateLabel}</Text>
              <Text style={styles.timeText}>{timeLabel}</Text>
            </View>
          </View>

          {/* Overall Rating */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>OVERALL RATING *</Text>
            <StarPicker
              value={overallRating}
              onChange={(v) => setOverallRating(v)}
              label="Overall"
            />
          </View>

          {/* Optional Ratings */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DETAILED RATINGS</Text>
            <View style={styles.ratingsCard}>
              <StarPicker value={vibeRating} onChange={setVibeRating} label="Vibe" />
              <StarPicker value={foodRating} onChange={setFoodRating} label="Food" />
              <StarPicker value={serviceRating} onChange={setServiceRating} label="Service" />
            </View>
          </View>

          {/* Party Size */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PARTY SIZE</Text>
            <TextInput
              value={partySize}
              onChangeText={setPartySize}
              placeholder="Number of guests"
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>

          {/* Occasion */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>OCCASION</Text>
            <View style={styles.occasionRow}>
              {OCCASIONS.map((o) => {
                const active = occasion === o;
                return (
                  <Pressable
                    key={o}
                    onPress={() => setOccasion(active ? null : o)}
                    style={[
                      styles.occasionChip,
                      active && styles.occasionChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.occasionChipText,
                        active && styles.occasionChipTextActive,
                      ]}
                    >
                      {o}
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
              placeholder="What did you order, how was it..."
              placeholderTextColor={TEXT_TERTIARY}
              style={[styles.input, styles.multiline]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Companions */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>COMPANIONS</Text>
            {companions.length > 0 && (
              <View style={styles.companionChips}>
                {companions.map((name) => (
                  <View key={name} style={styles.companionChip}>
                    <Text style={styles.companionChipText}>{name}</Text>
                    <Pressable
                      onPress={() => removeCompanion(name)}
                      hitSlop={8}
                    >
                      <Text style={styles.companionRemove}>{'\u2715'}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <View style={styles.addCompanionRow}>
              <TextInput
                value={companionName}
                onChangeText={setCompanionName}
                placeholder="Add a companion..."
                placeholderTextColor={TEXT_TERTIARY}
                style={[styles.input, styles.flex1]}
                onSubmitEditing={addCompanion}
                returnKeyType="done"
              />
              {companionName.trim().length > 0 && (
                <Pressable onPress={addCompanion} style={styles.addCompanionButton}>
                  <Text style={styles.addCompanionButtonText}>Add</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Total Cost */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TOTAL COST</Text>
            <TextInput
              value={totalCost}
              onChangeText={setTotalCost}
              placeholder="0.00"
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Link to Budget */}
          <Pressable
            onPress={() => setLinkToBudget(!linkToBudget)}
            style={styles.budgetToggleRow}
          >
            <View
              style={[
                styles.budgetCheckbox,
                linkToBudget && styles.budgetCheckboxActive,
              ]}
            >
              {linkToBudget && (
                <Text style={styles.budgetCheckmark}>{'\u2713'}</Text>
              )}
            </View>
            <Text style={styles.budgetToggleText}>Link to Budget</Text>
            <Text style={styles.budgetToggleHint}>Log as "Dining Out" expense</Text>
          </Pressable>

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[
              styles.saveButton,
              !canSave && styles.saveButtonDisabled,
            ]}
          >
            <Text style={styles.saveButtonText}>Save Visit</Text>
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
  flex1: {
    flex: 1,
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
    borderBottomColor: BORDER,
  },
  pickerItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  pickerItemLocation: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  pickerEmpty: {
    marginTop: 8,
    padding: 16,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontSize: 14,
    color: TEXT_TERTIARY,
  },

  // Date display
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 12,
    padding: 14,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  timeText: {
    fontSize: 15,
    color: TEXT_SECONDARY,
  },

  // Ratings
  ratingsCard: {
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },

  // Occasion
  occasionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  occasionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: BORDER,
  },
  occasionChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  occasionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  occasionChipTextActive: {
    color: '#FFFFFF',
  },

  // Companions
  companionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  companionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(220,38,38,0.12)',
  },
  companionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  companionRemove: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    padding: 2,
  },
  addCompanionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addCompanionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: ACCENT,
  },
  addCompanionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Budget toggle
  budgetToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 20,
  },
  budgetCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: TEXT_TERTIARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetCheckboxActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  budgetCheckmark: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  budgetToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  budgetToggleHint: {
    flex: 1,
    fontSize: 12,
    color: TEXT_TERTIARY,
    textAlign: 'right',
  },

  // Save
  saveButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
