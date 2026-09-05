import { useCallback, useEffect, useState } from 'react';
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
  RequirementUpdateSchema,
  getRequirement,
  updateRequirement,
  type RequirementCategory,
  type RequirementRow,
} from '@mylife/classes';
import { useDatabase } from '../../../../../components/DatabaseProvider';
import { CLASSES_ACCENT } from '../../../_ui';
import {
  MIN_GRADES,
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_CATEGORY_LABEL,
} from '../../_ui';
import { Stepper } from '../../program/add';

export default function EditRequirementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();

  const [req, setReq] = useState<RequirementRow | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<RequirementCategory | null>(null);
  const [creditsRequired, setCreditsRequired] = useState(0);
  const [courseCountRequired, setCourseCountRequired] = useState(0);
  const [minGrade, setMinGrade] = useState<string | null>(null);
  const [allowedCodes, setAllowedCodes] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const r = getRequirement(db, id);
    if (!r) return;
    setReq(r);
    setName(r.name);
    setCategory(r.category);
    setCreditsRequired(r.credits_required);
    setCourseCountRequired(r.course_count_required);
    setMinGrade(r.min_grade);
    let codesArr: string[] = [];
    if (r.allowed_course_codes) {
      try {
        const parsed = JSON.parse(r.allowed_course_codes);
        if (Array.isArray(parsed)) codesArr = parsed.filter((s) => typeof s === 'string');
      } catch {
        codesArr = [];
      }
    }
    setAllowedCodes(codesArr.join(', '));
    setNotes(r.notes_md ?? '');
  }, [db, id]);

  const handleSave = useCallback(() => {
    if (!req) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Requirement name cannot be empty.');
      return;
    }
    const codes = allowedCodes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const parsed = RequirementUpdateSchema.safeParse({
      name: name.trim(),
      category,
      credits_required: creditsRequired,
      course_count_required: courseCountRequired,
      min_grade: minGrade === 'none' ? null : minGrade,
      allowed_course_codes: codes.length > 0 ? codes : null,
      notes_md: notes.trim() || null,
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
      updateRequirement(db, req.id, parsed.data);
      router.back();
    } catch (err) {
      Alert.alert('Save failed', String(err));
      setSaving(false);
    }
  }, [
    db,
    req,
    name,
    category,
    creditsRequired,
    courseCountRequired,
    minGrade,
    allowedCodes,
    notes,
    router,
  ]);

  if (!req) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={{ title: 'Edit requirement' }} />
        <Text variant="body" color={colors.textSecondary}>
          Requirement not found.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `Edit ${req.name}` }} />
      <Card style={styles.card}>
        <Field label="Name">
          <TextInput
            value={name}
            onChangeText={setName}
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
        <Field label="Allowed course codes (comma-separated; CS* for prefix glob)">
          <TextInput
            value={allowedCodes}
            onChangeText={setAllowedCodes}
            placeholder="CS101, CS*, MATH202"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="characters"
            style={styles.input}
          />
        </Field>
        <Field label="Notes">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, styles.notesInput]}
          />
        </Field>
      </Card>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: CLASSES_ACCENT }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
            {saving ? 'Saving…' : 'Save changes'}
          </Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnLabel}>Cancel</Text>
        </Pressable>
      </View>
    </ScrollView>
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
  center: { justifyContent: 'center', alignItems: 'center' },
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
