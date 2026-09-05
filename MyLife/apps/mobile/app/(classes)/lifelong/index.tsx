import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  getCourseStats,
  getGoalProgress,
  listCertifications,
  listExpiring,
  listLearningGoals,
  listOnlineCourses,
  type CertificationRow,
  type LearningGoalProgress,
  type LearningGoalRow,
  type OnlineCourseRow,
  type OnlineCourseStats,
} from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  ClassesEmptyCard,
  ClassesHero,
  ClassesMetricRow,
  ClassesScreen,
  ClassesSection,
  useClassesFocusedSnapshot,
} from '../_ui';
import {
  CertListCard,
  CourseListCard,
  ProgressBar,
  formatDate,
} from './_ui';

const EXPIRING_WINDOW_DAYS = 90;

interface HubSnapshot {
  active_courses: OnlineCourseRow[];
  expiring_certs: CertificationRow[];
  active_goals: Array<{ goal: LearningGoalRow; progress: LearningGoalProgress }>;
  course_stats: OnlineCourseStats;
  cert_total: number;
  goal_total: number;
}

export default function LifelongHubScreen() {
  const db = useDatabase();
  const router = useRouter();

  const load = useCallback((): HubSnapshot => {
    const inProgress = listOnlineCourses(db, { status: 'in_progress' });
    const expiringCerts = listExpiring(db, EXPIRING_WINDOW_DAYS);
    const allGoals = listLearningGoals(db);
    const activeGoals = allGoals
      .filter((g) => g.status === 'active')
      .slice(0, 3)
      .map((goal) => ({ goal, progress: getGoalProgress(db, goal.id) }));

    return {
      active_courses: inProgress.slice(0, 3),
      expiring_certs: expiringCerts.slice(0, 5),
      active_goals: activeGoals,
      course_stats: getCourseStats(db),
      cert_total: listCertifications(db).length,
      goal_total: allGoals.length,
    };
  }, [db]);

  const snap = useClassesFocusedSnapshot(load);
  const isEmpty =
    snap.course_stats.total === 0 &&
    snap.cert_total === 0 &&
    snap.goal_total === 0;

  if (isEmpty) {
    return (
      <ClassesScreen
        title="Lifelong"
        subtitle="Self-directed courses, professional certifications, and the goals that connect them."
      >
        <ClassesHero
          badge="Lifelong"
          title="Build a learning life that compounds"
          body="Track Coursera, Udemy, YouTube series, professional certifications, and the long-arc goals that tie them together."
        />
        <ClassesSection title="Get started">
          <ClassesEmptyCard
            title="No courses yet"
            body="Track Coursera, Udemy, YouTube series — anywhere you are learning."
            actionLabel="Add a course"
            onAction={() => router.push('/(classes)/lifelong/course/add')}
          />
          <ClassesEmptyCard
            title="No certifications yet"
            body="Log professional credentials so renewals and expirations never sneak up."
            actionLabel="Add a credential"
            onAction={() => router.push('/(classes)/lifelong/cert/add')}
          />
          <ClassesEmptyCard
            title="No goals yet"
            body="Frame the why. Tie courses and certs to the version of you they unlock."
            actionLabel="Set a goal"
            onAction={() => router.push('/(classes)/lifelong/goal/add')}
          />
        </ClassesSection>
      </ClassesScreen>
    );
  }

  return (
    <ClassesScreen
      title="Lifelong"
      subtitle="Self-directed courses, professional certifications, and the goals that connect them."
    >
      <ClassesMetricRow
        items={[
          {
            label: 'In progress',
            value: String(snap.course_stats.in_progress),
          },
          {
            label: 'Hours',
            value: snap.course_stats.total_hours_spent.toFixed(1),
          },
          { label: 'Certifications', value: String(snap.cert_total) },
        ]}
      />

      <SectionHeader
        title="Active courses"
        ctaLabel="See all"
        onCtaPress={() => router.push('/(classes)/lifelong/courses')}
      />
      {snap.active_courses.length === 0 ? (
        <ClassesEmptyCard
          title="No courses in progress"
          body="Start one to see it here. Anything self-directed counts."
          actionLabel="Browse courses"
          onAction={() => router.push('/(classes)/lifelong/courses')}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {snap.active_courses.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/(classes)/lifelong/course/${c.id}`)}
            >
              <CourseListCard course={c} />
            </Pressable>
          ))}
        </View>
      )}

      <SectionHeader
        title="Expiring soon"
        ctaLabel="See all"
        onCtaPress={() => router.push('/(classes)/lifelong/certifications')}
      />
      {snap.expiring_certs.length === 0 ? (
        <ClassesEmptyCard
          title="Nothing expiring in the next 90 days"
          body="Renewal pressure stays low. We'll surface anything within 90 days here."
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {snap.expiring_certs.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/(classes)/lifelong/cert/${c.id}`)}
            >
              <CertListCard cert={c} />
            </Pressable>
          ))}
        </View>
      )}

      <SectionHeader
        title="Active goals"
        ctaLabel="See all"
        onCtaPress={() => router.push('/(classes)/lifelong/goals')}
      />
      {snap.active_goals.length === 0 ? (
        <ClassesEmptyCard
          title="No active goals"
          body="Goals turn scattered learning into a story arc. Add one with linked courses or certs."
          actionLabel="Set a goal"
          onAction={() => router.push('/(classes)/lifelong/goal/add')}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {snap.active_goals.map(({ goal, progress }) => (
            <Pressable
              key={goal.id}
              onPress={() => router.push(`/(classes)/lifelong/goal/${goal.id}`)}
              style={styles.goalRow}
            >
              <View style={styles.goalRowTop}>
                <Text style={styles.goalTitle}>{goal.title}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {goal.target_date
                    ? `Target ${formatDate(goal.target_date)}`
                    : 'No target date'}
                </Text>
              </View>
              <ProgressBar percent={progress.percent} />
              <Text variant="caption" color={colors.textSecondary}>
                {progress.completed_items} of {progress.total_items} items
                complete
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ClassesScreen>
  );
}

function SectionHeader({
  title,
  ctaLabel,
  onCtaPress,
}: {
  title: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {ctaLabel && onCtaPress ? (
        <Pressable onPress={onCtaPress}>
          <Text style={[styles.cta, { color: CLASSES_ACCENT }]}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  cta: {
    fontSize: 12,
    fontWeight: '700',
  },
  goalRow: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: 'rgba(59,130,246,0.08)',
    padding: spacing.md,
    gap: spacing.xs,
  },
  goalRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  goalTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
    flex: 1,
  },
});
