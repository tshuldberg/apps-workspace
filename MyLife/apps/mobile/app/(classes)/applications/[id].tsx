import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  computeApplicationProgress,
  deleteApplication,
  deleteApplicationTask,
  getApplication,
  getDeadlineUrgency,
  getStandardizedTest,
  listTasksByApplication,
  markTaskComplete,
  type ApplicationRow,
  type ApplicationTaskRow,
  type StandardizedTestRow,
} from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
  useClassesFocusedSnapshot,
} from '../_ui';
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_TASK_KIND_LABEL,
  APPLICATION_TASK_STATUS_LABEL,
  APPLICATION_TYPE_LABEL,
  PercentRing,
  Pill,
  deadlineCountdown,
  formatDate,
  urgencyColor,
  urgencyLabel,
} from './_ui';

interface DetailSnapshot {
  application: ApplicationRow | null;
  tasks: ApplicationTaskRow[];
  requiredTests: StandardizedTestRow[];
}

export default function ApplicationDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const load = useCallback((): DetailSnapshot => {
    const application = id ? getApplication(db, id) : null;
    if (!application) {
      return { application: null, tasks: [], requiredTests: [] };
    }
    const tasks = listTasksByApplication(db, application.id);
    let requiredTests: StandardizedTestRow[] = [];
    if (application.required_test_score_ids) {
      try {
        const ids = JSON.parse(application.required_test_score_ids) as string[];
        requiredTests = ids
          .map((tid) => getStandardizedTest(db, tid))
          .filter((t): t is StandardizedTestRow => Boolean(t));
      } catch {
        requiredTests = [];
      }
    }
    return { application, tasks, requiredTests };
  }, [db, id]);

  const snap = useClassesFocusedSnapshot(load);
  const app = snap.application;

  const onDelete = useCallback(() => {
    if (!app) return;
    Alert.alert('Delete application?', `This will remove "${app.name}" and its tasks.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteApplication(db, app.id);
          router.replace('/(classes)/applications');
        },
      },
    ]);
  }, [db, app, router]);

  const onToggleTask = useCallback(
    (task: ApplicationTaskRow) => {
      if (!app) return;
      if (task.status === 'done') {
        deleteApplicationTask(db, task.id);
      } else {
        markTaskComplete(db, task.id);
      }
      router.setParams({ id: app.id });
    },
    [db, app, router],
  );

  if (!app) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Application not found.</Text>
      </View>
    );
  }

  const urgency = getDeadlineUrgency(app);
  const progress = computeApplicationProgress(app, snap.tasks);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.title}>{app.name}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {[APPLICATION_TYPE_LABEL[app.type], app.institution, app.program]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <View style={{ marginTop: spacing.xs, flexDirection: 'row', gap: spacing.xs }}>
            <Pill label={APPLICATION_STATUS_LABEL[app.status]} />
            {urgency !== 'none' ? (
              <Pill
                label={urgencyLabel(urgency)}
                color={urgencyColor(urgency)}
                borderColor={urgencyColor(urgency)}
              />
            ) : null}
          </View>
        </View>
        <PercentRing percent={progress.percent_complete} />
      </View>

      <View style={styles.metaCard}>
        <Row label="Deadline" value={formatDate(app.deadline)} />
        <Row label="Countdown" value={deadlineCountdown(app.deadline)} />
        {app.early_deadline ? (
          <Row label="Early deadline" value={formatDate(app.early_deadline)} />
        ) : null}
        {app.decision_date ? (
          <Row label="Decision" value={formatDate(app.decision_date)} />
        ) : null}
      </View>

      <View style={styles.metaCard}>
        <Text style={styles.sectionTitle}>Counters</Text>
        <Row
          label="Essays"
          value={`${app.essays_finalized} finalized · ${app.essays_drafted} drafted / ${app.required_essays_count}`}
        />
        <Row
          label="Recommenders"
          value={`${app.recommenders_confirmed} / ${app.recommenders_required}`}
        />
        <Row
          label="Transcripts"
          value={`Requested ${app.transcripts_requested ? 'yes' : 'no'} · Sent ${app.transcripts_sent ? 'yes' : 'no'}`}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tasks</Text>
          <Text style={styles.sectionCount}>{snap.tasks.length}</Text>
        </View>
        {snap.tasks.length === 0 ? (
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No tasks yet.</Text>
        ) : (
          snap.tasks.map((t) => (
            <Pressable key={t.id} onPress={() => onToggleTask(t)} style={styles.taskRow}>
              <View
                style={[
                  styles.checkbox,
                  t.status === 'done' && {
                    backgroundColor: CLASSES_ACCENT,
                    borderColor: CLASSES_ACCENT,
                  },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.taskTitle,
                    t.status === 'done' && {
                      color: colors.textSecondary,
                      textDecorationLine: 'line-through',
                    },
                  ]}
                >
                  {t.title}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {APPLICATION_TASK_KIND_LABEL[t.kind]} ·{' '}
                  {APPLICATION_TASK_STATUS_LABEL[t.status]}
                  {t.due_at ? ` · due ${formatDate(t.due_at)}` : ''}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </View>

      {snap.requiredTests.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required tests</Text>
          {snap.requiredTests.map((t) => (
            <View key={t.id} style={styles.taskRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.taskTitle}>{t.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {t.score != null
                    ? `Score ${t.score}${t.max_score ? ` / ${t.max_score}` : ''}`
                    : 'No score yet'}
                  {t.test_date ? ` · ${formatDate(t.test_date)}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <Pressable
          style={[styles.action, { backgroundColor: CLASSES_ACCENT }]}
          onPress={() => router.push(`/(classes)/applications/edit/${app.id}`)}
        >
          <Text style={[styles.actionLabel, { color: colors.background }]}>Edit</Text>
        </Pressable>
        <Pressable
          style={[styles.action, { borderColor: colors.danger, borderWidth: 1 }]}
          onPress={onDelete}
        >
          <Text style={[styles.actionLabel, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
        {label}
      </Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  metaCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: CLASSES_ACCENT_DIM,
    padding: spacing.md,
    gap: spacing.xs,
  },
  section: { gap: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: CLASSES_ACCENT_DIM,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: CLASSES_ACCENT_BORDER,
  },
  taskTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  action: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
