import { useState, useMemo, useCallback } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from '@mylife/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDatabase } from '../../../../components/DatabaseProvider';
import {
  getRestaurant,
  updateRestaurant,
} from '@mylife/dining';
import type { UpdateRestaurantInput } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE = '#1B1B20';
const SURFACE_ELEVATED = '#2A292F';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = 'rgba(228,225,233,0.35)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

function parseCuisines(cuisines: string | null): string {
  if (!cuisines) return '';
  try {
    const arr = JSON.parse(cuisines);
    return Array.isArray(arr) ? arr.join(', ') : cuisines;
  } catch {
    return cuisines;
  }
}

export default function EditRestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();

  const restaurant = useMemo(() => {
    if (!id) return null;
    return getRestaurant(db, id);
  }, [db, id]);

  const [name, setName] = useState(restaurant?.name ?? '');
  const [address, setAddress] = useState(restaurant?.address ?? '');
  const [city, setCity] = useState(restaurant?.city ?? '');
  const [neighborhood, setNeighborhood] = useState(
    restaurant?.neighborhood ?? '',
  );
  const [cuisinesText, setCuisinesText] = useState(
    parseCuisines(restaurant?.cuisines ?? null),
  );
  const [priceTier, setPriceTier] = useState(restaurant?.price_tier ?? 0);
  const [websiteUrl, setWebsiteUrl] = useState(restaurant?.website_url ?? '');
  const [resyUrl, setResyUrl] = useState(restaurant?.resy_url ?? '');
  const [opentableUrl, setOpentableUrl] = useState(
    restaurant?.opentable_url ?? '',
  );
  const [tockUrl, setTockUrl] = useState(restaurant?.tock_url ?? '');
  const [yelpUrl, setYelpUrl] = useState(restaurant?.yelp_url ?? '');
  const [instagramHandle, setInstagramHandle] = useState(
    restaurant?.instagram_handle ?? '',
  );
  const [notesMd, setNotesMd] = useState(restaurant?.notes_md ?? '');
  const [isWishlist, setIsWishlist] = useState(
    restaurant?.is_wishlist === 1,
  );
  const [saving, setSaving] = useState(false);

  if (!restaurant) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>Restaurant not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Restaurant name is required.');
      return;
    }

    setSaving(true);

    const cuisinesArray = cuisinesText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const changes: UpdateRestaurantInput = {
      name: name.trim(),
      address: address.trim() || null,
      city: city.trim() || null,
      neighborhood: neighborhood.trim() || null,
      cuisines: cuisinesArray.length > 0 ? JSON.stringify(cuisinesArray) : null,
      price_tier: priceTier > 0 ? priceTier : null,
      website_url: websiteUrl.trim() || null,
      resy_url: resyUrl.trim() || null,
      opentable_url: opentableUrl.trim() || null,
      tock_url: tockUrl.trim() || null,
      yelp_url: yelpUrl.trim() || null,
      instagram_handle: instagramHandle.trim() || null,
      notes_md: notesMd.trim() || null,
      is_wishlist: isWishlist ? 1 : 0,
    };

    try {
      updateRestaurant(db, restaurant.id, changes);
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Edit Restaurant</Text>

        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>NAME *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Restaurant name"
            placeholderTextColor={TEXT_TERTIARY}
          />
        </View>

        {/* Location */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>ADDRESS</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="123 Main St"
            placeholderTextColor={TEXT_TERTIARY}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.fieldGroup, styles.flex1]}>
            <Text style={styles.label}>CITY</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="City"
              placeholderTextColor={TEXT_TERTIARY}
            />
          </View>
          <View style={[styles.fieldGroup, styles.flex1]}>
            <Text style={styles.label}>NEIGHBORHOOD</Text>
            <TextInput
              style={styles.input}
              value={neighborhood}
              onChangeText={setNeighborhood}
              placeholder="Neighborhood"
              placeholderTextColor={TEXT_TERTIARY}
            />
          </View>
        </View>

        {/* Cuisines */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>CUISINES</Text>
          <TextInput
            style={styles.input}
            value={cuisinesText}
            onChangeText={setCuisinesText}
            placeholder="Italian, Japanese, Mexican (comma-separated)"
            placeholderTextColor={TEXT_TERTIARY}
          />
        </View>

        {/* Price tier */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>PRICE</Text>
          <View style={styles.priceRow}>
            {[1, 2, 3, 4].map((tier) => (
              <Pressable
                key={tier}
                style={[
                  styles.pricePill,
                  priceTier === tier && styles.pricePillActive,
                ]}
                onPress={() => setPriceTier(priceTier === tier ? 0 : tier)}
              >
                <Text
                  style={[
                    styles.pricePillText,
                    priceTier === tier && styles.pricePillTextActive,
                  ]}
                >
                  {'$'.repeat(tier)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Wishlist */}
        <Pressable
          style={styles.toggleRow}
          onPress={() => setIsWishlist(!isWishlist)}
        >
          <Text style={styles.toggleLabel}>Wishlist</Text>
          <View
            style={[styles.toggle, isWishlist && styles.toggleActive]}
          >
            <View
              style={[
                styles.toggleKnob,
                isWishlist && styles.toggleKnobActive,
              ]}
            />
          </View>
        </Pressable>

        {/* Notes */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>NOTES</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notesMd}
            onChangeText={setNotesMd}
            placeholder="Your notes about this restaurant..."
            placeholderTextColor={TEXT_TERTIARY}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* External Links */}
        <Text style={styles.sectionDivider}>EXTERNAL LINKS</Text>

        {[
          { label: 'WEBSITE', value: websiteUrl, setter: setWebsiteUrl, placeholder: 'https://...' },
          { label: 'RESY', value: resyUrl, setter: setResyUrl, placeholder: 'https://resy.com/...' },
          { label: 'OPENTABLE', value: opentableUrl, setter: setOpentableUrl, placeholder: 'https://opentable.com/...' },
          { label: 'TOCK', value: tockUrl, setter: setTockUrl, placeholder: 'https://exploretock.com/...' },
          { label: 'YELP', value: yelpUrl, setter: setYelpUrl, placeholder: 'https://yelp.com/...' },
          { label: 'INSTAGRAM', value: instagramHandle, setter: setInstagramHandle, placeholder: '@handle' },
        ].map((field) => (
          <View key={field.label} style={styles.fieldGroup}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              style={styles.input}
              value={field.value}
              onChangeText={field.setter}
              placeholder={field.placeholder}
              placeholderTextColor={TEXT_TERTIARY}
              autoCapitalize="none"
              keyboardType={
                field.label === 'INSTAGRAM' ? 'default' : 'url'
              }
            />
          </View>
        ))}

        {/* Save button */}
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </Pressable>

        {/* Cancel */}
        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  backLink: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backLinkText: {
    fontSize: 15,
    color: ACCENT,
    fontWeight: '600',
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT_PRIMARY,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pricePill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  pricePillActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  pricePillText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  pricePillTextActive: {
    color: '#FFFFFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: SURFACE_ELEVATED,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleActive: {
    backgroundColor: ACCENT,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: TEXT_SECONDARY,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFFFFF',
  },
  sectionDivider: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: GLASS_BORDER,
  },
  saveButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
});
