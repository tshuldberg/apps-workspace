import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, Text as RNText } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  getMoodDashboard,
  getMoodEntriesByDate,
  getMoodEntryCount,
  getSetting,
  MoodScoreDescriptors,
  // Pet
  getPet,
  applyDecay,
  EVOLUTION_NAMES,
  type Pet,
  // Suggestions
  generateSuggestions,
  getRecentSuggestionKeys,
  getActivityCorrelations,
  createSuggestionHistory,
  updateSuggestionAction,
  type GeneratedSuggestion,
  // UI components
  GlassCard,
  SectionHeader,
  TimelineEntry,
  PetCard,
  GradientButton,
  MoodScoreIndicator,
  MOOD_SURFACES,
  MOOD_ACCENT,
  MOOD_TYPOGRAPHY,
} from '@mylife/mood';
import { colors } from '@mylife/ui';
import { useEnabledModules } from '@mylife/module-registry/hooks';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const SPECIES_EMOJI: Record<string, string> = {
  egg: '\u{1F95A}',
  cat: '\u{1F431}',
  dog: '\u{1F436}',
  bird: '\u{1F426}',
  bunny: '\u{1F430}',
  fox: '\u{1F98A}',
};

const SCORE_EMOJI: Record<number, string> = {
  1: '\u{1F629}',
  2: '\u{1F61E}',
  3: '\u{1F615}',
  4: '\u{1F614}',
  5: '\u{1F610}',
  6: '\u{1F642}',
  7: '\u{1F60A}',
  8: '\u{1F604}',
  9: '\u{1F601}',
  10: '\u{1F929}',
};

function formatDateHeading(): string {
  const d = new Date();
  const month = d.toLocaleString('en-US', { month: 'long' });
  const day = d.getDate();
  return `Today, ${month} ${day}`;
}

