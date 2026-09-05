import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  AssignmentInputSchema,
  createAssignment,
  formatClassesReminderSummary,
  getClassesSettings,
  listAssignmentsByClass,
  listClassesBySemester,
  listSemesters,
  type AssignmentPriority,
  type AssignmentRow,
  type AssignmentType,
  type ClassRow,
  type GroupMember,
  type RecurrenceFrequency,
} from '@mylife/classes';
import { borderRadius, Card, colors, spacing, Text } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

const ACCENT = colors.modules.classes;

const TYPES: AssignmentType[] = [
  'homework',
  'essay',
  'project',
  'quiz',
  'exam',
  'lab',
  'presentation',
  'reading',
  'other',
];

const PRIORITIES: AssignmentPriority[] = ['low', 'medium', 'high', 'critical'];

const FREQUENCIES: RecurrenceFrequency[] = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function defaultDueAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(23, 59, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toISO(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function AssignmentAddScreen() {
  const router = useRouter();
  const db = useDatabase();

  const initial = useMemo(() => {
    const semesters = listSemesters(db);
    const semester =
      semesters.find((s) => s.is_current === 1) ?? semesters[0] ?? null;
    const classes = semester ? listClassesBySemester(db, semester.id) : [];
    const settings = getClassesSettings(db);
    return {
      classes,
      reminderSummary: formatClassesReminderSummary(
        settings.assignmentReminderOffsets,
      ),
    };
  }, [db]);

  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState<string>(initial.classes[0]?.id ?? '');
  const [type, setType] = useState<AssignmentType>('homework');
  const [priority, setPriority] = useState<AssignmentPriority>('medium');
  const [dueAtLocal, setDueAtLocal] = useState<string>(defaultDueAt());
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(60);
  const [weight, setWeight] = useState<string>('');
  const [maxGrade, setMaxGrade] = useState<string>('100');
  const [description, setDescription] = useState('');

  const [recurrenceOn, setRecurrenceOn] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
  const [interval, setInterval] = useState<number>(1);
  const [until, setUntil] = useState<string>('');

  const [latePolicyOn, setLatePolicyOn] = useState(false);
  const [latePercent, setLatePercent] = useState<string>('10');
  const [lateMaxDays, setLateMaxDays] = useState<string>('5');

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [dependsOn, setDependsOn] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);

  const classAssignments = useMemo<AssignmentRow[]>(() => {
    if (!classId) return [];
    return listAssignmentsByClass(db, classId);
  }, [db, classId]);

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Assignment title cannot be empty.');
      return;
    }
    if (!classId) {
      Alert.alert('Class required', 'Pick a class first.');
      return;
    }

    const dueAtISO = toISO(dueAtLocal);
    const untilISO = recurrenceOn && until ? toISO(`${until}T23:59`) : undefined;

    const input = {
      class_id: classId,
      title: title.trim(),
      type,
      priority,
      due_at: dueAtISO,
      estimated_minutes:
        Number.isFinite(estimatedMinutes) && estimatedMinutes > 0
          ? estimatedMinutes
          : null,
      weight: weight.trim() ? Number(weight) : null,
      max_grade: maxGrade.trim() ? Number(maxGrade) : 100,
      description_md: description.trim() || null,
      is_recurring: recurrenceOn,
      recurrence_rule: recurrenceOn
        ? { frequency, interval, ...(untilISO ? { until: untilISO } : {}) }
        : null,
      late_policy: latePolicyOn
        ? {
            percent_per_day: Number(latePercent) || 0,
            max_days: Number(lateMaxDays) || 0,
          }
        : null,
      group_members: groupMembers.length > 0 ? groupMembers : null,
      depends_on: dependsOn.length > 0 ? dependsOn : null,
    };

    const parsed = AssignmentInputSchema.safeParse(input);
    if (!parsed.success) {
      Alert.alert(
        'Invalid input',
        parsed.error.issues[0]?.message ?? 'Check fields.',
      );
      return;
    }

    setSaving(true);
    try {
      createAssignment(db, uuid(), parsed.data);
      router.back();
    } catch (err) {
      Alert.alert('Save failed', String(err));
      setSaving(false);
    }
  }, [
    db,
    title,
    classId,
    type,
    priority,
    dueAtLocal,
    estimatedMinutes,
    weight,
    maxGrade,
    description,
    recurrenceOn,
    frequency,
    interval,
    until,
    latePolicyOn,
    latePercent,
    lateMaxDays,
    groupMembers,
    dependsOn,
    router,
  ]);

  const updateMember = (idx: number, patch: Partial<GroupMember>) => {
    setGroupMembers((arr) =>
      arr.map((m, i) => (i === idx ? { ...m, ...patch } : m)),
    );
  };
  const removeMember = (idx: number) => {
    setGroupMembers((arr) => arr.filter((_, i) => i !== idx));
  };
  const addMember = () => {
    setGroupMembers((arr) => [...arr, { name: '' }]);
  };

  const toggleDependency = (id: string) => {
    setDependsOn((arr) =>
      arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id],
    );
  };

  if (initial.classes.length === 0) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Add assignment',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
        >
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Add a class first</Text>
            <Text variant="body" color={colors.textSecondary}>
              Assignments live inside a class. Add a class in your active semester before creating assignments.
            </Text>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
              onPress={() => router.replace('/(classes)')}
            >
              <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
                Open schedule
              </Text>
            </Pressable>
          </Card>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add assignment',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Section title="Basics">
          <Card style={styles.card}>
            <Field label="Title">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Problem set 4"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
            </Field>
            <Field label="Class">
              <View style={styles.chipRow}>
                {initial.classes.map((c) => (
                  <ClassChip
                    key={c.id}
                    cls={c}
                    active={classId === c.id}
                    onPress={() => {
                      setClassId(c.id);
                      setDependsOn([]);
                    }}
                  />
                ))}
              </View>
            </Field>
            <Field label="Type">
              <View style={styles.chipRow}>
                {TYPES.map((t) => (
                  <ChipBtn
                    key={t}
                    label={t}
                    active={type === t}
                    onPress={() => setType(t)}
                  />
                ))}
              </View>
            </Field>
            <Field label="Priority">
              <View style={styles.chipRow}>
                {PRIORITIES.map((p) => (
                  <ChipBtn
                    key={p}
                    label={p}
                    active={priority === p}
                    onPress={() => setPriority(p)}
                  />
                ))}
              </View>
            </Field>
          </Card>
        </Section>

        <Section title="Due date">
          <Card style={styles.card}>
            <Field label="Due at (YYYY-MM-DDTHH:MM)">
              <TextInput
                value={dueAtLocal}
                onChangeText={setDueAtLocal}
                placeholder="2026-05-01T23:59"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
                autoCapitalize="none"
              />
            </Field>
            <Stepper
              label="Estimated minutes"
              value={estimatedMinutes}
              onChange={setEstimatedMinutes}
              step={15}
              min={0}
            />
            <View style={styles.row2}>
              <Field label="Weight" style={{ flex: 1 }}>
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="0.10"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </Field>
              <Field label="Max grade" style={{ flex: 1 }}>
                <TextInput
                  value={maxGrade}
                  onChangeText={setMaxGrade}
                  placeholder="100"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </Field>
            </View>
          </Card>
        </Section>

        <Section title="Description">
          <Card style={styles.card}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Markdown supported."
              placeholderTextColor={colors.textTertiary}
              multiline
              style={[styles.input, styles.notesInput]}
            />
          </Card>
        </Section>

        <Section title="Recurrence">
          <Card style={styles.card}>
            <ToggleRow
              label="Repeat on a schedule"
              value={recurrenceOn}
              onChange={setRecurrenceOn}
            />
            {recurrenceOn ? (
              <>
                <Field label="Frequency">
                  <View style={styles.chipRow}>
                    {FREQUENCIES.map((f) => (
                      <ChipBtn
                        key={f}
                        label={f}
                        active={frequency === f}
                        onPress={() => setFrequency(f)}
                      />
                    ))}
                  </View>
                </Field>
                <Stepper
                  label="Interval"
                  value={interval}
                  onChange={setInterval}
                  step={1}
                  min={1}
                />
                <Field label="Until (YYYY-MM-DD, optional)">
                  <TextInput
                    value={until}
                    onChangeText={setUntil}
                    placeholder="2026-12-15"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                </Field>
              </>
            ) : null}
          </Card>
        </Section>

        <Section title="Late policy">
          <Card style={styles.card}>
            <ToggleRow
              label="Apply late policy"
              value={latePolicyOn}
              onChange={setLatePolicyOn}
            />
            {latePolicyOn ? (
              <View style={styles.row2}>
                <Field label="Percent / day" style={{ flex: 1 }}>
                  <TextInput
                    value={latePercent}
                    onChangeText={setLatePercent}
                    placeholder="10"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </Field>
                <Field label="Max days" style={{ flex: 1 }}>
                  <TextInput
                    value={lateMaxDays}
                    onChangeText={setLateMaxDays}
                    placeholder="5"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    style={styles.input}
                  />
                </Field>
              </View>
            ) : null}
          </Card>
        </Section>

        <Section title="Group members">
          <Card style={styles.card}>
            {groupMembers.map((m, idx) => (
              <View key={idx} style={styles.memberRow}>
                <TextInput
                  value={m.name}
                  onChangeText={(v) => updateMember(idx, { name: v })}
                  placeholder="Name"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.input, { flex: 1 }]}
                />
                <TextInput
                  value={m.responsibilities ?? ''}
                  onChangeText={(v) =>
                    updateMember(idx, { responsibilities: v })
                  }
                  placeholder="Role"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.input, { flex: 1 }]}
                />
                <Pressable onPress={() => removeMember(idx)}>
                  <Text style={styles.removeLink}>×</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addBtn} onPress={addMember}>
              <Text style={[styles.addBtnLabel, { color: ACCENT }]}>
                + Add member
              </Text>
            </Pressable>
          </Card>
        </Section>

        {classAssignments.length > 0 ? (
          <Section title="Depends on">
            <Card style={styles.card}>
              <Text variant="caption" color={colors.textSecondary}>
                Pick assignments in this class that must finish first.
              </Text>
              <View style={styles.chipRow}>
                {classAssignments.map((a) => (
                  <ChipBtn
                    key={a.id}
                    label={a.title}
                    active={dependsOn.includes(a.id)}
                    onPress={() => toggleDependency(a.id)}
                  />
                ))}
              </View>
            </Card>
          </Section>
        ) : null}

        <Section title="Reminders">
          <Card style={styles.card}>
            <Text variant="body" color={colors.textSecondary}>
              Reminders use your global setting: {initial.reminderSummary}
            </Text>
            <Pressable
              style={styles.linkBtn}
              onPress={() => router.push('/(classes)/settings')}
            >
              <Text style={[styles.linkBtnLabel, { color: ACCENT }]}>
                Tune reminder offsets
              </Text>
            </Pressable>
          </Card>
        </Section>

        <View style={[styles.section, styles.actions]}>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={[styles.primaryBtnLabel, { color: colors.background }]}>
              {saving ? 'Saving…' : 'Save assignment'}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnLabel}>Cancel</Text>
          </Pressable>
        </View>
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
      <Text
        variant="caption"
        color={colors.textSecondary}
        style={styles.fieldLabel}
      >
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function ChipBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: ACCENT, borderColor: ACCENT }]}
    >
      <Text
        style={[
          styles.chipLabel,
          active && { color: colors.background },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ClassChip({
  cls,
  active,
  onPress,
}: {
  cls: ClassRow;
  active: boolean;
  onPress: () => void;
}) {
  const accent = cls.color || ACCENT;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active && { backgroundColor: accent, borderColor: accent },
      ]}
    >
      <View style={[styles.classDot, { backgroundColor: accent }]} />
      <Text
        style={[
          styles.chipLabel,
          active && { color: colors.background },
        ]}
      >
        {cls.code || cls.name}
      </Text>
    </Pressable>
  );
}

