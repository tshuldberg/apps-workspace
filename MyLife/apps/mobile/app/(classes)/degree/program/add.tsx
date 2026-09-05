import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  DegreeProgramInputSchema,
  createDegreeProgram,
  type DegreeType,
} from '@mylife/classes';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { uuid } from '../../../../lib/uuid';
import { CLASSES_ACCENT } from '../../_ui';
import { DEGREE_TYPES } from '../_ui';

export default function AddProgramScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [degreeType, setDegreeType] = useState<DegreeType | null>(null);
  const [totalCredits, setTotalCredits] = useState(120);
  const [gpaRequired, setGpaRequired] = useState<number | null>(null);
  const [catalogYear, setCatalogYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expectedCompletion, setExpectedCompletion] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Program name cannot be empty.');
      return;
    }
    const parsed = DegreeProgramInputSchema.safeParse({
      name: name.trim(),
      institution: institution.trim() || null,
      degree_type: degreeType,
      total_credits_required: totalCredits,
      gpa_required: gpaRequired,
      catalog_year: catalogYear.trim() || null,
      start_date: startDate.trim() || null,
      expected_completion: expectedCompletion.trim() || null,
      is_primary: isPrimary,
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
      createDegreeProgram(db, uuid(), parsed.data);
      router.back();
    } catch (err) {
      Alert.alert('Save failed', String(err));
      setSaving(false);
    }
  }, [
    db,
    name,
    institution,
    degreeType,
    totalCredits,
    gpaRequired,
    catalogYear,
    startDate,
    expectedCompletion,
    isPrimary,
    notes,
    router,
  ]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="Program">
        <Card style={styles.card}>
          <Field label="Name">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="BS Computer Science"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </Field>
          <Field label="Institution">
            <TextInput
              value={institution}
              onChangeText={setInstitution}
              placeholder="State University"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </Field>
          <Field label="Degree type">
            <View style={styles.chipRow}>
              {DEGREE_TYPES.map((dt) => {
                const active = degreeType === dt;
                return (
                  <Pressable
                    key={dt}
                    onPress={() => setDegreeType(active ? null : dt)}
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
                      {dt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>
        </Card>
      </Section>

      <Section title="Requirements">
        <Card style={styles.card}>
          <Field label="Total credits required">
            <Stepper
              value={totalCredits}
              onChange={setTotalCredits}
              step={3}
              min={0}
              format={(v) => `${v}`}
            />
          </Field>
          <Field label="Minimum GPA (optional)">
            <Stepper
              value={gpaRequired ?? 0}
              onChange={(v) => setGpaRequired(v <= 0 ? null : v)}
              step={0.1}
              min={0}
              max={4}
              format={(v) => (v <= 0 ? '—' : v.toFixed(1))}
            />
          </Field>
          <Field label="Catalog year">
            <TextInput
              value={catalogYear}
              onChangeText={setCatalogYear}
              placeholder="2024-2025"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
          </Field>
          <View style={styles.row2}>
            <Field label="Start date" style={{ flex: 1 }}>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                style={styles.input}
              />
            </Field>
            <Field label="Expected completion" style={{ flex: 1 }}>
              <TextInput
                value={expectedCompletion}
                onChangeText={setExpectedCompletion}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                style={styles.input}
              />
            </Field>
          </View>
          <View style={styles.toggleRow}>
            <Text variant="body" color={colors.text} style={{ flex: 1 }}>
              Set as primary
            </Text>
            <Switch
              value={isPrimary}
              onValueChange={setIsPrimary}
              trackColor={{ true: CLASSES_ACCENT, false: colors.border }}
            />
          </View>
        </Card>
      </Section>

      <Section title="Notes">
        <Card style={styles.card}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything to remember about this program."
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
            {saving ? 'Saving…' : 'Save program'}
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

export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
}) {
  return (
    <View style={styles.stepperRow}>
      <Pressable
        style={styles.stepperBtn}
        onPress={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
      >
        <Text style={styles.stepperBtnLabel}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>
        {format ? format(value) : String(value)}
      </Text>
      <Pressable
        style={styles.stepperBtn}
        onPress={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
      >
        <Text style={styles.stepperBtnLabel}>+</Text>
      </Pressable>
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnLabel: { color: colors.text, fontSize: 18, fontWeight: '700' },
  stepperValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'center',
  },
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
