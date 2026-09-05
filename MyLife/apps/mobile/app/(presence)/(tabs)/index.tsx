import { useCallback, useMemo, useState } from 'react';
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
import {
  AppRow,
  BadgeChip,
  DailyTimeCard,
  FocusFAB,
  PR_ACCENT,
  PR_ACCENT_LIGHT,
  PR_CATEGORY_GRADIENTS,
  PR_CYAN_GLOW_STYLE,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TEXT_TERTIARY,
  PR_TYPOGRAPHY,
  SectionHeader,
  XPLevelBar,
  getActiveCommitment,
  calculateStreaks,
  getActiveGoal,
  getAllActiveIntentions,
  getAppUsageByDate,
  getDailyUsageByDate,
  getDailyUsageRange,
  getFocusSessions,
  getPresenceBadgePreview,
  getPresenceLevelTitle,
  getSetting,
  getTopApps,
  getTotalXP,
  getXPProgress,
  xpForLevel,
} from '@mylife/presence';
import { EmptyState, ErrorState } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';

interface HomeLoadedState {
  error: null;
  empty: boolean;
  goalMinutes: number;
  totalXP: number;
  levelProgress: ReturnType<typeof getXPProgress>;
  levelTitle: string;
  levelFloorXP: number;
  nextLevelXP: number;
  deltaMinutes: number;
  trendData: Array<{ date: string; minutes: number }>;
  streaks: ReturnType<typeof calculateStreaks>;
  badgePreview: ReturnType<typeof getPresenceBadgePreview>;
  activeCommitmentText: string | null;
  topApps: Array<{
    app_name: string;
    category: string;
    total_minutes: number;
    total_opens: number;
    categoryKey: keyof typeof PR_CATEGORY_GRADIENTS;
    gradientFrom: string;
    gradientTo: string;
    iconName: ReturnType<typeof getCategoryIcon>;
    deltaPercent: number | null;
  }>;
  todayMinutes: number;
}

type HomeScreenState = HomeLoadedState | { error: string };

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgoKey(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return toDateKey(date);
}

function normalizeCategoryKey(category: string): keyof typeof PR_CATEGORY_GRADIENTS {
  const key = category.toLowerCase();

  if (key in PR_CATEGORY_GRADIENTS) {
    return key as keyof typeof PR_CATEGORY_GRADIENTS;
  }

  if (key === 'games') return 'gaming';
  return 'other';
}

function getCategoryIcon(category: string) {
  switch (normalizeCategoryKey(category)) {
    case 'social':
      return 'share' as const;
    case 'communication':
      return 'chat' as const;
    case 'utilities':
      return 'explore' as const;
    case 'media':
      return 'play_circle' as const;
    case 'audio':
      return 'music_note' as const;
    case 'productivity':
    case 'work':
      return 'task_alt' as const;
    case 'gaming':
      return 'bolt' as const;
    case 'education':
      return 'psychology' as const;
    default:
      return 'diamond' as const;
  }
}

function formatDeltaPercent(todayMinutes: number, yesterdayMinutes: number | null): number | null {
  if (yesterdayMinutes == null || yesterdayMinutes <= 0) {
    return todayMinutes > 0 ? null : 0;
  }

  return Math.round(((todayMinutes - yesterdayMinutes) / yesterdayMinutes) * 100);
}

function buildBadgeContext({
  totalXP,
  streaks,
  completedSessions,
  totalDays,
  activeIntentions,
}: {
  totalXP: number;
  streaks: ReturnType<typeof calculateStreaks>;
  completedSessions: number;
  totalDays: number;
  activeIntentions: number;
}) {
  const levelProgress = getXPProgress(totalXP);
  return {
    totalXP,
    level: levelProgress.level,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    completedSessions,
    totalDays,
    activeIntentions,
  };
}

