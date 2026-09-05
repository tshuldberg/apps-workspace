import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import {
  endSession,
  getAreas,
  getCompletionsForDate,
  getHabits,
  getMeasurementsForDate,
  getSessionsForDate,
  getStreaks,
  recordCompletion,
  recordMeasurement,
  startSession,
  type Area,
  type DayOfWeek,
  type Habit,
  HB_ACCENT_LIGHT,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  HabitRow,
  MaterialSymbol,
  QuickCheckFAB,
  SectionHeader,
  withAlpha,
  GlassCard,
} from '@mylife/habits';
import { HeaderIconButton } from '../../../components/habits/phase1-shared';
import { ModuleLayoutWrapper } from '../../../components/ModuleLayoutWrapper';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
};

type QuickCheckRow = {
  habit: Habit;
  area: Area | null;
  streakCount: number;
  progressLabel?: string;
};

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isHabitDueOnDate(habit: Habit, date: Date) {
  const dateString = toDateString(date);
  if (habit.startDate && dateString < habit.startDate) return false;
  if (habit.endDate && dateString > habit.endDate) return false;
  const dayOfWeek = DAY_MAP[date.getDay()];
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'specific_days' && habit.specificDays) {
    return habit.specificDays.includes(dayOfWeek);
  }
  if (habit.frequency === 'weekly') return dayOfWeek === 'mon';
  if (habit.frequency === 'monthly') return date.getDate() === 1;
  return true;
}

export default function HabitsTabsLayout() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [quickCheckVisible, setQuickCheckVisible] = useState(false);

  const today = useMemo(() => new Date(), [refreshKey, quickCheckVisible]);
  const todayString = toDateString(today);
  const habits = useMemo(
    () => getHabits(db, { isArchived: false, activeOnDate: todayString }),
    [db, refreshKey, todayString],
  );
  const completions = useMemo(() => getCompletionsForDate(db, todayString), [db, refreshKey, todayString]);
  const measurements = useMemo(() => getMeasurementsForDate(db, todayString), [db, refreshKey, todayString]);
  const sessions = useMemo(() => getSessionsForDate(db, todayString), [db, refreshKey, todayString]);
  const areas = useMemo(() => getAreas(db), [db, refreshKey]);
  const areasById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);

  const pendingHabits = useMemo<QuickCheckRow[]>(() => {
    return habits
      .filter((h) => h.habitType !== 'negative' && isHabitDueOnDate(h, today))
      .filter((h) => {
        if (h.habitType === 'timed') return !sessions.some((s) => s.habitId === h.id && s.completed);
        if (h.habitType === 'measurable') return !measurements.some((m) => m.habitId === h.id && m.value >= m.target);
        return !completions.some((c) => c.habitId === h.id);
      })
      .map((h) => ({
        habit: h,
        area: h.areaId ? (areasById.get(h.areaId) ?? null) : null,
        streakCount: getStreaks(db, h.id).currentStreak,
        progressLabel: h.habitType === 'timed' ? 'Done' : h.habitType === 'measurable' ? 'Hit Goal' : undefined,
      }));
  }, [areasById, completions, db, habits, measurements, sessions, today]);

  const refreshQuickCheck = useCallback(() => setRefreshKey((v) => v + 1), []);

  const handleQuickCheck = useCallback((habit: Habit) => {
    const now = new Date().toISOString();
    if (habit.habitType === 'timed') {
      const sid = uuid();
      startSession(db, sid, habit.id, habit.targetCount);
      endSession(db, sid, habit.targetCount);
      recordCompletion(db, uuid(), habit.id, now, habit.targetCount);
    } else if (habit.habitType === 'measurable') {
      recordMeasurement(db, uuid(), habit.id, now, habit.targetCount, habit.targetCount);
    } else {
      recordCompletion(db, uuid(), habit.id, now, 1);
    }
    refreshQuickCheck();
  }, [db, refreshQuickCheck]);

  const openQuickCheck = useCallback(() => {
    setQuickCheckVisible(true);
    refreshQuickCheck();
  }, [refreshQuickCheck]);

  return (
    <View style={styles.container}>
      <ModuleLayoutWrapper
        moduleId="habits"
        errorBoundary={false}
        lockGuard={false}
        screenOptions={{ sceneStyle: { backgroundColor: HB_SURFACES.base } }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            headerRight: () => (
              <HeaderIconButton
                icon="more_vert"
                label="Settings"
                onPress={() => router.push('/(habits)/settings')}
              />
            ),
          }}
        />
        <Tabs.Screen name="habits" options={{ title: 'Habits' }} />
        <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </ModuleLayoutWrapper>

      {/* QuickCheck FAB overlay */}
      <View pointerEvents="box-none" style={styles.fabOverlay}>
        <QuickCheckFAB pendingCount={pendingHabits.length} onPress={openQuickCheck} />
      </View>

      {/* QuickCheck modal */}
      <Modal
        animationType="slide"
        onRequestClose={() => setQuickCheckVisible(false)}
        transparent
        visible={quickCheckVisible}
      >
        <Pressable onPress={() => setQuickCheckVisible(false)} style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetWrap}>
            <GlassCard level={4} style={styles.sheetCard} contentStyle={styles.sheetContent}>
              <SectionHeader title="Quick Check" action={{ label: 'Close', onPress: () => setQuickCheckVisible(false) }} />
              <Text style={styles.sheetSubcopy}>Today&apos;s pending habits, ready for one-tap completion.</Text>
              {pendingHabits.length === 0 ? (
                <GlassCard level={1} style={styles.emptyCard} contentStyle={styles.emptyContent}>
                  <MaterialSymbol name="check_circle" size={28} color={HB_ACCENT_LIGHT} filled />
                  <Text style={styles.emptyTitle}>You&apos;re caught up</Text>
                  <Text style={styles.emptyCopy}>No pending habits are due right now.</Text>
                </GlassCard>
              ) : (
                <ScrollView contentContainerStyle={styles.sheetList} showsVerticalScrollIndicator={false}>
                  {pendingHabits.map((entry) => (
                    <HabitRow
                      key={entry.habit.id}
                      area={entry.area ? { name: entry.area.name, color: entry.area.color, icon: entry.area.icon } : null}
                      habit={entry.habit}
                      onCheck={() => handleQuickCheck(entry.habit)}
                      onPress={() => { setQuickCheckVisible(false); router.push(`/(habits)/${entry.habit.id}`); }}
                      progressLabel={entry.progressLabel}
                      showArea
                      showStreak
                      streakCount={entry.streakCount}
                    />
                  ))}
                </ScrollView>
              )}
            </GlassCard>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HB_SURFACES.base },
  fabOverlay: { position: 'absolute', bottom: 72, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  sheetBackdrop: { flex: 1, backgroundColor: withAlpha('#000000', 0.66), justifyContent: 'flex-end' },
  sheetWrap: { paddingHorizontal: 12, paddingBottom: 18 },
  sheetCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  sheetContent: { gap: 12, paddingTop: 18, paddingBottom: 24 },
  sheetSubcopy: { ...HB_TYPOGRAPHY.bodyMd, color: HB_TEXT_SECONDARY },
  sheetList: { gap: 12, paddingBottom: 12 },
  emptyCard: { marginTop: 8 },
  emptyContent: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  emptyTitle: { ...HB_TYPOGRAPHY.headlineMd, color: HB_TEXT },
  emptyCopy: { ...HB_TYPOGRAPHY.bodyMd, color: HB_TEXT_TERTIARY, textAlign: 'center' },
});
