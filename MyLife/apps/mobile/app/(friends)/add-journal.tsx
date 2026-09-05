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
import { createJournalEntry } from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS = 'rgba(255,255,255,0.03)';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SURFACE = '#2A292F';

const GRATITUDE_COLOR = '#10B981';
const PROCESSING_COLOR = '#6B7280';
const GROWTH_COLOR = '#8BCFF0';

type JournalType = 'gratitude' | 'conflict' | 'growth';

const TYPE_CONFIG: Record<
  JournalType,
  { label: string; color: string; prompt: string; placeholder: string }
> = {
  gratitude: {
    label: 'Gratitude',
    color: GRATITUDE_COLOR,
    prompt: 'What do you appreciate?',
    placeholder: 'I appreciate how they always...',
  },
  conflict: {
    label: 'Processing',
    color: PROCESSING_COLOR,
    prompt: "What's on your mind?",
    placeholder: "I've been thinking about...",
  },
  growth: {
    label: 'Growth',
    color: GROWTH_COLOR,
    prompt: 'How has this friendship changed?',
    placeholder: 'Looking back, our friendship has...',
  },
};

const TYPES: JournalType[] = ['gratitude', 'conflict', 'growth'];

export default function AddJournalScreen() {
  const router = useRouter();
  const { personId, personName, type: initialType } = useLocalSearchParams<{
    personId: string;
    personName: string;
    type: string;
  }>();
  const db = useDatabase();

  const [selectedType, setSelectedType] = useState<JournalType>(
    (initialType as JournalType) || 'gratitude',
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const config = TYPE_CONFIG[selectedType];

  const handleSave = useCallback(() => {
    if (!personId) return;
    if (!title.trim()) {
      Alert.alert('Title required', 'Give this entry a short title.');
      return;
    }

    setSaving(true);
    try {
      createJournalEntry(db, {
        person_id: personId,
        type: selectedType,
        title: title.trim(),
        description_md: description.trim() || undefined,
      });
      router.back();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save entry.';
      Alert.alert('Error', message);
      setSaving(false);
    }
  }, [db, personId, selectedType, title, description, router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backArrow}>{'\u2190'}</Text>
          </Pressable>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.title}>New Journal Entry</Text>
          <Text style={styles.subtitle}>
            {personName ? `About ${personName}` : 'Reflect on this friendship'}
          </Text>
        </View>

        {/* Type selector */}
        <View style={styles.typeRow}>
          {TYPES.map((t) => {
            const c = TYPE_CONFIG[t];
            const isActive = selectedType === t;
            return (
              <Pressable
                key={t}
                style={[
                  styles.typeChip,
                  isActive && { backgroundColor: `${c.color}20`, borderColor: c.color },
                ]}
                onPress={() => setSelectedType(t)}
              >
                <View style={[styles.typeDot, { backgroundColor: c.color }]} />
                <Text
                  style={[
                    styles.typeLabel,
                    isActive && { color: c.color, fontWeight: '700' },
                  ]}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Prompt */}
        <Text style={[styles.prompt, { color: config.color }]}>
          {config.prompt}
        </Text>

        {/* Title input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="A short title for this entry"
            placeholderTextColor="#9F8E81"
            maxLength={120}
          />
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder={config.placeholder}
            placeholderTextColor="#9F8E81"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Save */}
        <Pressable
          style={[styles.saveButton, { backgroundColor: config.color }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Entry'}
          </Text>
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
    paddingBottom: 60,
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 8,
  },
  backArrow: {
    fontSize: 24,
    color: TEXT_PRIMARY,
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },

  // Type selector
  typeRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 20,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: GLASS,
  },
  typeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },

  // Prompt
  prompt: {
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
  },

  // Inputs
  inputGroup: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: TEXT_PRIMARY,
  },
  textArea: {
    minHeight: 140,
    paddingTop: 14,
  },

  // Save
  saveButton: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
