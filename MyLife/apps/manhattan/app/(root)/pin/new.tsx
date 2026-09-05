import { useState } from 'react';
import { View, ScrollView, TextInput, Switch, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Button } from '@mylife/ui';
import { createPin } from '@mylife/manhattan';
import { useManhattanDatabase } from '../providers/DatabaseProvider';

export default function NewPinScreen() {
  const db = useManhattanDatabase();
  const router = useRouter();
  const [name, setName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [category, setCategory] = useState('');
  const [isShareable, setIsShareable] = useState(false);

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    createPin(db, {
      name: name.trim(),
      neighborhood: neighborhood.trim() || null,
      category: category.trim() || null,
      isShareable,
    });
    router.back();
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="heading" style={styles.title}>Add spot</Text>

      <Text variant="label" color="#9F8E81">Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Equinox Bond Street"
        placeholderTextColor="#52443A"
        autoFocus
      />

      <Text variant="label" color="#9F8E81">Neighborhood</Text>
      <TextInput
        style={styles.input}
        value={neighborhood}
        onChangeText={setNeighborhood}
        placeholder="NoHo"
        placeholderTextColor="#52443A"
      />

      <Text variant="label" color="#9F8E81">Category</Text>
      <TextInput
        style={styles.input}
        value={category}
        onChangeText={setCategory}
        placeholder="Gym, Bar, Venue"
        placeholderTextColor="#52443A"
      />

      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <Text variant="body">Share in plans</Text>
          <Text variant="caption" color="#9F8E81">
            Let this spot be suggested when planning outings.
          </Text>
        </View>
        <Switch
          value={isShareable}
          accessibilityLabel="Share in plans"
          onValueChange={setIsShareable}
          trackColor={{ false: '#2A292F', true: '#E4572E' }}
          thumbColor="#E4E1E9"
        />
      </View>

      <View style={styles.actions}>
        <Button title="Save spot" onPress={handleSave} disabled={!canSave} />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131318' },
  content: { padding: 20, paddingTop: 64, gap: 8 },
  title: { marginBottom: 8 },
  input: {
    backgroundColor: '#1F1F25',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#E4E1E9',
    fontSize: 16,
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginVertical: 8,
  },
  switchCopy: { flex: 1, gap: 2 },
  actions: { marginTop: 16, gap: 10 },
});
