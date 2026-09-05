import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  LearningGoalUpdateSchema,
  deleteLearningGoal,
  getCertification,
  getGoalProgress,
  getLearningGoal,
  getOnlineCourse,
  listCertifications,
  listOnlineCourses,
  updateLearningGoal,
  type CertificationRow,
  type LearningGoalProgress,
  type LearningGoalRow,
  type LearningGoalStatus,
  type OnlineCourseRow,
} from '@mylife/classes';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { CLASSES_ACCENT } from '../../_ui';
import { GOAL_STATUS_LABEL, ProgressBar, formatDate } from '../_ui';

const STATUSES: LearningGoalStatus[] = [
  'active',
  'completed',
  'paused',
  'abandoned',
];

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [goal, setGoal] = useState<LearningGoalRow | null>(() =>
    id ? getLearningGoal(db, id) : null,
  );
  const [progress, setProgress] = useState<LearningGoalProgress | null>(() =>
    id ? getGoalProgress(db, id) : null,
  );
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description_md ?? '');
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '');
  const [status, setStatus] = useState<LearningGoalStatus>(
    goal?.status ?? 'active',
  );
  const [courseIds, setCourseIds] = useState<string[]>(
    parseIds(goal?.course_ids ?? null),
  );
  const [certIds, setCertIds] = useState<string[]>(
    parseIds(goal?.certification_ids ?? null),
  );

  const allCourses = useMemo(() => listOnlineCourses(db), [db]);
  const allCerts = useMemo(() => listCertifications(db), [db]);

  useEffect(() => {
    if (id) {
      const g = getLearningGoal(db, id);
      setGoal(g);
      setProgress(getGoalProgress(db, id));
      if (g) {
        setTitle(g.title);
        setDescription(g.description_md ?? '');
        setTargetDate(g.target_date ?? '');
        setStatus(g.status);
        setCourseIds(parseIds(g.course_ids));
        setCertIds(parseIds(g.certification_ids));
      }
    }
  }, [db, id]);

  const linkedCourses = useMemo(() => {
    if (!goal) return [] as OnlineCourseRow[];
    return parseIds(goal.course_ids)
      .map((cid) => getOnlineCourse(db, cid))
      .filter((c): c is OnlineCourseRow => c !== null);
  }, [db, goal]);

  const linkedCerts = useMemo(() => {
    if (!goal) return [] as CertificationRow[];
    return parseIds(goal.certification_ids)
      .map((cid) => getCertification(db, cid))
      .filter((c): c is CertificationRow => c !== null);
  }, [db, goal]);

  const toggleCourse = (cid: string) =>
    setCourseIds((arr) =>
      arr.includes(cid) ? arr.filter((x) => x !== cid) : [...arr, cid],
    );
  const toggleCert = (cid: string) =>
    setCertIds((arr) =>
      arr.includes(cid) ? arr.filter((x) => x !== cid) : [...arr, cid],
    );

  const handleSave = useCallback(() => {
    if (!goal) return;
    const parsed = LearningGoalUpdateSchema.safeParse({
      title: title.trim() || goal.title,
      description_md: description.trim() || null,
      target_date: targetDate.trim() || null,
      status,
      course_ids: courseIds.length > 0 ? courseIds : null,
      certification_ids: certIds.length > 0 ? certIds : null,
    });
    if (!parsed.success) {
      Alert.alert(
        'Invalid input',
        parsed.error.issues[0]?.message ?? 'Check fields.',
      );
      return;
    }
    try {
      updateLearningGoal(db, goal.id, parsed.data);
      const fresh = getLearningGoal(db, goal.id);
      setGoal(fresh);
      setProgress(getGoalProgress(db, goal.id));
      setEditing(false);
    } catch (err) {
      Alert.alert('Save failed', String(err));
    }
  }, [goal, db, title, description, targetDate, status, courseIds, certIds]);

  const handleDelete = useCallback(() => {
    if (!goal) return;
    Alert.alert('Delete goal?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteLearningGoal(db, goal.id);
            router.back();
          } catch (err) {
            Alert.alert('Delete failed', String(err));
          }
        },
      },
    ]);
  }, [goal, db, router]);

  if (!goal) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={{ title: 'Goal' }} />
        <Text variant="body" color={colors.textSecondary}>
          Goal not found.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: goal.title }} />

      {editing ? (
        <>
          <Section title="Edit goal">
            <Card style={styles.card}>
              <Field label="Title">
                <TextInput value={title} onChangeText={setTitle} style={styles.input} />
              </Field>
              <Field label="Description">
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  style={[styles.input, styles.notesInput]}
                />
              </Field>
              <Field label="Target date">
                <TextInput
                  value={targetDate}
                  onChangeText={setTargetDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  style={styles.input}
                />
              </Field>
              <Field label="Status">
                <View style={styles.chipRow}>
                  {STATUSES.map((s) => {
                    const active = status === s;
                    return (
                      <Pressable
                        key={s}
                        onPress={() => setStatus(s)}
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
                          {GOAL_STATUS_LABEL[s] ?? s}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
            </Card>
          </Section>

          <Section title="Link courses">
            <Card style={styles.card}>
              {allCourses.length === 0 ? (
                <Text variant="caption" color={colors.textSecondary}>
                  No courses to link.
                </Text>
              ) : (
                allCourses.map((c) => {
                  const checked = courseIds.includes(c.id);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => toggleCourse(c.id)}
                      style={styles.checkRow}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          checked && {
                            backgroundColor: CLASSES_ACCENT,
                            borderColor: CLASSES_ACCENT,
                          },
                        ]}
                      >
                        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
                      </View>
                      <Text style={styles.checkLabel}>{c.title}</Text>
                    </Pressable>
                  );
                })
              )}
            </Card>
          </Section>

          <Section title="Link certifications">
            <Card style={styles.card}>
              {allCerts.length === 0 ? (
                <Text variant="caption" color={colors.textSecondary}>
                  No certifications to link.
                </Text>
              ) : (
                allCerts.map((c) => {
                  const checked = certIds.includes(c.id);
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => toggleCert(c.id)}
                      style={styles.checkRow}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          checked && {
                            backgroundColor: CLASSES_ACCENT,
                            borderColor: CLASSES_ACCENT,
                          },
                        ]}
                      >
                        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
                      </View>
                      <Text style={styles.checkLabel}>{c.name}</Text>
                    </Pressable>
                  );
                })
              )}
            </Card>
          </Section>

          <View style={styles.actions}>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: CLASSES_ACCENT }]}
              onPress={handleSave}
            >
              <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
                Save changes
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => setEditing(false)}
            >
              <Text style={styles.secondaryBtnLabel}>Cancel</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Section title="Goal">
            <Card style={styles.card}>
              <Text style={styles.title}>{goal.title}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {goal.target_date
                  ? `Target ${formatDate(goal.target_date)} · ${GOAL_STATUS_LABEL[goal.status] ?? goal.status}`
                  : `${GOAL_STATUS_LABEL[goal.status] ?? goal.status}`}
              </Text>
              {progress ? (
                <>
                  <ProgressBar percent={progress.percent} />
                  <Text variant="caption" color={colors.textSecondary}>
                    {progress.completed_items} of {progress.total_items} items
                    complete · {progress.percent.toFixed(0)}%
                  </Text>
                </>
              ) : null}
              {goal.description_md ? (
                <Text variant="body" color={colors.text}>
                  {goal.description_md}
                </Text>
              ) : null}
            </Card>
          </Section>

          <Section title="Linked courses">
            <Card style={styles.card}>
              {linkedCourses.length === 0 ? (
                <Text variant="caption" color={colors.textSecondary}>
                  No courses linked yet.
                </Text>
              ) : (
                linkedCourses.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() =>
                      router.push(`/(classes)/lifelong/course/${c.id}`)
                    }
                    style={styles.linkRow}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.linkTitle}>{c.title}</Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {c.status === 'completed' ? 'Completed' : `${c.progress_percent.toFixed(0)}%`}
                      </Text>
                    </View>
                    <Text style={styles.linkChevron}>›</Text>
                  </Pressable>
                ))
              )}
            </Card>
          </Section>

          <Section title="Linked certifications">
            <Card style={styles.card}>
              {linkedCerts.length === 0 ? (
                <Text variant="caption" color={colors.textSecondary}>
                  No certifications linked yet.
                </Text>
              ) : (
                linkedCerts.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() =>
                      router.push(`/(classes)/lifelong/cert/${c.id}`)
                    }
                    style={styles.linkRow}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.linkTitle}>{c.name}</Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        {c.issued_at ? `Issued ${formatDate(c.issued_at)}` : 'Not yet issued'}
                      </Text>
                    </View>
                    <Text style={styles.linkChevron}>›</Text>
                  </Pressable>
                ))
              )}
            </Card>
          </Section>

          <View style={styles.actions}>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: CLASSES_ACCENT }]}
              onPress={() => setEditing(true)}
            >
              <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
                Edit goal
              </Text>
            </Pressable>
            <Pressable style={styles.dangerBtn} onPress={handleDelete}>
              <Text style={styles.dangerBtnLabel}>Delete</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
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

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text variant="caption" color={colors.textSecondary} style={styles.fieldLabel}>
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  center: { justifyContent: 'center', alignItems: 'center' },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  card: { gap: spacing.sm },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  fieldLabel: { letterSpacing: 0.6, fontWeight: '700' },
  input: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 15,
  },
  notesInput: { minHeight: 100, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipLabel: { fontSize: 12, fontWeight: '700', color: colors.text },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: colors.background, fontWeight: '900', fontSize: 14 },
  checkLabel: { color: colors.text, fontSize: 14, flex: 1 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  linkChevron: { color: colors.textTertiary, fontSize: 24 },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  primaryBtnLabel: { fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryBtnLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  dangerBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFB4AB',
    backgroundColor: 'transparent',
  },
  dangerBtnLabel: { fontSize: 14, fontWeight: '700', color: '#FFB4AB' },
});
