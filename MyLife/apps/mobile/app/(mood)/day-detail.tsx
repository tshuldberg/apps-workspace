import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getMoodEntriesByDate,
  getEmotionTagsForEntry,
  getActivitiesForEntry,
  getActivityById,
  getAttachmentCount,
  getDailyAverages,
  getTopEmotions,
  MoodScoreDescriptors,
  type MoodEntry,
  type MoodEmotionTag,
  GlassCard,
  EmotionChip,
  StatBadge,
  SectionHeader,
  GradientButton,
  MOOD_SURFACES,
  MOOD_TYPOGRAPHY,
  MOOD_SCORE_COLORS,
  type MoodScore,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { AttachmentGallery } from '../../components/mood/AttachmentGallery';

interface EnrichedEntry extends MoodEntry {
  emotions: MoodEmotionTag[];
  activityNames: string[];
  attachmentCount: number;
}

export default function DayDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: string }>();

  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  const entries = useMemo((): EnrichedEntry[] => {
    const raw = getMoodEntriesByDate(db, targetDate);
    return raw.map((entry) => {
      const emotions = getEmotionTagsForEntry(db, entry.id);
      const links = getActivitiesForEntry(db, entry.id);
      const activityNames = links
        .map((link) => getActivityById(db, link.activityId))
        .filter(Boolean)
        .map((a) => a!.name);
      const attachCount = getAttachmentCount(db, entry.id);
      return { ...entry, emotions, activityNames, attachmentCount: attachCount };
    });
  }, [db, targetDate]);

  const dayAverage = useMemo(() => {
    if (entries.length === 0) return null;
    const sum = entries.reduce((acc, e) => acc + e.score, 0);
    return Math.round((sum / entries.length) * 10) / 10;
  }, [entries]);

  const topEmotion = useMemo(() => {
    const top = getTopEmotions(db, targetDate, targetDate, 1);
    return top.length > 0 ? top[0].emotion : null;
  }, [db, targetDate]);

  const trend = useMemo(() => {
    const d = new Date(targetDate + 'T00:00:00Z');
    const prev = new Date(d.getTime() - 86400000);
    const prevDate = prev.toISOString().slice(0, 10);
    const prevAvgs = getDailyAverages(db, prevDate, prevDate);
    if (dayAverage == null || prevAvgs.length === 0 || prevAvgs[0].average === 0) return null;
    const pct = Math.round(((dayAverage - prevAvgs[0].average) / prevAvgs[0].average) * 100);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct}% vs ${dayNames[prev.getUTCDay()]}`;
  }, [db, dayAverage, targetDate]);

  const formattedDate = useMemo(() => {
    const d = new Date(targetDate + 'T00:00:00Z');
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }, [targetDate]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionHeader label="HISTORY" title={formattedDate} />

      {/* Daily Average Card */}
      <GlassCard level={2} style={styles.averageCard}>
        <View style={styles.averageRow}>
          <View style={styles.averageLeft}>
            <Text style={styles.labelUpper}>DAILY AVERAGE</Text>
            {dayAverage != null ? (
              <View style={styles.scoreDisplay}>
                <Text style={[styles.bigScore, { color: MOOD_SCORE_COLORS[Math.max(1, Math.min(10, Math.round(dayAverage))) as MoodScore] }]}>
                  {dayAverage.toFixed(1)}
                </Text>
                <Text style={styles.scoreDenom}>/10</Text>
              </View>
            ) : (
              <Text style={styles.bigScore}>--</Text>
            )}
            {topEmotion != null && (
              <>
                <Text style={styles.labelUpper}>TOP EMOTION</Text>
                <Text style={styles.topEmotion}>{topEmotion}</Text>
              </>
            )}
          </View>
          <View style={styles.sparkleCircle}>
            <Text style={styles.sparkleIcon}>{'\u2728'}</Text>
          </View>
        </View>
      </GlassCard>

      {/* Stat Badges */}
      <View style={styles.statRow}>
        <View style={styles.statFlex}>
          <StatBadge icon={'\uD83D\uDCCB'} value={entries.length} label="recorded" />
        </View>
        {trend != null && (
          <View style={styles.statFlex}>
            <StatBadge icon={'\uD83D\uDCC8'} value={trend} label="TREND" />
          </View>
        )}
      </View>

      {/* Timeline */}
      <View style={styles.timelineHeader}>
        <Text style={styles.timelineLabel}>TIMELINE</Text>
      </View>

      {entries.length === 0 ? (
        <GlassCard level={2} style={styles.padH}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No entries for this day.</Text>
          </View>
        </GlassCard>
      ) : (
        <View style={styles.timeline}>
          {entries.map((entry, idx) => (
            <TimelineEntryCard key={entry.id} entry={entry} isLast={idx === entries.length - 1} />
          ))}
        </View>
      )}

      <View style={styles.addButtonWrap}>
        <GradientButton
          title="Add Entry"
          onPress={() => router.push('/(mood)/log-mood')}
        />
      </View>
    </ScrollView>
  );
}

function TimelineEntryCard({ entry, isLast }: { entry: EnrichedEntry; isLast: boolean }) {
  const descriptor = MoodScoreDescriptors[entry.score];
  const clamped = Math.max(1, Math.min(10, Math.round(entry.score))) as MoodScore;
  const scoreColor = MOOD_SCORE_COLORS[clamped];
  const time = new Date(entry.loggedAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={styles.timelineRow}>
      <View style={styles.spine}>
        <View style={[styles.dot, { backgroundColor: scoreColor }]} />
        {!isLast && <View style={styles.line} />}
      </View>

      <GlassCard level={2} style={styles.entryCard}>
        <View style={styles.entryHeader}>
          <View style={styles.entryMeta}>
            <Text style={styles.entryTime}>{time}</Text>
            <Text style={styles.entryEmotion}>
              {descriptor?.label ?? `Score ${entry.score}`}
            </Text>
          </View>
          <View style={[styles.entryScoreBadge, { backgroundColor: `${scoreColor}22` }]}>
            <Text style={[styles.entryScoreText, { color: scoreColor }]}>
              {entry.score}
            </Text>
          </View>
        </View>

        {entry.note != null && entry.note.length > 0 && (
          <Text style={styles.entryNote} numberOfLines={3}>
            {entry.note}
          </Text>
        )}

        {entry.emotions.length > 0 && (
          <View style={styles.chipRow}>
            {entry.emotions.slice(0, 4).map((tag) => (
              <EmotionChip key={tag.id} label={tag.emotion} selected />
            ))}
          </View>
        )}

        {entry.activityNames.length > 0 && (
          <View style={styles.chipRow}>
            {entry.activityNames.slice(0, 4).map((name) => (
              <View key={name} style={styles.activityChip}>
                <Text style={styles.activityChipText}>{name.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        )}

        {entry.attachmentCount > 0 && (
          <AttachmentGallery entryId={entry.id} editable={false} />
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MOOD_SURFACES.base },
  content: { paddingBottom: 100 },
  padH: { marginHorizontal: 20 },

  // Average card
  averageCard: { marginHorizontal: 20, marginTop: 8 },
  averageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  averageLeft: { flex: 1, gap: 2 },
  labelUpper: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
    marginBottom: 8,
  },
  bigScore: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -0.02 * 56,
    color: colors.text,
  },
  scoreDenom: {
    fontFamily: MOOD_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 18,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  topEmotion: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 18,
    color: colors.text,
    marginTop: 2,
  },
  sparkleCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: MOOD_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleIcon: { fontSize: 24 },

  // Stat badges
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 12,
  },
  statFlex: { flex: 1 },

  // Timeline section
  timelineHeader: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  timelineLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },
  timeline: {
    marginHorizontal: 20,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  spine: {
    width: 24,
    alignItems: 'center',
    paddingTop: 18,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: MOOD_SURFACES.focus,
    marginTop: 4,
  },

  // Entry card
  entryCard: {
    flex: 1,
    marginLeft: 8,
    marginBottom: 12,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  entryMeta: { flex: 1, gap: 2 },
  entryTime: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.textSecondary,
  },
  entryEmotion: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  entryScoreBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryScoreText: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 16,
    fontWeight: '700',
  },
  entryNote: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  activityChip: {
    backgroundColor: MOOD_SURFACES.focus,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activityChipText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.05 * 11,
    color: colors.text,
  },

  // Empty state
  emptyState: { paddingVertical: 32, alignItems: 'center' },
  emptyText: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
  },

  // Add button
  addButtonWrap: {
    marginHorizontal: 20,
    marginTop: 20,
  },
});
