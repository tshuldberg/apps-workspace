import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  deleteSize,
  getSizeById,
  updateSize,
  type Size,
  type SizeType,
} from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

const SIZE_TYPES: Array<{ key: SizeType; label: string }> = [
  { key: 'clothing', label: 'Clothing' },
  { key: 'shoe', label: 'Shoe' },
  { key: 'ring', label: 'Ring' },
  { key: 'other', label: 'Other' },
];

function formatMs(ms: number | null): string {
  if (ms == null) return 'never';
  return new Date(ms).toISOString().slice(0, 10);
}

export default function EditSizeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const size = useMemo<Size | null>(() => {
    if (!id) return null;
    try {
      return getSizeById(db, id);
    } catch {
      return null;
    }
  }, [db, id]);

  const [type, setType] = useState<SizeType>('clothing');
  const [brand, setBrand] = useState('');
  const [sizeValue, setSizeValue] = useState('');
  const [fitNotes, setFitNotes] = useState('');
  const [markVerified, setMarkVerified] = useState(false);

  useEffect(() => {
    if (!size) return;
    setType(size.type);
    setBrand(size.brand);
    setSizeValue(size.sizeValue);
    setFitNotes(size.fitNotes ?? '');
    setMarkVerified(false);
  }, [size]);

  if (!id || !size) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Size not found.</Text>
      </View>
    );
  }

  const canSave = brand.trim().length > 0 && sizeValue.trim().length > 0;

  const handleSave = () => {
    if (!canSave) {
      Alert.alert('Required', 'Brand and size value are required.');
      return;
    }
    try {
      updateSize(db, id, {
        type,
        brand: brand.trim(),
        sizeValue: sizeValue.trim(),
        fitNotes: fitNotes.trim() || null,
        ...(markVerified ? { lastVerified: Date.now() } : {}),
      });
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete size', `Remove ${size.brand} ${size.sizeValue}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteSize(db, id);
          router.replace('/(shop)/sizes');
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.panel}>
        <Text style={styles.title}>Type</Text>
        <View style={styles.pillRow}>
          {SIZE_TYPES.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.pill, type === t.key && styles.pillActive]}
              onPress={() => setType(t.key)}
            >
              <Text
                style={[styles.pillText, type === t.key && styles.pillTextActive]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Brand + size</Text>
        <Text style={styles.label}>Brand *</Text>
        <TextInput
          style={styles.input}
          value={brand}
          onChangeText={setBrand}
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={styles.label}>Size value *</Text>
        <TextInput
          style={styles.input}
          value={sizeValue}
          onChangeText={setSizeValue}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Fit notes</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={fitNotes}
          onChangeText={setFitNotes}
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </View>

      <View style={styles.panel}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Mark verified today</Text>
            <Text style={styles.helper}>
              Last verified: {formatMs(size.lastVerified)}
            </Text>
          </View>
          <Switch
            value={markVerified}
            onValueChange={setMarkVerified}
            trackColor={{ true: SHOP_ACCENT, false: surfaceTiers.low }}
          />
        </View>
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
          <Text style={styles.primaryButtonText}>Save changes</Text>
        </Pressable>
      </View>

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteText}>Delete size</Text>
      </Pressable>
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surfaceTiers.lowest,
  },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
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
  },
  pillTextActive: { color: '#0E0E13' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
});
