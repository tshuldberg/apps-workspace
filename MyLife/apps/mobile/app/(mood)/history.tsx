import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  getMoodEntries,
  getEmotionTagsForEntry,
  getActivitiesForEntry,
  getActivityById,
  getTopEmotions,
  MoodScoreDescriptors,
  type MoodEntry,
  type MoodEmotionTag,
  type MoodEntryFilter,
  GlassCard,
  SectionHeader,
  EmotionChip,
  MOOD_SURFACES,
  MOOD_TYPOGRAPHY,
  MOOD_ACCENT,
  MOOD_SCORE_COLORS,
  type MoodScore,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type ViewMode = 'daily' | 'monthly';
type TimeRange = '7d' | '30d' | '90d' | 'all';

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
  { key: 'all', label: 'All Time' },
];

interface EnrichedEntry extends MoodEntry {
  emotions: MoodEmotionTag[];
  activityNames: string[];
}

function getDateRangeFilter(range: TimeRange): Pick<MoodEntryFilter, 'startDate'> {
  if (range === 'all') return {};
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return { startDate: d.toISOString().slice(0, 10) };
}

export default function MoodHistoryScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedEmotions, setSelectedEmotions] = useState<Set<string>>(new Set());

  // Top emotions for filter chips
  const topEmotions = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    const past = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    return getTopEmotions(db, past, now, 8).map((e) => e.emotion);
  }, [db]);

  const toggleEmotion = useCallback((emotion: string) => {
    setSelectedEmotions((prev) => {
      const next = new Set(prev);
      if (next.has(emotion)) next.delete(emotion);
      else next.add(emotion);
      return next;
    });
  }, []);

  // Fetch + enrich entries
  const entries = useMemo((): EnrichedEntry[] => {
    const filter: MoodEntryFilter = {
      ...getDateRangeFilter(timeRange),
      limit: 200,
    };
    const raw = getMoodEntries(db, filter);
    return raw.map((entry) => {
      const emotions = getEmotionTagsForEntry(db, entry.id);
      const links = getActivitiesForEntry(db, entry.id);
      const activityNames = links
        .map((l) => getActivityById(db, l.activityId))
        .filter(Boolean)
        .map((a) => a!.name);
      return { ...entry, emotions, activityNames };
    });
  }, [db, timeRange]);

  // Apply client-side filters (search + emotion)
  const filtered = useMemo(() => {
    let result = entries;

    if (searchQuery.length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          (e.note?.toLowerCase().includes(q)) ||
          e.emotions.some((em) => em.emotion.toLowerCase().includes(q)) ||
          e.activityNames.some((a) => a.toLowerCase().includes(q)),
      );
    }

    if (selectedEmotions.size > 0) {
      result = result.filter((e) =>
        e.emotions.some((em) => selectedEmotions.has(em.emotion)),
      );
    }

    return result;
  }, [entries, searchQuery, selectedEmotions]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = new Map<string, EnrichedEntry[]>();
    for (const entry of filtered) {
      const list = groups.get(entry.date) ?? [];
      list.push(entry);
      groups.set(entry.date, list);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const formatDateHeader = useCallback((dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00Z');
    const months = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
    ];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionHeader label="REFLECTIONS" title="Timeline" />

      {/* View Mode Toggle */}
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.togglePill, viewMode === 'daily' && styles.togglePillActive]}
          onPress={() => setViewMode('daily')}
        >
          <Text style={[styles.toggleText, viewMode === 'daily' && styles.toggleTextActive]}>
            Daily
          </Text>
        </Pressable>
        <Pressable
          style={[styles.togglePill, viewMode === 'monthly' && styles.togglePillActive]}
          onPress={() => setViewMode('monthly')}
        >
          <Text style={[styles.toggleText, viewMode === 'monthly' && styles.toggleTextActive]}>
            Monthly
          </Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>{'\uD83D\uDD0D'}</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {TIME_RANGES.map((tr) => (
          <Pressable
            key={tr.key}
            style={[styles.filterChip, timeRange === tr.key && styles.filterChipActive]}
            onPress={() => setTimeRange(tr.key)}
          >
            <Text style={[styles.filterChipText, timeRange === tr.key && styles.filterChipTextActive]}>
              {tr.label}
            </Text>
          </Pressable>
        ))}
        {topEmotions.map((emotion) => (
          <EmotionChip
            key={emotion}
            label={emotion}
            selected={selectedEmotions.has(emotion)}
            onPress={() => toggleEmotion(emotion)}
          />
        ))}
      </ScrollView>

      {/* Entry List */}
      {grouped.length === 0 ? (
        <GlassCard level={2} style={styles.emptyCard}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{'\uD83D\uDCDD'}</Text>
            <Text style={styles.emptyTitle}>No entries found</Text>
            <Text style={styles.emptySubtitle}>
              {entries.length === 0
                ? 'Log a few moods to start building your history.'
                : 'Try adjusting your filters.'}
            </Text>
          </View>
        </GlassCard>
      ) : (
        grouped.map(([date, dayEntries]) => (
          <View key={date} style={styles.dateGroup}>
            {/* Date header with timeline dot */}
            <View style={styles.dateHeaderRow}>
              <View style={[styles.dateDot, { backgroundColor: MOOD_ACCENT }]} />
              <Text style={styles.dateHeaderText}>{formatDateHeader(date)}</Text>
            </View>

            {dayEntries.map((entry) => (
              <HistoryEntryCard
                key={entry.id}
                entry={entry}
                onPress={() => router.push({ pathname: '/(mood)/day-detail', params: { date } })}
              />
            ))}
          </View>
        ))
      )}

      {/* FAB */}
      <View style={styles.fabSpacer} />
    </ScrollView>
  );
}

