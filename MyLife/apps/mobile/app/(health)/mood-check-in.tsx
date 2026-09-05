import { useState, useMemo, useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, colors, spacing } from '@mylife/ui';
import {
  createMoodEntry,
  getMoodEntries,
  DEFAULT_ACTIVITIES,
  HEALTH_ACCENT,
  HEALTH_ACCENT_LIGHT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  GlassCard,
  SectionHeader,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

const MOOD_EMOJIS = [
  { min: 0, max: 2, emoji: '\u{1F629}', label: 'Awful' },
  { min: 2, max: 4, emoji: '\u{1F61E}', label: 'Bad' },
  { min: 4, max: 5, emoji: '\u{1F610}', label: 'Okay' },
  { min: 5, max: 7, emoji: '\u{1F642}', label: 'Good' },
  { min: 7, max: 8.5, emoji: '\u{1F60A}', label: 'Great' },
  { min: 8.5, max: 10.1, emoji: '\u{1F929}', label: 'Amazing' },
];

const EMOTION_TAGS = [
  'Calm', 'Focused', 'Anxious', 'Happy', 'Tired', 'Stressed',
  'Grateful', 'Energetic', 'Sad', 'Confident', 'Irritated', 'Relaxed',
];

const ACTIVITY_ICONS: Record<string, string> = {
  exercise: '\u{1F3CB}\uFE0F',
  work: '\u{1F4BC}',
  socializing: '\u{1F465}',
  reading: '\u{1F4DA}',
  meditation: '\u{1F9D8}',
  outdoors: '\u{1F333}',
  cooking: '\u{1F373}',
  creative: '\u{1F3A8}',
  family: '\u{1F46A}',
  sleep: '\u{1F4A4}',
  travel: '\u2708\uFE0F',
  shopping: '\u{1F6CD}\uFE0F',
};

function getEmojiForScore(score: number) {
  return MOOD_EMOJIS.find((e) => score >= e.min && score < e.max) ?? MOOD_EMOJIS[2];
}

function getDayLabel(daysAgo: number): string {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return days[d.getDay()];
}

export default function MoodCheckInScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [score, setScore] = useState(7);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const moodEmoji = getEmojiForScore(score);

  const recentEntries = useMemo(() => {
    try { return getMoodEntries(db, undefined, undefined, 7); } catch { return []; }
  }, [db]);

  const weeklyData = useMemo(() => {
    const days: { label: string; score: number | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayEntries = recentEntries.filter((e) =>
        (e.recordedAt ?? e.createdAt ?? '').startsWith(dateStr),
      );
      const avg = dayEntries.length > 0
        ? (dayEntries.reduce((s, e) => s + (e.intensity ?? 3), 0) / dayEntries.length) * 2
        : null;
      days.push({ label: getDayLabel(i), score: avg });
    }
    return days;
  }, [recentEntries]);

  const avgScore = useMemo(() => {
    const valid = weeklyData.filter((d) => d.score !== null);
    if (valid.length === 0) return null;
    return Math.round((valid.reduce((s, d) => s + d.score!, 0) / valid.length) * 10) / 10;
  }, [weeklyData]);

  const toggleEmotion = useCallback((tag: string) => {
    setSelectedEmotions((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const toggleActivity = useCallback((act: string) => {
    setSelectedActivities((prev) =>
      prev.includes(act) ? prev.filter((a) => a !== act) : [...prev, act],
    );
  }, []);

  const handleSave = () => {
    try {
      const id = `mood_${Date.now()}`;
      const dominantEmotion = selectedEmotions[0] ?? 'neutral';
      const energy = score >= 5 ? 'high' : 'low';
      const pleasantness =
        selectedEmotions.some((e) =>
          ['Anxious', 'Stressed', 'Sad', 'Tired', 'Irritated'].includes(e),
        )
          ? 'unpleasant'
          : 'pleasant';
      const mappedIntensity = Math.max(1, Math.min(5, Math.round(score / 2)));
      createMoodEntry(db, id, {
        mood: dominantEmotion.toLowerCase(),
        energyLevel: energy as 'high' | 'low',
        pleasantness: pleasantness as 'pleasant' | 'unpleasant',
        intensity: mappedIntensity,
        notes: [
          notes,
          selectedEmotions.length > 0 ? `Emotions: ${selectedEmotions.join(', ')}` : '',
          selectedActivities.length > 0 ? `Activities: ${selectedActivities.join(', ')}` : '',
        ].filter(Boolean).join('\n') || undefined,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save mood entry.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <SectionHeader label="MENTAL WELLNESS" title="Mood Check-In" />
      <Text style={styles.subtitle}>
        Track your emotional patterns and daily influences to gain deeper health insights.
      </Text>

      {/* Weekly Trend */}
      <GlassCard level={2} style={styles.trendCard}>
        <View style={styles.trendHeader}>
          <Text style={styles.trendTitle}>Weekly Trend</Text>
          {avgScore !== null && (
            <Text style={styles.trendBadge}>Avg {avgScore}/10</Text>
          )}
        </View>
        <View style={styles.barChart}>
          {weeklyData.map((day, i) => {
            const isToday = i === weeklyData.length - 1;
            const barHeight = day.score !== null ? (day.score / 10) * 80 : 4;
            return (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: day.score !== null
                          ? isToday ? HEALTH_ACCENT : HEALTH_ACCENT_LIGHT
                          : HEALTH_SURFACES.focus,
                        opacity: day.score !== null ? (isToday ? 1 : 0.6) : 0.3,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, isToday && styles.barLabelActive]}>
                  {day.label}
                </Text>
              </View>
            );
          })}
        </View>
      </GlassCard>

      {/* Mood Score */}
      <GlassCard level={2} style={styles.sliderCard}>
        <Text style={styles.sliderQuestion}>How are you feeling today? {'\u2728'}</Text>

        <View style={styles.emojiRow}>
          {MOOD_EMOJIS.map((e, i) => {
            const isActive = moodEmoji.emoji === e.emoji;
            return (
              <View key={i} style={styles.emojiItem}>
                <Text style={[styles.emoji, isActive && styles.emojiActive]}>{e.emoji}</Text>
                <Text style={[styles.emojiScore, isActive && styles.emojiScoreActive]}>
                  {Math.round(e.min + (e.max - e.min) / 2)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.scoreDisplay}>
          <Text style={styles.scoreLarge}>{score.toFixed(1)}</Text>
          <Text style={styles.scoreMax}> / 10</Text>
        </View>

        <View style={styles.scoreButtons}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <Pressable
              key={n}
              style={[styles.scoreBtn, score === n && styles.scoreBtnActive]}
              onPress={() => setScore(n)}
            >
              <Text style={[styles.scoreBtnText, score === n && styles.scoreBtnTextActive]}>
                {n}
              </Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>

      {/* Journal Entry */}
      <GlassCard level={2} style={styles.section}>
        <Text style={styles.sectionLabel}>JOURNAL ENTRY</Text>
        <TextInput
          style={styles.journalInput}
          placeholder="What's on your mind today? (Optional)"
          placeholderTextColor={colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
        />
      </GlassCard>

      {/* Emotion Tags */}
      <GlassCard level={2} style={styles.section}>
        <Text style={styles.sectionLabel}>EMOTIONS</Text>
        <View style={styles.chipGrid}>
          {EMOTION_TAGS.map((tag) => {
            const isSelected = selectedEmotions.includes(tag);
            return (
              <Pressable
                key={tag}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => toggleEmotion(tag)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{tag}</Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      {/* Activities */}
      <GlassCard level={2} style={styles.section}>
        <Text style={styles.sectionLabel}>{'\u2728'} ACTIVITIES</Text>
        <View style={styles.chipGrid}>
          {DEFAULT_ACTIVITIES.map((act) => {
            const isSelected = selectedActivities.includes(act);
            const icon = ACTIVITY_ICONS[act] ?? '\u2022';
            return (
              <Pressable
                key={act}
                style={[styles.activityChip, isSelected && styles.activityChipActive]}
                onPress={() => toggleActivity(act)}
              >
                <Text style={styles.activityIcon}>{icon}</Text>
                <Text style={[styles.activityText, isSelected && styles.activityTextActive]}>
                  {act.charAt(0).toUpperCase() + act.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      {/* Save */}
      <Pressable style={styles.saveButton} onPress={handleSave}>
        <LinearGradient
          colors={[HEALTH_ACCENT, '#DC2626']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.saveGradient}
        >
          <Text style={styles.saveText}>Save Check-In</Text>
        </LinearGradient>
      </Pressable>

      {/* Recent History */}
      {recentEntries.length > 0 && (
        <View style={styles.historySection}>
          <SectionHeader title="Recent History" action={{ text: 'View All', onPress: () => {} }} />
          {recentEntries.slice(0, 3).map((entry) => {
            const entryDate = new Date(entry.recordedAt ?? entry.createdAt ?? '');
            const dateLabel = entryDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            });
            const timeLabel = entryDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            });
            const entryEmoji = getEmojiForScore((entry.intensity ?? 3) * 2);
            return (
              <GlassCard key={entry.id} level={2} style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <Text style={styles.historyEmoji}>{entryEmoji.emoji}</Text>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyDate}>{dateLabel}, {timeLabel}</Text>
                    <Text style={styles.historyMood}>
                      {entry.mood} {'\u2022'} Score: {entry.intensity ? entry.intensity * 2 : '-'}/10
                    </Text>
                  </View>
                  <Text style={styles.historyChevron}>{'\u203A'}</Text>
                </View>
              </GlassCard>
            );
          })}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HEALTH_SURFACES.depth },
  content: { paddingBottom: 100 },
  subtitle: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: spacing.lg,
  },

  // Weekly Trend
  trendCard: { marginHorizontal: spacing.md, marginBottom: spacing.md },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  trendTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: colors.text,
  },
  trendBadge: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.5,
    color: HEALTH_ACCENT_LIGHT,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
  },
  barCol: { alignItems: 'center', flex: 1, gap: 6 },
  barTrack: { height: 80, justifyContent: 'flex-end' },
  bar: { width: 24, borderRadius: 4, minHeight: 4 },
  barLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.textTertiary,
  },
  barLabelActive: { color: HEALTH_ACCENT },

  // Slider Card
  sliderCard: { marginHorizontal: spacing.md, marginBottom: spacing.md, alignItems: 'center' },
  sliderQuestion: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.sm,
  },
  emojiItem: { alignItems: 'center', gap: 2 },
  emoji: { fontSize: 26, opacity: 0.4 },
  emojiActive: { opacity: 1, fontSize: 32 },
  emojiScore: { fontSize: 10, color: colors.textTertiary },
  emojiScoreActive: { color: HEALTH_ACCENT, fontWeight: '700' },
  scoreDisplay: { flexDirection: 'row', alignItems: 'baseline', marginBottom: spacing.md },
  scoreLarge: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    fontSize: 36,
    color: colors.text,
    lineHeight: 44,
  },
  scoreMax: { fontSize: 16, color: colors.textTertiary },
  scoreButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  scoreBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HEALTH_SURFACES.focus,
  },
  scoreBtnActive: { backgroundColor: HEALTH_ACCENT },
  scoreBtnText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  scoreBtnTextActive: { color: '#fff' },

  // Sections
  section: { marginHorizontal: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  sectionLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textTertiary,
  },

  // Journal
  journalInput: {
    backgroundColor: HEALTH_SURFACES.focus,
    borderRadius: 12,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 100,
  },

  // Chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: HEALTH_SURFACES.focus,
  },
  chipActive: { backgroundColor: `${HEALTH_ACCENT}20` },
  chipText: { fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: HEALTH_ACCENT_LIGHT, fontWeight: '600' },

  // Activities
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: HEALTH_SURFACES.focus,
  },
  activityChipActive: { backgroundColor: `${HEALTH_ACCENT}20` },
  activityIcon: { fontSize: 14 },
  activityText: { fontSize: 13, color: colors.textSecondary },
  activityTextActive: { color: HEALTH_ACCENT_LIGHT, fontWeight: '600' },

  // Save
  saveButton: { marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.lg },
  saveGradient: { paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  saveText: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: '#fff',
  },

  // History
  historySection: { gap: spacing.sm },
  historyCard: { marginHorizontal: spacing.md },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  historyEmoji: { fontSize: 28 },
  historyInfo: { flex: 1, gap: 2 },
  historyDate: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.text,
  },
  historyMood: { fontSize: 12, color: colors.textSecondary, textTransform: 'capitalize' },
  historyChevron: { fontSize: 22, color: colors.textTertiary },
});