function Stepper({
  label,
  value,
  onChange,
  step,
  min,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
  min: number;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          style={styles.stepperBtn}
          onPress={() => onChange(Math.max(min, value - step))}
        >
          <Text style={styles.stepperBtnLabel}>-</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable
          style={styles.stepperBtn}
          onPress={() => onChange(value + step)}
        >
          <Text style={styles.stepperBtnLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)}>
      <Text variant="body" style={{ color: colors.text, flex: 1 }}>
        {label}
      </Text>
      <View
        style={[
          styles.toggle,
          value && { backgroundColor: ACCENT, borderColor: ACCENT },
        ]}
      >
        <Text style={[styles.toggleLabel, value && { color: colors.background }]}>
          {value ? 'ON' : 'OFF'}
        </Text>
      </View>
    </Pressable>
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
  row2: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  classDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnLabel: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  stepperValue: {
    minWidth: 50,
    textAlign: 'center',
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  toggleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  memberRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  removeLink: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 22,
    paddingHorizontal: 6,
  },
  addBtn: { paddingVertical: spacing.sm, alignItems: 'flex-start' },
  addBtnLabel: { fontSize: 14, fontWeight: '700' },
  linkBtn: { paddingVertical: 4, alignItems: 'flex-start' },
  linkBtnLabel: { fontSize: 13, fontWeight: '700' },
  emptyCard: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
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
