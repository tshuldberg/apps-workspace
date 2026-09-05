import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  createDish,
  COMMON_ALLERGENS,
} from '@mylife/dining';
import type { CreateDishInput, DishCourse } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE_ELEVATED = '#1F1F25';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = '#9F8E81';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.03)';
const WARNING_ORANGE = '#FFB877';

const COURSES: { label: string; value: DishCourse }[] = [
  { label: 'Appetizer', value: 'appetizer' },
  { label: 'Main', value: 'main' },
  { label: 'Dessert', value: 'dessert' },
  { label: 'Side', value: 'side' },
  { label: 'Drink', value: 'drink' },
  { label: 'Other', value: 'other' },
];

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

export default function AddDishScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ restaurantId: string; visitId?: string }>();
  const db = useDatabase();

  const restaurantId = params.restaurantId;
  const visitId = params.visitId ?? null;

  const [name, setName] = useState('');
  const [course, setCourse] = useState<DishCourse | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [priceText, setPriceText] = useState('');
  const [wouldOrderAgain, setWouldOrderAgain] = useState(false);
  const [selectedAllergens, setSelectedAllergens] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const toggleAllergen = useCallback((allergen: string) => {
    setSelectedAllergens((prev) =>
      prev.includes(allergen)
        ? prev.filter((a) => a !== allergen)
        : [...prev, allergen],
    );
  }, []);

  const handleSave = useCallback(() => {
    if (!restaurantId || !name.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const dishId = uuid();
      const priceCents = priceText
        ? Math.round(parseFloat(priceText) * 100) || null
        : null;

      const input: CreateDishInput = {
        restaurant_id: restaurantId,
        name: name.trim(),
        visit_id: visitId,
        course: course,
        rating: rating,
        price_cents: priceCents,
        would_order_again: wouldOrderAgain ? 1 : 0,
        allergens:
          selectedAllergens.length > 0
            ? JSON.stringify(selectedAllergens)
            : null,
        notes: notes.trim() || null,
      };

      createDish(db, dishId, input);
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [
    restaurantId, name, visitId, course, rating, priceText,
    wouldOrderAgain, selectedAllergens, notes, isSaving, db, router,
  ]);

  const canSave = !!restaurantId && name.trim().length > 0 && !isSaving;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <Text style={styles.headerBack}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Add Dish</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DISH NAME *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="What did you have?"
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
              autoFocus
            />
          </View>

          {/* Course */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>COURSE</Text>
            <View style={styles.chipRow}>
              {COURSES.map((c) => {
                const active = course === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => setCourse(active ? null : c.value)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.chipTextActive,
                      ]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Rating */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RATING</Text>
            <StarPicker value={rating} onChange={setRating} label="Rating" />
          </View>

          {/* Price */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PRICE</Text>
            <View style={styles.priceRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                value={priceText}
                onChangeText={setPriceText}
                placeholder="0.00"
                placeholderTextColor={TEXT_TERTIARY}
                style={[styles.input, styles.flex1]}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Would Order Again */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Would order again</Text>
              <Switch
                value={wouldOrderAgain}
                onValueChange={setWouldOrderAgain}
                trackColor={{ false: SURFACE_ELEVATED, true: ACCENT }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Allergens */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ALLERGENS</Text>
            <View style={styles.chipRow}>
              {COMMON_ALLERGENS.map((a) => {
                const active = selectedAllergens.includes(a);
                return (
                  <Pressable
                    key={a}
                    onPress={() => toggleAllergen(a)}
                    style={[
                      styles.chip,
                      active && styles.allergenChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active && styles.allergenChipTextActive,
                      ]}
                    >
                      {a}
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
              placeholder="Preparation, flavors, presentation..."
              placeholderTextColor={TEXT_TERTIARY}
              style={[styles.input, styles.multiline]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Save */}
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          >
            <Text style={styles.saveButtonText}>Save Dish</Text>
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
    borderColor: BORDER,
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  allergenChipActive: {
    backgroundColor: 'rgba(255,184,119,0.15)',
    borderColor: WARNING_ORANGE,
  },
  allergenChipTextActive: {
    color: WARNING_ORANGE,
  },

  // Price
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dollarSign: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 12,
    padding: 14,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
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
