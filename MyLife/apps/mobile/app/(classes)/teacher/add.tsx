import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { TeacherInputSchema, createTeacher } from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

const ACCENT = colors.modules.classes;

interface OfficeHourDraft {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  start_time: string;
  end_time: string;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export default function TeacherAddScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [officeLocation, setOfficeLocation] = useState('');
  const [teachingStyle, setTeachingStyle] = useState('');
  const [gradingNotes, setGradingNotes] = useState('');
  const [recPotential, setRecPotential] = useState(0);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState('');
  const [officeHours, setOfficeHours] = useState<OfficeHourDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Teacher name cannot be empty.');
      return;
    }
    const parsed = TeacherInputSchema.safeParse({
      name: name.trim(),
      title: title.trim() || null,
      department: department.trim() || null,
      email: email.trim() || null,
      office_location: officeLocation.trim() || null,
      office_hours: officeHours.length > 0 ? officeHours : null,
      teaching_style_notes: teachingStyle.trim() || null,
      grading_notes: gradingNotes.trim() || null,
      rec_potential: recPotential > 0 ? recPotential : null,
      rating: rating > 0 ? rating : null,
      notes_md: notes.trim() || null,
    });
    if (!parsed.success) {
      Alert.alert('Invalid input', parsed.error.issues[0]?.message ?? 'Check fields.');
      return;
    }
    setSaving(true);
    try {
      createTeacher(db, uuid(), parsed.data);
      router.back();
    } catch (err) {
      Alert.alert('Save failed', String(err));
      setSaving(false);
    }
  }, [
    db,
    name,
    title,
    department,
    email,
    officeLocation,
    officeHours,
    teachingStyle,
    gradingNotes,
    recPotential,
    rating,
    notes,
    router,
  ]);

  const updateHour = (idx: number, patch: Partial<OfficeHourDraft>) => {
    setOfficeHours((arr) =>
      arr.map((h, i) => (i === idx ? { ...h, ...patch } : h)),
    );
  };

  const removeHour = (idx: number) => {
    setOfficeHours((arr) => arr.filter((_, i) => i !== idx));
  };

  const addHour = () => {
    setOfficeHours((arr) => [
      ...arr,
      { day: 'mon', start_time: '14:00', end_time: '15:00' },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add teacher',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Section title="Identity">
          <Card style={styles.card}>
            <Field label="Name">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Dr. Adelaide Marlowe"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
            </Field>
            <Field label="Title">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Associate Professor"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
            </Field>
            <Field label="Department">
              <TextInput
                value={department}
                onChangeText={setDepartment}
                placeholder="Mathematics"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
            </Field>
            <Field label="Email">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="marlowe@university.edu"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
            </Field>
          </Card>
        </Section>

        <Section title="Office">
          <Card style={styles.card}>
            <Field label="Location">
              <TextInput
                value={officeLocation}
                onChangeText={setOfficeLocation}
                placeholder="Math Hall 312"
                placeholderTextColor={colors.textTertiary}
                style={styles.input}
              />
            </Field>
            {officeHours.map((h, idx) => (
              <View key={idx} style={styles.hourRow}>
                <View style={styles.dayPickerRow}>
                  {DAYS.map((day) => (
                    <Pressable
                      key={day}
                      onPress={() => updateHour(idx, { day })}
                      style={[
                        styles.dayChip,
                        h.day === day && {
                          backgroundColor: ACCENT,
                          borderColor: ACCENT,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayChipLabel,
                          h.day === day && { color: colors.background },
                        ]}
                      >
                        {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.row2}>
                  <Field label="Start" style={{ flex: 1 }}>
                    <TextInput
                      value={h.start_time}
                      onChangeText={(v) => updateHour(idx, { start_time: v })}
                      placeholder="14:00"
                      placeholderTextColor={colors.textTertiary}
                      style={styles.input}
                    />
                  </Field>
                  <Field label="End" style={{ flex: 1 }}>
                    <TextInput
                      value={h.end_time}
                      onChangeText={(v) => updateHour(idx, { end_time: v })}
                      placeholder="15:00"
                      placeholderTextColor={colors.textTertiary}
                      style={styles.input}
                    />
                  </Field>
                </View>
                <Pressable onPress={() => removeHour(idx)}>
                  <Text style={styles.removeLink}>Remove</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addBtn} onPress={addHour}>
              <Text style={[styles.addBtnLabel, { color: ACCENT }]}>
                + Add office hour block
              </Text>
            </Pressable>
          </Card>
        </Section>

        <Section title="Ratings">
          <Card style={styles.card}>
            <RatingRow
              label="Recommendation potential"
              value={recPotential}
              onChange={setRecPotential}
            />
            <RatingRow
              label="Personal rating"
              value={rating}
              onChange={setRating}
            />
            <Text variant="caption" color={colors.textSecondary}>
              Personal rating is private and never shared.
            </Text>
          </Card>
        </Section>

        <Section title="Teaching style notes">
          <Card style={styles.card}>
            <TextInput
              value={teachingStyle}
              onChangeText={setTeachingStyle}
              placeholder="Lecture-heavy with weekly problem sets…"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={[styles.input, styles.notesInput]}
            />
          </Card>
        </Section>

        <Section title="Grading personality">
          <Card style={styles.card}>
            <TextInput
              value={gradingNotes}
              onChangeText={setGradingNotes}
              placeholder="Strict on labs, generous on participation…"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={[styles.input, styles.notesInput]}
            />
          </Card>
        </Section>

        <Section title="Private notes">
          <Card style={styles.card}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Markdown supported."
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
              {saving ? 'Saving…' : 'Save teacher'}
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

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.ratingRow}>
      <Text variant="body" color={colors.textSecondary}>
        {label}
      </Text>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => onChange(n === value ? 0 : n)}>
            <Text style={[styles.star, n <= value && { color: '#FFB877' }]}>
              {n <= value ? '★' : '☆'}
            </Text>
          </Pressable>
        ))}
      </View>
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
  row2: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  hourRow: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  removeLink: { color: '#FFB4AB', fontWeight: '700', fontSize: 13 },
  addBtn: { paddingVertical: spacing.sm, alignItems: 'flex-start' },
  addBtnLabel: { fontSize: 14, fontWeight: '700' },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  starRow: { flexDirection: 'row', gap: 4 },
  star: { fontSize: 22, color: colors.textTertiary, letterSpacing: 1 },
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
