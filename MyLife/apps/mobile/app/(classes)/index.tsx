import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  createClass,
  createTeacher,
  detectClassConflicts,
  getClassesSettings,
  getScheduleForWeek,
  listClassesBySemester,
  listSemesters,
  listTeachers,
  setCurrentSemester,
  type ClassInput,
  type TeacherRow,
} from '@mylife/classes';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { ClassesScreen, useClassesFocusedSnapshot } from './_ui';
import { WeeklySchedule } from '../../components/classes/WeeklySchedule';
import { SemesterPicker } from '../../components/classes/SemesterPicker';
import { AddClassSheet } from '../../components/classes/AddClassSheet';
import { OfficeHoursWidget } from '../../components/classes/OfficeHoursWidget';

const ACCENT = colors.modules.classes;

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export default function ClassesScheduleScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = () => setRefreshTick((n) => n + 1);

  const settings = useClassesFocusedSnapshot(
    useCallback(() => getClassesSettings(db), [db]),
  );
  const semesters = useClassesFocusedSnapshot(
    useCallback(() => listSemesters(db), [db, refreshTick]),
  );
  const teachers = useClassesFocusedSnapshot(
    useCallback(() => listTeachers(db), [db, refreshTick]),
  );

  const currentSemester =
    semesters.find((s) => s.is_current === 1) ?? semesters[0] ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(
    currentSemester?.id ?? null,
  );
  const activeId = selectedId ?? currentSemester?.id ?? null;

  const blocks = useClassesFocusedSnapshot(
    useCallback(
      () => (activeId ? getScheduleForWeek(db, activeId) : []),
      [db, activeId, refreshTick],
    ),
  );
  const conflicts = useClassesFocusedSnapshot(
    useCallback(
      () => (activeId ? detectClassConflicts(db, activeId) : []),
      [db, activeId, refreshTick],
    ),
  );
  const semesterClasses = useClassesFocusedSnapshot(
    useCallback(
      () => (activeId ? listClassesBySemester(db, activeId) : []),
      [db, activeId, refreshTick],
    ),
  );

  const [showAdd, setShowAdd] = useState(false);

  function handleSelect(id: string) {
    setSelectedId(id);
    setCurrentSemester(db, id);
    refresh();
  }

  function handleSubmit(input: ClassInput) {
    createClass(db, genId('cls'), input);
    refresh();
  }

  function handleCreateTeacher(name: string): TeacherRow | null {
    return createTeacher(db, genId('tch'), { name });
  }

  return (
    <ClassesScreen
      title="Schedule"
      subtitle="Your weekly grid. Tap a block for class details, or add a class to start filling in the week."
    >
      <SemesterPicker
        semesters={semesters}
        selectedId={activeId}
        onSelect={handleSelect}
        onAddPress={() => router.push('/(classes)/settings')}
      />

      {!activeId ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No semester yet</Text>
          <Text style={styles.emptyBody}>
            Create a semester from Settings to start adding classes.
          </Text>
          <Pressable
            style={styles.primaryAction}
            onPress={() => router.push('/(classes)/settings')}
          >
            <Text style={styles.primaryActionText}>Open Settings</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <WeeklySchedule
            blocks={blocks}
            conflicts={conflicts}
            showWeekends={settings.showWeekends}
          />

          <OfficeHoursWidget
            teachers={teachers}
            classes={semesterClasses}
            onPressTeacher={(id) =>
              router.push(`/(classes)/teacher/${id}` as never)
            }
          />

          {blocks.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No classes yet</Text>
              <Text style={styles.emptyBody}>
                Tap the + button to add your first class for{' '}
                {currentSemester?.name ?? 'this semester'}.
              </Text>
            </View>
          ) : null}
        </>
      )}

      {activeId ? (
        <Pressable
          style={styles.fab}
          onPress={() => setShowAdd(true)}
          accessibilityLabel="Add class"
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      ) : null}

      {activeId ? (
        <AddClassSheet
          visible={showAdd}
          onClose={() => setShowAdd(false)}
          onSubmit={handleSubmit}
          semesterId={activeId}
          teachers={teachers}
          onCreateTeacher={handleCreateTeacher}
        />
      ) : null}
    </ClassesScreen>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryAction: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: ACCENT,
  },
  primaryActionText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  fabText: {
    color: colors.background,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
});
