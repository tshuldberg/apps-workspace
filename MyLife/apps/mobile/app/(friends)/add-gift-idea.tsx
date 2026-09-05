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
import { createIdea } from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#EC4899';
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SURFACE = '#2A292F';

export default function AddGiftIdeaScreen() {
  const router = useRouter();
  const { personId, personName } = useLocalSearchParams<{
    personId: string;
    personName: string;
  }>();
  const db = useDatabase();

  const [description, setDescription] = useState('');
  const [priceText, setPriceText] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const reset = useCallback(() => {
    setDescription('');
    setPriceText('');
    setSourceNote('');
    setLinkUrl('');
  }, []);

  const handleSave = useCallback(
    (addAnother: boolean) => {
      if (!personId || !description.trim()) {
        Alert.alert('Missing info', 'Description is required.');
        return;
      }

      const priceCents = priceText
        ? Math.round(parseFloat(priceText) * 100)
        : undefined;
      if (priceText && (isNaN(priceCents!) || priceCents! < 0)) {
        Alert.alert('Invalid price', 'Please enter a valid dollar amount.');
        return;
      }

      try {
        createIdea(db, {
          person_id: personId,
          description: description.trim(),
          estimated_price_cents: priceCents,
          source_note: sourceNote.trim() || undefined,
          link_url: linkUrl.trim() || undefined,
        });

        if (addAnother) {
          reset();
        } else {
          router.back();
        }
      } catch (e) {
        Alert.alert(
          'Error',
          e instanceof Error ? e.message : 'Could not save idea.',
        );
      }
    },
    [db, personId, description, priceText, sourceNote, linkUrl, reset, router],
  );

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
          <Text style={styles.headerTitle}>Gift Idea</Text>
          <View style={{ width: 24 }} />
        </View>

        {personName && (
          <Text style={styles.personLabel}>for {personName}</Text>
        )}

        {/* Description (large) */}
        <Text style={styles.fieldLabel}>What's the idea? *</Text>
        <TextInput
          style={[styles.input, styles.largeInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the gift idea..."
          placeholderTextColor="#9F8E81"
          multiline
          numberOfLines={3}
          autoFocus
        />

        {/* Price estimate */}
        <Text style={styles.fieldLabel}>Price estimate</Text>
        <View style={styles.currencyRow}>
          <Text style={styles.currencySign}>$</Text>
          <TextInput
            style={[styles.input, styles.currencyInput]}
            value={priceText}
            onChangeText={setPriceText}
            placeholder="0.00"
            placeholderTextColor="#9F8E81"
            keyboardType="decimal-pad"
          />
        </View>

        {/* Source note */}
        <Text style={styles.fieldLabel}>Where did you see this?</Text>
        <TextInput
          style={styles.input}
          value={sourceNote}
          onChangeText={setSourceNote}
          placeholder="Instagram, store, friend mentioned it..."
          placeholderTextColor="#9F8E81"
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

        {/* Buttons */}
        <Pressable
          style={styles.saveButton}
          onPress={() => handleSave(false)}
        >
          <Text style={styles.saveButtonText}>Save Idea</Text>
        </Pressable>

        <Pressable
          style={styles.saveAnotherButton}
          onPress={() => handleSave(true)}
        >
          <Text style={styles.saveAnotherText}>Save + Add Another</Text>
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
  largeInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 17,
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

  // Buttons
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
  saveAnotherButton: {
    backgroundColor: SURFACE,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  saveAnotherText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
});
