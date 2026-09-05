import { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Pressable, TextInput } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import { Check } from 'lucide-react-native';
import {
  createCircle,
  getCircle,
  updateCircle,
  listPeople,
  type PersonRecord,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';
const SURFACE = '#2A292F';

const COLOR_PRESETS = [
  '#EC4899', '#8B5CF6', '#06B6D4', '#F59E0B',
  '#10B981', '#EF4444', '#6366F1', '#F97316',
  '#14B8A6', '#A855F7',
];

const AVATAR_COLORS = [
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function AddCircleScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [allPeople, setAllPeople] = useState<PersonRecord[]>([]);

  useEffect(() => {
    const people = listPeople(db, { is_archived: false });
    setAllPeople(people);

    // Edit mode
    if (editId) {
      const existing = getCircle(db, editId);
      if (existing) {
        setName(existing.name);
        setIcon(existing.icon ?? '');
        setSelectedColor(existing.color ?? COLOR_PRESETS[0]);
        setSelectedMembers(existing.member_ids);
      }
    }
  }, [db, editId]);

  const toggleMember = useCallback((personId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(personId)
        ? prev.filter((id) => id !== personId)
        : [...prev, personId],
    );
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim()) return;

    if (editId) {
      updateCircle(db, editId, {
        name: name.trim(),
        icon: icon.trim() || undefined,
        color: selectedColor,
        member_ids: selectedMembers,
      });
    } else {
      createCircle(db, {
        name: name.trim(),
        icon: icon.trim() || undefined,
        color: selectedColor,
        member_ids: selectedMembers,
      });
    }

    router.back();
  }, [db, editId, name, icon, selectedColor, selectedMembers, router]);

  const isEditing = !!editId;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Circle' : 'New Circle'}
          </Text>

          {/* Name */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. College Friends"
              placeholderTextColor="rgba(255,255,255,0.2)"
            />
          </View>

          {/* Icon */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Icon (emoji)</Text>
            <TextInput
              style={[styles.input, { width: 80, textAlign: 'center', fontSize: 24 }]}
              value={icon}
              onChangeText={(text) => setIcon(text.slice(0, 2))}
              placeholder="👥"
              placeholderTextColor="rgba(255,255,255,0.2)"
            />
          </View>

          {/* Color */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.colorRow}>
              {COLOR_PRESETS.map((c) => (
                <Pressable
                  key={c}
                  style={[
                    styles.colorChip,
                    { backgroundColor: c },
                    selectedColor === c && styles.colorChipSelected,
                  ]}
                  onPress={() => setSelectedColor(c)}
                >
                  {selectedColor === c && <Check size={14} color="#fff" strokeWidth={3} />}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Members */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Members ({selectedMembers.length})
            </Text>
            <View style={styles.membersGrid}>
              {allPeople.map((person) => {
                const isSelected = selectedMembers.includes(person.id);
                return (
                  <Pressable
                    key={person.id}
                    style={[styles.memberChip, isSelected && styles.memberChipSelected]}
                    onPress={() => toggleMember(person.id)}
                  >
                    <View
                      style={[
                        styles.memberAvatar,
                        {
                          backgroundColor: AVATAR_COLORS[nameHash(person.display_name) % AVATAR_COLORS.length],
                          opacity: isSelected ? 1 : 0.5,
                        },
                      ]}
                    >
                      <Text style={styles.memberAvatarText}>
                        {getInitials(person.display_name)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.memberName, isSelected && { color: TEXT_PRIMARY }]}
                      numberOfLines={1}
                    >
                      {person.display_name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Save button */}
          <Pressable
            style={[styles.saveButton, !name.trim() && { opacity: 0.4 }]}
            onPress={handleSave}
            disabled={!name.trim()}
          >
            <Text style={styles.saveButtonText}>
              {isEditing ? 'Save Changes' : 'Create Circle'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 },

  headerTitle: { fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 28 },

  field: { marginBottom: 24 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: TEXT_SECONDARY,
    marginBottom: 10,
  },
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 16,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },

  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorChipSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },

  membersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  memberChip: {
    alignItems: 'center',
    width: 64,
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  memberChipSelected: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(236, 72, 153, 0.08)',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  memberAvatarText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  memberName: { fontSize: 11, color: TEXT_SECONDARY, textAlign: 'center' },

  saveButton: {
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: ACCENT,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#131318' },
});
