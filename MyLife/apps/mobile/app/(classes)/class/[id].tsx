import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  CLASSES_PALETTE,
  classToICS,
  classesToICS,
  commuteBuffer,
  deleteClass,
  detectClassConflicts,
  getClass,
  getSemester,
  getTeacher,
  listClassesBySemester,
  pickClassColor,
  withAlpha,
  type CategoryWeights,
  type ClassRow,
  type DayTime,
  type SemesterRow,
  type TeacherRow,
} from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import { useClassesFocusedSnapshot } from '../_ui';

const ACCENT = colors.modules.classes;

const DAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

interface DetailSnapshot {
  cls: ClassRow | null;
  semester: SemesterRow | null;
  teacher: TeacherRow | null;
  conflicts: number;
  commuteWarnings: number;
  blocks: DayTime[];
  weights: CategoryWeights | null;
  colorHex: string;
  semesterClasses: ClassRow[];
}

function parseBlocks(raw: string | null): DayTime[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DayTime[]) : [];
  } catch {
    return [];
  }
}

function parseWeights(raw: string | null): CategoryWeights | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as CategoryWeights) : null;
  } catch {
    return null;
  }
}

function formatTimeRange(b: DayTime): string {
  return `${b.start_time}–${b.end_time}`;
}

function formatLocation(cls: ClassRow): string {
  const parts: string[] = [];
  if (cls.room) parts.push(cls.room);
  if (cls.building) parts.push(cls.building);
  return parts.length > 0 ? parts.join(', ') : 'Location TBD';
}

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [exporting, setExporting] = useState(false);

  const snapshot = useClassesFocusedSnapshot<DetailSnapshot>(
    useCallback(() => {
      if (!id) {
        return {
          cls: null,
          semester: null,
          teacher: null,
          conflicts: 0,
          commuteWarnings: 0,
          blocks: [],
          weights: null,
          colorHex: CLASSES_PALETTE[0],
          semesterClasses: [],
        };
      }
      const cls = getClass(db, id);
      if (!cls) {
        return {
          cls: null,
          semester: null,
          teacher: null,
          conflicts: 0,
          commuteWarnings: 0,
          blocks: [],
          weights: null,
          colorHex: CLASSES_PALETTE[0],
          semesterClasses: [],
        };
      }
      const semester = getSemester(db, cls.semester_id);
      const teacher = cls.teacher_id ? getTeacher(db, cls.teacher_id) : null;
      const semesterClasses = listClassesBySemester(db, cls.semester_id);
      const conflictRows = detectClassConflicts(db, cls.semester_id).filter(
        (c) => c.a.id === cls.id || c.b.id === cls.id,
      );
      const commute = commuteBuffer(semesterClasses, { travelMinutes: 15 }).filter(
        (g) => (g.from_class_id === cls.id || g.to_class_id === cls.id) && g.tight,
      );
      return {
        cls,
        semester,
        teacher,
        conflicts: conflictRows.length,
        commuteWarnings: commute.length,
        blocks: parseBlocks(cls.day_times),
        weights: parseWeights(cls.category_weights),
        colorHex: cls.color || pickClassColor(cls.id),
        semesterClasses,
      };
    }, [db, id]),
  );

  const weightEntries = useMemo<Array<[string, number]>>(
    () =>
      snapshot.weights
        ? Object.entries(snapshot.weights).sort((a, b) => b[1] - a[1])
        : [],
    [snapshot.weights],
  );
  const weightTotal = useMemo(
    () => weightEntries.reduce((acc, [, v]) => acc + v, 0),
    [weightEntries],
  );

  const handleDelete = useCallback(() => {
    if (!snapshot.cls) return;
    Alert.alert(
      'Delete class',
      `Remove ${snapshot.cls.name}? This will not delete the semester or teacher.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteClass(db, snapshot.cls!.id);
            router.back();
          },
        },
      ],
    );
  }, [db, router, snapshot.cls]);

  const handleExport = useCallback(async () => {
    if (!snapshot.cls || !snapshot.semester) {
      Alert.alert('Cannot export', 'Class needs a semester with a start date.');
      return;
    }
    setExporting(true);
    try {
      const ics = classToICS(snapshot.cls, snapshot.semester);
      const fileUri = `${FileSystem.cacheDirectory ?? ''}${snapshot.cls.id}.ics`;
      await FileSystem.writeAsStringAsync(fileUri, ics, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/calendar',
          dialogTitle: `Add ${snapshot.cls.name} to Calendar`,
          UTI: 'com.apple.ical.ics',
        });
      } else {
        Alert.alert('Calendar export ready', `Saved to ${fileUri}`);
      }
    } catch (err) {
      Alert.alert('Export failed', String(err));
    } finally {
      setExporting(false);
    }
  }, [snapshot.cls, snapshot.semester]);

  const handleExportSemester = useCallback(async () => {
    if (!snapshot.semester) return;
    try {
      const ics = classesToICS(snapshot.semesterClasses, snapshot.semester);
      const fileUri = `${FileSystem.cacheDirectory ?? ''}semester-${snapshot.semester.id}.ics`;
      await FileSystem.writeAsStringAsync(fileUri, ics, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/calendar',
          dialogTitle: `Add ${snapshot.semester.name} to Calendar`,
          UTI: 'com.apple.ical.ics',
        });
      }
    } catch (err) {
      Alert.alert('Export failed', String(err));
    }
  }, [snapshot.semester, snapshot.semesterClasses]);

  if (!id) {
    return (
      <View style={styles.errorScreen}>
        <Text>Missing class id.</Text>
      </View>
    );
  }

  if (!snapshot.cls) {
    return (
      <View style={styles.errorScreen}>
        <Text variant="heading" style={styles.errorTitle}>
          Class not found
        </Text>
        <Text variant="body" color={colors.textSecondary} style={styles.errorBody}>
          The class may have been deleted. Return to the schedule.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnLabel}>Back to schedule</Text>
        </Pressable>
      </View>
    );
  }

  const cls = snapshot.cls;
  const accent = snapshot.colorHex;

  return (
    <>
      <Stack.Screen
        options={{
          title: cls.name,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
      >
        <View style={[styles.colorBar, { backgroundColor: accent }]} />

        <View style={styles.heroSection}>
          {cls.code ? (
            <Text style={[styles.eyebrow, { color: accent }]}>
              {cls.code}
              {cls.section ? ` · §${cls.section}` : ''}
            </Text>
          ) : null}
          <Text style={styles.title}>{cls.name}</Text>
          <View style={styles.metaPills}>
            <View style={[styles.metaPill, { borderColor: withAlpha(accent, 0.4) }]}>
              <Text style={[styles.metaPillText, { color: accent }]}>
                {cls.credits} credit{cls.credits === 1 ? '' : 's'}
              </Text>
            </View>
            {snapshot.semester ? (
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{snapshot.semester.name}</Text>
              </View>
            ) : null}
          </View>
          {(snapshot.conflicts > 0 || snapshot.commuteWarnings > 0) && (
            <View style={styles.warningRow}>
              {snapshot.conflicts > 0 ? (
                <View style={styles.warningChip}>
                  <Text style={styles.warningChipText}>
                    {snapshot.conflicts} schedule conflict
                    {snapshot.conflicts === 1 ? '' : 's'}
                  </Text>
                </View>
              ) : null}
              {snapshot.commuteWarnings > 0 ? (
                <View style={styles.commuteChip}>
                  <Text style={styles.commuteChipText}>
                    {snapshot.commuteWarnings} tight commute
                    {snapshot.commuteWarnings === 1 ? '' : 's'}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <Section title="Schedule">
          <Card style={styles.card}>
            {snapshot.blocks.length === 0 ? (
              <Text variant="body" color={colors.textSecondary}>
                No weekly meetings configured. Add a time block in Edit.
              </Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {snapshot.blocks.map((b, idx) => (
                  <View key={`${b.day}-${idx}`} style={styles.scheduleRow}>
                    <View
                      style={[styles.dayBadge, { backgroundColor: withAlpha(accent, 0.18) }]}
                    >
                      <Text style={[styles.dayBadgeText, { color: accent }]}>
                        {DAY_LABELS[b.day] ?? b.day.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="body">{formatTimeRange(b)}</Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {formatLocation(cls)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </Section>

        <Section title="Teacher">
          {snapshot.teacher ? (
            <Pressable
              onPress={() =>
                router.push(`/(classes)/teacher/${snapshot.teacher!.id}` as never)
              }
            >
              <Card style={styles.card}>
                <Text variant="body" style={styles.teacherName}>
                  {snapshot.teacher.name}
                </Text>
                {snapshot.teacher.title || snapshot.teacher.department ? (
                  <Text variant="caption" color={colors.textSecondary}>
                    {[snapshot.teacher.title, snapshot.teacher.department]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
                {snapshot.teacher.email ? (
                  <Text variant="caption" style={[styles.teacherLink, { color: accent }]}>
                    {snapshot.teacher.email}
                  </Text>
                ) : null}
                <Text style={[styles.cardChevron, { color: accent }]}>
                  View profile →
                </Text>
              </Card>
            </Pressable>
          ) : (
            <Card style={styles.card}>
              <Text variant="body" color={colors.textSecondary}>
                No teacher attached. Edit this class to assign one.
              </Text>
              <Pressable
                style={[styles.linkBtn, { marginTop: spacing.sm }]}
                onPress={() => router.push('/(classes)/teacher/add' as never)}
              >
                <Text style={[styles.linkBtnLabel, { color: accent }]}>
                  + Add a teacher
                </Text>
              </Pressable>
            </Card>
          )}
        </Section>

        <Section title="Grading breakdown">
          <Card style={styles.card}>
            {weightEntries.length === 0 ? (
              <Text variant="body" color={colors.textSecondary}>
                No category weights set. Edit to add categories like Homework, Exams,
                Final.
              </Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {weightEntries.map(([category, value]) => {
                  const pct = weightTotal > 0 ? (value / weightTotal) * 100 : 0;
                  return (
                    <View key={category} style={styles.weightRow}>
                      <View style={styles.weightLabelRow}>
                        <Text variant="body">{category}</Text>
                        <Text variant="body" style={styles.weightValue}>
                          {value}%
                        </Text>
                      </View>
                      <View style={styles.weightTrack}>
                        <View
                          style={[
                            styles.weightFill,
                            { width: `${pct}%`, backgroundColor: accent },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
                {Math.abs(weightTotal - 100) > 0.5 ? (
                  <Text variant="caption" color={colors.textSecondary}>
                    Categories sum to {weightTotal}% (expected 100%).
                  </Text>
                ) : null}
              </View>
            )}
          </Card>
        </Section>

        {cls.notes_md ? (
          <Section title="Syllabus notes">
            <Card style={styles.card}>
              <Text variant="body" style={styles.notesBody}>
                {cls.notes_md}
              </Text>
            </Card>
          </Section>
        ) : null}

        <Section title="Assignments">
          <Card style={styles.card}>
            <View style={styles.assignmentSummary}>
              <View style={styles.assignmentStat}>
                <Text variant="caption" color={colors.textSecondary}>
                  Upcoming
                </Text>
                <Text style={styles.assignmentValue}>—</Text>
              </View>
              <View style={styles.assignmentStat}>
                <Text variant="caption" color={colors.textSecondary}>
                  In progress
                </Text>
                <Text style={styles.assignmentValue}>—</Text>
              </View>
              <View style={styles.assignmentStat}>
                <Text variant="caption" color={colors.textSecondary}>
                  Graded
                </Text>
                <Text style={styles.assignmentValue}>—</Text>
              </View>
            </View>
            <Pressable
              style={styles.linkBtn}
              onPress={() => router.push('/(classes)/assignments' as never)}
            >
              <Text style={[styles.linkBtnLabel, { color: accent }]}>
                Open assignment queue →
              </Text>
            </Pressable>
            <Text variant="caption" color={colors.textSecondary} style={styles.placeholderHint}>
              Per-class assignment counts arrive with the assignment tracker.
            </Text>
          </Card>
        </Section>

        <Section title="Actions">
          <View style={styles.actionGrid}>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: accent }]}
              onPress={() =>
                router.push(`/(classes)/class/edit/${cls.id}` as never)
              }
            >
              <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
                Edit class
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={handleExport}
              disabled={exporting}
            >
              <Text style={styles.secondaryBtnLabel}>
                {exporting ? 'Preparing…' : 'Export to Calendar'}
              </Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={handleExportSemester}>
              <Text style={styles.secondaryBtnLabel}>Export semester</Text>
            </Pressable>
            <Pressable style={styles.dangerBtn} onPress={handleDelete}>
              <Text style={styles.dangerBtnLabel}>Delete class</Text>
            </Pressable>
          </View>
        </Section>
      </ScrollView>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  errorScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorTitle: { textAlign: 'center' },
  errorBody: { textAlign: 'center' },
  colorBar: { height: 6, width: '100%' },
  heroSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.text,
  },
  metaPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  metaPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  warningRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  warningChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,180,171,0.16)',
  },
  warningChipText: { fontSize: 12, fontWeight: '700', color: '#FFB4AB' },
  commuteChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,184,119,0.16)',
  },
  commuteChipText: { fontSize: 12, fontWeight: '700', color: '#FFB877' },
  section: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  card: { gap: spacing.xs },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    minWidth: 52,
    alignItems: 'center',
  },
  dayBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  teacherName: { fontWeight: '700' },
  teacherLink: { marginTop: 4 },
  cardChevron: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '700',
  },
  weightRow: { gap: 6 },
  weightLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  weightValue: { fontWeight: '700' },
  weightTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  weightFill: { height: '100%', borderRadius: 4 },
  notesBody: { lineHeight: 22 },
  assignmentSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
  },
  assignmentStat: { alignItems: 'center', gap: 4 },
  assignmentValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  placeholderHint: { fontStyle: 'italic', marginTop: spacing.xs },
  linkBtn: { paddingVertical: spacing.xs },
  linkBtnLabel: { fontSize: 14, fontWeight: '700' },
  actionGrid: { gap: spacing.sm },
  primaryBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryBtnLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: colors.background,
  },
  secondaryBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryBtnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  dangerBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,180,171,0.4)',
    backgroundColor: 'rgba(255,180,171,0.08)',
  },
  dangerBtnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFB4AB',
  },
});