function formatTime12h(iso: string): string {
  const h24 = parseInt(iso.slice(11, 13), 10);
  const min = iso.slice(14, 16);
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${min} ${ampm}`;
}

export default function MoodTodayScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick] = useState(0);

  const today = new Date().toISOString().slice(0, 10);
  const dashboard = useMemo(() => {
    try {
      return getMoodDashboard(db);
    } catch {
      return {
        todayEntries: 0,
        todayAverage: null,
        weekAverage: null,
        monthAverage: null,
        currentStreak: 0,
        longestStreak: 0,
        totalEntries: 0,
      };
    }
  }, [db, tick]);
  const todayEntries = useMemo(() => {
    try { return getMoodEntriesByDate(db, today); } catch { return []; }
  }, [db, today, tick]);
  const entryCount = useMemo(() => {
    try { return getMoodEntryCount(db); } catch { return 0; }
  }, [db, tick]);
  const sosEnabled = (() => {
    try { return getSetting(db, 'sos_enabled') !== 'false'; } catch { return true; }
  })();

  // Pet data
  const [pet, setPet] = useState<Pet | null>(null);
  useFocusEffect(
    useCallback(() => {
      setPet(getPet(db));
    }, [db]),
  );

  const petData = useMemo(() => {
    if (!pet) return null;
    const { newHappiness } = applyDecay(pet, new Date().toISOString());
    const emoji = pet.evolutionStage === 0
      ? '\u{1F95A}'
      : (SPECIES_EMOJI[pet.species] ?? '\u{1F95A}');
    const stageName = EVOLUTION_NAMES[pet.evolutionStage] ?? 'Unknown';
    return { name: pet.name, mood: stageName, happiness: newHappiness, emoji };
  }, [pet]);

  // Suggestion data
  const [suggestion, setSuggestion] = useState<(GeneratedSuggestion & { historyId: string }) | null>(null);

  const enabledModules = useEnabledModules();
  const enabledModuleIds = useMemo(
    () => enabledModules.map((m) => m.id),
    [enabledModules],
  );

  const loadSuggestion = useCallback(() => {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const recentKeys = getRecentSuggestionKeys(db, twentyFourHoursAgo);
      const correlations = getActivityCorrelations(db, 30);
      const count = getMoodEntryCount(db);
      const generated = generateSuggestions({
        currentScore: dashboard.todayAverage ?? 5,
        activityCorrelations: correlations,
        recentSuggestionKeys: recentKeys,
        enabledModules: enabledModuleIds,
        entryCount: count,
      });
      if (generated.length > 0) {
        const s = generated[0];
        const historyId = uuid();
        createSuggestionHistory(db, historyId, {
          suggestionKey: s.key,
          category: s.category,
          source: s.source,
        });
        setSuggestion({ ...s, historyId });
      }
    } catch {
      // noop
    }
  }, [db, dashboard.todayAverage, enabledModuleIds]);

  useEffect(() => {
    loadSuggestion();
  }, [loadSuggestion]);

  const handleSuggestionAction = useCallback(
    (action: 'completed' | 'dismissed') => {
      if (!suggestion) return;
      updateSuggestionAction(db, suggestion.historyId, action);
      setSuggestion(null);
    },
    [db, suggestion],
  );

  const scoreRounded = dashboard.todayAverage
    ? Math.round(dashboard.todayAverage)
    : null;
  const hasEntries = todayEntries.length > 0 || entryCount > 0;

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <RNText style={styles.headerLock}>{'\u{1F512}'}</RNText>
            <RNText style={styles.headerTitle}>MyMood</RNText>
          </View>
          <View style={styles.headerRight}>
            <Pressable hitSlop={8}>
              <RNText style={styles.headerBell}>{'\u{1F514}'}</RNText>
            </Pressable>
          </View>
        </View>

        {/* Date heading */}
        <RNText style={styles.dateHeading}>{formatDateHeading()}</RNText>

        {/* Today's Average */}
        {hasEntries && (
          <GlassCard level={2}>
            <RNText style={styles.avgLabel}>TODAY'S AVERAGE</RNText>
            {dashboard.todayAverage != null ? (
              <View style={styles.avgRow}>
                <View style={styles.avgScoreCol}>
                  <MoodScoreIndicator
                    score={dashboard.todayAverage}
                    size="lg"
                    showEmoji={false}
                  />
                  <RNText style={styles.avgSubtitle}>Consistency is key</RNText>
                </View>
                <RNText style={styles.avgEmoji}>
                  {SCORE_EMOJI[scoreRounded ?? 5] ?? '\u{1F610}'}
                </RNText>
              </View>
            ) : (
              <View style={styles.avgRow}>
                <RNText style={styles.avgPlaceholder}>--</RNText>
                <RNText style={styles.avgEmoji}>{'\u{1F3AD}'}</RNText>
              </View>
            )}
          </GlassCard>
        )}

        {/* Pet Companion */}
        {petData ? (
          <PetCard
            name={petData.name}
            mood={petData.mood}
            happiness={petData.happiness}
            onPress={() => router.push('/(mood)/pet')}
          />
        ) : (
          <GlassCard level={2} onPress={() => router.push('/(mood)/pet')}>
            <View style={styles.petAdoptRow}>
              <RNText style={styles.petAdoptEmoji}>{'\u{1F95A}'}</RNText>
              <RNText style={styles.petAdoptText}>Adopt a virtual pet!</RNText>
            </View>
          </GlassCard>
        )}

        {/* AI Insights */}
        {suggestion != null && (
          <GlassCard level={2}>
            <View style={styles.insightHeader}>
              <View style={styles.insightLabelRow}>
                <RNText style={styles.insightSparkle}>{'\u2728'}</RNText>
                <RNText style={styles.insightLabel}>AI INSIGHTS</RNText>
              </View>
              <RNText style={styles.insightSparkleRight}>{'\u2728'}</RNText>
            </View>
            <RNText style={styles.insightText}>{suggestion.description}</RNText>
            <View style={styles.insightActions}>
              <GradientButton title="Try It" onPress={() => handleSuggestionAction('completed')} />
              <GradientButton title="Dismiss" variant="secondary" onPress={() => handleSuggestionAction('dismissed')} />
            </View>
          </GlassCard>
        )}

        {/* Timeline */}
        {todayEntries.length > 0 && (
          <View style={styles.timelineSection}>
            <SectionHeader
              title="Timeline"
              action={{
                text: `${todayEntries.length} ${todayEntries.length === 1 ? 'entry' : 'entries'} today`,
                onPress: () => router.push('/(mood)/history'),
              }}
            />
            <View style={styles.timelineList}>
              {todayEntries.map((entry) => {
                const descriptor = MoodScoreDescriptors[entry.score];
                const emotionLabel = descriptor?.label ?? `Score ${entry.score}`;
                const emoji = SCORE_EMOJI[entry.score] ?? '\u{1F610}';
                return (
                  <TimelineEntry
                    key={entry.id}
                    emotion={emotionLabel}
                    emoji={emoji}
                    time={formatTime12h(entry.createdAt)}
                    score={entry.score}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Empty state */}
        {!hasEntries && (
          <GlassCard level={2}>
            <View style={styles.emptyState}>
              <RNText style={styles.emptyEmoji}>{'\u{1F3AD}'}</RNText>
              <RNText style={styles.emptyTitle}>How are you feeling?</RNText>
              <RNText style={styles.emptyBody}>
                Tap + to log your first mood
              </RNText>
            </View>
          </GlassCard>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(mood)/log-mood')}
      >
        <RNText style={styles.fabIcon}>+</RNText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: MOOD_SURFACES.base,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLock: {
    fontSize: 20,
  },
  headerTitle: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 22,
    fontWeight: '700',
    color: MOOD_ACCENT,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBell: {
    fontSize: 20,
  },

  // Date heading
  dateHeading: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
    marginBottom: 4,
  },

  // Today's Average
  avgLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  avgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avgScoreCol: {
    gap: 4,
  },
  avgSubtitle: {
    fontFamily: MOOD_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  avgEmoji: {
    fontSize: 40,
  },
  avgPlaceholder: {
    fontFamily: MOOD_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 48,
    fontWeight: '700',
    color: MOOD_ACCENT,
  },

  // Pet adopt
  petAdoptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  petAdoptEmoji: {
    fontSize: 32,
  },
  petAdoptText: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 16,
    fontWeight: '600',
    color: MOOD_ACCENT,
  },

  // AI Insights
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  insightLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  insightSparkle: {
    fontSize: 16,
  },
  insightLabel: {
    ...MOOD_TYPOGRAPHY.labelUpper,
    color: MOOD_ACCENT,
  },
  insightSparkleRight: {
    fontSize: 28,
    opacity: 0.3,
  },
  insightText: {
    fontFamily: MOOD_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    marginBottom: 16,
  },
  insightActions: {
    flexDirection: 'row',
    gap: 12,
  },

  // Timeline
  timelineSection: {
    gap: 8,
  },
  timelineList: {
    gap: 8,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: MOOD_TYPOGRAPHY.headlineMd.fontFamily,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  emptyBody: {
    fontFamily: MOOD_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MOOD_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: MOOD_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
    marginTop: -2,
  },
});
