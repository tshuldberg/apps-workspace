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
  LearningGoalInputSchema,
  createLearningGoal,
  listCertifications,
  listOnlineCourses,
  type LearningGoalStatus,
} from '@mylife/classes';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { uuid } from '../../../../lib/uuid';
import { CLASSES_ACCENT } from '../../_ui';
import { GOAL_STATUS_LABEL } from '../_ui';

const STATUSES: LearningGoalStatus[] = [
  'active',
  'completed',
  'paused',
  'abandoned',
];

export default function AddGoalScreen() {
  const router = useRouter();
  const db = useDatabase();
  const allCourses = listOnlineCourses(db);
  const allCerts = listCertifications(db);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState<LearningGoalStatus>('active');
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [certIds, setCertIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleCourse = (id: string) =>
    setCourseIds((arr) =>
      arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id],
    );
  const toggleCert = (id: string) =>
    setCertIds((arr) =>
      arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id],
    );

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Goal title cannot be empty.');
      return;
    }
    const parsed = LearningGoalInputSchema.safeParse({
      title: title.trim(),
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
    setSaving(true);
    try {
      createLearningGoal(db, uuid(), parsed.data);
      router.back();
    } catch (err) {
      Alert.alert('Save failed', String(err));
      setSaving(false);
    }
  }, [db, title, description, targetDate, status, courseIds, certIds, router]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="The goal">
        <Card style={styles.card}>
          <Field label="Title">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Become conversational in Spanish"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </Field>
          <Field label="Description">
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What does success look like? Why does it matter?"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={[styles.input, styles.notesInput]}
            />
          </Field>
          <View style={styles.row2}>
            <Field label="Target date" style={{ flex: 1 }}>
              <TextInput
                value={targetDate}
                onChangeText={setTargetDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                style={styles.input}
              />
            </Field>
          </View>
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
              Add courses first to link them here.
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
                    {checked ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : null}
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
              Add certifications first to link them here.
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
                    {checked ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : null}
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
          disabled={saving}
        >
          <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
            {saving ? 'Saving…' : 'Set goal'}
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
