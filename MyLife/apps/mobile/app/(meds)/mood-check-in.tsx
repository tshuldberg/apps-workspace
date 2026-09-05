import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  createMoodEntry,
  getMoodEntries,
  linkActivitiesToMood,
} from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_MOOD,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  MoodChip,
  withAlpha,
} from '@mylife/meds/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const MOOD_OPTIONS = [
  { id: 'terrible', label: 'Terrible', emoji: '😭', color: MD_MOOD.terrible, pleasantness: 'unpleasant' as const },
  { id: 'bad', label: 'Bad', emoji: '🙁', color: MD_MOOD.bad, pleasantness: 'unpleasant' as const },
  { id: 'neutral', label: 'Neutral', emoji: '😐', color: MD_MOOD.neutral, pleasantness: 'neutral' as const },
  { id: 'good', label: 'Good', emoji: '🙂', color: MD_MOOD.good, pleasantness: 'pleasant' as const },
  { id: 'great', label: 'Great', emoji: '😁', color: MD_MOOD.great, pleasantness: 'pleasant' as const },
] as const;

const ACTIVITY_OPTIONS = [
  'Exercise',
  'Social',
  'Work',
  'Rest',
  'Meditation',
  'Medication',
  'Stress',
  'Pain',
  'Sleep',
  'Weather',
  'Diet',
] as const;

function mapEnergyToIntensity(energy: number): number {
  return Math.max(1, Math.min(5, Math.round((energy / 10) * 4) + 1));
}

