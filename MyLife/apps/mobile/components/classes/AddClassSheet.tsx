import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@mylife/ui';
import {
  ALL_DAYS,
  CLASSES_PALETTE,
  DAY_LABELS,
  type ClassInput,
  type Day,
  type DayTime,
  type TeacherRow,
} from '@mylife/classes';

const DEFAULT_START = '09:00';
const DEFAULT_END = '10:15';

export interface AddClassSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: ClassInput) => void;
  closeOnSubmit?: boolean;
  semesterId: string;
  teachers: TeacherRow[];
  /** Quick-create a teacher inline; returns the new teacher id. */
  onCreateTeacher?: (name: string) => TeacherRow | null;
}

interface CategoryRow {
  key: string;
  weight: string;
}

interface FormState {
  name: string;
  code: string;
  section: string;
  credits: string;
  room: string;
  building: string;
  color: string;
  teacherId: string | null;
  teacherSearch: string;
  targetGrade: string;
  latePolicy: string;
  selectedDays: Set<Day>;
  startTime: string;
  endTime: string;
  categories: CategoryRow[];
}

function initialState(): FormState {
  return {
    name: '',
    code: '',
    section: '',
    credits: '3',
    room: '',
    building: '',
    color: CLASSES_PALETTE[0],
    teacherId: null,
    teacherSearch: '',
    targetGrade: '',
    latePolicy: '',
    selectedDays: new Set<Day>(['mon', 'wed']),
    startTime: DEFAULT_START,
    endTime: DEFAULT_END,
    categories: [
      { key: 'exams', weight: '40' },
      { key: 'homework', weight: '30' },
      { key: 'participation', weight: '20' },
      { key: 'final', weight: '10' },
    ],
  };
}

/**
 * Bottom-sheet modal for creating a class. Supports multi-day selection,
 * a single shared time block (use Edit Class later for per-day time
 * variation), inline teacher search/create, color picker, category weights,
 * and optional target grade + late policy notes.
 */
