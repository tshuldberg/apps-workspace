import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  formatClassesReminderSummary,
  getClassesSettings,
  listAssignmentsByClass,
  listClassesBySemester,
  listSemesters,
  type AssignmentRow,
  type AssignmentStatus,
  type ClassRow,
} from '@mylife/classes';
import { borderRadius, colors, spacing, Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  CLASSES_ACCENT,
  CLASSES_ACCENT_BORDER,
  CLASSES_ACCENT_DIM,
  ClassesEmptyCard,
  ClassesScreen,
  useClassesFocusedSnapshot,
} from './_ui';

interface AssignmentRowVM {
  assignment: AssignmentRow;
  cls: ClassRow | null;
  isOverdue: boolean;
}

interface AssignmentsSnapshot {
  rows: AssignmentRowVM[];
  classes: ClassRow[];
  reminderSummary: string;
}

const STATUS_FILTERS: Array<{ key: 'all' | AssignmentStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'graded', label: 'Graded' },
];

const PRIORITY_DOT: Record<string, string> = {
  low: colors.textTertiary,
  medium: colors.tertiary,
  high: colors.primary,
  critical: colors.danger,
};

function statusLabel(s: AssignmentStatus): string {
  switch (s) {
    case 'not_started':
      return 'Not started';
    case 'in_progress':
      return 'In progress';
    case 'submitted':
      return 'Submitted';
    case 'graded':
      return 'Graded';
  }
}

