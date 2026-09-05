import { useCallback, useState } from 'react';
import { View, ScrollView, TextInput, Switch, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, Card, Button, EmptyState } from '@mylife/ui';
import { getPinById, setPinShareable, softDeletePin, updatePin, type PinRow } from '@mylife/manhattan';
import { useManhattanDatabase } from '../providers/DatabaseProvider';
import { EntityTags } from '../components/EntityTags';

export default function PinDetailScreen() {
  const db = useManhattanDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pin, setPin] = useState<PinRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [category, setCategory] = useState('');

  const refresh = useCallback(() => {
    if (!id) return;
    const found = getPinById(db, id);
    setPin(found);
    if (found && !loaded) {
      setName(found.name);
      setNeighborhood(found.neighborhood ?? '');
      setCategory(found.category ?? '');
      setLoaded(true);
    }
  }, [db, id, loaded]);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!id || !pin || !canSave) return;
    updatePin(db, id, {
      name: name.trim(),
      neighborhood: neighborhood.trim() || null,
      category: category.trim() || null,
      lat: pin.lat,
      lng: pin.lng,
      photoRef: pin.photo_ref,
      isShareable: pin.is_shareable === 1,
    });
    refresh();
  };

  const handleToggleShareable = (value: boolean) => {
    if (!id) return;
    setPinShareable(db, id, value);
    refresh();
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert('Delete spot?', 'This removes the pin from your list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          softDeletePin(db, id);
          router.back();
        },
      },
    ]);
  };

  if (!pin) {
    return (
      <View style={styles.center}>
        <EmptyState title="Spot not found" message="This pin may have been deleted." />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text variant="heading">{name.trim() || pin.name}</Text>

      <Card>
        <View style={styles.field}>
          <Text variant="label" color="#9F8E81">Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Spot name"
            placeholderTextColor="#52443A"
          />
        </View>
        <View style={styles.field}>
          <Text variant="label" color="#9F8E81">Neighborhood</Text>
          <TextInput
            style={styles.input}
            value={neighborhood}
            onChangeText={setNeighborhood}
            placeholder="NoHo"
            placeholderTextColor="#52443A"
          />
        </View>
        <View style={styles.field}>
          <Text variant="label" color="#9F8E81">Category</Text>
          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder="Gym, Bar, Venue"
            placeholderTextColor="#52443A"
          />
        </View>
      </Card>

      <EntityTags entityType="pin" entityId={pin.id} />

      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <Text variant="body">Share in plans</Text>
          <Text variant="caption" color="#9F8E81">
            Let this spot be suggested when planning outings.
          </Text>
        </View>
        <Switch
          value={pin.is_shareable === 1}
          accessibilityLabel="Share in plans"
          onValueChange={handleToggleShareable}
          trackColor={{ false: '#2A292F', true: '#E4572E' }}
          thumbColor="#E4E1E9"
        />
      </View>

      <View style={styles.actions}>
        <Button title="Save changes" onPress={handleSave} disabled={!canSave} />
        <Button title="Delete" variant="danger" onPress={handleDelete} />
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131318' },
  content: { padding: 20, paddingTop: 64, gap: 16 },
  center: { flex: 1, justifyContent: 'center', backgroundColor: '#131318' },
  field: { gap: 4, marginBottom: 8 },
  input: {
    backgroundColor: '#1F1F25',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#E4E1E9',
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  switchCopy: { flex: 1, gap: 2 },
  actions: { marginTop: 8, gap: 10 },
});
