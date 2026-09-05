import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  createAppliance, getAppliance, updateAppliance, getProperties,
  type ApplianceCategory, type ApplianceCondition,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const CATEGORIES: ApplianceCategory[] = ['hvac', 'kitchen', 'laundry', 'plumbing', 'electrical', 'outdoor', 'other'];
const CONDITIONS: ApplianceCondition[] = ['new', 'good', 'fair', 'poor', 'replaced'];

export default function AddApplianceScreen() {
  const { id, propertyId: paramPropId } = useLocalSearchParams<{ id?: string; propertyId?: string }>();
  const db = useDatabase();
  const router = useRouter();
  const isEdit = !!id;
  const properties = useMemo(() => getProperties(db), [db]);

  const [propId, setPropId] = useState(paramPropId ?? properties[0]?.id ?? '');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [category, setCategory] = useState<ApplianceCategory>('other');
  const [condition, setCondition] = useState<ApplianceCondition>('good');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (id) {
      const a = getAppliance(db, id);
      if (a) {
        setPropId(a.propertyId); setName(a.name); setBrand(a.brand ?? '');
        setModelNumber(a.modelNumber ?? ''); setSerialNumber(a.serialNumber ?? '');
        setCategory(a.category); setCondition(a.condition);
        setWarrantyExpiry(a.warrantyExpiry ?? ''); setNotes(a.notes ?? '');
      }
    }
  }, [id, db]);

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Required', 'Name is required.'); return; }
    const data = {
      propertyId: propId, name: name.trim(), category, condition,
      brand: brand.trim() || undefined, modelNumber: modelNumber.trim() || undefined,
      serialNumber: serialNumber.trim() || undefined,
      warrantyExpiry: warrantyExpiry.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    if (isEdit && id) { updateAppliance(db, id, data); }
    else { createAppliance(db, uuid(), data); }
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{isEdit ? 'Edit Appliance' : 'Add Appliance'}</Text>

      <Text variant="label" color={colors.textSecondary}>Name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Refrigerator" placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Brand</Text>
      <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Model Number</Text>
      <TextInput style={styles.input} value={modelNumber} onChangeText={setModelNumber} placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Category</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <Pressable key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
            <Text variant="label" color={category === c ? colors.background : colors.textSecondary} style={{ fontSize: 11 }}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary}>Condition</Text>
      <View style={styles.chipRow}>
        {CONDITIONS.map((c) => (
          <Pressable key={c} style={[styles.chip, condition === c && styles.chipActive]} onPress={() => setCondition(c)}>
            <Text variant="label" color={condition === c ? colors.background : colors.textSecondary}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text variant="label" color={colors.textSecondary}>Warranty Expiry</Text>
      <TextInput style={styles.input} value={warrantyExpiry} onChangeText={setWarrantyExpiry}
        placeholder="YYYY-MM-DD" placeholderTextColor={colors.textTertiary} />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text variant="label" color={colors.background}>{isEdit ? 'Save' : 'Add Appliance'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.glassBorder, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, color: colors.text, backgroundColor: 'rgba(255,255,255,0.06)' },
  chipRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.glassStrong, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: ACCENT },
  saveButton: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.md },
});
