import React, { useMemo, useRef } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  GlassPanel,
  MaterialSymbol,
  TrendBars,
  buildDailySummary,
  buildPresenceRecommendations,
  calculateStreaks,
  countAppOpensForDate,
  formatScreenTime,
  getActiveGoal,
  getActiveCommitment,
  getAllActiveIntentions,
  getAppUsageByDate,
  getDailyUsageByDate,
  getDailyUsageRange,
  getFocusSessionsByDate,
  getXPForDate,
  getXPLog,
  PR_ACCENT_LIGHT,
  PR_FONTS,
  PR_SESSION_TYPES,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TEXT_TERTIARY,
  PR_TYPOGRAPHY,
} from '@mylife/presence';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type GradeLetter = 'A' | 'B' | 'C' | 'D' | 'F';

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(date: string, delta: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + delta);
  return next.toISOString().slice(0, 10);
}

function startDate(from: string, daysAgo: number): string {
  return addDays(from, -daysAgo);
}

function formatLongDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatShortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function gradeColor(grade: GradeLetter): string {
  switch (grade) {
    case 'A':
      return '#30D158';
    case 'B':
      return PR_ACCENT_LIGHT;
    case 'C':
      return '#FFB877';
    case 'D':
      return '#FB923C';
    default:
      return '#FF6B6B';
  }
}

function buildGrade(score: number): GradeLetter {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function buildTrendData(records: ReturnType<typeof getDailyUsageRange>, today: string) {
  const byDate = new Map(records.map((record) => [record.date, record.total_minutes]));
  const data: Array<{ label: string; value: number; isToday: boolean }> = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    data.push({
      label: formatShortDate(date),
      value: byDate.get(date) ?? 0,
      isToday: offset === 0,
    });
  }

  return data;
}

