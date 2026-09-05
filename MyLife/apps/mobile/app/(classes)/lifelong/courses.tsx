import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  getCourseStats,
  listOnlineCourses,
  type OnlineCourseRow,
  type OnlineCourseStats,
  type OnlineCourseStatus,
} from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  ClassesEmptyCard,
  ClassesMetricRow,
  ClassesScreen,
  useClassesFocusedSnapshot,
} from '../_ui';
import { CourseListCard } from './_ui';

type Filter = 'all' | OnlineCourseStatus;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'not_started', label: 'Not started' },
  { id: 'abandoned', label: 'Abandoned' },
];

interface Snapshot {
  courses: OnlineCourseRow[];
  stats: OnlineCourseStats;
}

export default function CoursesListScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback((): Snapshot => {
    const courses = listOnlineCourses(
      db,
      filter === 'all' ? {} : { status: filter },
    );
    return { courses, stats: getCourseStats(db) };
  }, [db, filter]);

  const snap = useClassesFocusedSnapshot(load);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ClassesScreen
        title="Courses"
        subtitle="Self-directed courses across every provider you use."
      >
        <ClassesMetricRow
          items={[
            { label: 'Total', value: String(snap.stats.total) },
            { label: 'In progress', value: String(snap.stats.in_progress) },
            {
              label: 'Hours',
              value: snap.stats.total_hours_spent.toFixed(1),
            },
          ]}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={[
                  styles.chip,
                  active && {
                    backgroundColor: CLASSES_ACCENT,
                    borderColor: CLASSES_ACCENT,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    active && { color: colors.background },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {snap.courses.length === 0 ? (
          <ClassesEmptyCard
            title={
              filter === 'all'
                ? 'No courses yet'
                : `No ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} courses`
            }
            body="Track Coursera, Udemy, YouTube series — anywhere you are learning."
            actionLabel="Add a course"
            onAction={() => router.push('/(classes)/lifelong/course/add')}
          />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {snap.courses.map((c) => (
              <Pressable
                key={c.id}
                onPress={() =>
                  router.push(`/(classes)/lifelong/course/${c.id}`)
                }
              >
                <CourseListCard course={c} />
              </Pressable>
            ))}
          </View>
        )}
      </ClassesScreen>

      <Pressable
        style={[styles.fab, { backgroundColor: CLASSES_ACCENT }]}
        onPress={() => router.push('/(classes)/lifelong/course/add')}
      >
        <Text style={[styles.fabLabel, { color: colors.background }]}>
          + Course
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    gap: 8,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.4,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
