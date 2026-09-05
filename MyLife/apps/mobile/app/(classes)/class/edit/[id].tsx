import { useCallback, useMemo, useState } from 'react';
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
  CLASSES_PALETTE,
  getClass,
  listTeachers,
  updateClass,
  type CategoryWeights,
  type DayTime,
  type TeacherRow,
} from '@mylife/classes';
import { useDatabase } from '../../../../components/DatabaseProvider';

const ACCENT = colors.modules.classes;

interface EditState {
  name: string;
  code: string;
  section: string;
  credits: string;
  room: string;
  building: string;
  color: string;
  notesMd: string;
  teacherId: string | null;
  blocks: DayTime[];
  weights: Array<{ category: string; value: string }>;
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

function parseWeights(
  raw: string | null,
): Array<{ category: string; value: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CategoryWeights;
    if (!parsed || typeof parsed !== 'object') return [];
    return Object.entries(parsed).map(([category, value]) => ({
      category,
      value: String(value),
    }));
  } catch {
    return [];
  }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function ClassEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();

  const initial = useMemo<EditState | null>(() => {
    if (!id) return null;
    const cls = getClass(db, id);
    if (!cls) return null;
    return {
      name: cls.name,
      code: cls.code ?? '',
      section: cls.section ?? '',
      credits: String(cls.credits),
      room: cls.room ?? '',
      building: cls.building ?? '',
      color: cls.color || CLASSES_PALETTE[0],
      notesMd: cls.notes_md ?? '',
      teacherId: cls.teacher_id,
      blocks: parseBlocks(cls.day_times),
      weights: parseWeights(cls.category_weights),
    };
  }, [db, id]);

  const teachers = useMemo<TeacherRow[]>(() => listTeachers(db), [db]);
  const [state, setState] = useState<EditState | null>(initial);
  const [saving, setSaving] = useState(false);

  const set = useCallback(<K extends keyof EditState>(key: K, value: EditState[K]) => {
    setState((s) => (s ? { ...s, [key]: value } : s));
  }, []);

  const updateBlock = useCallback(
    (idx: number, patch: Partial<DayTime>) => {
      setState((s) =>
        s
          ? {
              ...s,
              blocks: s.blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
            }
          : s,
      );
    },
    [],
  );

  const removeBlock = useCallback((idx: number) => {
    setState((s) =>
      s ? { ...s, blocks: s.blocks.filter((_, i) => i !== idx) } : s,
    );
  }, []);

  const addBlock = useCallback(() => {
    setState((s) =>
      s
        ? {
            ...s,
            blocks: [
              ...s.blocks,
              { day: 'mon', start_time: '09:00', end_time: '10:00' },
            ],
          }
        : s,
    );
  }, []);

  const updateWeight = useCallback(
    (idx: number, patch: Partial<{ category: string; value: string }>) => {
      setState((s) =>
        s
          ? {
              ...s,
              weights: s.weights.map((w, i) => (i === idx ? { ...w, ...patch } : w)),
            }
          : s,
      );
    },
    [],
  );

  const addWeight = useCallback(() => {
    setState((s) =>
      s ? { ...s, weights: [...s.weights, { category: '', value: '' }] } : s,
    );
  }, []);

  const removeWeight = useCallback((idx: number) => {
    setState((s) =>
      s ? { ...s, weights: s.weights.filter((_, i) => i !== idx) } : s,
    );
  }, []);

