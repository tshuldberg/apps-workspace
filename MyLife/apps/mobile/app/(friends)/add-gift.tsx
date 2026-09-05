import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Text } from '@mylife/ui';
import { createGift, type GiftInput } from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#EC4899';
const BLUE = '#8BCFF0';
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SURFACE = '#2A292F';

const OCCASIONS = [
  { value: 'birthday', label: 'Birthday', color: '#F59E0B' },
  { value: 'holiday', label: 'Holiday', color: '#EF4444' },
  { value: 'just_because', label: 'Just because', color: '#8B5CF6' },
  { value: 'thank_you', label: 'Thank you', color: '#10B981' },
  { value: 'anniversary', label: 'Anniversary', color: '#EC4899' },
  { value: 'graduation', label: 'Graduation', color: '#06B6D4' },
  { value: 'other', label: 'Other', color: '#9F8E81' },
] as const;

export default function AddGiftScreen() {
  const router = useRouter();
  const { personId, personName } = useLocalSearchParams<{
    personId: string;
    personName: string;
  }>();
  const db = useDatabase();

  const [direction, setDirection] = useState<'given' | 'received'>('given');
  const [description, setDescription] = useState('');
  const [occasion, setOccasion] = useState<string | undefined>();
  const [amountText, setAmountText] = useState('');
  const [dateText, setDateText] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reactionNotes, setReactionNotes] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const handleSave = useCallback(() => {
    if (!personId || !description.trim()) {
      Alert.alert('Missing info', 'Description is required.');
      return;
    }

    const amountCents = amountText
      ? Math.round(parseFloat(amountText) * 100)
      : undefined;
    if (amountText && (isNaN(amountCents!) || amountCents! < 0)) {
      Alert.alert('Invalid amount', 'Please enter a valid dollar amount.');
      return;
    }

    const input: GiftInput = {
      person_id: personId,
      direction,
      description: description.trim(),
      occasion: occasion as GiftInput['occasion'],
      amount_cents: amountCents,
      date: dateText || undefined,
      reaction_notes: reactionNotes.trim() || undefined,
      link_url: linkUrl.trim() || undefined,
    };

    try {
      createGift(db, input);
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save gift.');
    }
  }, [
    db,
    personId,
    direction,
    description,
    occasion,
    amountText,
    dateText,
    reactionNotes,
    linkUrl,
    router,
  ]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backArrow}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Log Gift</Text>
          <View style={{ width: 24 }} />
        </View>

        {personName && (
          <Text style={styles.personLabel}>for {personName}</Text>
        )}

        {/* Direction toggle */}
        <Text style={styles.fieldLabel}>Direction</Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={[
              styles.toggleButton,
              direction === 'given' && { backgroundColor: `${ACCENT}20` },
            ]}
            onPress={() => setDirection('given')}
          >
            <Text
              style={[
                styles.toggleText,
                direction === 'given' && { color: ACCENT, fontWeight: '700' },
              ]}
            >
              Given
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleButton,
              direction === 'received' && { backgroundColor: `${BLUE}20` },
            ]}
            onPress={() => setDirection('received')}
          >
            <Text
              style={[
                styles.toggleText,
                direction === 'received' && {
                  color: BLUE,
                  fontWeight: '700',
                },
              ]}
            >
              Received
            </Text>
          </Pressable>
        </View>

        {/* Description */}
        <Text style={styles.fieldLabel}>Description *</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="What was it?"
          placeholderTextColor="#9F8E81"
          autoFocus
        />

        {/* Occasion chips */}
        <Text style={styles.fieldLabel}>Occasion</Text>
        <View style={styles.chipRow}>
          {OCCASIONS.map((occ) => (
            <Pressable
              key={occ.value}
              style={[
                styles.chip,
                occasion === occ.value && {
                  backgroundColor: `${occ.color}20`,
                  borderColor: `${occ.color}40`,
                },
              ]}
              onPress={() =>
                setOccasion(occasion === occ.value ? undefined : occ.value)
              }
            >
              <Text
                style={[
                  styles.chipText,
                  occasion === occ.value && { color: occ.color },
                ]}
              >
                {occ.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Amount */}
        <Text style={styles.fieldLabel}>Amount</Text>
        <View style={styles.currencyRow}>
          <Text style={styles.currencySign}>$</Text>
          <TextInput
            style={[styles.input, styles.currencyInput]}
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0.00"
            placeholderTextColor="#9F8E81"
            keyboardType="decimal-pad"
          />
        </View>

        {/* Date */}
        <Text style={styles.fieldLabel}>Date</Text>
        <TextInput
          style={styles.input}
          value={dateText}
          onChangeText={setDateText}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9F8E81"
        />

        {/* Reaction notes */}
        <Text style={styles.fieldLabel}>Reaction notes</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={reactionNotes}
          onChangeText={setReactionNotes}
          placeholder="How did they react?"
          placeholderTextColor="#9F8E81"
          multiline
          numberOfLines={3}
        />

        {/* Link */}
        <Text style={styles.fieldLabel}>Link URL</Text>
        <TextInput
          style={styles.input}
          value={linkUrl}
          onChangeText={setLinkUrl}
          placeholder="https://..."
          placeholderTextColor="#9F8E81"
          keyboardType="url"
          autoCapitalize="none"
        />

        {/* Save */}
        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Gift</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 12,
  },
  backArrow: {
    fontSize: 24,
    color: TEXT_PRIMARY,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  personLabel: {
    textAlign: 'center',
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 20,
  },

  // Fields
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 8,
  },
  input: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: TEXT_PRIMARY,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: SURFACE,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },

  // Currency
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySign: {
    fontSize: 18,
    fontWeight: '700',
    color: ACCENT,
    marginRight: 8,
  },
  currencyInput: {
    flex: 1,
  },

  // Save
  saveButton: {
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
