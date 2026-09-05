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
import { createWine } from '@mylife/dining';
import type { CreateWineInput, WineColor } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE_ELEVATED = '#1F1F25';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = '#9F8E81';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.03)';

const WINE_COLORS: { label: string; value: WineColor }[] = [
  { label: 'Red', value: 'red' },
  { label: 'White', value: 'white' },
  { label: 'Rose', value: 'rose' },
  { label: 'Sparkling', value: 'sparkling' },
  { label: 'Orange', value: 'orange' },
  { label: 'Dessert', value: 'dessert' },
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

export default function AddWineScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ restaurantId: string; visitId?: string }>();
  const db = useDatabase();

  const restaurantId = params.restaurantId;
  const visitId = params.visitId ?? null;

  const [producer, setProducer] = useState('');
  const [name, setName] = useState('');
  const [vintageText, setVintageText] = useState('');
  const [region, setRegion] = useState('');
  const [varietal, setVarietal] = useState('');
  const [color, setColor] = useState<WineColor | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [priceText, setPriceText] = useState('');
  const [byGlass, setByGlass] = useState(false);
  const [pairingNotes, setPairingNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(() => {
    if (!restaurantId || !producer.trim() || !name.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const wineId = uuid();
      const priceCents = priceText
        ? Math.round(parseFloat(priceText) * 100) || null
        : null;
      const vintage = vintageText
        ? parseInt(vintageText, 10) || null
        : null;

      const input: CreateWineInput = {
        restaurant_id: restaurantId,
        producer: producer.trim(),
        name: name.trim(),
        visit_id: visitId,
        vintage,
        region: region.trim() || null,
        varietal: varietal.trim() || null,
        color,
        rating,
        price_cents: priceCents,
        by_glass: byGlass ? 1 : 0,
        pairing_notes: pairingNotes.trim() || null,
      };

      createWine(db, wineId, input);
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [
    restaurantId, producer, name, visitId, vintageText, region, varietal,
    color, rating, priceText, byGlass, pairingNotes, isSaving, db, router,
  ]);

  const canSave =
    !!restaurantId &&
    producer.trim().length > 0 &&
    name.trim().length > 0 &&
    !isSaving;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <Text style={styles.headerBack}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Add Wine</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Producer */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PRODUCER *</Text>
            <TextInput
              value={producer}
              onChangeText={setProducer}
              placeholder="Winery or producer name"
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
              autoFocus
            />
          </View>

          {/* Name */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WINE NAME *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Wine name or cuvee"
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
            />
          </View>

          {/* Vintage */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>VINTAGE</Text>
            <TextInput
              value={vintageText}
              onChangeText={setVintageText}
              placeholder="Year (e.g. 2021)"
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>

          {/* Region */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>REGION</Text>
            <TextInput
              value={region}
              onChangeText={setRegion}
              placeholder="Napa Valley, Burgundy, Barossa..."
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
            />
          </View>

          {/* Varietal */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>VARIETAL</Text>
            <TextInput
              value={varietal}
              onChangeText={setVarietal}
              placeholder="Cabernet Sauvignon, Pinot Noir..."
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
            />
          </View>

          {/* Color */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>COLOR</Text>
            <View style={styles.chipRow}>
              {WINE_COLORS.map((c) => {
                const active = color === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => setColor(active ? null : c.value)}
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

          {/* By Glass */}
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>By the glass</Text>
              <Switch
                value={byGlass}
                onValueChange={setByGlass}
                trackColor={{ false: SURFACE_ELEVATED, true: ACCENT }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Pairing Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PAIRING NOTES</Text>
            <TextInput
              value={pairingNotes}
              onChangeText={setPairingNotes}
              placeholder="What did you pair it with?"
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
            <Text style={styles.saveButtonText}>Save Wine</Text>
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
