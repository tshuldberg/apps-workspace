import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  createCostEntry, getCostEntry, updateCostEntry, getProperties,
  type CostCategory,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const CATEGORIES: CostCategory[] = ['maintenance', 'repair', 'improvement', 'utility', 'other'];

export default function AddCostScreen() {
  const { id, propertyId: paramPropId, scheduleId } = useLocalSearchParams<{
    id?: string; propertyId?: string; scheduleId?: string;
  }>();
  const db = useDatabase();
  const router = useRouter();
  const isEdit = !!id;

  const properties = useMemo(() => getProperties(db), [db]);
  const [propId, setPropId] = useState(paramPropId ?? properties[0]?.id ?? '');
  const [category, setCategory] = useState<CostCategory>('maintenance');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [costDate, setCostDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (id) {
      const existing = getCostEntry(db, id);
      if (existing) {
        setPropId(existing.propertyId);
        setCategory(existing.category);
        setDescription(existing.description);
        setAmount(String(existing.amountCents / 100));
        setVendor(existing.vendor ?? '');
        setCostDate(existing.costDate.slice(0, 10));
      }
    }
  }, [id, db]);

  const handleSave = () => {
    if (!description.trim()) { Alert.alert('Required', 'Description is required.'); return; }
    const cents = Math.max(0, Math.round(Number(amount) * 100));
    if (cents <= 0) { Alert.alert('Required', 'Amount must be positive.'); return; }

    const data = {
      propertyId: propId,
      scheduleId: scheduleId || undefined,
      category,
      description: description.trim(),
      amountCents: cents,
      vendor: vendor.trim() || undefined,
      costDate,
    };

    if (isEdit && id) {
      updateCostEntry(db, id, data);
    } else {
      createCostEntry(db, uuid(), data);
    }
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{isEdit ? 'Edit Cost' : 'Log Cost'}</Text>

      <Text variant="label" color={colors.textSecondary}>Description *</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription}
        placeholder="HVAC service call" placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Amount ($) *</Text>
      <TextInput style={styles.input} value={amount} onChangeText={setAmount}
        keyboardType="decimal-pad" placeholder="150.00" placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Category</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <Pressable key={c} style={[styles.chip, category === c && styles.chipActive]}
            onPress={() => setCategory(c)}>
            <Text variant="label" color={category === c ? colors.background : colors.textSecondary}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary}>Vendor</Text>
      <TextInput style={styles.input} value={vendor} onChangeText={setVendor}
        placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Date</Text>
      <TextInput style={styles.input} value={costDate} onChangeText={setCostDate}
        placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text variant="label" color={colors.background}>{isEdit ? 'Save' : 'Log Cost'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 8,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chip: {
    backgroundColor: colors.glassStrong, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  chipActive: { backgroundColor: ACCENT },
  saveButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.md,
  },
});
