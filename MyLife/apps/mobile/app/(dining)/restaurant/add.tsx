import { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  createRestaurant,
  addTagToRestaurant,
  listTags,
  createTag,
  parseRestaurantUrl,
  isValidUrl,
  platformToUrlField,
} from '@mylife/dining';
import type { Tag, CreateRestaurantInput, Platform } from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE_ELEVATED = '#1F1F25';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = '#9F8E81';
const BORDER = 'rgba(255,255,255,0.06)';
const GLASS = 'rgba(255,255,255,0.03)';

const PRICE_TIERS = ['$', '$$', '$$$', '$$$$'] as const;

export default function AddRestaurantScreen() {
  const router = useRouter();
  const db = useDatabase();

  // URL parsing state
  const [urlInput, setUrlInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedPlatform, setParsedPlatform] = useState<Platform | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [priceTier, setPriceTier] = useState<number | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [notes, setNotes] = useState('');
  const [isWishlist, setIsWishlist] = useState(false);
  const [isPetFriendly, setIsPetFriendly] = useState(false);

  // Platform-specific URLs
  const [platformUrls, setPlatformUrls] = useState<Record<string, string>>({});

  // Tags state
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState('');

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Load cuisine tags on mount
  useEffect(() => {
    const tags = listTags(db, 'cuisine');
    setAllTags(tags);
  }, [db]);

  // Handle URL paste and auto-fill
  const handleUrlParse = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed || !isValidUrl(trimmed)) return;

    setIsParsing(true);
    try {
      const parsed = await parseRestaurantUrl(trimmed);
      setParsedPlatform(parsed.platform);

      if (parsed.name && !name) setName(parsed.name);
      if (parsed.address && !address) setAddress(parsed.address);
      if (parsed.city && !city) setCity(parsed.city);
      if (parsed.website && !websiteUrl) setWebsiteUrl(parsed.website);

      // Set the platform-specific URL field
      if (parsed.platformUrl) {
        const field = platformToUrlField(parsed.platform);
        if (field) {
          setPlatformUrls((prev) => ({ ...prev, [field]: parsed.platformUrl! }));
        }
      }

      // Auto-select matching cuisine tags
      if (parsed.cuisines && parsed.cuisines.length > 0) {
        const matchingIds = new Set<string>();
        for (const cuisine of parsed.cuisines) {
          const lower = cuisine.toLowerCase();
          const found = allTags.find((t) => t.name.toLowerCase() === lower);
          if (found) matchingIds.add(found.id);
        }
        if (matchingIds.size > 0) {
          setSelectedTagIds((prev) => new Set([...prev, ...matchingIds]));
        }
      }
    } finally {
      setIsParsing(false);
    }
  }, [urlInput, name, address, city, websiteUrl, allTags]);

  // Trigger parse when URL looks valid
  useEffect(() => {
    if (isValidUrl(urlInput.trim()) && urlInput.trim().length > 10) {
      void handleUrlParse();
    }
  }, [urlInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }, []);

  const handleCreateTag = useCallback(() => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    const existing = allTags.find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      setSelectedTagIds((prev) => new Set([...prev, existing.id]));
      setNewTagName('');
      return;
    }

    const id = uuid();
    const tag = createTag(db, id, { name: trimmed, kind: 'cuisine', color: null });
    setAllTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedTagIds((prev) => new Set([...prev, id]));
    setNewTagName('');
  }, [newTagName, allTags, db]);

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName || isSaving) return;

    setIsSaving(true);
    try {
      const id = uuid();
      const input: CreateRestaurantInput = {
        name: trimmedName,
        address: address.trim() || null,
        city: city.trim() || null,
        neighborhood: neighborhood.trim() || null,
        price_tier: priceTier,
        website_url: websiteUrl.trim() || null,
        instagram_handle: instagramHandle.trim() || null,
        notes_md: notes.trim() || null,
        is_wishlist: isWishlist ? 1 : 0,
        resy_url: platformUrls.resy_url || null,
        opentable_url: platformUrls.opentable_url || null,
        tock_url: platformUrls.tock_url || null,
        yelp_url: platformUrls.yelp_url || null,
      };

      createRestaurant(db, id, input);

      // Add selected tags
      for (const tagId of selectedTagIds) {
        addTagToRestaurant(db, id, tagId);
      }

      // Add Pet-Friendly tag if toggled
      if (isPetFriendly) {
        const vibeTags = listTags(db, 'vibe');
        let petTag = vibeTags.find((t) => t.name.toLowerCase() === 'pet-friendly');
        if (!petTag) {
          petTag = createTag(db, uuid(), { name: 'Pet-Friendly', kind: 'vibe', color: '#30D158' });
        }
        addTagToRestaurant(db, id, petTag.id);
      }

      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [
    name, address, city, neighborhood, priceTier, websiteUrl,
    instagramHandle, notes, isWishlist, isPetFriendly, platformUrls,
    selectedTagIds, isSaving, db, router,
  ]);

  const canSave = name.trim().length > 0 && !isSaving;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <Text style={styles.headerBack}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Add Restaurant</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* URL Paste Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PASTE A LINK</Text>
            <View style={styles.urlRow}>
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder="Resy, OpenTable, Tock, Yelp, or Google Maps"
                placeholderTextColor={TEXT_TERTIARY}
                style={styles.urlInput}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {isParsing && (
                <ActivityIndicator
                  size="small"
                  color={ACCENT}
                  style={styles.urlSpinner}
                />
              )}
            </View>
            {parsedPlatform && parsedPlatform !== 'unknown' && (
              <Text style={styles.platformBadge}>
                Detected: {parsedPlatform.replace('_', ' ')}
              </Text>
            )}
          </View>

          {/* Name */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NAME *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Restaurant name"
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
            />
          </View>

          {/* Address */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ADDRESS</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Street address"
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
            />
          </View>

          {/* City + Neighborhood row */}
          <View style={styles.row}>
            <View style={[styles.section, styles.flex1]}>
              <Text style={styles.sectionLabel}>CITY</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="City"
                placeholderTextColor={TEXT_TERTIARY}
                style={styles.input}
              />
            </View>
            <View style={[styles.section, styles.flex1]}>
              <Text style={styles.sectionLabel}>NEIGHBORHOOD</Text>
              <TextInput
                value={neighborhood}
                onChangeText={setNeighborhood}
                placeholder="Neighborhood"
                placeholderTextColor={TEXT_TERTIARY}
                style={styles.input}
              />
            </View>
          </View>

          {/* Price Tier */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PRICE</Text>
            <View style={styles.priceRow}>
              {PRICE_TIERS.map((label, idx) => {
                const tier = idx + 1;
                const active = priceTier === tier;
                return (
                  <Pressable
                    key={tier}
                    onPress={() => setPriceTier(active ? null : tier)}
                    style={[
                      styles.priceChip,
                      active && styles.priceChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.priceChipText,
                        active && styles.priceChipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Cuisine Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CUISINE TAGS</Text>
            <View style={styles.tagsWrap}>
              {allTags.map((tag) => {
                const active = selectedTagIds.has(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => toggleTag(tag.id)}
                    style={[
                      styles.tagChip,
                      active && { backgroundColor: tag.color ?? ACCENT, borderColor: tag.color ?? ACCENT },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagChipText,
                        active && styles.tagChipTextActive,
                      ]}
                    >
                      {tag.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {/* Custom tag input */}
            <View style={styles.addTagRow}>
              <TextInput
                value={newTagName}
                onChangeText={setNewTagName}
                placeholder="Add custom tag..."
                placeholderTextColor={TEXT_TERTIARY}
                style={[styles.input, styles.flex1]}
                onSubmitEditing={handleCreateTag}
                returnKeyType="done"
              />
              {newTagName.trim().length > 0 && (
                <Pressable onPress={handleCreateTag} style={styles.addTagButton}>
                  <Text style={styles.addTagButtonText}>Add</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Website */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>WEBSITE</Text>
            <TextInput
              value={websiteUrl}
              onChangeText={setWebsiteUrl}
              placeholder="https://..."
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          {/* Instagram */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>INSTAGRAM</Text>
            <TextInput
              value={instagramHandle}
              onChangeText={setInstagramHandle}
              placeholder="@handle"
              placeholderTextColor={TEXT_TERTIARY}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTES</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="What to order, who recommended it..."
              placeholderTextColor={TEXT_TERTIARY}
              style={[styles.input, styles.multiline]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Wishlist Toggle */}
          <View style={styles.wishlistRow}>
            <View>
              <Text style={styles.wishlistLabel}>Add to wishlist</Text>
              <Text style={styles.wishlistSubtext}>
                Mark as a place you want to try
              </Text>
            </View>
            <Switch
              value={isWishlist}
              onValueChange={setIsWishlist}
              trackColor={{ false: SURFACE_ELEVATED, true: ACCENT }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Pet-Friendly Toggle */}
          <View style={styles.petFriendlyRow}>
            <View>
              <Text style={styles.wishlistLabel}>{'\uD83D\uDC3E'} Pet-Friendly</Text>
              <Text style={styles.wishlistSubtext}>
                This restaurant welcomes pets
              </Text>
            </View>
            <Switch
              value={isPetFriendly}
              onValueChange={setIsPetFriendly}
              trackColor={{ false: SURFACE_ELEVATED, true: '#30D158' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={[
              styles.saveButton,
              !canSave && styles.saveButtonDisabled,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Restaurant</Text>
            )}
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
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  urlInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  urlSpinner: {
    marginLeft: 8,
  },
  platformBadge: {
    fontSize: 12,
    color: ACCENT,
    fontWeight: '600',
    marginTop: 6,
    textTransform: 'capitalize',
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
  priceChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SURFACE_ELEVATED,
    borderWidth: 1,
    borderColor: BORDER,
  },
  priceChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  priceChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  priceChipTextActive: {
    color: '#FFFFFF',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: GLASS,
  },
  tagChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  tagChipTextActive: {
    color: '#FFFFFF',
  },
  addTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addTagButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: ACCENT,
  },
  addTagButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  wishlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  petFriendlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SURFACE_ELEVATED,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  wishlistLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  wishlistSubtext: {
    fontSize: 13,
    color: TEXT_TERTIARY,
    marginTop: 2,
  },
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
