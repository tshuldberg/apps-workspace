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
import {
  createLifeEvent,
  getResponseSuggestion,
  type LifeEventInput,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = '#EC4899';
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

const EVENT_TYPES = [
  { value: 'move', label: 'Moved', icon: '\uD83C\uDFE0', color: '#8BCFF0' },
  { value: 'job', label: 'New job', icon: '\uD83D\uDCBC', color: '#F59E0B' },
  { value: 'baby', label: 'Baby', icon: '\uD83D\uDC76', color: '#EC4899' },
  { value: 'engaged', label: 'Engaged', icon: '\uD83D\uDC8D', color: '#8B5CF6' },
  { value: 'married', label: 'Married', icon: '\uD83D\uDC92', color: '#EF4444' },
  { value: 'graduated', label: 'Graduated', icon: '\uD83C\uDF93', color: '#06B6D4' },
  { value: 'other', label: 'Other', icon: '\u2728', color: '#9F8E81' },
] as const;

type EventTypeValue = (typeof EVENT_TYPES)[number]['value'];

export default function AddLifeEventScreen() {
  const router = useRouter();
  const { personId, personName } = useLocalSearchParams<{
    personId: string;
    personName: string;
  }>();
  const db = useDatabase();

  const [type, setType] = useState<EventTypeValue | null>(null);
  const [description, setDescription] = useState('');
  const [dateText, setDateText] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notesMd, setNotesMd] = useState('');

  const suggestion = type ? getResponseSuggestion(type) : null;

  const handleSave = useCallback(() => {
    if (!personId || !type) {
      Alert.alert('Missing info', 'Please select an event type.');
      return;
    }

    const input: LifeEventInput = {
      person_id: personId,
      type,
      description: description.trim() || undefined,
      happened_at: dateText
        ? new Date(dateText).toISOString()
        : undefined,
      notes_md: notesMd.trim() || undefined,
    };

    try {
      createLifeEvent(db, input);
      router.back();
    } catch (e) {
      Alert.alert(
        'Error',
        e instanceof Error ? e.message : 'Could not save event.',
      );
    }
  }, [db, personId, type, description, dateText, notesMd, router]);

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
          <Text style={styles.headerTitle}>Add Life Event</Text>
          <View style={{ width: 24 }} />
        </View>

        {personName && (
          <Text style={styles.personLabel}>for {personName}</Text>
        )}

        {/* Type picker */}
        <Text style={styles.fieldLabel}>What happened? *</Text>
        <View style={styles.chipRow}>
          {EVENT_TYPES.map((et) => (
            <Pressable
              key={et.value}
              style={[
                styles.chip,
                type === et.value && {
                  backgroundColor: `${et.color}20`,
                  borderColor: `${et.color}40`,
                },
              ]}
              onPress={() => setType(et.value)}
            >
              <Text style={styles.chipIcon}>{et.icon}</Text>
              <Text
                style={[
                  styles.chipText,
                  type === et.value && { color: et.color },
                ]}
              >
                {et.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.fieldLabel}>
          {type === 'move' ? 'New city' : 'Description'}
        </Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder={type === 'move' ? 'City name' : 'Brief description'}
          placeholderTextColor="#9F8E81"
        />

        {/* Date */}
        <Text style={styles.fieldLabel}>When</Text>
        <TextInput
          style={styles.input}
          value={dateText}
          onChangeText={setDateText}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#9F8E81"
        />

        {/* Notes */}
        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={notesMd}
          onChangeText={setNotesMd}
          placeholder="Any details you want to remember"
          placeholderTextColor="#9F8E81"
          multiline
          numberOfLines={3}
        />

        {/* Response suggestion */}
        {suggestion && (
          <View style={styles.suggestionCard}>
            <Text style={styles.suggestionLabel}>Consider:</Text>
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </View>
        )}

        {/* Save */}
        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Event</Text>
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: 6,
  },
  chipIcon: {
    fontSize: 16,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  suggestionCard: {
    backgroundColor: 'rgba(139,207,240,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,207,240,0.15)',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
  },
  suggestionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8BCFF0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontStyle: 'italic',
    lineHeight: 20,
  },
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
