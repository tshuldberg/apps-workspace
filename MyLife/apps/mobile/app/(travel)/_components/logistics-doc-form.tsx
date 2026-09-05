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
  createDocument,
  DocumentInputSchema,
  type DocumentInput,
  type DocumentType,
} from '@mylife/travel';
import { useDatabase } from '../../../components/DatabaseProvider';
import { TRAVEL_ACCENT } from '../_ui';

const TYPES: DocumentType[] = [
  'passport',
  'visa',
  'insurance',
  'vaccination',
  'membership',
  'other',
];

export function DocAddForm({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const db = useDatabase();
  const [type, setType] = useState<DocumentType>('passport');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [country, setCountry] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [reminderDays, setReminderDays] = useState('90');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setType('passport');
    setName('');
    setNumber('');
    setCountry('');
    setIssueDate('');
    setExpiryDate('');
    setReminderDays('90');
    setError(null);
  }

  function handleSave() {
    setSaving(true);
    try {
      const candidate: DocumentInput = {
        type,
        name: name.trim(),
        number: number.trim() || undefined,
        country: country.trim() || undefined,
        issue_date: issueDate.trim() || undefined,
        expiry_date: expiryDate.trim() || undefined,
        renewal_reminder_days: reminderDays
          ? Number(reminderDays)
          : undefined,
      };
      const parsed = DocumentInputSchema.safeParse(candidate);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Invalid document.');
        setSaving(false);
        return;
      }
      createDocument(db, parsed.data);
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
            <Text style={styles.title}>Add document</Text>
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

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="My passport"
              placeholderTextColor="#9F8E81"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Number</Text>
            <TextInput
              style={styles.input}
              placeholder="optional"
              placeholderTextColor="#9F8E81"
              value={number}
              onChangeText={setNumber}
            />

            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              placeholder="optional"
              placeholderTextColor="#9F8E81"
              value={country}
              onChangeText={setCountry}
            />

            <View style={styles.row2}>
              <View style={styles.col}>
                <Text style={styles.label}>Issue date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9F8E81"
                  value={issueDate}
                  onChangeText={setIssueDate}
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Expiry date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9F8E81"
                  value={expiryDate}
                  onChangeText={setExpiryDate}
                />
              </View>
            </View>

            <Text style={styles.label}>Reminder (days out)</Text>
            <TextInput
              style={styles.input}
              placeholder="90"
              placeholderTextColor="#9F8E81"
              value={reminderDays}
              onChangeText={setReminderDays}
              keyboardType="number-pad"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.save, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveText}>
                {saving ? 'Saving...' : 'Save document'}
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
