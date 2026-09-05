import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { SleepEntryRecord } from '@mylife/sleep';
import {
  buildWeeklyGoalDots,
  buildSleepTimelineSections,
  formatDurationLabel,
  formatSleepEntryDateLabel,
  formatSleepTimeLabel,
  generateAccountabilityMessage,
  getActiveGoals,
  getSleepDurationTone,
  getSleepWeekStart,
  getSleepWakeFeelingMeta,
  getStreaks,
  getWeeklySummary,
  listEntries,
  renderSleepQualityStars,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  SLEEP_ACCENT,
  SLEEP_DURATION_TONES,
  SleepPlaceholderScreen,
  readSleepTargetHours,
} from './_ui';

const PAGE_SIZE = 50;

interface SleepListSection {
  title: string;
  weekStart: string;
  data: SleepEntryRecord[];
}

interface WeeklyAccountabilityState {
  message: string;
  daysOnTarget: number;
  evaluatedDays: number;
  dots: ReturnType<typeof buildWeeklyGoalDots>;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getLatestEntryDate(entries: readonly SleepEntryRecord[]): string {
  return entries.reduce(
    (latest, entry) => (entry.date > latest ? entry.date : latest),
    todayDate(),
  );
}

export default function SleepIndexScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [entries, setEntries] = useState<SleepEntryRecord[]>([]);
  const [targetHours, setTargetHours] = useState(8);
  const [hasMore, setHasMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [weeklyAccountability, setWeeklyAccountability] =
    useState<WeeklyAccountabilityState | null>(null);

  const loadEntries = useCallback(
    (offset: number, append: boolean) => {
      const rows = listEntries(db, {
        limit: PAGE_SIZE + 1,
        offset,
      });
      const nextRows = rows.slice(0, PAGE_SIZE);

      setTargetHours(readSleepTargetHours(db));
      setHasMore(rows.length > PAGE_SIZE);
      setEntries((current) => (append ? [...current, ...nextRows] : nextRows));

      if (!append && nextRows.length >= 7) {
        const goals = getActiveGoals(db);
        const streaks = getStreaks(db);
        const weekStart = getSleepWeekStart(getLatestEntryDate(nextRows));
        const summary = getWeeklySummary(nextRows, goals, weekStart, streaks);
        setWeeklyAccountability({
          message: generateAccountabilityMessage(summary),
          daysOnTarget: summary.daysOnTarget,
          evaluatedDays: summary.evaluatedDays,
          dots: buildWeeklyGoalDots(nextRows, goals, weekStart),
        });
      } else if (!append) {
        setWeeklyAccountability(null);
      }
    },
    [db],
  );

  useFocusEffect(
    useCallback(() => {
      try {
        loadEntries(0, false);
      } catch {
        setEntries([]);
        setHasMore(false);
        setWeeklyAccountability(null);
      }
    }, [loadEntries]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    try {
      loadEntries(0, false);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadEntries]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || entries.length === 0) {
      return;
    }

    setIsLoadingMore(true);
    try {
      loadEntries(entries.length, true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [entries.length, hasMore, isLoadingMore, loadEntries]);

  const sections = useMemo<SleepListSection[]>(
    () =>
      buildSleepTimelineSections(entries).map((section) => ({
        title: section.label,
        weekStart: section.weekStart,
        data: section.entries,
      })),
    [entries],
  );

  const latestEntry = entries[0] ?? null;

  if (entries.length === 0) {
    return (
      <SleepPlaceholderScreen
        eyebrow="Sleep Log"
        title="Log your first night's sleep"
        subtitle="MySleep now has the full morning-log list shell, but it still starts with one fast manual entry."
        cards={[
          {
            emoji: '🗂️',
            title: 'Weekly timeline ready',
            body: 'Once you save a log, MySleep groups nights by week so the newest check-in always lands at the top.',
          },
          {
            emoji: '🛏️',
            title: 'Detail and edit flow',
            body: 'Each night now opens into its own detail surface with edit and delete actions already wired.',
          },
          {
            emoji: '🎯',
            title: 'Target-aware durations',
            body: 'Duration badges compare each night against your sleep target so short nights stand out immediately.',
          },
        ]}
        footer={(
          <View style={styles.ctaRow}>
            <Pressable
              onPress={() => router.push('/(sleep)/log' as never)}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Log Sleep</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(sleep)/factors/log' as never)}
              style={styles.secondaryCtaButton}
            >
              <Text style={styles.secondaryCtaButtonText}>Log Factors</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(sleep)/nap/log' as never)}
              style={styles.secondaryCtaButton}
            >
              <Text style={styles.secondaryCtaButtonText}>Log Nap</Text>
            </Pressable>
          </View>
        )}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <SectionList<SleepEntryRecord, SleepListSection>
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={SLEEP_ACCENT}
          />
        )}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.45}
        ListHeaderComponent={(
          <View style={styles.headerContent}>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>Sleep Log</Text>
              <Text style={styles.heroTitle}>
                Nights are grouped by week so the trend is readable at a glance.
              </Text>
              <Text style={styles.heroSubtitle}>
                The list stays chronological, target-aware, and fast enough to scan on a groggy morning.
              </Text>

              <View style={styles.heroPillRow}>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Target {targetHours}h</Text>
                </View>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>{entries.length} loaded</Text>
                </View>
              </View>

              <View style={styles.ctaRow}>
                <Pressable
                  onPress={() => router.push('/(sleep)/factors/log' as never)}
                  style={styles.secondaryCtaButton}
                >
                  <Text style={styles.secondaryCtaButtonText}>Log Factors</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    router.push('/(sleep)/factors/log?quick=1' as never)
                  }
                  style={styles.secondaryCtaButton}
                >
                  <Text style={styles.secondaryCtaButtonText}>Quick Log</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(sleep)/nap/log' as never)}
                  style={styles.secondaryCtaButton}
                >
                  <Text style={styles.secondaryCtaButtonText}>Log Nap</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(sleep)/hygiene' as never)}
                  style={styles.secondaryCtaButton}
                >
                  <Text style={styles.secondaryCtaButtonText}>Hygiene</Text>
                </Pressable>
              </View>
            </View>

            {latestEntry && (
              <Pressable
                onPress={() =>
                  router.push(`/(sleep)/entry/${latestEntry.id}` as never)
                }
                style={styles.latestCard}
              >
                <View style={styles.latestHeader}>
                  <View>
                    <Text style={styles.cardEyebrow}>Latest Night</Text>
                    <Text style={styles.latestTitle}>
                      {formatSleepEntryDateLabel(latestEntry.date)}
                    </Text>
                  </View>
                  <DurationBadge
                    durationMinutes={latestEntry.duration_minutes}
                    targetHours={targetHours}
                  />
                </View>

                <Text style={styles.latestSubtitle}>
                  {formatSleepTimeLabel(latestEntry.bedtime)} to {formatSleepTimeLabel(latestEntry.wake_time)}
                </Text>

                <View style={styles.metricPillRow}>
                  <View style={styles.metricPill}>
                    <Text style={styles.metricPillText}>
                      {renderSleepQualityStars(latestEntry.quality_rating)}
                    </Text>
                  </View>
                  <View style={styles.metricPill}>
                    <Text style={styles.metricPillText}>
                      {getSleepWakeFeelingMeta(latestEntry.wake_feeling).emoji}{' '}
                      {getSleepWakeFeelingMeta(latestEntry.wake_feeling).label}
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}

            {weeklyAccountability && (
              <View style={styles.accountabilityCard}>
                <View style={styles.accountabilityHeader}>
                  <View>
                    <Text style={styles.cardEyebrow}>Weekly Check-In</Text>
                    <Text style={styles.accountabilityTitle}>
                      {weeklyAccountability.daysOnTarget} of{' '}
                      {weeklyAccountability.evaluatedDays} nights on target
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/(sleep)/insights' as never)}
                    style={styles.accountabilityLink}
                  >
                    <Text style={styles.accountabilityLinkText}>Insights</Text>
                  </Pressable>
                </View>
                <Text style={styles.accountabilityCopy}>
                  {weeklyAccountability.message}
                </Text>
                <View style={styles.weekDotRow}>
                  {weeklyAccountability.dots.map((dot) => (
                    <View key={dot.date} style={styles.weekDotItem}>
                      <View
                        style={[
                          styles.weekDot,
                          dot.status === 'met' && styles.weekDotMet,
                          dot.status === 'missed' && styles.weekDotMissed,
                        ]}
                      />
                      <Text style={styles.weekDotLabel}>{dot.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
        ListFooterComponent={(
          <View style={styles.footer}>
            {isLoadingMore ? (
              <ActivityIndicator color={SLEEP_ACCENT} />
            ) : hasMore ? (
              <Pressable onPress={handleLoadMore} style={styles.loadMoreButton}>
                <Text style={styles.loadMoreButtonText}>Load Older Nights</Text>
              </Pressable>
            ) : (
              <Text style={styles.footerCopy}>
                You've reached the oldest loaded sleep log.
              </Text>
            )}
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item }) => {
          const feeling = getSleepWakeFeelingMeta(item.wake_feeling);
          return (
            <Pressable
              onPress={() => router.push(`/(sleep)/entry/${item.id}` as never)}
              style={styles.entryRow}
            >
              <View style={styles.entryMain}>
                <Text style={styles.entryDate}>
                  {formatSleepEntryDateLabel(item.date)}
                </Text>
                <Text style={styles.entryTimes}>
                  {formatSleepTimeLabel(item.bedtime)} to {formatSleepTimeLabel(item.wake_time)}
                </Text>
                <Text style={styles.entryMetaLine}>
                  {renderSleepQualityStars(item.quality_rating)} • {feeling.emoji}{' '}
                  {feeling.label}
                </Text>
              </View>

              <View style={styles.entryAside}>
                <DurationBadge
                  durationMinutes={item.duration_minutes}
                  targetHours={targetHours}
                />
                <Text style={styles.entryWakeCount}>
                  {item.wake_count} wake-ups
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable
        onPress={() => router.push('/(sleep)/log' as never)}
        style={styles.fab}
      >
        <Text style={styles.fabText}>Log Sleep</Text>
      </Pressable>
    </View>
  );
}

function DurationBadge({
  durationMinutes,
  targetHours,
}: {
  durationMinutes: number;
  targetHours: number;
}) {
  const tone = getSleepDurationTone(durationMinutes, targetHours);
  const toneStyle = SLEEP_DURATION_TONES[tone];

  return (
    <View
      style={[
        styles.durationBadge,
        {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
        },
      ]}
    >
      <Text style={[styles.durationBadgeText, { color: toneStyle.textColor }]}>
        {formatDurationLabel(durationMinutes)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 180,
    gap: 12,
  },
  headerContent: {
    gap: 16,
    marginBottom: 20,
  },
  hero: {
    gap: 12,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  heroPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,15,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryCtaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryCtaButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  latestCard: {
    gap: 12,
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  latestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardEyebrow: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  latestTitle: {
    marginTop: 4,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  latestSubtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  metricPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,15,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metricPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  accountabilityCard: {
    gap: 12,
    padding: 18,
    borderRadius: 22,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accountabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  accountabilityTitle: {
    marginTop: 4,
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },
  accountabilityCopy: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  accountabilityLink: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(167,139,250,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.32)',
  },
  accountabilityLinkText: {
    color: '#E9DDFF',
    fontSize: 12,
    fontWeight: '800',
  },
  weekDotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  weekDotItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  weekDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  weekDotMet: {
    backgroundColor: 'rgba(48,209,88,0.72)',
    borderColor: 'rgba(48,209,88,0.92)',
  },
  weekDotMissed: {
    backgroundColor: 'rgba(255,69,58,0.55)',
    borderColor: 'rgba(255,69,58,0.82)',
  },
  weekDotLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  sectionTitle: {
    marginBottom: 8,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    marginBottom: 12,
    borderRadius: 22,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryMain: {
    flex: 1,
    gap: 6,
  },
  entryDate: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  entryTimes: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  entryMetaLine: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  entryAside: {
    alignItems: 'flex-end',
    gap: 8,
  },
  entryWakeCount: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  durationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  durationBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  footer: {
    paddingTop: 4,
    alignItems: 'center',
  },
  footerCopy: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  loadMoreButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadMoreButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 108,
    minHeight: 56,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SLEEP_ACCENT,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  fabText: {
    color: '#0E0E13',
    fontSize: 15,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: SLEEP_ACCENT,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 16,
    fontWeight: '800',
  },
});
