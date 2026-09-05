import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GlassPanel,
  MaterialSymbol,
  PR_ACCENT,
  PR_ACCENT_LIGHT,
  PR_CYAN_GLOW_STYLE,
  PR_SESSION_TYPES,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TEXT_TERTIARY,
  PR_TYPOGRAPHY,
  SectionHeader,
  TrendBars,
  calculateXP,
  createFocusSession,
  formatScreenTime,
  getFocusSessions,
  type FocusSession,
} from '@mylife/presence';
import { EmptyState, ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

interface SessionsLoadedState {
  error: null;
  sessions: FocusSession[];
  weeklySessionsCount: number;
  weeklyMinutes: number;
  weeklyCompletionRate: number;
  currentStreak: number;
  trendData: Array<{ label: string; value: number; isToday: boolean }>;
}

type SessionsScreenState = SessionsLoadedState | { error: string };

type SessionType = 'solo' | 'group' | 'beast';
type QuickFilter = 'all' | 'solo' | 'group' | 'beast' | 'completed' | 'abandoned';
type SortMode = 'date' | 'duration' | 'xp';

const SESSION_TYPE_META: Record<
  SessionType,
  { label: string; chipLabel: string; icon: 'person' | 'groups' | 'bolt'; accent: string; glow?: boolean }
> = {
  solo: {
    label: 'Solo Focus',
    chipLabel: 'Solo',
    icon: 'person',
    accent: PR_SESSION_TYPES.solo,
  },
  group: {
    label: 'Group Focus',
    chipLabel: 'Group',
    icon: 'groups',
    accent: PR_SESSION_TYPES.group,
  },
  beast: {
    label: 'Beast Mode',
    chipLabel: 'Beast',
    icon: 'bolt',
    accent: PR_SESSION_TYPES.beast,
    glow: true,
  },
};

const DURATION_OPTIONS = [15, 25, 45, 60, 90];

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgoKey(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toDateKey(date);
}

function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function calculateSessionStreak(sessions: FocusSession[]): number {
  const completedDates = [...new Set(
    sessions
      .filter((session) => session.completed === 1)
      .map((session) => session.start_time.slice(0, 10)),
  )].sort((left, right) => right.localeCompare(left));

  if (completedDates.length === 0) {
    return 0;
  }

  let streak = 1;

  for (let index = 1; index < completedDates.length; index += 1) {
    const previous = new Date(`${completedDates[index - 1]}T00:00:00`);
    const current = new Date(`${completedDates[index]}T00:00:00`);
    const diffDays = Math.round((previous.getTime() - current.getTime()) / 86_400_000);

    if (diffDays !== 1) {
      break;
    }

    streak += 1;
  }

  return streak;
}

export default function SessionsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<SessionType>('solo');
  const [selectedDuration, setSelectedDuration] = useState<number>(25);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [visibleCount, setVisibleCount] = useState(50);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const state = useMemo<SessionsScreenState>(() => {
    try {
      const sessions = getFocusSessions(db, 250);
      const weekStart = daysAgoKey(6);
      const weeklySessions = sessions.filter((session) => session.start_time.slice(0, 10) >= weekStart);
      const completedWeekly = weeklySessions.filter((session) => session.completed === 1);
      const weeklyMinutes = completedWeekly.reduce(
        (sum, session) => sum + (session.actual_minutes ?? session.planned_minutes),
        0,
      );
      const weeklyCompletionRate = weeklySessions.length > 0
        ? Math.round((completedWeekly.length / weeklySessions.length) * 100)
        : 0;

      const trendData = Array.from({ length: 7 }, (_, index) => {
        const date = daysAgoKey(6 - index);
        const sessionsForDay = completedWeekly.filter((session) => session.start_time.slice(0, 10) === date);
        const totalMinutes = sessionsForDay.reduce(
          (sum, session) => sum + (session.actual_minutes ?? session.planned_minutes),
          0,
        );

        return {
          label: new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
          value: totalMinutes,
          isToday: date === toDateKey(new Date()),
        };
      });

      return {
        error: null,
        sessions,
        weeklySessionsCount: weeklySessions.length,
        weeklyMinutes,
        weeklyCompletionRate,
        currentStreak: calculateSessionStreak(sessions),
        trendData,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to load focus sessions.',
      };
    }
  }, [db, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((current) => current + 1);
    setRefreshing(false);
  }, []);

  const filteredSessions = useMemo(() => {
    if (state.error) {
      return [];
    }

    const sessionSource = (state as SessionsLoadedState).sessions;

    return [...sessionSource]
      .filter((session) => {
        if (quickFilter === 'completed') return session.completed === 1;
        if (quickFilter === 'abandoned') return session.completed === 0;
        if (quickFilter === 'all') return true;
        return session.type === quickFilter;
      })
      .sort((left, right) => {
        if (sortMode === 'duration') {
          return (right.actual_minutes ?? right.planned_minutes) - (left.actual_minutes ?? left.planned_minutes);
        }

        if (sortMode === 'xp') {
          return (
            calculateXP('session', right.actual_minutes ?? right.planned_minutes) -
            calculateXP('session', left.actual_minutes ?? left.planned_minutes)
          );
        }

        return right.start_time.localeCompare(left.start_time);
      });
  }, [quickFilter, sortMode, state]);

  const visibleSessions = filteredSessions.slice(0, visibleCount);

  const startSession = useCallback(() => {
    try {
      const session = createFocusSession(db, {
        planned_minutes: selectedDuration,
        type: selectedType,
      });

      refresh();
      router.push({
        pathname: '/(presence)/session-active',
        params: {
          sessionId: session.id,
          plannedMinutes: String(selectedDuration),
        },
      } as never);
    } catch (error) {
      Alert.alert(
        'Session failed to start',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [db, refresh, router, selectedDuration, selectedType]);

  if (state.error) {
    return (
      <View style={styles.screen}>
        <View style={styles.errorWrap}>
          <ErrorState message={state.error} onRetry={refresh} />
        </View>
      </View>
    );
  }

  const content = state as SessionsLoadedState;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={PR_ACCENT_LIGHT}
            colors={[PR_ACCENT_LIGHT]}
          />
        )}
      >
        <View style={styles.heroBlock}>
          <Text style={styles.heroEyebrow}>Focus</Text>
          <Text style={styles.heroTitle}>Sessions</Text>
          <Text style={styles.heroCopy}>
            Keep momentum visible, launch a new focus block, and track how consistently you protected your attention.
          </Text>
        </View>

        {content.sessions.length === 0 ? (
          <View style={styles.stack}>
            <GlassPanel padding={20}>
              <EmptyState
                icon="🎯"
                title="No sessions yet"
                message="Start your first focus session below. MyPresence will track streaks, focus time, and XP once you begin."
              />
            </GlassPanel>
          </View>
        ) : null}

        <View style={styles.stack}>
          <GlassPanel padding={20} style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View>
                <Text style={styles.cardEyebrow}>Weekly Summary</Text>
                <Text style={styles.summaryCopy}>Last seven days</Text>
              </View>
              <View style={styles.streakPill}>
                <MaterialSymbol name="local_fire_department" size={16} color={PR_ACCENT_LIGHT} filled />
                <Text style={styles.streakPillText}>{`${content.currentStreak} day streak`}</Text>
              </View>
            </View>

            <View style={styles.summaryMetrics}>
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryValue}>{String(content.weeklySessionsCount)}</Text>
                <Text style={styles.summaryLabel}>sessions</Text>
              </View>
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryValue}>{formatScreenTime(content.weeklyMinutes)}</Text>
                <Text style={styles.summaryLabel}>focus time</Text>
              </View>
              <View style={styles.summaryMetric}>
                <Text style={styles.summaryValue}>{`${content.weeklyCompletionRate}%`}</Text>
                <Text style={styles.summaryLabel}>completion</Text>
              </View>
            </View>

            <TrendBars data={content.trendData} height={72} />
          </GlassPanel>

          <GlassPanel padding={20} style={styles.startCard}>
            <SectionHeader
              title="Start a New Session"
              action={(
                <Pressable
                  style={styles.inlineAction}
                  onPress={() => Alert.alert('Whitelist', 'Whitelist editing lands in the active session flow in a later phase.')}
                >
                  <MaterialSymbol name="tune" size={16} color={PR_ACCENT_LIGHT} />
                  <Text style={styles.inlineActionText}>Whitelist</Text>
                </Pressable>
              )}
            />

            <View style={styles.typeGrid}>
              {(['solo', 'group', 'beast'] as SessionType[]).map((type) => {
                const selected = type === selectedType;
                const meta = SESSION_TYPE_META[type];
                return (
                  <Pressable
                    key={type}
                    onPress={() => setSelectedType(type)}
                    style={[
                      styles.typeTile,
                      selected && {
                        backgroundColor: `${meta.accent}20`,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.typeIconWrap,
                        {
                          backgroundColor: `${meta.accent}18`,
                        },
                        selected && meta.glow && styles.beastGlow,
                      ]}
                    >
                      <MaterialSymbol
                        name={meta.icon}
                        size={20}
                        color={meta.accent}
                        filled={selected}
                      />
                    </View>
                    <Text style={[styles.typeTitle, selected && { color: meta.accent }]}>
                      {meta.label}
                    </Text>
                    <Text style={styles.typeCopy}>
                      {type === 'solo'
                        ? 'Default private focus mode.'
                        : type === 'group'
                          ? 'Shared accountability placeholder.'
                          : 'No early exits. Commit fully.'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((minutes) => {
                const selected = minutes === selectedDuration;
                return (
                  <Pressable
                    key={minutes}
                    onPress={() => setSelectedDuration(minutes)}
                    style={[styles.durationChip, selected && styles.durationChipActive]}
                  >
                    <Text style={[styles.durationText, selected && styles.durationTextActive]}>
                      {`${minutes}m`}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => Alert.alert('Custom duration', 'Custom presets are queued for a later phase.')}
                style={styles.durationChip}
              >
                <Text style={styles.durationText}>Custom</Text>
              </Pressable>
            </View>

            <Pressable onPress={startSession}>
              <LinearGradient
                colors={[PR_ACCENT_LIGHT, PR_ACCENT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startButton}
              >
                <MaterialSymbol name="play_circle" size={20} color="#04161D" filled />
                <Text style={styles.startButtonText}>{`Start ${SESSION_TYPE_META[selectedType].label}`}</Text>
              </LinearGradient>
            </Pressable>
          </GlassPanel>
        </View>

        <View style={styles.section}>
          <Text style={styles.filterLabel}>Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {(['all', 'solo', 'group', 'beast', 'completed', 'abandoned'] as QuickFilter[]).map((value) => {
              const selected = quickFilter === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setQuickFilter(value)}
                  style={[styles.filterChip, selected && styles.filterChipActive]}
                >
                  <Text style={[styles.filterText, selected && styles.filterTextActive]}>
                    {value}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.filterLabel}>Sort</Text>
          <View style={styles.sortRow}>
            {(['date', 'duration', 'xp'] as SortMode[]).map((value) => {
              const selected = sortMode === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setSortMode(value)}
                  style={[styles.sortChip, selected && styles.sortChipActive]}
                >
                  <Text style={[styles.sortText, selected && styles.sortTextActive]}>{value}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Recent Activity" />
          <View style={styles.historyStack}>
            {visibleSessions.length === 0 ? (
              <GlassPanel padding={20}>
                <EmptyState
                  icon="🧠"
                  title="No sessions match this filter"
                  message="Adjust the chips above to bring sessions back into view."
                />
              </GlassPanel>
            ) : (
              visibleSessions.map((session) => {
                const meta = SESSION_TYPE_META[session.type as SessionType] ?? SESSION_TYPE_META.solo;
                const xpEarned = calculateXP('session', session.actual_minutes ?? session.planned_minutes);
                const completed = session.completed === 1;

                return (
                  <GlassPanel
                    key={session.id}
                    padding={16}
                    style={[
                      styles.historyCard,
                      session.type === 'beast' && styles.beastSessionCard,
                    ]}
                    onPress={() =>
                      Alert.alert(
                        meta.label,
                        `${formatSessionDate(session.start_time)}\n${formatScreenTime(
                          session.actual_minutes ?? session.planned_minutes,
                        )}\n${completed ? 'Completed' : 'Abandoned'}`,
                      )
                    }
                  >
                    <View style={styles.historyLeft}>
                      <View style={[styles.historyIconWrap, { backgroundColor: `${meta.accent}1A` }]}>
                        <MaterialSymbol name={meta.icon} size={18} color={meta.accent} filled={completed} />
                      </View>
                      <View style={styles.historyCopy}>
                        <View style={styles.historyTitleRow}>
                          <Text style={styles.historyTitle}>{meta.label}</Text>
                          <View style={[styles.typeBadge, { backgroundColor: `${meta.accent}18` }]}>
                            <Text style={[styles.typeBadgeText, { color: meta.accent }]}>
                              {meta.chipLabel}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.historyMeta}>
                          {`${formatSessionDate(session.start_time)} · ${session.planned_minutes} min`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.historyRight}>
                      <View style={styles.historyStatusRow}>
                        <MaterialSymbol
                          name={completed ? 'check_circle' : 'close'}
                          size={18}
                          color={completed ? '#30D158' : '#FFB4AB'}
                          filled={completed}
                        />
                        <Text style={[styles.historyXP, { color: completed ? meta.accent : PR_TEXT_SECONDARY }]}>
                          {`+${xpEarned} XP`}
                        </Text>
                      </View>
                      <Text style={styles.historySecondary}>
                        {completed ? 'Completed' : 'Abandoned'}
                      </Text>
                    </View>
                  </GlassPanel>
                );
              })
            )}
          </View>

          {filteredSessions.length > visibleCount ? (
            <Pressable style={styles.loadMoreButton} onPress={() => setVisibleCount((current) => current + 50)}>
              <Text style={styles.loadMoreText}>Load 50 more</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PR_SURFACES.lowest,
  },
  content: {
    paddingBottom: 160,
    gap: 20,
  },
  stickyShell: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    backgroundColor: 'rgba(14, 14, 19, 0.92)',
  },
  topBar: {
    minHeight: 64,
    borderRadius: 24,
    backgroundColor: 'rgba(19, 19, 24, 0.76)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: PR_ACCENT,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    ...PR_TYPOGRAPHY.titleMd,
    color: '#03151A',
  },
  topBarEyebrow: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  topBarTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_ACCENT_LIGHT,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  heroBlock: {
    paddingHorizontal: 20,
    gap: 6,
  },
  heroEyebrow: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  heroTitle: {
    ...PR_TYPOGRAPHY.displayLg,
    color: PR_TEXT,
    lineHeight: 52,
  },
  heroCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  stack: {
    paddingHorizontal: 20,
    gap: 14,
  },
  summaryCard: {
    gap: 18,
  },
  upNextCard: {
    gap: 14,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardEyebrow: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  summaryCopy: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    marginTop: 4,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(34,211,238,0.12)',
  },
  streakPillText: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_ACCENT_LIGHT,
  },
  summaryMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryMetric: {
    flex: 1,
    gap: 4,
  },
  summaryValue: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
  },
  summaryLabel: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  sectionHelperText: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  upNextStack: {
    gap: 10,
  },
  upNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upNextDuration: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  startCard: {
    gap: 18,
  },
  inlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineActionText: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_ACCENT_LIGHT,
  },
  typeGrid: {
    gap: 12,
  },
  typeTile: {
    backgroundColor: PR_SURFACES.low,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  typeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beastGlow: {
    shadowColor: PR_SESSION_TYPES.beast,
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  typeTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  sessionCardTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  sessionMeta: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
  },
  typeCopy: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  durationChip: {
    minWidth: 72,
    borderRadius: 999,
    backgroundColor: PR_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChipActive: {
    backgroundColor: PR_ACCENT_LIGHT,
  },
  durationText: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_SECONDARY,
  },
  durationTextActive: {
    color: '#03151A',
  },
  startButton: {
    minHeight: 54,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...PR_CYAN_GLOW_STYLE,
  },
  startButtonText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: '#04161D',
  },
  section: {
    paddingHorizontal: 20,
    gap: 14,
  },
  filterLabel: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_TERTIARY,
  },
  filterRow: {
    gap: 10,
    paddingRight: 12,
  },
  filterChip: {
    borderRadius: 999,
    backgroundColor: PR_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: PR_ACCENT_LIGHT,
  },
  filterText: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_SECONDARY,
  },
  filterTextActive: {
    color: '#03151A',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sortChip: {
    borderRadius: 999,
    backgroundColor: PR_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sortChipActive: {
    backgroundColor: 'rgba(34,211,238,0.12)',
  },
  sortText: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  sortTextActive: {
    color: PR_ACCENT_LIGHT,
  },
  historyStack: {
    gap: 12,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  beastSessionCard: {
    shadowColor: PR_SESSION_TYPES.beast,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  historyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCopy: {
    flex: 1,
    gap: 4,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  historyTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  typeBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  typeBadgeText: {
    ...PR_TYPOGRAPHY.labelTight,
  },
  historyMeta: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
  },
  historyRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  historyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyXP: {
    ...PR_TYPOGRAPHY.labelUpper,
  },
  historySecondary: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  loadMoreButton: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: PR_SURFACES.low,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