export default function PresenceHomeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const today = useMemo(() => toDateKey(new Date()), []);
  const yesterday = useMemo(() => daysAgoKey(1), []);

  const state = useMemo<HomeScreenState>(() => {
    try {
      const todayUsage = getDailyUsageByDate(db, today);
      const todayApps = getAppUsageByDate(db, today, 50);
      const yesterdayApps = getAppUsageByDate(db, yesterday, 50);
      const recentDaily = getDailyUsageRange(db, daysAgoKey(29), today, 30)
        .sort((left, right) => left.date.localeCompare(right.date));
      const previousWeek = getDailyUsageRange(db, daysAgoKey(7), yesterday, 7);
      const allDaily = getDailyUsageRange(db, '2020-01-01', today, 2000)
        .sort((left, right) => left.date.localeCompare(right.date));
      const topApps = getTopApps(db, today, today, 5);
      const activeGoal = getActiveGoal(db, today);
      const activeCommitment = getActiveCommitment(db);
      const totalXP = getTotalXP(db);
      const streaks = calculateStreaks([...allDaily].reverse());
      const sessions = getFocusSessions(db, 200);
      const completedSessions = sessions.filter((session) => session.completed === 1).length;
      const activeIntentions = getAllActiveIntentions(db, 100).length;
      const fallbackGoal = Number(getSetting(db, 'daily_goal_minutes') ?? '180');

      const goalMinutes = activeGoal?.daily_minutes ?? fallbackGoal;
      const previousAverage = previousWeek.length > 0
        ? Math.round(
            previousWeek.reduce((sum, record) => sum + record.total_minutes, 0) / previousWeek.length,
          )
        : goalMinutes;
      const deltaMinutes = (todayUsage?.total_minutes ?? 0) - previousAverage;
      const levelProgress = getXPProgress(totalXP);
      const badgePreview = getPresenceBadgePreview(
        buildBadgeContext({
          totalXP,
          streaks,
          completedSessions,
          totalDays: allDaily.length,
          activeIntentions,
        }),
        6,
      );
      const yesterdayMinutesByName = new Map(
        yesterdayApps.map((record) => [record.app_name, record.minutes]),
      );

      return {
        error: null,
        empty: todayUsage == null && allDaily.length === 0 && todayApps.length === 0,
        goalMinutes,
        totalXP,
        levelProgress,
        levelTitle: getPresenceLevelTitle(levelProgress.level),
        levelFloorXP: xpForLevel(levelProgress.level),
        nextLevelXP: xpForLevel(levelProgress.level + 1),
        deltaMinutes,
        trendData: recentDaily.map((record) => ({
          date: record.date,
          minutes: record.total_minutes,
        })),
        streaks,
        badgePreview,
        activeCommitmentText: activeCommitment?.text ?? null,
        topApps: topApps.map((app) => {
          const categoryKey = normalizeCategoryKey(app.category);
          const gradient = PR_CATEGORY_GRADIENTS[categoryKey] ?? PR_CATEGORY_GRADIENTS.other;
          return {
            ...app,
            categoryKey,
            gradientFrom: gradient[0],
            gradientTo: gradient[1],
            iconName: getCategoryIcon(app.category),
            deltaPercent: formatDeltaPercent(
              app.total_minutes,
              yesterdayMinutesByName.get(app.app_name) ?? null,
            ),
          };
        }),
        todayMinutes: todayUsage?.total_minutes ?? 0,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to load presence data.',
      };
    }
  }, [db, refreshKey, today, yesterday]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((current) => current + 1);
    setRefreshing(false);
  }, []);

  if (state.error) {
    return (
      <View style={styles.screen}>
        <View style={styles.errorWrap}>
          <ErrorState message={state.error} onRetry={refresh} />
        </View>
      </View>
    );
  }

  const content = state as HomeLoadedState;

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
        {content.empty ? (
          <View style={styles.stack}>
            <EmptyState
              icon="🧘"
              title="Connect Screen Time"
              message="MyPresence becomes your daily focus dashboard once screen-time data starts flowing in. The bridge is still a stub, but the dashboard is ready."
              actionLabel="Connect Screen Time"
              onAction={() => Alert.alert('Coming Soon', 'Screen Time syncing will be wired in a later phase.')}
              accentColor={PR_ACCENT}
            />
            {content.activeCommitmentText != null ? (
              <View style={styles.commitmentEmptyCard}>
                <Text style={styles.commitmentEmptyLabel}>Remember</Text>
                <Text style={styles.commitmentEmptyText}>{content.activeCommitmentText}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <>
            <DailyTimeCard
              totalMinutes={content.todayMinutes}
              deltaMinutes={content.deltaMinutes}
              goalMinutes={content.goalMinutes}
              trendData={content.trendData}
            />

            <XPLevelBar
              level={content.levelProgress.level}
              totalXP={content.totalXP}
              currentLevelXP={content.levelFloorXP}
              nextLevelXP={content.nextLevelXP}
              title={content.levelTitle}
            />

            <View style={styles.section}>
              <SectionHeader
                title="Achievements"
                action={(
                  <Pressable
                    onPress={() => router.push('/(presence)/badges' as never)}
                    style={styles.sectionAction}
                  >
                    <Text style={styles.streakText}>{`${content.streaks.current}-day streak`}</Text>
                    <Text style={styles.linkText}>View all</Text>
                  </Pressable>
                )}
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.badgeRail}
              >
                {content.badgePreview.map((badge) => (
                  <BadgeChip
                    key={badge.id}
                    icon={badge.icon}
                    label={badge.label}
                    earned={badge.earned}
                    glow={badge.glow}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <SectionHeader
                title="Top Applications"
                action={(
                  <Pressable onPress={() => router.push('/(presence)/report' as never)}>
                    <Text style={styles.linkText}>Daily report</Text>
                  </Pressable>
                )}
              />

              <View style={styles.stack}>
                {content.topApps.length === 0 ? (
                  <View style={styles.inlineEmptyCard}>
                    <Text style={styles.inlineEmptyTitle}>No tracked apps yet today</Text>
                    <Text style={styles.inlineEmptyCopy}>
                      Once usage records land, MyPresence will rank the apps that are pulling your attention.
                    </Text>
                  </View>
                ) : (
                  content.topApps.map((app) => (
                    <AppRow
                      key={app.app_name}
                      appName={app.app_name}
                      appCategory={app.category}
                      minutes={app.total_minutes}
                      deltaPercent={app.deltaPercent}
                      iconName={app.iconName}
                      gradientFrom={app.gradientFrom}
                      gradientTo={app.gradientTo}
                    />
                  ))
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <FocusFAB onPress={() => router.push('/(presence)/(tabs)/sessions' as never)} />
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
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    fontFamily: PR_TYPOGRAPHY.titleMd.fontFamily,
  },
  topBarEyebrow: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_TERTIARY,
  },
  topBarTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_ACCENT_LIGHT,
    ...PR_CYAN_GLOW_STYLE,
  },
  discoverChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: PR_ACCENT,
  },
  discoverChipText: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: '#03151A',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  section: {
    paddingHorizontal: 20,
    gap: 14,
  },
  stack: {
    paddingHorizontal: 20,
    gap: 14,
  },
  commitmentEmptyCard: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 8,
  },
  commitmentEmptyLabel: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  commitmentEmptyText: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT,
  },
  sectionAction: {
    alignItems: 'flex-end',
    gap: 4,
  },
  streakText: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  linkText: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_ACCENT_LIGHT,
  },
  badgeRail: {
    gap: 12,
    paddingRight: 12,
  },
  inlineEmptyCard: {
    backgroundColor: PR_SURFACES.low,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 8,
  },
  inlineEmptyTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  inlineEmptyCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