function relativeDue(due: string | null, isOverdue: boolean): string {
  if (!due) return 'No due date';
  const dueDate = new Date(due);
  const now = new Date();
  const ms = dueDate.getTime() - now.getTime();
  const days = Math.round(ms / 86400000);
  if (isOverdue) {
    const overdueDays = Math.abs(days);
    if (overdueDays === 0) return 'Overdue today';
    return `Overdue ${overdueDays}d`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days < 7) return `Due in ${days}d`;
  return dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDueAbsolute(due: string | null): string {
  if (!due) return '';
  const d = new Date(due);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ClassesAssignmentsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<'all' | AssignmentStatus>('all');
  const [classFilter, setClassFilter] = useState<string>('all');

  const load = useCallback((): AssignmentsSnapshot => {
    const semesters = listSemesters(db);
    const semester =
      semesters.find((s) => s.is_current === 1) ?? semesters[0] ?? null;
    const settings = getClassesSettings(db);
    const reminderSummary = formatClassesReminderSummary(
      settings.assignmentReminderOffsets,
    );

    if (!semester) {
      return { rows: [], classes: [], reminderSummary };
    }

    const classes = listClassesBySemester(db, semester.id);
    const classMap = new Map(classes.map((c) => [c.id, c]));
    const all: AssignmentRow[] = [];
    for (const c of classes) {
      all.push(...listAssignmentsByClass(db, c.id));
    }
    all.sort((a, b) => {
      if (a.due_at === null && b.due_at === null) return 0;
      if (a.due_at === null) return 1;
      if (b.due_at === null) return -1;
      return a.due_at.localeCompare(b.due_at);
    });
    const now = Date.now();
    const rows: AssignmentRowVM[] = all.map((a) => ({
      assignment: a,
      cls: classMap.get(a.class_id) ?? null,
      isOverdue:
        a.due_at !== null &&
        new Date(a.due_at).getTime() < now &&
        (a.status === 'not_started' || a.status === 'in_progress'),
    }));
    return { rows, classes, reminderSummary };
  }, [db]);

  const snapshot = useClassesFocusedSnapshot(load);

  const filtered = useMemo(() => {
    return snapshot.rows.filter((r) => {
      if (statusFilter !== 'all' && r.assignment.status !== statusFilter) return false;
      if (classFilter !== 'all' && r.assignment.class_id !== classFilter) return false;
      return true;
    });
  }, [snapshot.rows, statusFilter, classFilter]);

  if (snapshot.classes.length === 0) {
    return (
      <ClassesScreen
        title="Assignments"
        subtitle="Add a class first to start tracking assignments and due dates."
      >
        <ClassesEmptyCard
          title="No classes yet"
          body="Assignments live inside a class. Add a class to your active semester first."
          actionLabel="Open schedule"
          onAction={() => router.push('/(classes)')}
        />
      </ClassesScreen>
    );
  }

  return (
    <ClassesScreen
      title="Assignments"
      subtitle={`Reminders use your global setting: ${snapshot.reminderSummary}`}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setStatusFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text
                style={[styles.chipLabel, active && styles.chipLabelActive]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <Pressable
          onPress={() => setClassFilter('all')}
          style={[styles.chip, classFilter === 'all' && styles.chipActive]}
        >
          <Text
            style={[
              styles.chipLabel,
              classFilter === 'all' && styles.chipLabelActive,
            ]}
          >
            All classes
          </Text>
        </Pressable>
        {snapshot.classes.map((c) => {
          const active = classFilter === c.id;
          const accent = c.color || CLASSES_ACCENT;
          return (
            <Pressable
              key={c.id}
              onPress={() => setClassFilter(c.id)}
              style={[
                styles.chip,
                active && {
                  backgroundColor: accent,
                  borderColor: accent,
                },
              ]}
            >
              <View style={[styles.classDot, { backgroundColor: accent }]} />
              <Text
                style={[
                  styles.chipLabel,
                  active && { color: colors.background },
                ]}
              >
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {filtered.length === 0 ? (
        <ClassesEmptyCard
          title="No assignments yet"
          body="No assignments yet. Add your first or import from a class syllabus."
          actionLabel="Add assignment"
          onAction={() => router.push('/(classes)/assignment/add')}
        />
      ) : (
        <View style={styles.list}>
          {filtered.map((row) => (
            <AssignmentListItem
              key={row.assignment.id}
              row={row}
              onPress={() =>
                router.push({
                  pathname: '/(classes)/assignment/[id]',
                  params: { id: row.assignment.id },
                })
              }
            />
          ))}
        </View>
      )}

      <View style={{ height: 80 }} />

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(classes)/assignment/add')}
        accessibilityLabel="Add assignment"
      >
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>
    </ClassesScreen>
  );
}

function AssignmentListItem({
  row,
  onPress,
}: {
  row: AssignmentRowVM;
  onPress: () => void;
}) {
  const accent = row.cls?.color || CLASSES_ACCENT;
  const priorityColor = PRIORITY_DOT[row.assignment.priority] ?? colors.textTertiary;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.itemCard,
        row.isOverdue && {
          borderColor: 'rgba(255,180,171,0.4)',
          backgroundColor: 'rgba(147,0,10,0.18)',
        },
      ]}
    >
      <View style={[styles.itemAccent, { backgroundColor: accent }]} />
      <View style={styles.itemBody}>
        <View style={styles.itemHeaderRow}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text style={styles.itemTitle} numberOfLines={2}>
            {row.assignment.title}
          </Text>
        </View>
        <View style={styles.itemMetaRow}>
          {row.cls ? (
            <View
              style={[
                styles.classChip,
                { borderColor: accent, backgroundColor: 'rgba(0,0,0,0.25)' },
              ]}
            >
              <Text style={[styles.classChipLabel, { color: accent }]}>
                {row.cls.code || row.cls.name}
              </Text>
            </View>
          ) : null}
          <Text
            style={[
              styles.dueText,
              row.isOverdue && { color: colors.danger, fontWeight: '700' },
            ]}
          >
            {relativeDue(row.assignment.due_at, row.isOverdue)}
          </Text>
          {row.assignment.due_at ? (
            <Text style={styles.dueAbs}>
              {' · '}
              {formatDueAbsolute(row.assignment.due_at)}
            </Text>
          ) : null}
        </View>
        <View style={styles.itemFooterRow}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeLabel}>
              {statusLabel(row.assignment.status)}
            </Text>
          </View>
          <Text style={styles.typeLabel}>{row.assignment.type}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    gap: spacing.xs,
    paddingVertical: 4,
    paddingRight: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: CLASSES_ACCENT,
    borderColor: CLASSES_ACCENT,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipLabelActive: {
    color: colors.background,
  },
  classDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  list: {
    gap: spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  itemAccent: {
    width: 4,
  },
  itemBody: {
    flex: 1,
    padding: spacing.sm,
    gap: 6,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  classChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  classChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  dueText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  dueAbs: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  itemFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
    backgroundColor: CLASSES_ACCENT_DIM,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
  },
  statusBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: CLASSES_ACCENT,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  typeLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: 'capitalize',
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CLASSES_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPlus: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.background,
    lineHeight: 30,
  },
});
