import { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  Pressable,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  createMemory,
  listPeople,
  type PersonRecord,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const SURFACE = '#2A292F';

const GRADIENT_PAIRS: string[] = [
  '#EC4899', '#8B5CF6', '#06B6D4', '#F59E0B',
  '#10B981', '#EF4444', '#6366F1', '#E879A1',
];

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getAvatarColor(name: string): string {
  return GRADIENT_PAIRS[nameHash(name) % GRADIENT_PAIRS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function AddMemoryScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [title, setTitle] = useState('');
  const [descriptionMd, setDescriptionMd] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [tagsText, setTagsText] = useState('');
  const [isInsideJoke, setIsInsideJoke] = useState(false);
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const all = listPeople(db, { is_archived: false });
    setPeople(all);
  }, [db]);

  const togglePerson = useCallback((id: string) => {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  const handleSave = useCallback(() => {
    if (!title.trim()) return;
    setSaving(true);

    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      createMemory(db, {
        title: title.trim(),
        description_md: descriptionMd.trim() || undefined,
        person_ids: selectedPeople,
        happened_at: new Date().toISOString(),
        tags,
        is_inside_joke: isInsideJoke,
      });
      router.back();
    } catch {
      setSaving(false);
    }
  }, [db, title, descriptionMd, selectedPeople, tagsText, isInsideJoke, router]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Add Memory',
          headerStyle: { backgroundColor: BG },
          headerTintColor: TEXT_PRIMARY,
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="What happened?"
              placeholderTextColor="#9F8E81"
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>What's the story?</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={descriptionMd}
              onChangeText={setDescriptionMd}
              placeholder="The details you want to remember..."
              placeholderTextColor="#9F8E81"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* People picker */}
          <View style={styles.field}>
            <Text style={styles.label}>Who was there?</Text>
            <View style={styles.peopleGrid}>
              {people.map((person) => {
                const selected = selectedPeople.includes(person.id);
                return (
                  <Pressable
                    key={person.id}
                    style={[styles.personChip, selected && styles.personChipSelected]}
                    onPress={() => togglePerson(person.id)}
                  >
                    <View
                      style={[
                        styles.chipAvatar,
                        { backgroundColor: getAvatarColor(person.display_name) },
                      ]}
                    >
                      <Text style={styles.chipAvatarText}>
                        {getInitials(person.display_name)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.chipName, selected && styles.chipNameSelected]}
                      numberOfLines={1}
                    >
                      {person.display_name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Tags */}
          <View style={styles.field}>
            <Text style={styles.label}>Tags (comma-separated)</Text>
            <TextInput
              style={styles.input}
              value={tagsText}
              onChangeText={setTagsText}
              placeholder="travel, funny, late-night..."
              placeholderTextColor="#9F8E81"
            />
          </View>

          {/* Inside joke toggle */}
          <View style={styles.jokeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jokeLabel}>This is an inside joke</Text>
              <Text style={styles.jokeSubtitle}>
                {isInsideJoke
                  ? 'Never forget why this is funny'
                  : 'Mark if only your group would get it'}
              </Text>
            </View>
            <Switch
              value={isInsideJoke}
              onValueChange={setIsInsideJoke}
              trackColor={{ false: '#35343A', true: ACCENT }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Save button */}
          <Pressable
            style={[styles.saveButton, (!title.trim() || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!title.trim() || saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Memory'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
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
    gap: 24,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  input: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  textArea: {
    minHeight: 100,
  },
  peopleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  personChipSelected: {
    backgroundColor: `${ACCENT}20`,
    borderColor: ACCENT,
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chipName: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    maxWidth: 100,
  },
  chipNameSelected: {
    color: TEXT_PRIMARY,
  },
  jokeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  jokeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  jokeSubtitle: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