export default function ReportScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const selectedDate = params.date != null && isValidDateString(params.date)
    ? params.date
    : todayString();
  const shareCardRef = useRef<View>(null);

  const report = useMemo(() => {
    try {
      const dailyUsage = getDailyUsageByDate(db, selectedDate);
      const appUsage = getAppUsageByDate(db, selectedDate);
      const focusSessions = getFocusSessionsByDate(db, selectedDate);
      const recentUsage = getDailyUsageRange(db, startDate(selectedDate, 6), selectedDate);
      const recentStreakUsage = getDailyUsageRange(db, startDate(selectedDate, 60), selectedDate);
      const goal = getActiveGoal(db, selectedDate);
      const activeIntentions = getAllActiveIntentions(db);
      const xpEntries = getXPLog(db, 1000).filter((entry) => entry.date === selectedDate);
      const xpTotal = getXPForDate(db, selectedDate);

      return {
        dailyUsage,
        appUsage,
        focusSessions,
        recentUsage,
        recentStreakUsage,
        goal,
        activeIntentions,
        xpEntries,
        xpTotal,
      };
    } catch {
      return null;
    }
  }, [db, selectedDate]);

  if (report == null) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>Daily report unavailable</Text>
          <Text style={styles.errorCopy}>
            Presence data could not be read for this date.
          </Text>
        </View>
      </>
    );
  }

  const {
    dailyUsage,
    appUsage,
    focusSessions,
    recentUsage,
    recentStreakUsage,
    goal,
    activeIntentions,
    xpEntries,
    xpTotal,
  } = report;
  const summary = dailyUsage == null
    ? null
    : buildDailySummary(dailyUsage, appUsage);
  const goalMinutes = goal?.daily_minutes ?? 180;
  const totalMinutes = summary?.totalMinutes ?? 0;
  const completedSessions = focusSessions.filter((session) => session.completed === 1);
  const focusMinutes = completedSessions.reduce(
    (sum, session) => sum + (session.actual_minutes ?? session.planned_minutes),
    0,
  );
  const bestSession = completedSessions.reduce((best, session) => {
    const duration = session.actual_minutes ?? session.planned_minutes;
    return Math.max(best, duration);
  }, 0);
  const averageMinutes = recentUsage.length > 0
    ? Math.round(recentUsage.reduce((sum, record) => sum + record.total_minutes, 0) / recentUsage.length)
    : 0;
  const streaks = calculateStreaks(recentStreakUsage);

  const intentionStatus = activeIntentions.map((intention) => {
    const app = appUsage.find((item) => item.app_id === intention.app_id);
    const opens = countAppOpensForDate(db, selectedDate, intention.app_id);
    const minutes = app?.minutes ?? 0;
    const averagePerOpen = opens > 0 ? minutes / opens : 0;
    const withinOpens = intention.daily_open_limit == null || opens <= intention.daily_open_limit;
    const withinMinutes = intention.per_open_minutes == null || averagePerOpen <= intention.per_open_minutes;

    return {
      appId: intention.app_id,
      appName: intention.app_name,
      compliant: withinOpens && withinMinutes,
      overage: Math.max(opens - (intention.daily_open_limit ?? opens), 0),
    };
  });

  const intentionMap = new Map(intentionStatus.map((item) => [item.appId, item]));
  const intentionCompliance = intentionStatus.length === 0
    ? 100
    : Math.round(
        (intentionStatus.filter((item) => item.compliant).length / intentionStatus.length) * 100,
      );

  const goalCompliance = goalMinutes <= 0
    ? 100
    : Math.max(
        0,
        Math.min(
          100,
          Math.round((1 - Math.max(totalMinutes - goalMinutes, 0) / goalMinutes) * 100),
        ),
      );
  const sessionCompliance = completedSessions.length > 0 ? 100 : 0;
  const overallScore = Math.round(goalCompliance * 0.55 + intentionCompliance * 0.25 + sessionCompliance * 0.2);
  const grade = buildGrade(overallScore);
  const gradeAccent = gradeColor(grade);
  const dayNarrative = [
    totalMinutes <= goalMinutes
      ? `${formatScreenTime(goalMinutes - totalMinutes)} under goal`
      : `${formatScreenTime(totalMinutes - goalMinutes)} over goal`,
    completedSessions.length > 0
      ? `${completedSessions.length} focus session${completedSessions.length === 1 ? '' : 's'}`
      : 'No focus sessions',
    intentionStatus.length === 0
      ? 'No active intentions'
      : intentionCompliance === 100
        ? 'Intentions held'
        : `${intentionStatus.filter((item) => !item.compliant).length} intention misses`,
  ].join(' · ');

  const recommendations = summary == null
    ? []
    : buildPresenceRecommendations({
        summary,
        goalMinutes,
        recentAverageMinutes: averageMinutes,
        completedSessions: completedSessions.length,
        focusMinutes,
        currentStreak: streaks.current,
        intentionCompliance,
        violatingApps: intentionStatus
          .filter((item) => !item.compliant)
          .sort((left, right) => right.overage - left.overage),
      });
  const trendData = buildTrendData(recentUsage, selectedDate);
  const goalXp = xpEntries
    .filter((entry) => entry.source === 'goal')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const sessionXp = xpEntries
    .filter((entry) => entry.source === 'session')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const intentionXp = xpEntries
    .filter((entry) => entry.source === 'intention')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const streakXp = xpEntries
    .filter((entry) => entry.source === 'streak')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const activeCommitment = getActiveCommitment(db);
  const shouldShowCommitment = activeCommitment != null && (grade === 'C' || grade === 'D' || grade === 'F');

  const handleDateShift = (delta: number) => {
    const nextDate = addDays(selectedDate, delta);
    if (nextDate > todayString()) {
      return;
    }

    router.replace({
      pathname: '/(presence)/report',
      params: { date: nextDate },
    } as never);
  };

  const handleShare = async () => {
    if (shareCardRef.current == null) {
      return;
    }

    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing unavailable', 'This device does not support file sharing.');
        return;
      }

      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await Sharing.shareAsync(uri, {
        dialogTitle: 'Share Day Summary',
        mimeType: 'image/png',
      });
    } catch {
      Alert.alert('Share failed', 'The day summary image could not be generated.');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable style={styles.headerButton} onPress={() => router.back()}>
            <MaterialSymbol name="chevron_left" size={22} color={PR_TEXT} />
          </Pressable>

          <View style={styles.headerDate}>
            <Pressable style={styles.headerButton} onPress={() => handleDateShift(-1)}>
              <MaterialSymbol name="chevron_left" size={18} color={PR_TEXT_TERTIARY} />
            </Pressable>
            <Text style={styles.headerDateText}>{formatShortDate(selectedDate)}</Text>
            <Pressable
              style={[
                styles.headerButton,
                selectedDate >= todayString() && styles.headerButtonDisabled,
              ]}
              onPress={() => handleDateShift(1)}
              disabled={selectedDate >= todayString()}
            >
              <MaterialSymbol name="chevron_right" size={18} color={PR_TEXT_TERTIARY} />
            </Pressable>
          </View>

          <Pressable style={styles.headerButton} onPress={() => void handleShare()}>
            <MaterialSymbol name="share" size={20} color={PR_TEXT} />
          </Pressable>
        </View>

        <View style={styles.heroSection}>
          <Text style={styles.heroDate}>{formatLongDate(selectedDate)}</Text>
          <Text style={[styles.heroGrade, { color: gradeAccent }]}>{grade}</Text>
          <Text style={styles.heroSubtitle}>{dayNarrative}</Text>
        </View>

        <GlassPanel padding={18} style={styles.card}>
          <Text style={styles.sectionTitle}>Total screen time</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>{formatScreenTime(totalMinutes)}</Text>
            <Text style={[styles.totalDelta, { color: totalMinutes <= goalMinutes ? '#30D158' : '#FF6B6B' }]}>
              {totalMinutes <= goalMinutes
                ? `${formatScreenTime(goalMinutes - totalMinutes)} under goal`
                : `${formatScreenTime(totalMinutes - goalMinutes)} over goal`}
            </Text>
          </View>
          <Text style={styles.averageText}>
            {averageMinutes > 0
              ? `${Math.abs(Math.round(((totalMinutes - averageMinutes) / Math.max(averageMinutes, 1)) * 100))}% ${totalMinutes <= averageMinutes ? 'below' : 'above'} 7-day average`
              : 'No 7-day average yet'}
          </Text>
          <TrendBars data={trendData} goalValue={goalMinutes} height={86} />
        </GlassPanel>

        <GlassPanel padding={18} style={styles.card}>
          <Text style={styles.sectionTitle}>App breakdown</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.appColumn]}>App</Text>
            <Text style={styles.tableHeaderText}>Time</Text>
            <Text style={styles.tableHeaderText}>Opens</Text>
            <Text style={styles.tableHeaderText}>Rule</Text>
          </View>
          <View style={styles.tableBody}>
            {appUsage.length === 0 ? (
              <Text style={styles.emptyInlineCopy}>No app usage recorded for this date.</Text>
            ) : (
              appUsage.map((app) => {
                const intention = intentionMap.get(app.app_id);
                return (
                  <View key={app.id} style={styles.tableRow}>
                    <View style={styles.appColumn}>
                      <Text style={styles.appName}>{app.app_name}</Text>
                      <Text style={styles.appCategory}>{app.category}</Text>
                    </View>
                    <Text style={styles.tableValue}>{formatScreenTime(app.minutes)}</Text>
                    <Text style={styles.tableValue}>{app.opens}</Text>
                    {intention == null ? (
                      <Text style={styles.tableMuted}>-</Text>
                    ) : (
                      <MaterialSymbol
                        name={intention.compliant ? 'check_circle' : 'close'}
                        size={18}
                        color={intention.compliant ? '#30D158' : '#FF6B6B'}
                        filled={intention.compliant}
                      />
                    )}
                  </View>
                );
              })
            )}
          </View>
        </GlassPanel>

        <GlassPanel padding={18} style={styles.card}>
          <Text style={styles.sectionTitle}>Focus sessions</Text>
          <View style={styles.metricGrid}>
            <Metric label="Completed" value={String(completedSessions.length)} />
            <Metric label="Focus time" value={formatScreenTime(focusMinutes)} />
            <Metric label="Best session" value={bestSession > 0 ? formatScreenTime(bestSession) : '-'} />
            <Metric label="Streak" value={`${streaks.current}d`} />
          </View>
          <View style={styles.sessionList}>
            {completedSessions.length === 0 ? (
              <Text style={styles.emptyInlineCopy}>No completed focus sessions on this day.</Text>
            ) : (
              completedSessions.map((session) => (
                <View key={session.id} style={styles.sessionRow}>
                  <View style={[styles.sessionBadge, { backgroundColor: `${PR_SESSION_TYPES[session.type]}22` }]}>
                    <Text style={[styles.sessionBadgeText, { color: PR_SESSION_TYPES[session.type] }]}>
                      {session.type.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.sessionDuration}>
                    {formatScreenTime(session.actual_minutes ?? session.planned_minutes)}
                  </Text>
                  <Text style={styles.sessionRating}>
                    {session.rating == null ? '—' : '★'.repeat(session.rating)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </GlassPanel>

        <GlassPanel padding={18} style={styles.card}>
          <Text style={styles.sectionTitle}>XP breakdown</Text>
          <View style={styles.xpList}>
            <XPRow label="Goal compliance" value={goalXp} />
            <XPRow label="Focus sessions" value={sessionXp} />
            <XPRow label="Intentions" value={intentionXp} />
            <XPRow label="Streak bonus" value={streakXp} />
            <XPRow label="Total" value={xpTotal} highlight />
          </View>
        </GlassPanel>

        <GlassPanel padding={18} style={styles.card}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          <View style={styles.recommendationList}>
            {shouldShowCommitment ? (
              <View style={styles.commitmentCallout}>
                <Text style={styles.commitmentEyebrow}>Remember</Text>
                <Text style={styles.commitmentBody}>{activeCommitment?.text}</Text>
              </View>
            ) : null}
            {recommendations.length === 0 ? (
              <Text style={styles.emptyInlineCopy}>Recommendations appear once a daily summary exists.</Text>
            ) : (
              recommendations.map((item) => (
                <Pressable
                  key={item.title}
                  style={styles.recommendationCard}
                  onPress={() => router.push(item.actionRoute as never)}
                >
                  <MaterialSymbol name="lightbulb" size={18} color={PR_ACCENT_LIGHT} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recommendationTitle}>{item.title}</Text>
                    <Text style={styles.recommendationBody}>{item.body}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </GlassPanel>

        <View ref={shareCardRef} collapsable={false}>
          <GlassPanel padding={20} style={styles.shareCard}>
            <Text style={styles.shareEyebrow}>PRIVACY-SAFE DAY SUMMARY</Text>
            <Text style={[styles.shareGrade, { color: gradeAccent }]}>{grade}</Text>
            <Text style={styles.shareTime}>{formatScreenTime(totalMinutes)}</Text>
            <Text style={styles.shareMeta}>
              {completedSessions.length} focus session{completedSessions.length === 1 ? '' : 's'} · {xpTotal} XP
            </Text>
          </GlassPanel>
        </View>

        <Pressable style={styles.shareButton} onPress={() => void handleShare()}>
          <Text style={styles.shareButtonText}>Share Day Summary</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function XPRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <View style={styles.xpRow}>
      <Text style={highlight ? styles.xpLabelHighlight : styles.xpLabel}>{label}</Text>
      <Text style={highlight ? styles.xpValueHighlight : styles.xpValue}>+{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PR_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  errorScreen: {
    flex: 1,
    backgroundColor: PR_SURFACES.base,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  errorTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
  },
  errorCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerButtonDisabled: {
    opacity: 0.3,
  },
  headerDateText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
    minWidth: 72,
    textAlign: 'center',
  },
  heroSection: {
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  heroDate: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  heroGrade: {
    fontFamily: PR_FONTS.extraBold,
    fontSize: 80,
    lineHeight: 84,
    letterSpacing: -3,
  },
  heroSubtitle: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    textAlign: 'center',
    maxWidth: 320,
  },
  card: {
    gap: 14,
  },
  sectionTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
  },
  totalRow: {
    gap: 6,
  },
  totalValue: {
    fontFamily: PR_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    color: PR_TEXT,
    letterSpacing: -1.2,
  },
  totalDelta: {
    ...PR_TYPOGRAPHY.titleMd,
  },
  averageText: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_TERTIARY,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tableHeaderText: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_TERTIARY,
    minWidth: 40,
    textAlign: 'right',
  },
  tableBody: {
    gap: 10,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  appColumn: {
    flex: 1,
    textAlign: 'left',
  },
  appName: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  appCategory: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  tableValue: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT,
    minWidth: 44,
    textAlign: 'right',
  },
  tableMuted: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_TERTIARY,
    minWidth: 18,
    textAlign: 'right',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '47%',
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 6,
  },
  metricLabel: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_TERTIARY,
  },
  metricValue: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  sessionList: {
    gap: 8,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sessionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  sessionBadgeText: {
    ...PR_TYPOGRAPHY.labelUpper,
  },
  sessionDuration: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT,
    flex: 1,
  },
  sessionRating: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_ACCENT_LIGHT,
  },
  xpList: {
    gap: 10,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  xpLabel: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
  xpValue: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  xpLabelHighlight: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_ACCENT_LIGHT,
  },
  xpValueHighlight: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_ACCENT_LIGHT,
  },
  recommendationList: {
    gap: 10,
  },
  commitmentCallout: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(34,211,238,0.12)',
  },
  commitmentEyebrow: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_ACCENT_LIGHT,
  },
  commitmentBody: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT,
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  recommendationTitle: {
    ...PR_TYPOGRAPHY.titleMd,
    color: PR_TEXT,
  },
  recommendationBody: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_TEXT_SECONDARY,
    marginTop: 4,
  },
  shareCard: {
    alignItems: 'center',
    gap: 8,
  },
  shareEyebrow: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_TERTIARY,
  },
  shareGrade: {
    fontFamily: PR_FONTS.extraBold,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -2,
  },
  shareTime: {
    fontFamily: PR_FONTS.bold,
    fontSize: 28,
    lineHeight: 34,
    color: PR_TEXT,
  },
  shareMeta: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  shareButton: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PR_ACCENT_LIGHT,
  },
  shareButtonText: {
    ...PR_TYPOGRAPHY.titleMd,
    color: '#041015',
  },
  emptyInlineCopy: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
});
