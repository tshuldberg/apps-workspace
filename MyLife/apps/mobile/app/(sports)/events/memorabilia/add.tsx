import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  createMemorabilia,
  getMemorabilia,
  updateMemorabilia,
  type Memorabilia,
  type MemorabiliaType,
} from '@mylife/sports';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../../_ui';

const ITEM_TYPES: { id: MemorabiliaType; label: string }[] = [
  { id: 'card', label: 'Card' },
  { id: 'jersey', label: 'Jersey' },
  { id: 'signed', label: 'Signed' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'ball', label: 'Ball' },
  { id: 'hat', label: 'Hat' },
  { id: 'other', label: 'Other' },
];

function parseDollarsToCents(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export default function AddMemorabiliaScreen() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{ editId?: string }>();
  const editId = typeof params.editId === 'string' ? params.editId : undefined;

  const existing = useMemo<Memorabilia | null>(() => {
    if (!editId) return null;
    return getMemorabilia(db, editId);
  }, [db, editId]);

  const [itemType, setItemType] = useState<MemorabiliaType>(
    existing?.item_type ?? 'card',
  );
  const [description, setDescription] = useState<string>(
    existing?.description ?? '',
  );
  const [sport, setSport] = useState<string>(existing?.sport ?? '');
  const [team, setTeam] = useState<string>(existing?.team ?? '');
  const [player, setPlayer] = useState<string>(existing?.player ?? '');
  const [acquiredAt, setAcquiredAt] = useState<number | null>(
    existing?.acquired_at ?? null,
  );
  const [purchase, setPurchase] = useState<string>(
    existing && existing.purchase_price_cents > 0
      ? (existing.purchase_price_cents / 100).toFixed(2)
      : '',
  );
  const [estimated, setEstimated] = useState<string>(
    existing && existing.estimated_value_cents > 0
      ? (existing.estimated_value_cents / 100).toFixed(2)
      : '',
  );
  const [notes, setNotes] = useState<string>(existing?.notes_md ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    setError(null);
    if (description.trim() === '') {
      setError('Description is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        item_type: itemType,
        description: description.trim(),
        sport: sport.trim() === '' ? null : sport.trim(),
        team: team.trim() === '' ? null : team.trim(),
        player: player.trim() === '' ? null : player.trim(),
        acquired_at: acquiredAt,
        purchase_price_cents: parseDollarsToCents(purchase),
        estimated_value_cents: parseDollarsToCents(estimated),
        notes_md: notes.trim() === '' ? null : notes.trim(),
      };

      if (editId && existing) {
        updateMemorabilia(db, editId, payload);
        router.replace(`/(sports)/events/memorabilia/${editId}` as never);
        return;
      }

      const saved = createMemorabilia(db, payload);
      router.replace(`/(sports)/events/memorabilia/${saved.id}` as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }, [
    acquiredAt,
    db,
    description,
    editId,
    estimated,
    existing,
    itemType,
    notes,
    player,
    purchase,
    router,
    sport,
    team,
  ]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>
          {editId ? 'Edit item' : 'Add item'}
        </Text>
        <Text style={styles.title}>
          {editId ? 'Update memorabilia' : 'New memorabilia'}
        </Text>

        <Text style={styles.label}>Type</Text>
        <View style={styles.wrapRow}>
          {ITEM_TYPES.map((t) => {
            const active = itemType === t.id;
            return (
              <Pressable
                key={t.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setItemType(t.id)}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Description *</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. 2023 Topps Chrome Mookie Betts"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Sport (optional)</Text>
        <TextInput
          value={sport}
          onChangeText={setSport}
          placeholder="MLB, NFL, NBA…"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Team (optional)</Text>
        <TextInput
          value={team}
          onChangeText={setTeam}
          placeholder="Dodgers, 49ers…"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Player (optional)</Text>
        <TextInput
          value={player}
          onChangeText={setPlayer}
          placeholder="Mookie Betts"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Acquired at (optional)</Text>
        <View style={styles.rowInline}>
          <Text style={styles.playedText}>
            {acquiredAt
              ? new Date(acquiredAt).toLocaleDateString()
              : 'Not set'}
          </Text>
          <Pressable
            onPress={() => setAcquiredAt(Date.now())}
            style={styles.nowBtn}
          >
            <Text style={styles.nowBtnText}>Today</Text>
          </Pressable>
          {acquiredAt !== null ? (
            <Pressable
              onPress={() => setAcquiredAt(null)}
              style={styles.ghostBtn}
            >
              <Text style={styles.ghostBtnText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.label}>Purchase price (USD, optional)</Text>
        <TextInput
          value={purchase}
          onChangeText={setPurchase}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Estimated value (USD, optional)</Text>
        <TextInput
          value={estimated}
          onChangeText={setEstimated}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
          placeholder="Grade, serial number, story behind it…"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, styles.notesInput]}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.footer}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryBtn, saving && styles.primaryBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>
              {saving ? 'Saving…' : editId ? 'Save changes' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { padding: 20, paddingBottom: 180, gap: 10 },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  input: {
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  notesInput: { minHeight: 100 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rowInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: SPORTS_ACCENT,
    borderColor: SPORTS_ACCENT,
  },
  chipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: { color: '#0E0E13' },
  playedText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  nowBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SPORTS_ACCENT,
  },
  nowBtnText: { color: SPORTS_ACCENT, fontWeight: '700', fontSize: 13 },
  ghostBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ghostBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: { color: '#F87171', fontSize: 13, marginTop: 6 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: SPORTS_ACCENT,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
