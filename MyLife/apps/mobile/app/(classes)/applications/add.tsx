import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import { createApplication, type ApplicationStatus, type ApplicationType } from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import { CLASSES_ACCENT, CLASSES_ACCENT_BORDER, CLASSES_ACCENT_DIM } from '../_ui';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  APPLICATION_TYPES,
  APPLICATION_TYPE_LABEL,
} from './_ui';

export default function AddApplicationScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [program, setProgram] = useState('');
  const [type, setType] = useState<ApplicationType>('undergrad');
  const [status, setStatus] = useState<ApplicationStatus>('considering');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give the application a name.');
      return;
    }
    setSaving(true);
    try {
      createApplication(db, uuid(), {
        name: name.trim(),
        institution: institution.trim() || null,
        program: program.trim() || null,
        type,
        status,
        deadline: deadline.trim() || null,
      });
      router.replace('/(classes)/applications');
    } catch (err) {
      Alert.alert('Could not save', String(err));
      setSaving(false);
    }
  }, [db, name, institution, program, type, status, deadline, router]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Stanford CS PhD"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />

      <Text style={styles.label}>Institution</Text>
      <TextInput
        value={institution}
        onChangeText={setInstitution}
        placeholder="Stanford University"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />

      <Text style={styles.label}>Program</Text>
      <TextInput
        value={program}
        onChangeText={setProgram}
        placeholder="Computer Science PhD"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />

      <Text style={styles.label}>Type</Text>
      <View style={styles.chipRow}>
        {APPLICATION_TYPES.map((t) => {
          const active = t === type;
          return (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {APPLICATION_TYPE_LABEL[t]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Status</Text>
      <View style={styles.chipRow}>
        {APPLICATION_STATUSES.map((s) => {
          const active = s === status;
          return (
            <Pressable
              key={s}
              onPress={() => setStatus(s)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {APPLICATION_STATUS_LABEL[s]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Deadline (YYYY-MM-DD)</Text>
      <TextInput
        value={deadline}
        onChangeText={setDeadline}
        placeholder="2026-01-15"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        autoCapitalize="none"
      />

      <Pressable
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={onSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnLabel}>{saving ? 'Saving…' : 'Save application'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl * 2,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  input: {
    color: colors.text,
    fontSize: 16,
    backgroundColor: CLASSES_ACCENT_DIM,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: CLASSES_ACCENT_DIM,
    borderColor: CLASSES_ACCENT,
  },
  chipLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: CLASSES_ACCENT,
  },
  saveBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    backgroundColor: CLASSES_ACCENT,
    alignItems: 'center',
  },
  saveBtnLabel: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
