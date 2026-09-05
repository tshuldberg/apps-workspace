import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  RequirementInputSchema,
  createRequirement,
  listRequirementsByProgram,
  type RequirementCategory,
} from '@mylife/classes';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { uuid } from '../../../../lib/uuid';
import { CLASSES_ACCENT } from '../../_ui';
import {
  MIN_GRADES,
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_CATEGORY_LABEL,
} from '../_ui';
import { Stepper } from '../program/add';

export default function AddRequirementScreen() {
  const params = useLocalSearchParams<{ program_id?: string }>();
  const router = useRouter();
  const db = useDatabase();
  const programId = params.program_id ?? '';

  const [name, setName] = useState('');
  const [category, setCategory] = useState<RequirementCategory | null>(null);
  const [creditsRequired, setCreditsRequired] = useState(0);
  const [courseCountRequired, setCourseCountRequired] = useState(0);
  const [minGrade, setMinGrade] = useState<string | null>(null);
  const [allowedCodes, setAllowedCodes] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(() => {
    if (!programId) {
      Alert.alert('Missing program', 'Open this from a program detail page.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Name required', 'Requirement name cannot be empty.');
      return;
    }
    const codes = allowedCodes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const existing = listRequirementsByProgram(db, programId);
    const sortOrder = existing.length;
    const parsed = RequirementInputSchema.safeParse({
      program_id: programId,
      name: name.trim(),
      category,
      credits_required: creditsRequired,
      course_count_required: courseCountRequired,
      min_grade: minGrade === 'none' ? null : minGrade,
      allowed_course_codes: codes.length > 0 ? codes : null,
      notes_md: notes.trim() || null,
      sort_order: sortOrder,
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
      createRequirement(db, uuid(), parsed.data);
      router.back();
    } catch (err) {
      Alert.alert('Save failed', String(err));
      setSaving(false);
    }
  }, [
    db,
    programId,
    name,
    category,
    creditsRequired,
    courseCountRequired,
    minGrade,
    allowedCodes,
    notes,
    router,
  ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="Requirement">
        <Card style={styles.card}>
          <Field label="Name">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Computer Science Core"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </Field>
          <Field label="Category">
            <View style={styles.chipRow}>
              {REQUIREMENT_CATEGORIES.map((c) => {
                const active = category === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(active ? null : c)}
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
                      {REQUIREMENT_CATEGORY_LABEL[c]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
        </Card>
      </Section>

      <Section title="Quotas">
        <Card style={styles.card}>
          <Field label="Credits required">
            <Stepper
              value={creditsRequired}
              onChange={setCreditsRequired}
              step={3}
              min={0}
            />
          </Field>
          <Field label="Course count required">
            <Stepper
              value={courseCountRequired}
              onChange={setCourseCountRequired}
              step={1}
              min={0}
            />
          </Field>
          <Field label="Minimum grade">
            <View style={styles.chipRow}>
              {MIN_GRADES.map((g) => {
                const active =
                  (minGrade === null && g === 'none') || minGrade === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => setMinGrade(g === 'none' ? null : g)}
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
                      {g}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
        </Card>
      </Section>

      <Section title="Allowed course codes">
        <Card style={styles.card}>
          <Field label="Codes (comma-separated; CS* for prefix glob)">
            <TextInput
              value={allowedCodes}
              onChangeText={setAllowedCodes}
              placeholder="CS101, CS*, MATH202"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="characters"
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
            placeholder="Anything to remember about this requirement."
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
            {saving ? 'Saving…' : 'Save requirement'}
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
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
