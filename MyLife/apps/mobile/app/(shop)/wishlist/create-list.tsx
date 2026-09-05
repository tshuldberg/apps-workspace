import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createWishlist, type Occasion } from '@mylife/shop';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SHOP_ACCENT } from '../_ui';

const OCCASIONS: Occasion[] = [
  'birthday',
  'holiday',
  'graduation',
  'housewarming',
  'thank_you',
  'general',
  'other',
];

export default function CreateWishlistScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [occasion, setOccasion] = useState<Occasion | null>(null);
  const [personId, setPersonId] = useState('');

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Give your wishlist a name.');
      return;
    }
    try {
      const list = createWishlist(db, {
        name: name.trim(),
        description: description.trim() || null,
        occasion,
        personId: personId.trim() || null,
      });
      router.replace(`/(shop)/wishlist/${list.id}`);
    } catch (e) {
      Alert.alert('Error', "Couldn't create wishlist.");
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>New wishlist</Text>
      <Text style={styles.subtitle}>
        Group wishes by occasion, person, or theme. You can toggle sharing later.
      </Text>

      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Birthday 2026"
        placeholderTextColor={colors.textSecondary}
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        placeholder="What is this list for?"
        placeholderTextColor={colors.textSecondary}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.label}>Occasion</Text>
      <View style={styles.pillRow}>
        <Pressable
          style={[styles.pill, occasion === null && styles.pillActive]}
          onPress={() => setOccasion(null)}
        >
          <Text style={[styles.pillText, occasion === null && styles.pillTextActive]}>None</Text>
        </Pressable>
        {OCCASIONS.map((o) => (
          <Pressable
            key={o}
            style={[styles.pill, occasion === o && styles.pillActive]}
            onPress={() => setOccasion(o)}
          >
            <Text style={[styles.pillText, occasion === o && styles.pillTextActive]}>
              {o.replace('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Gift for person (optional ID)</Text>
      <TextInput
        style={styles.input}
        placeholder="Friends module person id"
        placeholderTextColor={colors.textSecondary}
        value={personId}
        onChangeText={setPersonId}
        autoCapitalize="none"
      />

      <Pressable style={styles.primaryButton} onPress={handleCreate}>
        <Text style={styles.primaryButtonText}>Create wishlist</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 160, gap: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  label: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },
  input: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
  },
  inputMulti: { minHeight: 84, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: SHOP_ACCENT, borderColor: SHOP_ACCENT },
  pillText: { color: colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  pillTextActive: { color: '#0E0E13' },
  primaryButton: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: SHOP_ACCENT,
  },
  primaryButtonText: { color: '#0E0E13', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
