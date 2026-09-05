import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  getApplication,
  updateApplication,
  type ApplicationStatus,
  type ApplicationType,
} from '@mylife/classes';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { CLASSES_ACCENT, CLASSES_ACCENT_BORDER, CLASSES_ACCENT_DIM } from '../../_ui';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  APPLICATION_TYPES,
  APPLICATION_TYPE_LABEL,
} from '../_ui';

export default function EditApplicationScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [program, setProgram] = useState('');
  const [type, setType] = useState<ApplicationType>('undergrad');
  const [status, setStatus] = useState<ApplicationStatus>('considering');
  const [deadline, setDeadline] = useState('');
  const [requiredEssays, setRequiredEssays] = useState('0');
  const [essaysDrafted, setEssaysDrafted] = useState('0');
  const [essaysFinalized, setEssaysFinalized] = useState('0');
  const [recRequired, setRecRequired] = useState('0');
  const [recConfirmed, setRecConfirmed] = useState('0');
  const [transcriptsRequested, setTranscriptsRequested] = useState(false);
  const [transcriptsSent, setTranscriptsSent] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const app = getApplication(db, id);
    if (!app) {
      Alert.alert('Not found', 'This application does not exist.');
      router.replace('/(classes)/applications');
      return;
    }
    setName(app.name);
    setInstitution(app.institution ?? '');
    setProgram(app.program ?? '');
    setType(app.type);
    setStatus(app.status);
    setDeadline(app.deadline ?? '');
    setRequiredEssays(String(app.required_essays_count));
    setEssaysDrafted(String(app.essays_drafted));
    setEssaysFinalized(String(app.essays_finalized));
    setRecRequired(String(app.recommenders_required));
    setRecConfirmed(String(app.recommenders_confirmed));
    setTranscriptsRequested(Boolean(app.transcripts_requested));
    setTranscriptsSent(Boolean(app.transcripts_sent));
    setLoaded(true);
  }, [db, id, router]);

  const onSave = useCallback(() => {
    if (!id) return;
    if (!name.trim()) {
      Alert.alert('Name required');
      return;
    }
    setSaving(true);
    try {
      updateApplication(db, id, {
        name: name.trim(),
        institution: institution.trim() || null,
        program: program.trim() || null,
        type,
        status,
        deadline: deadline.trim() || null,
        required_essays_count: parseIntOr(requiredEssays, 0),
        essays_drafted: parseIntOr(essaysDrafted, 0),
        essays_finalized: parseIntOr(essaysFinalized, 0),
        recommenders_required: parseIntOr(recRequired, 0),
        recommenders_confirmed: parseIntOr(recConfirmed, 0),
        transcripts_requested: transcriptsRequested,
        transcripts_sent: transcriptsSent,
      });
      router.replace(`/(classes)/applications/${id}`);
    } catch (err) {
      Alert.alert('Could not save', String(err));
      setSaving(false);
    }
  }, [
    db,
    id,
    name,
    institution,
    program,
    type,
    status,
    deadline,
    requiredEssays,
    essaysDrafted,
    essaysFinalized,
    recRequired,
    recConfirmed,
    transcriptsRequested,
    transcriptsSent,
    router,
  ]);

  if (!loaded) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={styles.label}>Name</Text>
      <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor={colors.textSecondary} />

      <Text style={styles.label}>Institution</Text>
      <TextInput value={institution} onChangeText={setInstitution} style={styles.input} placeholderTextColor={colors.textSecondary} />

      <Text style={styles.label}>Program</Text>
      <TextInput value={program} onChangeText={setProgram} style={styles.input} placeholderTextColor={colors.textSecondary} />

      <Text style={styles.label}>Type</Text>
      <View style={styles.chipRow}>
        {APPLICATION_TYPES.map((t) => {
          const active = t === type;
          return (
            <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{APPLICATION_TYPE_LABEL[t]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Status</Text>
      <View style={styles.chipRow}>
        {APPLICATION_STATUSES.map((s) => {
          const active = s === status;
          return (
            <Pressable key={s} onPress={() => setStatus(s)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{APPLICATION_STATUS_LABEL[s]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Deadline (YYYY-MM-DD)</Text>
      <TextInput value={deadline} onChangeText={setDeadline} style={styles.input} placeholderTextColor={colors.textSecondary} autoCapitalize="none" />

      <Text style={styles.label}>Essays required / drafted / finalized</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <NumberInput value={requiredEssays} onChange={setRequiredEssays} />
        <NumberInput value={essaysDrafted} onChange={setEssaysDrafted} />
        <NumberInput value={essaysFinalized} onChange={setEssaysFinalized} />
      </View>

      <Text style={styles.label}>Recommenders required / confirmed</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <NumberInput value={recRequired} onChange={setRecRequired} />
        <NumberInput value={recConfirmed} onChange={setRecConfirmed} />
      </View>

      <Text style={styles.label}>Transcripts</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <ToggleChip
          label="Requested"
          active={transcriptsRequested}
          onPress={() => setTranscriptsRequested((v) => !v)}
        />
        <ToggleChip
          label="Sent"
          active={transcriptsSent}
          onPress={() => setTranscriptsSent((v) => !v)}
        />
      </View>

      <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
        <Text style={styles.saveBtnLabel}>{saving ? 'Saving…' : 'Save changes'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function NumberInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType="number-pad"
      style={[styles.input, { flex: 1, textAlign: 'center' }]}
      placeholderTextColor={colors.textSecondary}
    />
  );
}

function ToggleChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function parseIntOr(s: string, fallback: number): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: CLASSES_ACCENT_BORDER,
  },
  chipActive: { backgroundColor: CLASSES_ACCENT_DIM, borderColor: CLASSES_ACCENT },
  chipLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipLabelActive: { color: CLASSES_ACCENT },
  saveBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.pill,
    backgroundColor: CLASSES_ACCENT,
    alignItems: 'center',
  },
  saveBtnLabel: { color: colors.background, fontSize: 14, fontWeight: '800', letterSpacing: 0.4 },
});