  const handleSave = useCallback(() => {
    if (!state || !id) return;
    if (!state.name.trim()) {
      Alert.alert('Name required', 'Class name cannot be empty.');
      return;
    }
    for (const b of state.blocks) {
      if (!TIME_RE.test(b.start_time) || !TIME_RE.test(b.end_time)) {
        Alert.alert('Invalid time', 'Use HH:MM (24h) for every time block.');
        return;
      }
      if (b.start_time >= b.end_time) {
        Alert.alert('Invalid range', 'Start time must be before end time.');
        return;
      }
    }
    const weightsObject: CategoryWeights = {};
    for (const w of state.weights) {
      const key = w.category.trim();
      if (!key) continue;
      const num = Number(w.value);
      if (!Number.isFinite(num) || num < 0 || num > 100) {
        Alert.alert('Invalid weight', `${key}: weight must be a number 0-100.`);
        return;
      }
      weightsObject[key] = num;
    }
    setSaving(true);
    try {
      updateClass(db, id, {
        name: state.name.trim(),
        code: state.code.trim() || null,
        section: state.section.trim() || null,
        credits: Number(state.credits) || 0,
        room: state.room.trim() || null,
        building: state.building.trim() || null,
        teacher_id: state.teacherId,
        color: state.color,
        notes_md: state.notesMd.trim() || null,
        day_times: state.blocks,
        category_weights:
          Object.keys(weightsObject).length > 0 ? weightsObject : null,
      });
      router.back();
    } catch (err) {
      Alert.alert('Save failed', String(err));
      setSaving(false);
    }
  }, [db, id, router, state]);

  if (!state) {
    return (
      <View style={styles.errorScreen}>
        <Text variant="heading" style={styles.errorTitle}>
          Class not found
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnLabel}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit class',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Section title="Basics">
          <Card style={styles.card}>
            <Field label="Name">
              <TextInput
                value={state.name}
                onChangeText={(v) => set('name', v)}
                placeholder="Calculus II"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
            </Field>
            <View style={styles.row2}>
              <Field label="Code" style={{ flex: 1 }}>
                <TextInput
                  value={state.code}
                  onChangeText={(v) => set('code', v)}
                  placeholder="MA 201"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                />
              </Field>
              <Field label="Section" style={{ width: 100 }}>
                <TextInput
                  value={state.section}
                  onChangeText={(v) => set('section', v)}
                  placeholder="01"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                />
              </Field>
            </View>
            <Field label="Credits">
              <TextInput
                value={state.credits}
                onChangeText={(v) => set('credits', v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="3"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
            </Field>
          </Card>
        </Section>

        <Section title="Location">
          <Card style={styles.card}>
            <View style={styles.row2}>
              <Field label="Building" style={{ flex: 1 }}>
                <TextInput
                  value={state.building}
                  onChangeText={(v) => set('building', v)}
                  placeholder="Tech Hall"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                />
              </Field>
              <Field label="Room" style={{ width: 110 }}>
                <TextInput
                  value={state.room}
                  onChangeText={(v) => set('room', v)}
                  placeholder="204"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                />
              </Field>
            </View>
          </Card>
        </Section>

        <Section title="Color">
          <Card style={styles.card}>
            <View style={styles.colorRow}>
              {CLASSES_PALETTE.map((hex) => (
                <Pressable
                  key={hex}
                  onPress={() => set('color', hex)}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: hex,
                      borderColor:
                        state.color === hex ? colors.text : 'transparent',
                    },
                  ]}
                />
              ))}
            </View>
          </Card>
        </Section>

