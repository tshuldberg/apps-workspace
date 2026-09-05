import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { createSize, type SizeType } from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

const SIZE_TYPES: Array<{ key: SizeType; label: string }> = [
  { key: 'clothing', label: 'Clothing' },
  { key: 'shoe', label: 'Shoe' },
  { key: 'ring', label: 'Ring' },
  { key: 'other', label: 'Other' },
];

export default function AddSizeScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [type, setType] = useState<SizeType>('clothing');
  const [brand, setBrand] = useState('');
  const [sizeValue, setSizeValue] = useState('');
  const [fitNotes, setFitNotes] = useState('');
  const [verifyToday, setVerifyToday] = useState(false);

  const canSave = brand.trim().length > 0 && sizeValue.trim().length > 0;

  const handleSave = () => {
    if (!canSave) {
      Alert.alert('Required', 'Brand and size value are required.');
      return;
    }
    try {
      createSize(db, {
        type,
        brand: brand.trim(),
        sizeValue: sizeValue.trim(),
        fitNotes: fitNotes.trim() || null,
        lastVerified: verifyToday ? Date.now() : null,
      });
      router.replace('/(shop)/sizes');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save.');
    }
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
          placeholder="Nike"
          placeholderTextColor={colors.textSecondary}
          autoFocus
        />
        <Text style={styles.label}>Size value *</Text>
        <TextInput
          style={styles.input}
          value={sizeValue}
          onChangeText={setSizeValue}
          placeholder="M, 10.5, 7, 32W 30L..."
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Fit notes</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={fitNotes}
          onChangeText={setFitNotes}
          placeholder="runs small, tight in shoulders, long sleeves..."
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </View>

      <View style={styles.panel}>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Mark verified today</Text>
            <Text style={styles.helper}>
              Records a last-verified timestamp so older sizes can be flagged.
            </Text>
          </View>
          <Switch
            value={verifyToday}
            onValueChange={setVerifyToday}
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
          <Text style={styles.primaryButtonText}>Save size</Text>
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
});
