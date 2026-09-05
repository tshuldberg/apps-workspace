import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  Factor,
  SleepEntryRecord,
  SleepHygieneCheck,
  SleepHygienePracticeId,
} from '@mylife/sleep';
import {
  SLEEP_HYGIENE_PRACTICES,
  getEnabledHygienePracticeIds,
  getSleepHygieneDashboard,
  listEntries,
  listFactors,
  listHygieneChecks,
  saveHygieneCheck,
  serializeEnabledHygienePracticeIds,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { SLEEP_ACCENT } from './_ui';

interface HygieneState {
  entries: SleepEntryRecord[];
  factors: Factor[];
  checks: SleepHygieneCheck[];
  enabledPracticeIds: SleepHygienePracticeId[];
}

const HYGIENE_ENABLED_KEY = 'sleep.hygiene.enabledPractices';
const TARGET_BEDTIME_KEY = 'sleep.reminder.targetBedtime';

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function readSetting(
  db: ReturnType<typeof useDatabase>,
  key: string,
  fallback = '',
): string {
  return db.query<{ value: string }>(
    `SELECT value FROM sl_settings WHERE key = ? LIMIT 1`,
    [key],
  )[0]?.value ?? fallback;
}

function writeSetting(
  db: ReturnType<typeof useDatabase>,
  key: string,
  value: string,
): void {
  db.execute(
    `INSERT INTO sl_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

function statusLabel(status: string): string {
  if (status === 'met') return 'Met';
  if (status === 'missed') return 'Missed';
  return 'Needs data';
}

function statusStyle(status: string) {
  if (status === 'met') return styles.statusMet;
  if (status === 'missed') return styles.statusMissed;
  return styles.statusUnknown;
}

export default function SleepHygieneScreen() {
  const db = useDatabase();
  const router = useRouter();
  const referenceDate = todayDate();
  const startDate = addDays(referenceDate, -6);
  const [state, setState] = useState<HygieneState>({
    entries: [],
    factors: [],
    checks: [],
    enabledPracticeIds: getEnabledHygienePracticeIds(null),
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDashboard = useCallback(() => {
    const enabledPracticeIds = getEnabledHygienePracticeIds(
      readSetting(db, HYGIENE_ENABLED_KEY),
    );

    setState({
      entries: listEntries(db, {
        startDate,
        endDate: referenceDate,
        limit: 200,
      }),
      factors: listFactors(db, {
        startDate,
        endDate: referenceDate,
        limit: 200,
      }),
      checks: listHygieneChecks(db, {
        startDate,
        endDate: referenceDate,
      }),
      enabledPracticeIds,
    });
  }, [db, referenceDate, startDate]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    try {
      loadDashboard();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDashboard]);

  const targetBedtime = readSetting(db, TARGET_BEDTIME_KEY, '22:30');
  const dashboard = useMemo(
    () =>
      getSleepHygieneDashboard({
        entries: state.entries,
        factors: state.factors,
        checks: state.checks,
        referenceDate,
        enabledPracticeIds: state.enabledPracticeIds,
        targetBedtime,
      }),
    [
      referenceDate,
      state.checks,
      state.enabledPracticeIds,
      state.entries,
      state.factors,
      targetBedtime,
    ],
  );

  const handleToggleToday = useCallback(
    (practiceId: SleepHygienePracticeId, currentStatus: string) => {
      saveHygieneCheck(db, {
        date: referenceDate,
        practice_id: practiceId,
        met: currentStatus !== 'met',
        source: 'manual',
      });
      loadDashboard();
    },
    [db, loadDashboard, referenceDate],
  );

  const handleTogglePractice = useCallback(
    (practiceId: SleepHygienePracticeId) => {
      const enabled = new Set(state.enabledPracticeIds);
      if (enabled.has(practiceId) && enabled.size > 1) {
        enabled.delete(practiceId);
      } else {
        enabled.add(practiceId);
      }

      const next = SLEEP_HYGIENE_PRACTICES
        .map((practice) => practice.id)
        .filter((id) => enabled.has(id));
      writeSetting(db, HYGIENE_ENABLED_KEY, serializeEnabledHygienePracticeIds(next));
      loadDashboard();
    },
    [db, loadDashboard, state.enabledPracticeIds],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={SLEEP_ACCENT}
        />
      )}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Sleep Hygiene</Text>
        <Text style={styles.heroTitle}>Small daily practices, scored weekly.</Text>
        <Text style={styles.heroCopy}>
          MySleep auto-fills from factor logs when it can, and manual check-offs
          stay local with your sleep data.
        </Text>
        <View style={styles.ctaRow}>
          <Pressable
            onPress={() => router.push('/(sleep)/factors/log' as never)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Log Factors</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(sleep)/nap/log' as never)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Log Nap</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <Metric
          label="Weekly score"
          value={
            dashboard.weeklyScore === null
              ? '--'
              : `${Math.round(dashboard.weeklyScore)}%`
          }
        />
        <Metric
          label="Today"
          value={
            dashboard.today.score === null
              ? '--'
              : `${Math.round(dashboard.today.score)}%`
          }
        />
        <Metric
          label="Known items"
          value={`${dashboard.today.knownCount}/${dashboard.today.totalCount}`}
        />
        <Metric
          label="Quality link"
          value={
            dashboard.correlation.status === 'reportable'
              ? dashboard.correlation.direction
              : 'learning'
          }
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Today</Text>
        <Text style={styles.cardTitle}>{referenceDate} checklist</Text>
        <View style={styles.checkList}>
          {dashboard.today.items.map((item) => (
            <Pressable
              key={item.practice.id}
              onPress={() =>
                handleToggleToday(item.practice.id, item.status)
              }
              style={styles.checkRow}
            >
              <View style={styles.checkCopy}>
                <Text style={styles.checkTitle}>{item.practice.label}</Text>
                <Text style={styles.checkReason}>{item.reason}</Text>
              </View>
              <View style={[styles.statusPill, statusStyle(item.status)]}>
                <Text style={styles.statusText}>
                  {statusLabel(item.status)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Weekly adherence</Text>
        <Text style={styles.cardTitle}>Last 7 sleep dates</Text>
        <View style={styles.weekGrid}>
          {dashboard.daily.map((day) => (
            <View key={day.date} style={styles.weekTile}>
              <Text style={styles.weekDate}>{day.date.slice(5)}</Text>
              <Text style={styles.weekScore}>
                {day.score === null ? '--' : `${Math.round(day.score)}%`}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Quality correlation</Text>
        <Text style={styles.cardTitle}>
          {dashboard.correlation.status === 'reportable'
            ? 'Adherence has enough samples'
            : 'Still collecting samples'}
        </Text>
        <Text style={styles.cardCopy}>{dashboard.correlation.insight}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Configured practices</Text>
        <Text style={styles.cardTitle}>Tap to include or hide</Text>
        <View style={styles.practiceList}>
          {SLEEP_HYGIENE_PRACTICES.map((practice) => {
            const enabled = state.enabledPracticeIds.includes(practice.id);
            return (
              <Pressable
                key={practice.id}
                onPress={() => handleTogglePractice(practice.id)}
                style={styles.practiceRow}
              >
                <View style={styles.checkCopy}>
                  <Text style={styles.checkTitle}>{practice.label}</Text>
                  <Text style={styles.checkReason}>{practice.detail}</Text>
                </View>
                <Text
                  style={[
                    styles.practiceState,
                    enabled && styles.practiceStateEnabled,
                  ]}
                >
                  {enabled ? 'On' : 'Off'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScrollView>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
  },
  hero: {
    gap: 10,
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(167,139,250,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.26)',
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroCopy: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: SLEEP_ACCENT,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: 6,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardEyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  cardCopy: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  checkList: {
    gap: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkCopy: {
    flex: 1,
    gap: 4,
  },
  checkTitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  checkReason: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  statusPill: {
    minWidth: 86,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusMet: {
    backgroundColor: 'rgba(48,209,88,0.14)',
    borderColor: 'rgba(48,209,88,0.34)',
  },
  statusMissed: {
    backgroundColor: 'rgba(255,69,58,0.14)',
    borderColor: 'rgba(255,69,58,0.34)',
  },
  statusUnknown: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.border,
  },
  statusText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekTile: {
    width: 86,
    gap: 6,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekDate: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  weekScore: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  practiceList: {
    gap: 10,
  },
  practiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  practiceState: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  practiceStateEnabled: {
    color: '#BBF7D0',
  },
});
