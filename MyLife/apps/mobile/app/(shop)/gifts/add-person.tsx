import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createGiftPerson } from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

const OCCASIONS = [
  'birthday',
  'holiday',
  'graduation',
  'housewarming',
  'thank_you',
  'other',
];

function parseDateISO(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  return Number.isNaN(ts) ? null : ts;
}

export default function AddPersonScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [occasion, setOccasion] = useState<string | null>(null);
  const [dateInput, setDateInput] = useState('');

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) {
      Alert.alert('Required', 'Name is required.');
      return;
    }
    const occasionDate = parseDateISO(dateInput);
    if (dateInput.trim() && occasionDate == null) {
      Alert.alert('Invalid date', 'Use a YYYY-MM-DD date or leave blank.');
      return;
    }
    try {
      createGiftPerson(db, {
        name: name.trim(),
        relationship: relationship.trim() || null,
        nextOccasion: occasion,
        nextOccasionDate: occasionDate,
      });
      router.replace('/(shop)/gifts');
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
        <Text style={styles.title}>Person</Text>
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Sarah"
          placeholderTextColor={colors.textSecondary}
          autoFocus
        />
        <Text style={styles.label}>Relationship</Text>
        <TextInput
          style={styles.input}
          value={relationship}
          onChangeText={setRelationship}
          placeholder="sister, friend, partner..."
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>Next occasion</Text>
        <View style={styles.pillRow}>
          {OCCASIONS.map((o) => (
            <Pressable
              key={o}
              style={[styles.pill, occasion === o && styles.pillActive]}
              onPress={() => setOccasion(occasion === o ? null : o)}
            >
              <Text
                style={[styles.pillText, occasion === o && styles.pillTextActive]}
              >
                {o.replace('_', ' ')}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={dateInput}
          onChangeText={setDateInput}
          placeholder="2026-12-25"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
        />
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
          <Text style={styles.primaryButtonText}>Save person</Text>
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
  pillText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
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
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
