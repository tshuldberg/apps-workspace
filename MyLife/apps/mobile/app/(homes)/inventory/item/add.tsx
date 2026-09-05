import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { uuid } from '../../../../lib/uuid';
import {
  createInventoryItem, getInventoryItem, updateInventoryItem,
  getProperties, getRoomsForProperty,
  type ItemCategory, type Condition,
} from '@mylife/homes';

const ACCENT = colors.modules.homes;
const CATEGORIES: ItemCategory[] = ['furniture', 'electronics', 'appliance', 'clothing', 'jewelry', 'art', 'tool', 'sporting', 'other'];
const CONDITIONS: Condition[] = ['new', 'good', 'fair', 'poor'];

export default function AddInventoryItem() {
  const { id, propertyId: paramPropId, roomId: paramRoomId } = useLocalSearchParams<{
    id?: string; propertyId?: string; roomId?: string;
  }>();
  const db = useDatabase();
  const router = useRouter();
  const isEdit = !!id;
  const properties = useMemo(() => getProperties(db), [db]);
  const propId = paramPropId ?? properties[0]?.id ?? '';
  const rooms = useMemo(() => propId ? getRoomsForProperty(db, propId) : [], [db, propId]);

  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState(paramRoomId ?? rooms[0]?.id ?? '');
  const [category, setCategory] = useState<ItemCategory>('other');
  const [condition, setCondition] = useState<Condition>('good');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (id) {
      const item = getInventoryItem(db, id);
      if (item) {
        setName(item.name); setRoomId(item.roomId); setCategory(item.category);
        setCondition(item.condition); setBrand(item.brand ?? ''); setModel(item.model ?? '');
        setValue(item.estimatedValueCents ? String(item.estimatedValueCents / 100) : '');
        setNotes(item.notes ?? '');
      }
    }
  }, [id, db]);

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Required', 'Name is required.'); return; }
    if (!roomId) { Alert.alert('Required', 'Select a room.'); return; }
    const data = {
      roomId, propertyId: propId, name: name.trim(), category, condition,
      brand: brand.trim() || undefined, model: model.trim() || undefined,
      estimatedValueCents: value ? Math.round(Number(value) * 100) : undefined,
      notes: notes.trim() || undefined,
    };
    if (isEdit && id) { updateInventoryItem(db, id, data); }
    else { createInventoryItem(db, uuid(), data); }
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text variant="heading">{isEdit ? 'Edit Item' : 'Add Item'}</Text>

      <Text variant="label" color={colors.textSecondary}>Name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.textTertiary} />

      {rooms.length > 0 && (
        <>
          <Text variant="label" color={colors.textSecondary}>Room *</Text>
          <View style={styles.chipRow}>
            {rooms.map((r) => (
              <Pressable key={r.id} style={[styles.chip, roomId === r.id && styles.chipActive]} onPress={() => setRoomId(r.id)}>
                <Text variant="label" color={roomId === r.id ? colors.background : colors.textSecondary}>{r.name}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

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

      <Text variant="label" color={colors.textSecondary}>Brand</Text>
      <TextInput style={styles.input} value={brand} onChangeText={setBrand} placeholderTextColor={colors.textTertiary} />

      <Text variant="label" color={colors.textSecondary}>Estimated Value ($)</Text>
      <TextInput style={styles.input} value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholderTextColor={colors.textTertiary} />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text variant="label" color={colors.background}>{isEdit ? 'Save' : 'Add Item'}</Text>
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