        <Section title="Schedule blocks">
          <Card style={styles.card}>
            {state.blocks.length === 0 ? (
              <Text variant="body" color={colors.textSecondary}>
                No weekly meetings yet.
              </Text>
            ) : (
              state.blocks.map((b, idx) => (
                <View key={idx} style={styles.blockRow}>
                  <View style={styles.dayPickerRow}>
                    {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map(
                      (day) => (
                        <Pressable
                          key={day}
                          onPress={() => updateBlock(idx, { day })}
                          style={[
                            styles.dayPickerChip,
                            b.day === day && {
                              backgroundColor: ACCENT,
                              borderColor: ACCENT,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayPickerLabel,
                              b.day === day && { color: colors.background },
                            ]}
                          >
                            {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>
                  <View style={styles.row2}>
                    <Field label="Start" style={{ flex: 1 }}>
                      <TextInput
                        value={b.start_time}
                        onChangeText={(v) => updateBlock(idx, { start_time: v })}
                        placeholder="09:00"
                        placeholderTextColor={colors.textTertiary}
                        style={styles.input}
                      />
                    </Field>
                    <Field label="End" style={{ flex: 1 }}>
                      <TextInput
                        value={b.end_time}
                        onChangeText={(v) => updateBlock(idx, { end_time: v })}
                        placeholder="10:00"
                        placeholderTextColor={colors.textTertiary}
                        style={styles.input}
                      />
                    </Field>
                  </View>
                  <Pressable onPress={() => removeBlock(idx)}>
                    <Text style={styles.removeLink}>Remove</Text>
                  </Pressable>
                </View>
              ))
            )}
            <Pressable style={styles.addBtn} onPress={addBlock}>
              <Text style={[styles.addBtnLabel, { color: ACCENT }]}>
                + Add time block
              </Text>
            </Pressable>
          </Card>
        </Section>

        <Section title="Teacher">
          <Card style={styles.card}>
            <Pressable
              style={[
                styles.teacherChip,
                state.teacherId === null && {
                  borderColor: ACCENT,
                },
              ]}
              onPress={() => set('teacherId', null)}
            >
              <Text variant="body">No teacher</Text>
            </Pressable>
            {teachers.map((t) => (
              <Pressable
                key={t.id}
                style={[
                  styles.teacherChip,
                  state.teacherId === t.id && {
                    borderColor: ACCENT,
                  },
                ]}
                onPress={() => set('teacherId', t.id)}
              >
                <Text variant="body">{t.name}</Text>
                {t.title || t.department ? (
                  <Text variant="caption" color={colors.textSecondary}>
                    {[t.title, t.department].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </Pressable>
            ))}
            <Pressable
              style={styles.addBtn}
              onPress={() => router.push('/(classes)/teacher/add' as never)}
            >
              <Text style={[styles.addBtnLabel, { color: ACCENT }]}>
                + Add teacher
              </Text>
            </Pressable>
          </Card>
        </Section>

        <Section title="Grading weights">
          <Card style={styles.card}>
            {state.weights.map((w, idx) => (
              <View key={idx} style={styles.row2}>
                <Field label="Category" style={{ flex: 1 }}>
                  <TextInput
                    value={w.category}
                    onChangeText={(v) => updateWeight(idx, { category: v })}
                    placeholder="Homework"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.input}
                  />
                </Field>
                <Field label="%" style={{ width: 90 }}>
                  <TextInput
                    value={w.value}
                    onChangeText={(v) => updateWeight(idx, { value: v.replace(/[^0-9.]/g, '') })}
                    keyboardType="decimal-pad"
                    placeholder="30"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.input}
                  />
                </Field>
                <Pressable
                  onPress={() => removeWeight(idx)}
                  style={styles.weightRemove}
                >
                  <Text style={styles.removeLink}>×</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addBtn} onPress={addWeight}>
              <Text style={[styles.addBtnLabel, { color: ACCENT }]}>
                + Add category
              </Text>
            </Pressable>
          </Card>
        </Section>

        <Section title="Syllabus notes">
          <Card style={styles.card}>
            <TextInput
              value={state.notesMd}
              onChangeText={(v) => set('notesMd', v)}
              placeholder="Markdown supported. Office hours, attendance policy, key dates."
              placeholderTextColor={colors.textTertiary}
              multiline
              style={[styles.input, styles.notesInput]}
            />
          </Card>
        </Section>

        <View style={[styles.section, styles.actions]}>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text
              style={[styles.primaryBtnLabel, { color: colors.background }]}
            >
              {saving ? 'Saving…' : 'Save changes'}
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
  errorScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  errorTitle: { textAlign: 'center' },
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
  notesInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  row2: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
  blockRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayPickerChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayPickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  removeLink: {
    color: '#FFB4AB',
    fontWeight: '700',
    fontSize: 13,
  },
  weightRemove: { paddingBottom: 12 },
  addBtn: { paddingVertical: spacing.sm, alignItems: 'flex-start' },
  addBtnLabel: { fontSize: 14, fontWeight: '700' },
  teacherChip: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: 2,
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
