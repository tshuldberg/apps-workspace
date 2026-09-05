import { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  createHangout,
  listPeople,
  type ActivityTag,
} from '@mylife/friends';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.friends;
const BG = '#131318';
const TEXT_PRIMARY = '#E4E1E9';
const TEXT_SECONDARY = '#D6C3B5';
const SURFACE = '#2A292F';
const GLASS_BORDER = 'rgba(255,255,255,0.06)';

// ── Activity tags ───────────────────────────────────────────────────

const ACTIVITY_OPTIONS: { key: ActivityTag; emoji: string; label: string }[] = [
  { key: 'coffee', emoji: '\u2615', label: 'Coffee' },
  { key: 'dinner', emoji: '\uD83C\uDF7D\uFE0F', label: 'Dinner' },
  { key: 'lunch', emoji: '\uD83E\uDD57', label: 'Lunch' },
  { key: 'drinks', emoji: '\uD83C\uDF7B', label: 'Drinks' },
  { key: 'hike', emoji: '\uD83E\uDD7E', label: 'Hike' },
  { key: 'movie', emoji: '\uD83C\uDFAC', label: 'Movie' },
  { key: 'gaming', emoji: '\uD83C\uDFAE', label: 'Gaming' },
  { key: 'party', emoji: '\uD83C\uDF89', label: 'Party' },
  { key: 'study', emoji: '\uD83D\uDCDA', label: 'Study' },
  { key: 'work', emoji: '\uD83D\uDCBC', label: 'Work' },
  { key: 'gym', emoji: '\uD83D\uDCAA', label: 'Gym' },
  { key: 'shopping', emoji: '\uD83D\uDECD\uFE0F', label: 'Shopping' },
  { key: 'concert', emoji: '\uD83C\uDFB5', label: 'Concert' },
  { key: 'travel', emoji: '\u2708\uFE0F', label: 'Travel' },
  { key: 'random', emoji: '\uD83C\uDFB2', label: 'Random' },
];

// ── Duration presets ────────────────────────────────────────────────

const DURATION_OPTIONS: { label: string; minutes: number }[] = [
  { label: '30min', minutes: 30 },
  { label: '1hr', minutes: 60 },
  { label: '2hr', minutes: 120 },
  { label: '3hr', minutes: 180 },
  { label: 'Half-day', minutes: 360 },
  { label: 'Full day', minutes: 720 },
];

// ── Quality labels ──────────────────────────────────────────────────

const QUALITY_LABELS: Record<number, string> = {
  1: 'Rough',
  2: 'Meh',
  3: 'Fine',
  4: 'Good',
  5: 'Amazing',
};

// ── Avatar helpers ──────────────────────────────────────────────────

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

