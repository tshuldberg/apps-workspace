import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import {
  createStandardizedTest,
  type StandardizedTestCategory,
  type StandardizedTestStatus,
} from '@mylife/classes';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import { CLASSES_ACCENT, CLASSES_ACCENT_BORDER, CLASSES_ACCENT_DIM } from '../_ui';
import {
  TEST_CATEGORIES,
  TEST_CATEGORY_LABEL,
  TEST_STATUSES,
  TEST_STATUS_LABEL,
} from './_ui';

export default function AddTestScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<StandardizedTestCategory>('undergrad');
  const [status, setStatus] = useState<StandardizedTestStatus>('planned');
  const [testDate, setTestDate] = useState('');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [superscoreEligible, setSuperscoreEligible] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSave = useCallback(() => {
    if (!name.trim()) {
      Alert.alert('Name required');
      return;
    }
    setSaving(true);
    try {
      createStandardizedTest(db, uuid(), {
        name: name.trim(),
        category,
        status,
        test_date: testDate.trim() || null,
        score: parseFloatOrNull(score),
        max_score: parseFloatOrNull(maxScore),
        superscore_eligible: superscoreEligible,
      });
      router.replace('/(classes)/tests');
    } catch (err) {
      Alert.alert('Could not save', String(err));
      setSaving(false);
    }
  }, [db, name, category, status, testDate, score, maxScore, superscoreEligible, router]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={styles.label}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="SAT, GRE, AP Calc BC, etc."
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {TEST_CATEGORIES.map((c) => {
          const active = c === category;
          return (
            <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {TEST_CATEGORY_LABEL[c]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Status</Text>
      <View style={styles.chipRow}>
        {TEST_STATUSES.map((s) => {
          const active = s === status;
          return (
            <Pressable key={s} onPress={() => setStatus(s)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {TEST_STATUS_LABEL[s]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Test date (YYYY-MM-DD)</Text>
      <TextInput
        value={testDate}
        onChangeText={setTestDate}
        placeholder="2026-03-12"
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Score / Max score</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TextInput
          value={score}
          onChangeText={setScore}
          placeholder="1480"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { flex: 1 }]}
          keyboardType="numeric"
        />
        <TextInput
          value={maxScore}
          onChangeText={setMaxScore}
          placeholder="1600"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { flex: 1 }]}
          keyboardType="numeric"
        />
      </View>

      <Pressable
        onPress={() => setSuperscoreEligible((v) => !v)}
        style={[styles.chip, superscoreEligible && styles.chipActive, { alignSelf: 'flex-start', marginTop: spacing.sm }]}
      >
        <Text style={[styles.chipLabel, superscoreEligible && styles.chipLabelActive]}>
          {superscoreEligible ? 'Superscore eligible: yes' : 'Superscore eligible: no'}
        </Text>
      </Pressable>

      <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
        <Text style={styles.saveBtnLabel}>{saving ? 'Saving…' : 'Save test'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function parseFloatOrNull(s: string): number | null {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
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
