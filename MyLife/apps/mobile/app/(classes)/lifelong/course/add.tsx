import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  OnlineCourseInputSchema,
  createOnlineCourse,
  type OnlineCourseStatus,
} from '@mylife/classes';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { uuid } from '../../../../lib/uuid';
import { CLASSES_ACCENT } from '../../_ui';
import { COURSE_STATUS_LABEL } from '../_ui';

const STATUSES: OnlineCourseStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'abandoned',
];

export default function AddCourseScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState('');
  const [instructor, setInstructor] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<OnlineCourseStatus>('in_progress');
  const [progress, setProgress] = useState('0');
  const [estHours, setEstHours] = useState('');
  const [actualHours, setActualHours] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Course title cannot be empty.');
      return;
    }
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const parsed = OnlineCourseInputSchema.safeParse({
      title: title.trim(),
      provider: provider.trim() || null,
      instructor: instructor.trim() || null,
      url: url.trim() || null,
      category: category.trim() || null,
      status,
      progress_percent: Number(progress) || 0,
      estimated_hours: estHours ? Number(estHours) : null,
      actual_hours: actualHours ? Number(actualHours) : null,
      notes_md: notes.trim() || null,
      tags: tagList.length > 0 ? tagList : null,
    });
    if (!parsed.success) {
      Alert.alert(
        'Invalid input',
        parsed.error.issues[0]?.message ?? 'Check fields.',
      );
      return;
    }
    setSaving(true);
    try {
      createOnlineCourse(db, uuid(), parsed.data);
      router.back();
    } catch (err) {
      Alert.alert('Save failed', String(err));
      setSaving(false);
    }
  }, [
    db,
    title,
    provider,
    instructor,
    url,
    category,
    status,
    progress,
    estHours,
    actualHours,
    notes,
    tags,
    router,
  ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="What">
        <Card style={styles.card}>
          <Field label="Title">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Practical Deep Learning"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </Field>
          <Field label="Provider">
            <TextInput
              value={provider}
              onChangeText={setProvider}
              placeholder="Coursera, Udemy, fast.ai…"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </Field>
          <Field label="Instructor">
            <TextInput
              value={instructor}
              onChangeText={setInstructor}
              placeholder="Jeremy Howard"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </Field>
          <Field label="URL">
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="https://…"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              style={styles.input}
            />
          </Field>
          <Field label="Category">
            <TextInput
              value={category}
              onChangeText={setCategory}
              placeholder="ML, Spanish, Design…"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </Field>
        </Card>
      </Section>

      <Section title="Progress">
        <Card style={styles.card}>
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
          <Field label="Progress %">
            <TextInput
              value={progress}
              onChangeText={setProgress}
              placeholder="0-100"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numeric"
              style={styles.input}
            />
          </Field>
          <View style={styles.row2}>
            <Field label="Est. hours" style={{ flex: 1 }}>
              <TextInput
                value={estHours}
                onChangeText={setEstHours}
                placeholder="40"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                style={styles.input}
              />
            </Field>
            <Field label="Actual hours" style={{ flex: 1 }}>
              <TextInput
                value={actualHours}
                onChangeText={setActualHours}
                placeholder="12.5"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                style={styles.input}
              />
            </Field>
          </View>
        </Card>
      </Section>

      <Section title="Tagging">
        <Card style={styles.card}>
          <Field label="Tags (comma-separated)">
            <TextInput
              value={tags}
              onChangeText={setTags}
              placeholder="ml, python, side-project"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              style={styles.input}
            />
          </Field>
        </Card>
      </Section>

      <Section title="Notes">
        <Card style={styles.card}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="What you want to remember about this course."
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[styles.input, styles.notesInput]}
          />
        </Card>
      </Section>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: CLASSES_ACCENT }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
            {saving ? 'Saving…' : 'Save course'}
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnLabel}>Cancel</Text>
        </Pressable>
      </View>
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
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  card: { gap: spacing.sm },
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
});
