import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  computeApplicationProgress,
  getDeadlineUrgency,
  groupApplicationsByStatus,
  listApplications,
  listTasksByApplication,
  type ApplicationRow,
  type ApplicationStatus,
  type ApplicationTaskRow,
} from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
  ClassesEmptyCard,
  ClassesHero,
  ClassesMetricRow,
  ClassesScreen,
  useClassesFocusedSnapshot,
} from '../_ui';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  APPLICATION_TYPE_LABEL,
  Pill,
  ProgressBar,
  deadlineCountdown,
  urgencyColor,
  urgencyLabel,
} from './_ui';

interface AppCardData {
  application: ApplicationRow;
  tasks: ApplicationTaskRow[];
}

interface Snapshot {
  groups: Record<ApplicationStatus, AppCardData[]>;
  total: number;
  upcoming: number;
}

const ACTIVE_STATUSES: ApplicationStatus[] = [
  'considering',
  'in_progress',
  'submitted',
  'waitlisted',
  'deferred',
  'accepted',
  'rejected',
  'withdrawn',
];

export default function ApplicationsHubScreen() {
  const db = useDatabase();
  const router = useRouter();

  const load = useCallback((): Snapshot => {
    const apps = listApplications(db);
    const grouped = groupApplicationsByStatus(apps);
    const groups = {} as Record<ApplicationStatus, AppCardData[]>;
    for (const status of APPLICATION_STATUSES) {
      groups[status] = grouped[status].map((application) => ({
        application,
        tasks: listTasksByApplication(db, application.id),
      }));
    }
    const now = new Date();
    const upcoming = apps.filter((a) => {
      if (!a.deadline) return false;
      const u = getDeadlineUrgency(a, now);
      return u === 'critical' || u === 'soon';
    }).length;
    return { groups, total: apps.length, upcoming };
  }, [db]);

  const snap = useClassesFocusedSnapshot(load);

  if (snap.total === 0) {
    return (
      <ClassesScreen
        title="Applications"
        subtitle="Track every college, scholarship, fellowship, internship, or job application in one place."
      >
        <ClassesHero
          badge="Applications"
          title="Stay on top of every deadline"
          body="Group by status, surface critical deadlines, and never lose track of an essay, recommender, or transcript."
          actionLabel="Add application"
          onAction={() => router.push('/(classes)/applications/add')}
        />
        <ClassesEmptyCard
          title="No applications yet"
          body="Add the first one. We'll group them by status and bubble up what's due soon."
          actionLabel="Add an application"
          onAction={() => router.push('/(classes)/applications/add')}
        />
      </ClassesScreen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ClassesScreen
        title="Applications"
        subtitle="Grouped by status. Tap any card to drill in."
      >
        <ClassesMetricRow
          items={[
            { label: 'Total', value: String(snap.total) },
            { label: 'Due soon', value: String(snap.upcoming) },
            {
              label: 'In progress',
              value: String(snap.groups.in_progress.length),
            },
          ]}
        />

        {ACTIVE_STATUSES.filter((status) => snap.groups[status].length > 0).map(
          (status) => (
            <View key={status} style={{ gap: spacing.sm }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {APPLICATION_STATUS_LABEL[status]}
                </Text>
                <Text style={styles.sectionCount}>
                  {snap.groups[status].length}
                </Text>
              </View>
              <View style={{ gap: spacing.sm }}>
                {snap.groups[status].map(({ application, tasks }) => (
                  <Pressable
                    key={application.id}
                    onPress={() =>
                      router.push(`/(classes)/applications/${application.id}`)
                    }
                  >
                    <ApplicationCard
                      application={application}
                      tasks={tasks}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          ),
        )}
      </ClassesScreen>

      <Pressable
        style={[styles.fab, { backgroundColor: CLASSES_ACCENT }]}
        onPress={() => router.push('/(classes)/applications/add')}
      >
        <Text style={[styles.fabLabel, { color: colors.background }]}>
          + Application
        </Text>
      </Pressable>
    </View>
  );
}

function ApplicationCard({
  application,
  tasks,
}: {
  application: ApplicationRow;
  tasks: ApplicationTaskRow[];
}) {
  const progress = computeApplicationProgress(application, tasks);
  const urgency = getDeadlineUrgency(application);
  const urgencyClr = urgencyColor(urgency);
  const meta = [
    APPLICATION_TYPE_LABEL[application.type],
    application.institution,
    application.program,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.cardTitle}>{application.name}</Text>
          {meta ? (
            <Text variant="caption" color={colors.textSecondary}>
              {meta}
            </Text>
          ) : null}
        </View>
        {urgency !== 'none' ? (
          <Pill
            label={urgencyLabel(urgency)}
            color={urgencyClr}
            borderColor={urgencyClr}
          />
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <Text variant="caption" color={colors.textSecondary}>
          {deadlineCountdown(application.deadline)}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          {progress.percent_complete}% complete
        </Text>
      </View>

      <ProgressBar percent={progress.percent_complete} />
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
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: CLASSES_ACCENT,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: CLASSES_ACCENT_DIM,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
