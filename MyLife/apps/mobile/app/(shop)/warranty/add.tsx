import { useEffect, useMemo, useState } from 'react';
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
import {
  createWarranty,
  getPurchaseById,
  listPurchases,
  type CoverageType,
  type Purchase,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

const COVERAGE_TYPES: CoverageType[] = [
  'manufacturer',
  'extended',
  'protection',
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoToMs(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
  );
}

export default function AddWarrantyScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ purchaseId?: string }>();
  const initialPurchaseId = Array.isArray(params.purchaseId)
    ? params.purchaseId[0]
    : params.purchaseId;

  const [purchaseId, setPurchaseId] = useState<string | null>(
    initialPurchaseId ?? null,
  );
  const [itemName, setItemName] = useState('');
  const [coverageType, setCoverageType] = useState<CoverageType>('manufacturer');
  const [startDate, setStartDate] = useState(todayIso());
  const [expiryDate, setExpiryDate] = useState('');
  const [coverageDetails, setCoverageDetails] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [reminderDays, setReminderDays] = useState('30');
  const [showPurchasePicker, setShowPurchasePicker] = useState(false);

  const purchases = useMemo<Purchase[]>(() => {
    try {
      return listPurchases(db);
    } catch {
      return [];
    }
  }, [db]);

  const selectedPurchase = useMemo(() => {
    if (!purchaseId) return null;
    try {
      return getPurchaseById(db, purchaseId);
    } catch {
      return null;
    }
  }, [db, purchaseId]);

  // Prefill from linked purchase if present.
  useEffect(() => {
    if (!selectedPurchase) return;
    if (!itemName) setItemName(selectedPurchase.name);
    if (selectedPurchase.purchaseDate) {
      setStartDate(selectedPurchase.purchaseDate.slice(0, 10));
    }
  }, [selectedPurchase]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave =
    itemName.trim().length > 0 &&
    isoToMs(startDate) != null &&
    isoToMs(expiryDate) != null;

  const handleSave = () => {
    const startMs = isoToMs(startDate);
    const expiryMs = isoToMs(expiryDate);
    if (!itemName.trim() || startMs == null || expiryMs == null) {
      Alert.alert('Required', 'Item name, start, and expiry dates are required.');
      return;
    }
    if (expiryMs < startMs) {
      Alert.alert('Invalid dates', 'Expiry must be on or after start date.');
      return;
    }
    const reminder = Number(reminderDays);
    try {
      const w = createWarranty(db, {
        purchaseId: purchaseId ?? null,
        itemName: itemName.trim(),
        coverageType,
        startDate: startMs,
        expiryDate: expiryMs,
        coverageDetailsMd: coverageDetails.trim() || null,
        serialNumber: serialNumber.trim() || null,
        registrationNumber: registrationNumber.trim() || null,
        reminderDaysBefore:
          Number.isFinite(reminder) && reminder >= 0 ? Math.floor(reminder) : 30,
      });
      router.replace(`/(shop)/warranty/${w.id}`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save.');
    }
  };

  const stepReminder = (delta: number) => {
    const n = Number(reminderDays);
    const next = Math.max(0, (Number.isFinite(n) ? n : 30) + delta);
    setReminderDays(String(next));
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.panel}>
        <Text style={styles.title}>Link a purchase</Text>
        <Text style={styles.helper}>
          Optional. Linking pre-fills the item name and start date from your
          purchase journal.
        </Text>
        {selectedPurchase ? (
          <View style={styles.linkedRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkedName}>{selectedPurchase.name}</Text>
              <Text style={styles.linkedMeta}>
                {selectedPurchase.purchaseDate.slice(0, 10)}
                {selectedPurchase.store ? ` · ${selectedPurchase.store}` : ''}
              </Text>
            </View>
            <Pressable
              style={styles.secondaryButtonSmall}
              onPress={() => {
                setPurchaseId(null);
                setShowPurchasePicker(false);
              }}
            >
              <Text style={styles.secondaryButtonText}>Clear</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setShowPurchasePicker((s) => !s)}
          >
            <Text style={styles.secondaryButtonText}>
              {showPurchasePicker ? 'Hide purchases' : 'Pick from purchases'}
            </Text>
          </Pressable>
        )}
        {showPurchasePicker && !selectedPurchase ? (
          <View style={styles.pickerList}>
            {purchases.length === 0 ? (
              <Text style={styles.helper}>No purchases logged yet.</Text>
            ) : (
              purchases.slice(0, 25).map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.pickerRow}
                  onPress={() => {
                    setPurchaseId(p.id);
                    setShowPurchasePicker(false);
                  }}
                >
                  <Text style={styles.pickerName}>{p.name}</Text>
                  <Text style={styles.pickerDate}>
                    {p.purchaseDate.slice(0, 10)}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Item + coverage</Text>
        <Text style={styles.label}>Item name *</Text>
        <TextInput
          style={styles.input}
          value={itemName}
          onChangeText={setItemName}
          placeholder="MacBook Pro 14"
          placeholderTextColor={colors.textSecondary}
          autoFocus
        />
        <Text style={styles.label}>Coverage type</Text>
        <View style={styles.pillRow}>
          {COVERAGE_TYPES.map((c) => (
            <Pressable
              key={c}
              style={[styles.pill, coverageType === c && styles.pillActive]}
              onPress={() => setCoverageType(c)}
            >
              <Text
                style={[
                  styles.pillText,
                  coverageType === c && styles.pillTextActive,
                ]}
              >
                {c}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Dates</Text>
        <Text style={styles.label}>Start date *</Text>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={styles.label}>Expiry date *</Text>
        <TextInput
          style={styles.input}
          value={expiryDate}
          onChangeText={setExpiryDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Identifiers</Text>
        <Text style={styles.label}>Serial number</Text>
        <TextInput
          style={styles.input}
          value={serialNumber}
          onChangeText={setSerialNumber}
          placeholder="C02XG..."
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="characters"
        />
        <Text style={styles.label}>Registration number</Text>
        <TextInput
          style={styles.input}
          value={registrationNumber}
          onChangeText={setRegistrationNumber}
          placeholder="APL-..."
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Coverage details</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={coverageDetails}
          onChangeText={setCoverageDetails}
          placeholder="1-year limited, accidental damage excluded..."
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Reminder lead time</Text>
        <Text style={styles.helper}>
          MyShop flags this warranty in the expiring-soon list this many days
          before expiry.
        </Text>
        <View style={styles.stepperRow}>
          <Pressable
            style={styles.stepperButton}
            onPress={() => stepReminder(-7)}
          >
            <Text style={styles.stepperLabel}>-7</Text>
          </Pressable>
          <Pressable
            style={styles.stepperButton}
            onPress={() => stepReminder(-1)}
          >
            <Text style={styles.stepperLabel}>-1</Text>
          </Pressable>
          <TextInput
            style={[styles.input, styles.stepperValue]}
            value={reminderDays}
            onChangeText={setReminderDays}
            keyboardType="number-pad"
          />
          <Pressable
            style={styles.stepperButton}
            onPress={() => stepReminder(1)}
          >
            <Text style={styles.stepperLabel}>+1</Text>
          </Pressable>
          <Pressable
            style={styles.stepperButton}
            onPress={() => stepReminder(7)}
          >
            <Text style={styles.stepperLabel}>+7</Text>
          </Pressable>
        </View>
        <Text style={styles.helper}>
          {reminderDays || '0'} days before expiry
        </Text>
      </View>

      <View style={styles.navRow}>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.primaryButtonText}>Save warranty</Text>
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
  panel: {
    gap: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  helper: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
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
  inputMulti: { minHeight: 90, textAlignVertical: 'top' },
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
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkedName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  linkedMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  pickerList: { gap: 4, maxHeight: 240 },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerName: { color: colors.text, fontSize: 13, fontWeight: '700', flex: 1 },
  pickerDate: { color: colors.textSecondary, fontSize: 12 },
  stepperRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  stepperButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperLabel: { color: colors.text, fontSize: 13, fontWeight: '700' },
  stepperValue: { flex: 1, textAlign: 'center' },
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
  secondaryButtonSmall: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
