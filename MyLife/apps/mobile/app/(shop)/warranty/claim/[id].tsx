import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fileClaim, getWarrantyById, type Warranty } from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../../_ui';

type Outcome = 'pending' | 'approved' | 'denied' | 'repaired' | 'replaced';

const OUTCOMES: Outcome[] = [
  'pending',
  'approved',
  'denied',
  'repaired',
  'replaced',
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FileClaimScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [claimDate, setClaimDate] = useState(todayIso());
  const [description, setDescription] = useState('');
  const [outcome, setOutcome] = useState<Outcome>('pending');

  const warranty = useMemo<Warranty | null>(() => {
    if (!id) return null;
    try {
      return getWarrantyById(db, id);
    } catch {
      return null;
    }
  }, [db, id]);

  if (!warranty) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Warranty not found</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const canSave = description.trim().length > 0;

  const handleSubmit = () => {
    if (!canSave) {
      Alert.alert('Required', 'Enter a description of the issue.');
      return;
    }
    const notes = [
      `Filed ${claimDate}`,
      `Outcome: ${outcome}`,
      '',
      description.trim(),
    ].join('\n');
    try {
      fileClaim(db, warranty.id, { notes });
      router.replace(`/(shop)/warranty/${warranty.id}`);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not file claim.',
      );
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>File a claim</Text>
        <Text style={styles.title}>{warranty.itemName}</Text>
        <Text style={styles.subtitle}>
          Record the claim locally. This marks the warranty as claimed and saves
          your notes so future-you has the full history.
        </Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>Claim date</Text>
        <TextInput
          style={styles.input}
          value={claimDate}
          onChangeText={setClaimDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSecondary}
        />

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={description}
          onChangeText={setDescription}
          placeholder="Screen cracked after drop. Contacted support on..."
          placeholderTextColor={colors.textSecondary}
          multiline
          autoFocus
        />

        <Text style={styles.label}>Outcome</Text>
        <View style={styles.pillRow}>
          {OUTCOMES.map((o) => (
            <Pressable
              key={o}
              style={[styles.pill, outcome === o && styles.pillActive]}
              onPress={() => setOutcome(o)}
            >
              <Text
                style={[
                  styles.pillText,
                  outcome === o && styles.pillTextActive,
                ]}
              >
                {o}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.navRow}>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSave}
        >
          <Text style={styles.primaryButtonText}>Submit claim</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 180,
    gap: 14,
  },
  header: {
    gap: 6,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SHOP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  input: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  inputMulti: { minHeight: 130, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: SHOP_ACCENT, borderColor: SHOP_ACCENT },
  pillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  pillTextActive: { color: '#0E0E13' },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  primaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