export function AddClassSheet({
  visible,
  onClose,
  onSubmit,
  closeOnSubmit = true,
  semesterId,
  teachers,
  onCreateTeacher,
}: AddClassSheetProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);

  const filteredTeachers = useMemo(() => {
    const q = form.teacherSearch.trim().toLowerCase();
    if (!q) return teachers.slice(0, 6);
    return teachers.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 6);
  }, [teachers, form.teacherSearch]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDay(day: Day) {
    setForm((prev) => {
      const next = new Set(prev.selectedDays);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return { ...prev, selectedDays: next };
    });
  }

  function setCategory(index: number, patch: Partial<CategoryRow>) {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.map((row, i) =>
        i === index ? { ...row, ...patch } : row,
      ),
    }));
  }

  function addCategory() {
    setForm((prev) => ({
      ...prev,
      categories: [...prev.categories, { key: '', weight: '' }],
    }));
  }

  function removeCategory(index: number) {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== index),
    }));
  }

  function quickCreateTeacher() {
    const name = form.teacherSearch.trim();
    if (!name || !onCreateTeacher) return;
    const created = onCreateTeacher(name);
    if (created) {
      setForm((prev) => ({
        ...prev,
        teacherId: created.id,
        teacherSearch: created.name,
      }));
    }
  }

  function close() {
    setForm(initialState());
    setError(null);
    onClose();
  }

  function submit() {
    const name = form.name.trim();
    if (!name) {
      setError('Class name is required');
      return;
    }
    if (form.startTime >= form.endTime) {
      setError('End time must be after start time');
      return;
    }
    const days = Array.from(form.selectedDays);
    const day_times: DayTime[] = days.map((day) => ({
      day,
      start_time: form.startTime,
      end_time: form.endTime,
    }));

    const weights: Record<string, number> = {};
    for (const row of form.categories) {
      const key = row.key.trim();
      const weight = Number(row.weight);
      if (!key || !Number.isFinite(weight)) continue;
      weights[key] = weight;
    }
    const credits = Number(form.credits);

    const notes = form.latePolicy.trim()
      ? `Late policy: ${form.latePolicy.trim()}`
      : null;

    const input: ClassInput = {
      semester_id: semesterId,
      name,
      code: form.code.trim() || null,
      section: form.section.trim() || null,
      credits: Number.isFinite(credits) ? credits : 3,
      day_times,
      room: form.room.trim() || null,
      building: form.building.trim() || null,
      teacher_id: form.teacherId,
      category_weights: Object.keys(weights).length > 0 ? weights : null,
      target_grade: form.targetGrade.trim()
        ? Number(form.targetGrade)
        : null,
      color: form.color,
      notes_md: notes,
    };
    onSubmit(input);
    if (closeOnSubmit) {
      close();
    }
  }

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={close}
    >
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Add Class</Text>
            <Pressable onPress={close} accessibilityLabel="Close">
              <Text style={styles.closeText}>Cancel</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Field label="Name">
              <TextInput
                value={form.name}
                onChangeText={(v) => update('name', v)}
                placeholder="Intro to Computer Science"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
            </Field>

            <View style={styles.row}>
              <Field label="Code" flex>
                <TextInput
                  value={form.code}
                  onChangeText={(v) => update('code', v)}
                  placeholder="CS 101"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                />
              </Field>
              <Field label="Section" flex>
                <TextInput
                  value={form.section}
                  onChangeText={(v) => update('section', v)}
                  placeholder="001"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                />
              </Field>
              <Field label="Credits" flex>
                <TextInput
                  value={form.credits}
                  onChangeText={(v) => update('credits', v)}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </Field>
            </View>

            <Field label="Days">
              <View style={styles.dayRow}>
                {ALL_DAYS.map((day) => {
                  const active = form.selectedDays.has(day);
                  return (
                    <Pressable
                      key={day}
                      onPress={() => toggleDay(day)}
                      style={[
                        styles.dayChip,
                        active && styles.dayChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          active && styles.dayTextActive,
                        ]}
                      >
                        {DAY_LABELS[day][0]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <View style={styles.row}>
              <Field label="Start (HH:MM)" flex>
                <TextInput
                  value={form.startTime}
                  onChangeText={(v) => update('startTime', v)}
                  placeholder="09:00"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                />
              </Field>
              <Field label="End (HH:MM)" flex>
                <TextInput
                  value={form.endTime}
                  onChangeText={(v) => update('endTime', v)}
                  placeholder="10:15"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                />
              </Field>
            </View>

            <View style={styles.row}>
              <Field label="Room" flex>
                <TextInput
                  value={form.room}
                  onChangeText={(v) => update('room', v)}
                  placeholder="210"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                />
              </Field>
              <Field label="Building" flex>
                <TextInput
                  value={form.building}
                  onChangeText={(v) => update('building', v)}
                  placeholder="Hall A"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                />
              </Field>
            </View>

            <Field label="Teacher">
              <TextInput
                value={form.teacherSearch}
                onChangeText={(v) => {
                  update('teacherSearch', v);
                  update('teacherId', null);
                }}
                placeholder="Search or add a teacher"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
              <View style={styles.teacherList}>
                {filteredTeachers.map((t) => {
                  const selected = form.teacherId === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        update('teacherId', t.id);
                        update('teacherSearch', t.name);
                      }}
                      style={[
                        styles.teacherChip,
                        selected && styles.teacherChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.teacherText,
                          selected && styles.teacherTextActive,
                        ]}
                      >
                        {t.name}
                      </Text>
                    </Pressable>
                  );
                })}
                {form.teacherSearch.trim() &&
                !filteredTeachers.some(
                  (t) =>
                    t.name.toLowerCase() ===
                    form.teacherSearch.trim().toLowerCase(),
                ) ? (
                  <Pressable
                    style={[styles.teacherChip, styles.teacherChipNew]}
                    onPress={quickCreateTeacher}
                  >
                    <Text style={styles.teacherTextActive}>
                      + Add "{form.teacherSearch.trim()}"
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Field>

            <Field label="Color">
              <View style={styles.colorRow}>
                {CLASSES_PALETTE.map((hex) => {
                  const active = form.color === hex;
                  return (
                    <Pressable
                      key={hex}
                      onPress={() => update('color', hex)}
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: hex },
                        active && styles.colorSwatchActive,
                      ]}
                      accessibilityLabel={`Color ${hex}`}
                    />
                  );
                })}
              </View>
            </Field>

            <Field label="Grading categories">
              {form.categories.map((row, idx) => (
                <View key={idx} style={styles.catRow}>
                  <TextInput
                    value={row.key}
                    onChangeText={(v) => setCategory(idx, { key: v })}
                    placeholder="exams"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, styles.catKey]}
                  />
                  <TextInput
                    value={row.weight}
                    onChangeText={(v) => setCategory(idx, { weight: v })}
                    placeholder="40"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                    style={[styles.input, styles.catWeight]}
                  />
                  <Pressable
                    onPress={() => removeCategory(idx)}
                    style={styles.catRemove}
                  >
                    <Text style={styles.catRemoveText}>x</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={addCategory} style={styles.addCatButton}>
                <Text style={styles.addCatText}>+ Add category</Text>
              </Pressable>
            </Field>

            <View style={styles.row}>
              <Field label="Target grade (optional)" flex>
                <TextInput
                  value={form.targetGrade}
                  onChangeText={(v) => update('targetGrade', v)}
                  placeholder="93"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </Field>
              <Field label="Late policy (optional)" flex>
                <TextInput
                  value={form.latePolicy}
                  onChangeText={(v) => update('latePolicy', v)}
                  placeholder="-10% per day"
                  placeholderTextColor={colors.textTertiary}
                  style={styles.input}
                />
              </Field>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable onPress={close} style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} style={styles.primaryAction}>
              <Text style={styles.primaryActionText}>Save Class</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  children,
  flex,
}: {
  label: string;
  children: React.ReactNode;
  flex?: boolean;
}) {
  return (
    <View style={[styles.field, flex && { flex: 1 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    minHeight: '70%',
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  closeText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: {
    backgroundColor: 'rgba(59,130,246,0.22)',
    borderColor: 'rgba(59,130,246,0.55)',
  },
  dayText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  dayTextActive: {
    color: colors.modules.classes,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: colors.text,
  },
  catRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  catKey: {
    flex: 2,
  },
  catWeight: {
    flex: 1,
  },
  catRemove: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  catRemoveText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  addCatButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  addCatText: {
    color: colors.modules.classes,
    fontWeight: '700',
    fontSize: 13,
  },
  teacherList: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  teacherChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  teacherChipActive: {
    backgroundColor: 'rgba(59,130,246,0.22)',
    borderColor: 'rgba(59,130,246,0.55)',
  },
  teacherChipNew: {
    borderStyle: 'dashed',
    borderColor: 'rgba(59,130,246,0.55)',
  },
  teacherText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  teacherTextActive: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryAction: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: colors.text,
    fontWeight: '600',
  },
  primaryAction: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.modules.classes,
    alignItems: 'center',
  },
  primaryActionText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 15,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});