export default function LogHangoutScreen() {
  const router = useRouter();
  const db = useDatabase();

  // Load people for the picker
  const allPeople = useMemo(() => listPeople(db, { is_archived: false }), [db]);

  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [happenedAt, setHappenedAt] = useState(new Date().toISOString().slice(0, 16));
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [activityTags, setActivityTags] = useState<ActivityTag[]>([]);
  const [qualityRating, setQualityRating] = useState<number | null>(null);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredPeople = useMemo(() => {
    if (!peopleSearch.trim()) return allPeople;
    const q = peopleSearch.toLowerCase();
    return allPeople.filter((p) =>
      p.display_name.toLowerCase().includes(q),
    );
  }, [allPeople, peopleSearch]);

  const togglePerson = useCallback((id: string) => {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  const toggleActivity = useCallback((tag: ActivityTag) => {
    setActivityTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const handleSave = useCallback(() => {
    if (selectedPeople.length === 0) {
      Alert.alert('Who was there?', 'Pick at least one person.');
      return;
    }

    setSaving(true);
    try {
      const hangout = createHangout(db, {
        people_ids: selectedPeople,
        happened_at: new Date(happenedAt).toISOString(),
        duration_minutes: durationMinutes ?? undefined,
        activity_tags: activityTags,
        quality_rating: qualityRating ?? undefined,
        location_name: location.trim() || undefined,
        notes_md: notes.trim() || undefined,
      });
      router.replace({
        pathname: '/(friends)/hangout-detail',
        params: { id: hangout.id },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }, [db, router, selectedPeople, happenedAt, durationMinutes, activityTags, qualityRating, location, notes]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backArrow}>{'\u2190'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Log a hangout</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* People picker */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Who was there?</Text>
            <TextInput
              value={peopleSearch}
              onChangeText={setPeopleSearch}
              placeholder="Search people..."
              placeholderTextColor="#9F8E81"
              style={styles.searchInput}
            />
            <View style={styles.peopleList}>
              {filteredPeople.map((person) => {
                const selected = selectedPeople.includes(person.id);
                return (
                  <Pressable
                    key={person.id}
                    style={[styles.personRow, selected && styles.personRowSelected]}
                    onPress={() => togglePerson(person.id)}
                  >
                    <View
                      style={[
                        styles.personAvatar,
                        { backgroundColor: getAvatarColor(person.display_name) },
                      ]}
                    >
                      <Text style={styles.personAvatarText}>
                        {getInitials(person.display_name)}
                      </Text>
                    </View>
                    <Text style={styles.personName}>{person.display_name}</Text>
                    <View
                      style={[
                        styles.checkbox,
                        selected && styles.checkboxSelected,
                      ]}
                    >
                      {selected && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                    </View>
                  </Pressable>
                );
              })}
              {filteredPeople.length === 0 && (
                <Text style={styles.noPeople}>No people found.</Text>
              )}
            </View>
          </View>

          {/* Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>When?</Text>
            <TextInput
              value={happenedAt}
              onChangeText={setHappenedAt}
              placeholder="YYYY-MM-DDTHH:MM"
              placeholderTextColor="#9F8E81"
              style={styles.input}
            />
          </View>

          {/* Duration */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>How long?</Text>
            <View style={styles.chipRow}>
              {DURATION_OPTIONS.map((opt) => {
                const active = durationMinutes === opt.minutes;
                return (
                  <Pressable
                    key={opt.minutes}
                    onPress={() =>
                      setDurationMinutes(active ? null : opt.minutes)
                    }
                    style={[styles.durationChip, active && styles.durationChipActive]}
                  >
                    <Text
                      style={[
                        styles.durationChipText,
                        active && styles.durationChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Activity tags */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>What did you do?</Text>
            <View style={styles.activityGrid}>
              {ACTIVITY_OPTIONS.map((opt) => {
                const active = activityTags.includes(opt.key);
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => toggleActivity(opt.key)}
                    style={[
                      styles.activityCell,
                      active && styles.activityCellActive,
                    ]}
                  >
                    <Text style={styles.activityEmoji}>{opt.emoji}</Text>
                    <Text
                      style={[
                        styles.activityLabel,
                        active && styles.activityLabelActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Quality rating */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>How was your time?</Text>
            <View style={styles.qualityRow}>
              {[1, 2, 3, 4, 5].map((n) => {
                const active = qualityRating === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setQualityRating(active ? null : n)}
                    style={styles.qualityItem}
                  >
                    <View
                      style={[
                        styles.qualityStar,
                        { backgroundColor: qualityRating != null && n <= qualityRating ? ACCENT : '#35343A' },
                      ]}
                    />
                    <Text
                      style={[
                        styles.qualityLabel,
                        active && { color: ACCENT },
                      ]}
                    >
                      {QUALITY_LABELS[n]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Location */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Where?</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Coffee shop, park, their place..."
              placeholderTextColor="#9F8E81"
              style={styles.input}
            />
          </View>

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="What did you talk about? Any highlights?"
              placeholderTextColor="#9F8E81"
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              multiline
            />
          </View>

          {/* Save button */}
          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Hangout'}
            </Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backArrow: {
    fontSize: 24,
    color: TEXT_PRIMARY,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  input: {
    backgroundColor: SURFACE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  peopleList: {
    gap: 4,
    maxHeight: 220,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  personRowSelected: {
    backgroundColor: `${ACCENT}15`,
  },
  personAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  personName: {
    flex: 1,
    fontSize: 15,
    color: TEXT_PRIMARY,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noPeople: {
    fontSize: 14,
    color: '#9F8E81',
    textAlign: 'center',
    paddingVertical: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: 'transparent',
  },
  durationChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  durationChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  durationChipTextActive: {
    color: '#FFFFFF',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityCell: {
    width: 72,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    backgroundColor: 'transparent',
  },
  activityCellActive: {
    backgroundColor: `${ACCENT}20`,
    borderColor: ACCENT,
  },
  activityEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  activityLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  activityLabelActive: {
    color: ACCENT,
  },
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  qualityItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  qualityStar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  qualityLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9F8E81',
  },
  saveButton: {
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