export default function MoodCheckInScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<(typeof MOOD_OPTIONS)[number] | null>(MOOD_OPTIONS[2]);
  const [energy, setEnergy] = useState(6);
  const [notes, setNotes] = useState('');
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const lastEntry = useMemo(() => {
    try {
      return getMoodEntries(db, undefined, undefined, 1)[0] ?? null;
    } catch {
      return null;
    }
  }, [db]);

  const toggleActivity = (activity: string) => {
    setSelectedActivities((current) => (
      current.includes(activity)
        ? current.filter((item) => item !== activity)
        : [...current, activity]
    ));
  };

  const handleSave = async () => {
    if (!selectedMood || saving) {
      return;
    }

    setSaving(true);
    try {
      const moodEntryId = uuid();
      createMoodEntry(db, moodEntryId, {
        mood: selectedMood.id,
        energyLevel: energy >= 5 ? 'high' : 'low',
        pleasantness: selectedMood.pleasantness,
        intensity: mapEnergyToIntensity(energy),
        notes: notes.trim() || undefined,
      });
      linkActivitiesToMood(db, moodEntryId, selectedActivities);
      router.replace('/(meds)/mood' as never);
    } catch {
      Alert.alert('Unable to save', 'The mood check-in could not be saved. Try again.');
      setSaving(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Daily Mood Check-In</Text>
        <Text style={styles.title}>How are you?</Text>
        <Text style={styles.subtitle}>
          Capture your mood, energy, and what contributed so the trends screen can surface meaningful patterns.
        </Text>
        {selectedMood ? <MoodChip mood={selectedMood.id} size="lg" /> : null}
      </View>

      {lastEntry ? (
        <GlassCard padding={18} style={styles.lastEntryCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardEyebrow}>Last Entry</Text>
            <Text style={styles.cardMeta}>
              {new Date(lastEntry.recordedAt).toLocaleString()}
            </Text>
          </View>
          <View style={styles.lastEntryRow}>
            <MoodChip mood={lastEntry.mood} />
            <Text style={styles.lastEntryScore}>Energy {lastEntry.energyLevel}</Text>
          </View>
          {lastEntry.notes ? (
            <Text style={styles.lastEntryNotes}>{lastEntry.notes}</Text>
          ) : null}
        </GlassCard>
      ) : null}

      <GlassCard padding={20}>
        <View style={styles.sectionHeader}>
          <MaterialSymbol color={MD_ACCENT_LIGHT} filled name="sentiment_satisfied" size={22} />
          <Text style={styles.sectionTitle}>Mood</Text>
        </View>
        <View style={styles.moodGrid}>
          {MOOD_OPTIONS.map((option) => {
            const selected = selectedMood?.id === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setSelectedMood(option)}
                style={[
                  styles.moodOption,
                  {
                    backgroundColor: selected ? withAlpha(option.color, 0.24) : MD_SURFACES.low,
                    shadowColor: selected ? option.color : 'transparent',
                    shadowOpacity: selected ? 0.28 : 0,
                    shadowRadius: 12,
                  },
                ]}
              >
                <Text style={styles.moodEmoji}>{option.emoji}</Text>
                <Text style={[styles.moodLabel, { color: selected ? option.color : MD_TEXT }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <View style={styles.sectionHeader}>
          <MaterialSymbol color={MD_ACCENT_LIGHT} name="bolt" size={22} />
          <Text style={styles.sectionTitle}>Energy</Text>
          <Text style={styles.sectionValue}>{energy}/10</Text>
        </View>
        <Text style={styles.helperText}>
          Lower scores mean drained or flat. Higher scores mean activated or energized.
        </Text>
        <View style={styles.energyTrack}>
          {Array.from({ length: 11 }, (_, value) => {
            const selected = value <= energy;
            return (
              <Pressable
                key={value}
                onPress={() => setEnergy(value)}
                style={[
                  styles.energyStep,
                  {
                    backgroundColor: selected ? MD_ACCENT : withAlpha(MD_ACCENT, 0.16),
                    transform: [{ scaleY: selected ? 1 : 0.82 }],
                  },
                ]}
              >
                <Text style={[styles.energyStepLabel, { color: selected ? MD_SURFACES.lowest : MD_TEXT_TERTIARY }]}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <View style={styles.sectionHeader}>
          <MaterialSymbol color={MD_ACCENT_LIGHT} name="favorite" size={22} />
          <Text style={styles.sectionTitle}>Contributors</Text>
        </View>
        <Text style={styles.helperText}>Select everything that shaped today’s mood.</Text>
        <View style={styles.chipWrap}>
          {ACTIVITY_OPTIONS.map((activity) => {
            const selected = selectedActivities.includes(activity);
            return (
              <Pressable
                key={activity}
                onPress={() => toggleActivity(activity)}
                style={[
                  styles.activityChip,
                  {
                    backgroundColor: selected ? withAlpha(MD_ACCENT_LIGHT, 0.2) : MD_SURFACES.low,
                  },
                ]}
              >
                <Text style={[styles.activityLabel, { color: selected ? MD_ACCENT_LIGHT : MD_TEXT_SECONDARY }]}>
                  {activity}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard padding={20}>
        <View style={styles.sectionHeader}>
          <MaterialSymbol color={MD_ACCENT_LIGHT} name="edit_note" size={22} />
          <Text style={styles.sectionTitle}>Notes</Text>
        </View>
        <TextInput
          multiline
          onChangeText={setNotes}
          placeholder="What contributed to your mood or symptoms today?"
          placeholderTextColor={MD_TEXT_TERTIARY}
          style={styles.notesInput}
          textAlignVertical="top"
          value={notes}
        />
      </GlassCard>

      <Pressable
        disabled={!selectedMood || saving}
        onPress={handleSave}
        style={[
          styles.saveButton,
          !selectedMood || saving ? styles.saveButtonDisabled : null,
        ]}
      >
        <MaterialSymbol color={MD_SURFACES.lowest} filled name="check_circle" size={20} />
        <Text style={styles.saveLabel}>{saving ? 'Saving...' : 'Save Mood Check-In'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MD_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 18,
  },
  hero: {
    gap: 8,
    paddingTop: 4,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  title: {
    ...MD_TYPOGRAPHY.displayLg,
    color: MD_TEXT,
    fontSize: 38,
    lineHeight: 42,
  },
  subtitle: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  lastEntryCard: {
    backgroundColor: withAlpha(MD_ACCENT, 0.08),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardEyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  cardMeta: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 18,
  },
  lastEntryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  lastEntryScore: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_TEXT_SECONDARY,
  },
  lastEntryNotes: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    marginTop: 12,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  sectionTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
    flex: 1,
  },
  sectionValue: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_ACCENT_LIGHT,
  },
  helperText: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    marginTop: 10,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  moodOption: {
    alignItems: 'center',
    borderRadius: 22,
    flexBasis: '30%',
    gap: 8,
    justifyContent: 'center',
    minHeight: 112,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  moodEmoji: {
    fontSize: 36,
  },
  moodLabel: {
    ...MD_TYPOGRAPHY.titleMd,
    textAlign: 'center',
  },
  energyTrack: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  energyStep: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  energyStepLabel: {
    ...MD_TYPOGRAPHY.labelUpper,
    letterSpacing: 0.8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  activityChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  activityLabel: {
    ...MD_TYPOGRAPHY.titleMd,
  },
  notesInput: {
    ...MD_TYPOGRAPHY.bodyMd,
    backgroundColor: MD_SURFACES.high,
    borderRadius: 20,
    color: MD_TEXT,
    marginTop: 16,
    minHeight: 132,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: MD_ACCENT,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 20,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveLabel: {
    ...MD_TYPOGRAPHY.titleMd,
    color: MD_SURFACES.lowest,
  },
});
