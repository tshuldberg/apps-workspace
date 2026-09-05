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
  OnlineCourseUpdateSchema,
  deleteOnlineCourse,
  getOnlineCourse,
  updateOnlineCourse,
  type OnlineCourseRow,
  type OnlineCourseStatus,
} from '@mylife/classes';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { CLASSES_ACCENT } from '../../_ui';
import { COURSE_STATUS_LABEL, ProgressBar, formatDate } from '../_ui';

const STATUSES: OnlineCourseStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'abandoned',
];

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const [course, setCourse] = useState<OnlineCourseRow | null>(() =>
    id ? getOnlineCourse(db, id) : null,
  );
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(course?.title ?? '');
  const [provider, setProvider] = useState(course?.provider ?? '');
  const [instructor, setInstructor] = useState(course?.instructor ?? '');
  const [url, setUrl] = useState(course?.url ?? '');
  const [status, setStatus] = useState<OnlineCourseStatus>(
    course?.status ?? 'in_progress',
  );
  const [progress, setProgress] = useState(
    String(course?.progress_percent ?? 0),
  );
  const [actualHours, setActualHours] = useState(
    course?.actual_hours != null ? String(course.actual_hours) : '',
  );
  const [notes, setNotes] = useState(course?.notes_md ?? '');

  useEffect(() => {
    if (id) {
      const c = getOnlineCourse(db, id);
      setCourse(c);
      if (c) {
        setTitle(c.title);
        setProvider(c.provider ?? '');
        setInstructor(c.instructor ?? '');
        setUrl(c.url ?? '');
        setStatus(c.status);
        setProgress(String(c.progress_percent));
        setActualHours(c.actual_hours != null ? String(c.actual_hours) : '');
        setNotes(c.notes_md ?? '');
      }
    }
  }, [db, id]);

  const tags = useMemo(() => {
    if (!course?.tags) return [] as string[];
    try {
      const parsed = JSON.parse(course.tags);
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  }, [course?.tags]);

  const handleSave = useCallback(() => {
    if (!course) return;
    const parsed = OnlineCourseUpdateSchema.safeParse({
      title: title.trim() || course.title,
      provider: provider.trim() || null,
      instructor: instructor.trim() || null,
      url: url.trim() || null,
      status,
      progress_percent: Number(progress) || 0,
      actual_hours: actualHours ? Number(actualHours) : null,
      notes_md: notes.trim() || null,
    });
    if (!parsed.success) {
      Alert.alert(
        'Invalid input',
        parsed.error.issues[0]?.message ?? 'Check fields.',
      );
      return;
    }
    try {
      updateOnlineCourse(db, course.id, parsed.data);
      const fresh = getOnlineCourse(db, course.id);
      setCourse(fresh);
      setEditing(false);
    } catch (err) {
      Alert.alert('Save failed', String(err));
    }
  }, [
    course,
    db,
    title,
    provider,
    instructor,
    url,
    status,
    progress,
    actualHours,
    notes,
  ]);

  const handleDelete = useCallback(() => {
    if (!course) return;
    Alert.alert('Delete course?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteOnlineCourse(db, course.id);
            router.back();
          } catch (err) {
            Alert.alert('Delete failed', String(err));
          }
        },
      },
    ]);
  }, [course, db, router]);

  if (!course) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={{ title: 'Course' }} />
        <Text variant="body" color={colors.textSecondary}>
          Course not found.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: course.title }} />

      {editing ? (
        <>
          <Section title="Edit course">
            <Card style={styles.card}>
              <Field label="Title">
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  style={styles.input}
                />
              </Field>
              <Field label="Provider">
                <TextInput
                  value={provider}
                  onChangeText={setProvider}
                  style={styles.input}
                />
              </Field>
              <Field label="Instructor">
                <TextInput
                  value={instructor}
                  onChangeText={setInstructor}
                  style={styles.input}
                />
              </Field>
              <Field label="URL">
                <TextInput
                  value={url}
                  onChangeText={setUrl}
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
                          {COURSE_STATUS_LABEL[s] ?? s}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
              <View style={styles.row2}>
                <Field label="Progress %" style={{ flex: 1 }}>
                  <TextInput
                    value={progress}
                    onChangeText={setProgress}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </Field>
                <Field label="Actual hours" style={{ flex: 1 }}>
                  <TextInput
                    value={actualHours}
                    onChangeText={setActualHours}
                    keyboardType="numeric"
                    style={styles.input}
                  />
                </Field>
              </View>
              <Field label="Notes">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  style={[styles.input, styles.notesInput]}
                />
              </Field>
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
          <Section title="Overview">
            <Card style={styles.card}>
              <Text style={styles.title}>{course.title}</Text>
              {course.provider || course.instructor ? (
                <Text variant="caption" color={colors.textSecondary}>
                  {[course.provider, course.instructor]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              ) : null}
              <ProgressBar percent={course.progress_percent} />
              <Text variant="caption" color={colors.textSecondary}>
                {course.progress_percent.toFixed(0)}% ·{' '}
                {COURSE_STATUS_LABEL[course.status] ?? course.status}
              </Text>
            </Card>
          </Section>

          <Section title="Details">
            <Card style={styles.card}>
              <Row label="Started" value={formatDate(course.started_at)} />
              <Row label="Completed" value={formatDate(course.completed_at)} />
              <Row
                label="Hours"
                value={
                  course.actual_hours != null
                    ? `${course.actual_hours.toFixed(1)} logged`
                    : course.estimated_hours != null
                      ? `${course.estimated_hours.toFixed(1)} est.`
                      : '—'
                }
              />
              <Row label="Category" value={course.category ?? '—'} />
              {course.url ? <Row label="URL" value={course.url} /> : null}
              {tags.length > 0 ? (
                <Row label="Tags" value={tags.join(', ')} />
              ) : null}
            </Card>
          </Section>

          {course.notes_md ? (
            <Section title="Notes">
              <Card style={styles.card}>
                <Text variant="body" color={colors.text}>
                  {course.notes_md}
                </Text>
              </Card>
            </Section>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: CLASSES_ACCENT }]}
              onPress={() => setEditing(true)}
            >
              <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
                Edit course
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
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
  row2: { flexDirection: 'row', gap: spacing.sm },
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
