import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  createLoyaltyProgram,
  LoyaltyProgramInputSchema,
  type LoyaltyProgramInput,
  type LoyaltyType,
} from '@mylife/travel';
import { useDatabase } from '../../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from '../_ui';

const TYPES: LoyaltyType[] = ['airline', 'hotel', 'car'];

export function LoyaltyAddForm({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const db = useDatabase();
  const [type, setType] = useState<LoyaltyType>('airline');
  const [provider, setProvider] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const [statusTier, setStatusTier] = useState('');
  const [points, setPoints] = useState('');
  const [miles, setMiles] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setType('airline');
    setProvider('');
    setMemberNumber('');
    setStatusTier('');
    setPoints('');
    setMiles('');
    setExpiryDate('');
    setError(null);
  }

  function handleSave() {
    setSaving(true);
    try {
      const candidate: LoyaltyProgramInput = {
        type,
        provider: provider.trim(),
        member_number: memberNumber.trim() || undefined,
        status_tier: statusTier.trim() || undefined,
        points_balance: points ? Number(points) : undefined,
        miles_balance: miles ? Number(miles) : undefined,
        expiry_date: expiryDate.trim() || undefined,
      };
      const parsed = LoyaltyProgramInputSchema.safeParse(candidate);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Invalid program.');
        setSaving(false);
        return;
      }
      createLoyaltyProgram(db, parsed.data);
      reset();
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add loyalty program</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Type</Text>
            <View style={styles.chipRow}>
              {TYPES.map((t) => {
                const selected = type === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={[styles.chip, selected && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipText, selected && styles.chipTextActive]}
                    >
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Provider</Text>
            <TextInput
              style={styles.input}
              placeholder="United, Marriott, Hertz..."
              placeholderTextColor="#9F8E81"
              value={provider}
              onChangeText={setProvider}
            />

            <Text style={styles.label}>Member number</Text>
            <TextInput
              style={styles.input}
              placeholder="optional"
              placeholderTextColor="#9F8E81"
              value={memberNumber}
              onChangeText={setMemberNumber}
            />

            <Text style={styles.label}>Status tier</Text>
            <TextInput
              style={styles.input}
              placeholder="Gold, Platinum..."
              placeholderTextColor="#9F8E81"
              value={statusTier}
              onChangeText={setStatusTier}
            />

            <View style={styles.row2}>
              <View style={styles.col}>
                <Text style={styles.label}>Points</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#9F8E81"
                  value={points}
                  onChangeText={setPoints}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Miles</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#9F8E81"
                  value={miles}
                  onChangeText={setMiles}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={styles.label}>Expiry date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD (optional)"
              placeholderTextColor="#9F8E81"
              value={expiryDate}
              onChangeText={setExpiryDate}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.save, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveText}>
                {saving ? 'Saving...' : 'Save program'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: surfaceTiers.container,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  close: { color: TRAVEL_ACCENT, fontSize: 15, fontWeight: '600' },
  body: { padding: 20, gap: 12, paddingBottom: 40 },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  input: {
    backgroundColor: surfaceTiers.low,
    color: colors.text,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: surfaceTiers.low,
  },
  chipActive: {
    backgroundColor: 'rgba(14,165,233,0.2)',
    borderColor: TRAVEL_ACCENT,
  },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: TRAVEL_ACCENT },
  row2: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  error: { color: '#FFB4AB', fontSize: 13, marginTop: 4 },
  save: {
    marginTop: 16,
    backgroundColor: TRAVEL_ACCENT,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveText: { color: '#0E0E13', fontWeight: '800', fontSize: 15 },
});