function HistoryEntryCard({
  entry,
  onPress,
}: {
  entry: EnrichedEntry;
  onPress: () => void;
}) {
  const descriptor = MoodScoreDescriptors[entry.score];
  const clamped = Math.max(1, Math.min(10, Math.round(entry.score))) as MoodScore;
  const scoreColor = MOOD_SCORE_COLORS[clamped];
  const time = new Date(entry.loggedAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <GlassCard level={2} style={styles.entryCardWrap} onPress={onPress}>
      <View style={styles.entryHeader}>
        <View style={[styles.scoreBubble, { backgroundColor: `${scoreColor}22` }]}>
          <Text style={[styles.scoreBubbleText, { color: scoreColor }]}>{entry.score}</Text>
        </View>
        <View style={styles.entryMeta}>
          <Text style={styles.entryEmotion}>
            {descriptor?.label ?? `Score ${entry.score}`}
          </Text>
          <Text style={styles.entryTime}>{time}</Text>
        </View>
        <Pressable hitSlop={8}>
          <Text style={styles.moreIcon}>{'\u2026'}</Text>
        </Pressable>
      </View>

      {entry.note != null && entry.note.length > 0 && (
        <Text style={styles.entryNote} numberOfLines={4}>
          &ldquo;{entry.note}&rdquo;
        </Text>
      )}

      {(entry.emotions.length > 0 || entry.activityNames.length > 0) && (
        <View style={styles.tagRow}>
          {entry.emotions.slice(0, 3).map((tag) => (
            <View key={tag.id} style={styles.hashTag}>
              <Text style={styles.hashTagText}>#{tag.emotion.toUpperCase()}</Text>
            </View>
          ))}
          {entry.activityNames.slice(0, 2).map((name) => (
            <View key={name} style={styles.hashTag}>
              <Text style={styles.hashTagText}>#{name.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MOOD_SURFACES.base },
  content: { paddingBottom: 100 },

  // Toggle pills
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 4,
    gap: 8,
  },
  togglePill: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: MOOD_SURFACES.focus,
  },
  togglePillActive: {
    backgroundColor: MOOD_ACCENT,
  },
  toggleText: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: '#1a1008',
  },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MOOD_SURFACES.lift,
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 14,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.text,
    padding: 0,
  },

  // Filter chips
  filterScroll: {
    marginTop: 12,
  },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: MOOD_SURFACES.focus,
  },
  filterChipActive: {
    backgroundColor: `${MOOD_ACCENT}22`,
  },
  filterChipText: {
    fontFamily: MOOD_TYPOGRAPHY.labelUpper.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: MOOD_ACCENT,
  },

  // Date groups
  dateGroup: {
    marginTop: 20,
  },
  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 10,
  },
  dateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dateHeaderText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.05 * 12,
    color: colors.textSecondary,
  },

  // Entry cards
  entryCardWrap: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBubbleText: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 18,
    fontWeight: '700',
  },
  entryMeta: { flex: 1 },
  entryEmotion: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  entryTime: {
    fontFamily: MOOD_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  moreIcon: {
    fontSize: 20,
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  entryNote: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    marginTop: 12,
    fontStyle: 'italic',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  hashTag: {
    backgroundColor: MOOD_SURFACES.focus,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  hashTagText: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.05 * 10,
    color: MOOD_ACCENT,
  },

  // Empty state
  emptyCard: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyEmoji: { fontSize: 32 },
  emptyTitle: {
    ...MOOD_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  emptySubtitle: {
    ...MOOD_TYPOGRAPHY.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  fabSpacer: { height: 80 },
});
