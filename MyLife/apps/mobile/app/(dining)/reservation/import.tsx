import { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  parseConfirmationEmail,
  detectEmailPlatform,
  createReservation,
  createRestaurant,
  createImport,
  confirmImport,
  rejectImport,
  listRestaurants,
} from '@mylife/dining';
import type {
  Restaurant,
  CreateReservationInput,
  ParsedReservation,
} from '@mylife/dining';

const ACCENT = '#DC2626';
const BG = '#0E0E13';
const SURFACE_ELEVATED = '#1F1F25';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const TEXT_TERTIARY = '#9F8E81';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

type ImportStep = 'paste' | 'review';

export default function ImportReservationScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [step, setStep] = useState<ImportStep>('paste');
  const [rawText, setRawText] = useState('');
  const [importId, setImportId] = useState<string | null>(null);

  // Parsed fields (editable)
  const [restaurantName, setRestaurantName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [partySize, setPartySize] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);

  // Restaurant matching
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [showRestaurantPicker, setShowRestaurantPicker] = useState(false);
  const [createNewRestaurant, setCreateNewRestaurant] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  const filteredRestaurants = useMemo(() => {
    if (!showRestaurantPicker) return [];
    const search = restaurantSearch || restaurantName;
    return listRestaurants(db, {
      search: search || undefined,
      sort_by: 'name',
      sort_dir: 'ASC',
      limit: 10,
    });
  }, [db, restaurantSearch, restaurantName, showRestaurantPicker]);

  const selectedRestaurant = useMemo(() => {
    if (!selectedRestaurantId) return null;
    const restaurants = listRestaurants(db, { limit: 500 });
    return restaurants.find((r: Restaurant) => r.id === selectedRestaurantId) ?? null;
  }, [db, selectedRestaurantId]);

  const handleParse = useCallback(() => {
    if (!rawText.trim()) return;

    const parsed: ParsedReservation = parseConfirmationEmail(rawText);
    setRestaurantName(parsed.restaurantName ?? '');
    setDate(parsed.date ?? '');
    setTime(parsed.time ?? '');
    setPartySize(parsed.partySize ? String(parsed.partySize) : '2');
    setConfirmationCode(parsed.confirmationCode ?? '');
    setDetectedPlatform(parsed.platform);

    // Create import record
    const id = uuid();
    const platform = detectEmailPlatform(rawText);
    const source = platform ? `email_${platform}` as const : 'manual_paste' as const;
    createImport(db, id, {
      source,
      raw_text: rawText,
      parsed_data: JSON.stringify(parsed),
    });
    setImportId(id);

    // Try to match restaurant
    if (parsed.restaurantName) {
      setRestaurantSearch(parsed.restaurantName);
      setShowRestaurantPicker(true);
    }

    setStep('review');
  }, [rawText, db]);

  const handleConfirm = useCallback(() => {
    if (isSaving) return;

    const size = parseInt(partySize, 10);
    if (!size || size < 1) {
      Alert.alert('Invalid', 'Party size must be at least 1.');
      return;
    }
    if (!date) {
      Alert.alert('Invalid', 'Date is required.');
      return;
    }

    let restaurantId = selectedRestaurantId;

    // Create new restaurant if needed
    if (createNewRestaurant && restaurantName.trim()) {
      restaurantId = uuid();
      createRestaurant(db, restaurantId, {
        name: restaurantName.trim(),
      });
    }

    if (!restaurantId) {
      Alert.alert('Select Restaurant', 'Please select or create a restaurant.');
      return;
    }

    setIsSaving(true);
    try {
      const reservedAt = `${date}T${time || '19:00'}:00`;
      const reservationId = uuid();
      const input: CreateReservationInput = {
        restaurant_id: restaurantId,
        reserved_at: reservedAt,
        party_size: size,
        confirmation_code: confirmationCode.trim() || null,
        platform: detectedPlatform as CreateReservationInput['platform'],
      };

      createReservation(db, reservationId, input);

      if (importId) {
        confirmImport(db, importId, reservationId);
      }

      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedRestaurantId, createNewRestaurant, restaurantName, date, time,
    partySize, confirmationCode, detectedPlatform, importId, isSaving, db, router,
  ]);

  const handleReject = useCallback(() => {
    if (importId) {
      rejectImport(db, importId);
    }
    router.back();
  }, [importId, db, router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable hitSlop={12} onPress={() => router.back()}>
            <Text style={styles.headerBack}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Import Reservation</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'paste' && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  PASTE CONFIRMATION EMAIL
                </Text>
                <TextInput
                  value={rawText}
                  onChangeText={setRawText}
                  placeholder="Paste your reservation confirmation email here..."
                  placeholderTextColor={TEXT_TERTIARY}
                  style={[styles.input, styles.pasteArea]}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                />
              </View>

              <Pressable
                onPress={handleParse}
                disabled={!rawText.trim()}
                style={[
                  styles.parseButton,
                  !rawText.trim() && styles.parseButtonDisabled,
                ]}
              >
                <Text style={styles.parseButtonText}>Parse Email</Text>
              </Pressable>
            </>
          )}

          {step === 'review' && (
            <>
              {/* Detected Platform */}
              {detectedPlatform && (
                <View style={styles.platformBanner}>
                  <Text style={styles.platformBannerText}>
                    Detected: {detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)}
                  </Text>
                </View>
              )}

              {/* Editable Fields */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>RESTAURANT NAME</Text>
                <TextInput
                  value={restaurantName}
                  onChangeText={(text) => {
                    setRestaurantName(text);
                    setRestaurantSearch(text);
                    setShowRestaurantPicker(true);
                    setSelectedRestaurantId(null);
                    setCreateNewRestaurant(false);
                  }}
                  placeholder="Restaurant name"
                  placeholderTextColor={TEXT_TERTIARY}
                  style={styles.input}
                />

                {/* Restaurant Matching */}
                {selectedRestaurant && !showRestaurantPicker && (
                  <View style={styles.matchedBanner}>
                    <Text style={styles.matchedText}>
                      Matched: {selectedRestaurant.name}
                    </Text>
                    <Pressable onPress={() => setShowRestaurantPicker(true)}>
                      <Text style={styles.changeLink}>Change</Text>
                    </Pressable>
                  </View>
                )}

                {createNewRestaurant && !showRestaurantPicker && (
                  <View style={styles.matchedBanner}>
                    <Text style={styles.matchedText}>
                      Will create: {restaurantName}
                    </Text>
                    <Pressable onPress={() => {
                      setCreateNewRestaurant(false);
                      setShowRestaurantPicker(true);
                    }}>
                      <Text style={styles.changeLink}>Change</Text>
                    </Pressable>
                  </View>
                )}

                {showRestaurantPicker && (
                  <View style={styles.pickerList}>
                    {filteredRestaurants.map((r: Restaurant) => (
                      <Pressable
                        key={r.id}
                        style={styles.pickerItem}
                        onPress={() => {
                          setSelectedRestaurantId(r.id);
                          setShowRestaurantPicker(false);
                          setCreateNewRestaurant(false);
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
                    <Pressable
                      style={styles.pickerItemNew}
                      onPress={() => {
                        setCreateNewRestaurant(true);
                        setSelectedRestaurantId(null);
                        setShowRestaurantPicker(false);
                      }}
                    >
                      <Text style={styles.pickerItemNewText}>
                        + Add New Restaurant
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>DATE</Text>
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={TEXT_TERTIARY}
                  style={styles.input}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>TIME</Text>
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  placeholder="HH:mm"
                  placeholderTextColor={TEXT_TERTIARY}
                  style={styles.input}
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PARTY SIZE</Text>
                <TextInput
                  value={partySize}
                  onChangeText={setPartySize}
                  placeholder="2"
                  placeholderTextColor={TEXT_TERTIARY}
                  style={styles.input}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>CONFIRMATION CODE</Text>
                <TextInput
                  value={confirmationCode}
                  onChangeText={setConfirmationCode}
                  placeholder="e.g. ABC123"
                  placeholderTextColor={TEXT_TERTIARY}
                  style={styles.input}
                  autoCapitalize="characters"
                />
              </View>

              {/* Action Buttons */}
              <Pressable
                onPress={handleConfirm}
                disabled={isSaving}
                style={[styles.confirmButton, isSaving && styles.confirmButtonDisabled]}
              >
                <Text style={styles.confirmButtonText}>
                  Confirm & Create Reservation
                </Text>
              </Pressable>

              <Pressable style={styles.rejectButton} onPress={handleReject}>
                <Text style={styles.rejectButtonText}>Reject & Dismiss</Text>
              </Pressable>
            </>
          )}
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
  pasteArea: {
    minHeight: 200,
    paddingTop: 12,
  },

  // Parse button
  parseButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  parseButtonDisabled: {
    opacity: 0.4,
  },
  parseButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Platform banner
  platformBanner: {
    backgroundColor: 'rgba(139,207,240,0.12)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  platformBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8BCFF0',
  },

  // Matched restaurant
  matchedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(48,209,88,0.1)',
  },
  matchedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#30D158',
  },
  changeLink: {
    fontSize: 14,
    fontWeight: '600',
    color: ACCENT,
  },

  // Restaurant picker
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
  pickerItemNew: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  pickerItemNewText: {
    fontSize: 15,
    fontWeight: '700',
    color: ACCENT,
  },

  // Confirm/Reject buttons
  confirmButton: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rejectButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
});
